# Feature: Topic scoring & lecture-plan building

Decides **which parts of a lecture are most important** and turns them into a structured *lecture plan*.

* **Endpoints:** [`POST /analyze-lecture`](../api/lecture-analysis.md), [`GET /get-lecture-plan`](../api/lecture-analysis.md#get-get-lecture-plan)
* **Code:** `main.py`: `extract_features`, `compute_importance`, `label_importance`, `calculate_topic_count`,
  `analyze_text`, `build_topic`, `build_lecture_plan`, `save_lecture_plan`
* **Previous stage:** [ingestion](lecture-ingestion.md). **Next stage:** [retrieval indexing](rag.md)

## 1. Pipeline

```
lecture text ──chunk (150 words)──► features per chunk ──► importance score ──► top N chunks (kept in lecture order)
                                                                                   │
                                                  per chunk, in parallel: title · summary · prerequisites ·
                                                  misconceptions · key insights      (LLM, with fallbacks)
                                                                                   │
                                                  whole lecture: topic title · duration · instructor (LLM)
                                                                                   ▼
                                                            lecture plan  →  saved to data/ and indexed
```

## 2. Importance scoring

For every chunk four features in [0, 1] are computed:

| Feature | Definition | Weight |
|---|---|---|
| `semantic` | Cosine similarity between the chunk's embedding and the **mean embedding of all chunks** (how central the chunk is to the lecture). Model: `all-MiniLM-L6-v2`. **Without the model the value is a constant 0.5** | 0.35 |
| `audio` | Overlap with what was *emphasised aloud*. Take the transcript sentences (split on `. ! ?`) that contain any keyword below; collect their words of ≥4 letters/digits; `audio = min(|chunk words ∩ spoken words| / max(0.3 × |chunk words|, 1), 1)`. `0` when there is no transcript | 0.25 |
| `duration` | `min(words in chunk / 150, 1)`: favours full-size chunks over a short tail | 0.20 |
| `keyword` | Sum of the weights of the keywords found in the chunk (case-insensitive **substring** match), capped at 1 | 0.20 |

```
score = 0.35·semantic + 0.25·audio + 0.20·duration + 0.20·keyword
```

Keyword weights (`KEYWORDS`): `important` 1.0, `critical` 0.9, `exam` 0.9, `chapter` 0.85, `unit` 0.8,
`essential` 0.8, `remember` 0.8, `concept` 0.75, `key` 0.7, `main` 0.7, `section` 0.7, `note` 0.6.
Because matching is by substring, `key` also matches "monkey" and `note` matches "denote"; this is a known
approximation.

**Importance label** from the score: `high` ≥ 0.70, `medium` ≥ 0.45, otherwise `low`.
The plan's `weightage` is `round(score × 100, 2)`.

> Without sentence-transformers and without a transcript, `semantic` is constant and `audio` is 0, so the
> score differs between chunks only through `duration` and `keyword`.

## 3. How many topics?

`calculate_topic_count(source_text)` depends on the lecture's word count:

| Words | Topics |
|---|---|
| < 500 | 3 |
| < 1,500 | 5 |
| < 3,000 | 8 |
| < 5,000 | 12 |
| < 10,000 | 15 |
| ≥ 10,000 | 20 (hard maximum) |

If there are fewer chunks than that, every chunk becomes a topic. The highest-scoring chunks are selected and
then **re-sorted into their original order**, so topics follow the lecture's flow, not their score.

## 4. Building each topic: LLM calls and fallbacks

`build_topic` runs five LLM calls **in parallel** for each selected chunk. Topics themselves are processed one
after another.

| Field | Prompt goal | Temp. | Max tokens | Fallback when the LLM is unavailable |
|---|---|---|---|---|
| `title` | ≤10-word title (reply with the title only); quotes and trailing "." removed; cut to 100 chars | 0.3 | 40 | first 8 words of the chunk |
| `description` | 2-3 sentence summary | 0.4 | 150 | first 3 sentences of the chunk (≤400 chars) |
| `prerequisites` | 2-3 background items (JSON array of strings) | 0.5 | 200 | `[]` |
| `commonMisconceptions` | 2-3 common mistakes (JSON array) | 0.5 | 200 | `[]` |
| `keyInsights` | 2-3 key takeaways (JSON array) | 0.5 | 200 | `[]` |

List answers are parsed by `generate_structured_content`: JSON array preferred (at most 4 items kept); if the
model replied with bullet lines instead, the lines are used. See [ai-generation](ai-generation.md).

Each topic also carries `full_content` (first **500 characters** of its chunk), `importance`, `weightage` and an
id `topic-1`, `topic-2`, ... in lecture order.

After the topics, three more calls describe the **whole lecture** using the first five selected chunks:

| Field | Fallback |
|---|---|
| `topic` (overall title) | first 8 words of those chunks |
| `duration` | `"30-45 minutes"` |
| `instructor` | `"Subject Matter Expert"` |

**Call count:** `5 × N + 3` LLM calls for N topics (zero when no API key is configured).

## 5. Plan metadata

```json
"metadata": {
  "analysisDepth": "signal-weighted-enhanced",
  "confidenceScore": 0.57,
  "fallbackUsed": true,
  "totalTopicsGenerated": 5,
  "wordCount": 780,
  "processingVersion": "2.1"
}
```

| Field | Meaning |
|---|---|
| `confidenceScore` | Mean importance score (0-1, 2 decimals) of the selected chunks |
| `fallbackUsed` | `true` when **no transcript was available** (the audio signal was not used). Despite its name it does not indicate an LLM failure |
| `wordCount` | Words in the lecture text (not counting a separate transcript) |
| `processingVersion` | Version of the plan format |

The plan also gets `sessionId` and `lectureId` (random UUIDs), `date` (today) and, when saved,
`generated_at`. See [data-models](../reference/data-models.md#lecture-plan).

## 6. Saving and lookup

`save_lecture_plan` prepends the plan to `data/lecture_plans.json` and keeps the **10 newest**
([storage](storage.md)). `GET /get-lecture-plan` resolves a plan by `sessionId` / `lectureId` or returns the
latest.

## 7. Known limitations

* Chunk boundaries are arbitrary (every 150 words), so a concept can be split between two topics.
* A topic is described from a single chunk; the LLM never sees the rest of the lecture when naming it.
* Titles are not de-duplicated: two chunks about the same idea can get the same title (this is visible in the
  mocked examples in these docs).
* Scoring favours central, keyword-rich, full-length chunks; short but important endings can be skipped.
* Analysis time grows linearly with the number of topics (sequential topics, parallel fields).

## 8. Tests

`test_api.py`: `test_analyze_lecture_from_pptx_without_ai` (no key → extractive fallbacks, no "failed"
strings), `test_analyze_lecture_topics_keep_lecture_order`, `test_get_lecture_plan_lookup_rules`.
