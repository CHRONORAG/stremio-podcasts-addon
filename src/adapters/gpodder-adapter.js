const BaseAdapter = require("./base-adapter");
const Gpodder = require("../providers/gpodder");
const Parser = require("rss-parser");
const {b64decode, b64encode, toHumanReadableFileSize} = require("../helpers");

const feedParser = new Parser({timeout: 30000});

/**
 * Pull a playable audio reference out of an RSS item.
 * Returns null when the item carries no audio at all, so the caller can drop it.
 */
function getEnclosure(item) {
    if (item.enclosure && item.enclosure.url) {
        return {
            url: item.enclosure.url,
            type: item.enclosure.type || "audio/mpeg",
            length: item.enclosure.length
        };
    }

    // some feeds only expose the audio as a plain link on the item
    if (item.link && /\.(mp3|m4a|m4b|ogg|oga|opus|aac|wav|flac)(\?|#|$)/i.test(item.link)) {
        return {url: item.link, type: "audio/mpeg", length: undefined};
    }

    return null;
}

function getOwner(feed) {
    const itunes = feed.itunes || {};
    return itunes.author || (itunes.owner && itunes.owner.name) || undefined;
}

function getImage(feed) {
    return (feed.itunes && itunesImage(feed)) || (feed.image && feed.image.url) || undefined;
}

function itunesImage(feed) {
    const image = feed.itunes.image;
    return typeof image === "string" ? image : (image && image.url) || undefined;
}

class GpodderAdapter extends BaseAdapter{
    constructor() {
        super();
        this.provider = new Gpodder();
    }

    /**
     * Returns all genres to be used in the manifest
     * @return {Promise<Uint8Array | BigInt64Array | *[] | Float64Array | Int8Array | Float32Array | Int32Array | Uint32Array | Uint8ClampedArray | BigUint64Array | Int16Array | Uint16Array>}
     */
    async getGenres() {
        return (await this.provider.getAllCategories()).map(category => category.title);
    }

    /**
     * Summarized collection of meta items
     * @param args
     * @return {Promise<Uint8Array | BigInt64Array | {genres: (*|string), background: *, name: *, posterShape: string, logo: *, description: string | string, id: string, type: string, poster: *}[] | Float64Array | Int8Array | Float32Array | Int32Array | Uint32Array | Uint8ClampedArray | BigUint64Array | Int16Array | Uint16Array>}
     */
    async getSummarizedMetaDataCollection(args) {
        const count = args.extra.skip || 50;

        let podcasts = args.extra.search ? await this.provider.searchPodCasts(args.extra.search) :
            args.extra.genre != null ? await this.provider.getPodCasts(args.extra.genre, count) : await this.provider.getTopPodcasts(count);

        let metas = podcasts.map(podcast => {
            return {
                id: "podcasts_gpodder_" + b64encode(podcast.url),
                type: "channel",
                genres: args.extra.genre || "Top",
                name: podcast.title,
                poster: podcast.logo_url,
                posterShape: "square",
                background: podcast.logo_url,
                logo: podcast.logo_url,
                description: podcast.description
            }
        });

        return metas;
    }

    /**
     * Detailed description of meta item
     * @param args
     * @return {Promise<{meta: {website: ((existingPath: PathLike, newPath: PathLike, callback: (err: (NodeJS.ErrnoException | null)) => void) => void) | ((existingPath: PathLike, newPath: PathLike) => Promise<void>) | link | ((url: string) => string) | string, director: string[], description: *, videos: {id: string, title: *, released: Date}[], language: *, type: string, background: (exports.GET.imageURL|imageURL|exports.CLEAN.imageURL|string), name: *, genre: string | string[] | exports.GET.categories | categories, posterShape: string, logo: (exports.GET.imageURL|imageURL|exports.CLEAN.imageURL|string), id: *, poster: (exports.GET.imageURL|imageURL|exports.CLEAN.imageURL|string)}}>}
     */
    async getMetaData(args) {
        const url = b64decode(args.id.split("_")[2]);

        let feed;
        try {
            feed = await feedParser.parseString(String(await this.provider.getPodcastFeed(url)));
        } catch (e) {
            // The gpodder directory still lists plenty of podcasts whose feeds died years ago.
            // One broken feed must not turn the whole meta request into a 500.
            console.warn(`[gpodder] could not read feed ${url}: ${e && e.message}`);
            return Promise.resolve({meta: null});
        }

        const image = getImage(feed);
        const owner = getOwner(feed);
        const episodes = (feed.items || [])
            .map(item => ({item, enclosure: getEnclosure(item)}))
            .filter(entry => entry.enclosure !== null);

        return Promise.resolve({
            meta: {
                id: args.id,
                type: "channel",
                name: feed.title,
                genres: feed.itunes && feed.itunes.categories ? feed.itunes.categories
                    : (feed.categories || []),
                poster: image,
                posterShape: "square",
                background: image,
                logo: image,
                description: feed.description || (feed.itunes && feed.itunes.subtitle) || "",
                videos: episodes.map(({item, enclosure}) => {
                    return {
                        id: "podcasts_gpodder_" + b64encode(JSON.stringify(enclosure)),
                        title: item.title,
                        released: new Date(item.isoDate || item.pubDate || Date.now())
                    }
                }),
                director: owner ? [owner] : [],
                language: feed.language,
                website: feed.link
            },
            cacheMaxAge: 3 * (24 * 3600)
        });
    }

    /**
     * Tells Stremio how to obtain the media content
     * @param args
     * @return {Promise<{streams: {title: string, url: *}[]}>}
     */
    async getStreams(args) {
        const episode = JSON.parse(b64decode(args.id.split("_")[2]));

        const size = Number(episode.length);
        const type = episode.type || "audio";
        const title = Number.isFinite(size) && size > 0
            ? `${type} (${toHumanReadableFileSize(size)})`
            : type;

        return Promise.resolve({
            streams: [
                {
                    url: episode.url,
                    title: title
                }
            ],
            cacheMaxAge: 3 * (24 * 3600)
        });
    }
}

module.exports = GpodderAdapter;
