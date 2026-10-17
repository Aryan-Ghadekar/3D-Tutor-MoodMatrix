# Retrieval endpoint

Feature doc: [rag](../features/rag.md).

## `POST /rag/query`

Returns the passages of a lecture (and earlier explanations) most relevant to a question. The slide endpoint
uses the same retrieval internally; this endpoint exposes it directly, for example to show "sources" in a UI
or to debug why an answer was grounded the way it was.

**Request** (`application/json`)

| Field | Type | Default | Description |
|---|---|---|---|
| `collection` | string | *required* | The lecture's `sessionId` (every lecture has its own collection) |
| `query` | string | *required* | Natural-language question or keywords |
| `k` | integer | `4` | Number of results; clamped to **1-10** |

```bash
curl -X POST http://localhost:8001/rag/query -H "Content-Type: application/json" \
  -d '{"collection":"fae8e470-eaf2-4406-98d9-da0aa53855f3","query":"load factor resizing","k":2}'
```

**Response 200**

```json
{
  "results": [
    {
      "id": "chunk-5",
      "text": "load factor controls resizing. Hash tables map keys to buckets ...",
      "kind": "lecture",
      "meta": { "chunkIndex": 5, "topicId": null },
      "score": 0.5823,
      "snippet": "load factor controls resizing. Hash tables map keys to buckets ..."
    }
  ]
}
```

| Field | Notes |
|---|---|
| `kind` | `lecture` (document / slide text), `transcript` (audio / video speech when documents were also given) or `explanation` (a slide the tutor generated earlier) |
| `meta` | `lecture`: `chunkIndex` and `topicId` (the `topic-N` this chunk became, or `null` if the chunk was not selected as a topic). `explanation`: `topicIndex` and `action` |
| `score` | Similarity 0-1 (cosine). Results below **0.05** are dropped |
| `text` | The full stored passage; `snippet` is whitespace-normalised and cut to about 220 characters |

Results are sorted by `score`, highest first, across **all kinds**. An unknown collection, an empty query or
no match returns `{"results": []}` (never an error).

**Errors:** 422 if `collection` or `query` is missing.
