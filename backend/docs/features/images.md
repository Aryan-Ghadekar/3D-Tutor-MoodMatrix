# Feature: Slide illustrations (Wikimedia Commons)

Each slide can carry one illustration found on [Wikimedia Commons](https://commons.wikimedia.org).

* **Code:** `main.py`: `search_commons_image` (cached lookup) and `get_wikimedia_images` (query building)
* **Used by:** [slide generation](slide-generation.md)
* **External call:** `GET https://commons.wikimedia.org/w/api.php` (no key required)

## 1. Algorithm

`get_wikimedia_images(topic, action_type)`:

1. Take the topic **title** (trailing "." removed). Empty title → no image.
2. Extract *significant words*: runs of ≥4 letters (hyphens allowed).
3. Build **word stems** = the first 5 letters (lower-case) of each significant word that is not a generic
   word (`introduction`, `overview`, `basics`, `fundamentals`, `concepts`, `concept`, `using`, `with`, `and`,
   `the`, `from`, `into`).
4. Build up to three queries, tried in order until one succeeds:
   1. `"<first 3 significant words> diagram"` (or the full title if there are none),
   2. the full title,
   3. the first three significant words (only when the title has more than three of them).
5. For each query call `search_commons_image(query, stems)`.

`search_commons_image` asks the MediaWiki API for the 6 best file matches in the *File* namespace
(`generator=search`, `gsrsearch="<query> filetype:bitmap|drawing"`, `prop=imageinfo`, `iiurlwidth=800`) and
returns the **first** result that passes all checks:

| Check | Why |
|---|---|
| File name (lower-cased, `_` → space) contains at least one **stem** | Keeps images relevant to the topic. Skipped if there are no stems |
| MIME type is `image/jpeg`, `image/png`, `image/gif` or `image/svg+xml` | Excludes PDFs, audio, video |
| Original width ≥ 300 px | Excludes icons |
| A thumbnail URL (800 px wide) exists | The thumbnail is what is returned |

## 2. Result

```json
{
  "id": "img_99d602fb0b",
  "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/Hash_table_....svg/960px-....png",
  "caption": "Hash Tables (Wikimedia Commons)",
  "alt": "Illustration related to Hash Tables",
  "source": "wikimedia",
  "sourcePage": "https://commons.wikimedia.org/wiki/File:Hash_table_....svg",
  "isPlaceholder": false
}
```

The slide's `images` array holds this one object, or is `[]`. There are **no placeholder images**.

> **Licensing.** Commons files have different licences (CC BY, CC BY-SA, public domain...). The service returns
> `sourcePage` (the file's description page, which lists author and licence) so the UI or a downstream consumer
> can credit the author. Add an attribution line to your UI if you redistribute slides.

## 3. Caching and its trade-off

`search_commons_image` keeps an in-memory cache keyed by `(query, stems)`:

| Outcome | Cached? | For how long |
|---|---|---|
| An image was found | yes | 24 hours (`IMAGE_HIT_TTL`) |
| The search worked but nothing relevant exists | yes | 1 hour (`IMAGE_MISS_TTL`) |
| The lookup **failed** (timeout, network or API error) | **no** | retried on the next request |

At most 256 entries (`IMAGE_CACHE_MAX`) are kept; the entry closest to expiry is dropped first. So images come
back as soon as the network does, and repeated topics still cost no extra request.
`main.search_commons_image.cache_clear()` empties the cache.

## 4. Failure modes

| Situation | Result |
|---|---|
| No network / Wikimedia error / 8 s timeout | no image for this slide; not cached, so the next request tries again |
| No file name matches the topic words | no image (by design) |
| Topic title in a script without 4+ Latin letters (e.g. Devanagari) | no significant words → the full title is searched with no relevance stems; results are unfiltered |

## 5. Etiquette

Requests carry the header `User-Agent: MoodMatrixTutor/1.0 (educational project; contact: project maintainers)`
as Wikimedia requires. Replace the contact text with a real contact for production use.

## 6. Tests

Tests replace `search_commons_image` with a stub (`lambda q, s=(): None`) so they never touch the network.
