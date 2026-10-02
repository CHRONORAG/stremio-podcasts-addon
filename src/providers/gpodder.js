const request = require("request-promise");

class Gpodder {
    constructor() {
        this.url = "https://www.gpodder.net";
        this.api_v2 = `${this.url}/api/2`;
    }

    getAllCategories() {
        return this.sendGet(`${this.api_v2}/tags/99999999.json`);
    }

    convertToTag(title) {
        const regex = /[a-z-\d]+/gm;
        let result = [];

        let m;
        while ((m = regex.exec(title.toLowerCase())) !== null) {
            result.push(m[0]);
        }

        return result.join("-");
    }

    getPodCasts(category, count = 50) {
        return this.getTagForGenre(category).then(tag =>
            this.sendGet(`${this.api_v2}/tag/${tag}/${count}.json`)
        );
    }

    /**
     * The tags endpoint returns a human readable `title` AND the real `tag` slug used in
     * the /tag/{tag}/ endpoint. Deriving the slug from the title with convertToTag() mangles
     * titles that contain punctuation ("ARts/Performing Arts" -> "arts-performing-arts",
     * which is not a real tag and silently returns an empty catalog), so match on the
     * API-provided values first and only fall back to the heuristic.
     */
    getTagForGenre(genre) {
        const norm = value => String(value).toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");

        return this.getAllCategories().then(categories => {
            if (!Array.isArray(categories)) return this.convertToTag(genre);

            const exact = categories.find(category => category.title === genre)
                || categories.find(category => category.tag === genre);
            if (exact) return exact.tag;

            const normalized = norm(genre);
            const fuzzy = categories.find(category => norm(category.title) === normalized)
                || categories.find(category => norm(category.tag) === normalized);
            if (fuzzy) return fuzzy.tag;

            return this.convertToTag(genre);
        });
    }

    sendGet(url, json = true) {
        return request(url, {
            headers: {
                'User-Agent': 'Stremio podcasts addon'
            },
            json: json === true ? true : json
        });
    }

    getTopPodcasts(count = 50) {
        return this.sendGet(`${this.url}/toplist/${count}.json`);
    }

    getPodcastFeed(url) {
        return this.sendGet(url, false);
    }

    getPodCastInfo(feedUrl) {
        return this.sendGet(`${this.api_v2}/data/podcast.json?url=${feedUrl}`);
    }

    searchPodCasts(searchTerm) {
        return this.sendGet(`${this.url}/search.json?q=${searchTerm}`);
    }
}

module.exports = Gpodder;
