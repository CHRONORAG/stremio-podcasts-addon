const request = require("request-promise");

class Spreaker {
    constructor() {
        this.url = "https://api.spreaker.com";
        this.api_v2 = `${this.url}/v2`;
    }

    getAllCategories() {
        return this.queryAPI("/show-categories");
    }

    queryAPI(path) {
        return this.sendGet(`${this.api_v2}${path}`);
    }

    sendGet(url, json = true) {
        return request(url, {
            headers: {
                'User-Agent': 'Stremio podcasts addon'
            },
            json: true
        });
    }

    searchShows(query) {
        return this.queryAPI(`/search?type=shows&q=${query}&limit=50`);
    }

    getShowDetails(showId) {
        return this.queryAPI("/shows/" + showId);
    }

    getEpisodes(showId) {
        return this.queryAPI(`/shows/${showId}/episodes?sorting=oldest&limit=100`);
    }

    getEpisode(episodeId) {
        return this.queryAPI("/episodes/" + episodeId);
    }

    getShows(categoryId, count, lastId = null) {
        return this.queryAPI(`/explore/categories/${categoryId}/items?limit=${count}` + (lastId ? `&last_id=${lastId}` : ""));
    }

    getRootCategories() {
        return this.getAllCategories()
            .then(res => res.response.categories.filter(category => category.level === 1));
    }

    getCategoryItems(categoryId, limit = 50) {
        return this.queryAPI(`/explore/categories/${categoryId}/items?limit=${limit}`);
    }

    /**
     * Spreaker removed its editor-curated explore lists (211 = top, 214 = popular,
     * 108 = recommended); all of them now return 404. Rebuild a "top shows" feed by
     * interleaving the newest shows from every root category instead.
     */
    getTopShows(limit = 50, skip = 0) {
        return this.getRootCategories()
            .then(categories => {
                const perCategory = Math.max(2, Math.ceil((skip + limit) / categories.length));
                return Promise.all(categories.map(category =>
                    this.getCategoryItems(category.category_id, perCategory)
                        .then(res => res.response.items || [])
                        .catch(() => [])   // one dead category must not kill the whole catalog
                ));
            })
            .then(lists => {
                // walk the category lists in lockstep so the result mixes genres,
                // dropping shows that appear in more than one category
                const merged = [];
                const seen = new Set();
                const longest = lists.reduce((max, list) => Math.max(max, list.length), 0);
                for (let i = 0; i < longest; i++) {
                    for (const list of lists) {
                        const show = list[i];
                        if (!show || seen.has(show.show_id)) continue;
                        seen.add(show.show_id);
                        merged.push(show);
                    }
                }
                return {response: {items: merged.slice(skip, skip + limit), next_url: null}};
            });
    }

    /** Kept as aliases: both editors' lists are gone, so both fall back to the rebuilt top feed. */
    getRecommended(limit = 50, skip = 0) {
        return this.getTopShows(limit, skip);
    }

    getPopular(limit = 50, skip = 0) {
        return this.getTopShows(limit, skip);
    }
}

module.exports = Spreaker;
