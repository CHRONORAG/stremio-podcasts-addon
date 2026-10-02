# Stremio Podcasts Addon

Podcast catalogs and streams for [Stremio](https://www.stremio.com/), from two sources:

- **gpodder.net** — browse by genre, search, top podcasts, full RSS episode lists
- **Spreaker** — browse by category, search, popular shows, episode downloads and waveforms

A maintained fork of [`sleeyax/stremio-addons` → `packages/addons/podcasts`](https://github.com/sleeyax/stremio-addons/tree/master/packages/addons/podcasts),
which was archived. This fork repairs the parts that had stopped working against the current upstream APIs.

## What was fixed vs. upstream

- **Dead Spreaker endpoints.** Upstream called `/explore/lists/{211,108,214}/items` for the default
  catalog and for the *Popular* and *Recommended* genres. All three now return `404`, so those views
  failed with HTTP 500. Only `/explore/categories/{id}/items` and `/search` still exist, so "top" is now
  rebuilt by interleaving shows from all 19 root categories, deduplicated by `show_id`.
- **Feed parser crash.** Upstream depended on `podcast-feed-parser`, which throws a `TypeError` on any
  feed lacking `<itunes:owner>` — roughly 58% of the gpodder catalog, which surfaced as HTTP 500 on the
  meta request. Replaced with the maintained `rss-parser`.
- **Broken genre tags.** gpodder's tag endpoint returns both a display `title` and the real `tag` slug.
  Upstream derived the slug from the title with a regex, so `"ARts/Performing Arts"` became the
  non-existent `arts-performing-arts` and returned an empty catalog. Now the API's own `tag` is used,
  with fuzzy matching as a fallback.
- **Dead feeds no longer take down a request.** An unreachable or non-XML feed returns `{meta: null}`
  (HTTP 200) instead of an HTTP 500.
- **Boot resilience.** Genres are fetched live to build the manifest; a provider outage during startup
  now degrades to an empty genre list rather than preventing the addon from booting.

## Run locally

```bash
npm install
npm start            # or: PORT=8080 npm start
```

Then in Stremio: **Addons → Install from URL** →

```
http://127.0.0.1:50092/manifest.json
```

## Deploy

Ships with `render.yaml` for [Render](https://render.com). See the repo root for deploy instructions.

## Notes

- `request` / `request-promise` are deprecated upstream but still functional; they are retained to keep
  the diff against upstream small.
- The gpodder directory still lists podcasts whose feeds died years ago. Those now fail softly
  (`meta: null`) rather than erroring, but they will not play.

## License

MIT — inherited from the upstream project.
