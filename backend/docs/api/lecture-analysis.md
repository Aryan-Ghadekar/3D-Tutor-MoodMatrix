# Lecture analysis endpoints

Feature docs: [lecture-ingestion](../features/lecture-ingestion.md), [topic-scoring-and-plans](../features/topic-scoring-and-plans.md).

---

## `POST /analyze-lecture`

Turns lecture material into a **lecture plan**: an ordered list of important topics, each with a title,
summary, prerequisites, common misconceptions and key insights. The plan is saved, and every chunk of the
lecture is indexed for [retrieval](../features/rag.md).

**Content type:** `multipart/form-data`

| Part / parameter | Where | Type | Required | Description |
|---|---|---|---|---|
| `pdf` | form file | PDF | one of the four | Text is extracted page by page |
| `ppt` | form file | `.pptx` | one of the four | Text of every shape on every slide. Legacy `.ppt` is **not** supported |
| `audio` | form file | any format ffmpeg can decode | one of the four | Transcribed with Whisper |
| `yt_link` | **query string** | URL | one of the four | `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/` |

Rules:

* At least one of the four is required (otherwise **400**).
* `pdf` and `ppt` may be sent together; their text is concatenated.
* If both `audio` and `yt_link` are sent, **audio wins** (the link is ignored).
* If there is no PDF/PPT text, the **transcript is used as the lecture text**. With documents present the
  transcript only boosts the importance of matching chunks and is indexed separately for retrieval.

**Example**

```bash
curl -F "ppt=@lecture.pptx" -F "audio=@lecture.mp3" http://localhost:8001/analyze-lecture
curl -X POST "http://localhost:8001/analyze-lecture?yt_link=https://youtu.be/dQw4w9WgXcQ"
```

**Response 200**: a [lecture plan](../reference/data-models.md#lecture-plan)

```json
{
  "sessionId": "fae8e470-eaf2-4406-98d9-da0aa53855f3",
  "lectureId": "5e4be5c1-8768-4578-bb12-bc008a7f46a4",
  "topic": "Hash Tables and Collision Handling",
  "duration": "45 minutes",
  "date": "2026-10-17",
  "instructor": "Algorithms Professor",
  "impTopics": [
    {
      "id": "topic-1",
      "title": "Hash Tables and Collision Handling",
      "description": "Hash tables map keys to buckets. Collisions are resolved by chaining.",
      "full_content": "Hash tables map keys to buckets using a hash function. Important: collisions ...",
      "importance": "medium",
      "weightage": 57.5,
      "prerequisites": ["Point one", "Point two"],
      "commonMisconceptions": ["Point one", "Point two"],
      "keyInsights": ["Point one", "Point two"]
    }
  ],
  "metadata": {
    "analysisDepth": "signal-weighted-enhanced",
    "confidenceScore": 0.57,
    "transcriptUsed": false,
    "aiCalls": { "succeeded": 28, "failed": 0 },
    "aiGenerated": true,
    "fallbackUsed": false,
    "totalTopicsGenerated": 5,
    "wordCount": 780,
    "processingVersion": "2.1"
  },
  "generated_at": "2026-10-17T18:57:50.852109"
}
```

`sessionId` is the **lecture session id**: it is the key used by `GET /get-lecture-plan`, by the retrieval
collection, and by the web app to tie a study session to a lecture. `lectureId` is a second identifier for
the same plan.

**Errors**

| Status | `detail` | Cause |
|---|---|---|
| 400 | `Provide at least one of: pdf, ppt, audio or yt_link.` | Nothing sent |
| 422 | `Could not read the PDF file: ...` | Corrupt / encrypted PDF |
| 422 | `Could not read the PowerPoint file (only .pptx is supported): ...` | Corrupt file or `.ppt` |
| 422 | `No readable text could be extracted from the input.` | Scanned PDF with no text layer, empty slides |
| 422 | `No readable text was found in the provided files or video.` | Text was empty after chunking |
| 422 | `Could not find a video id in the YouTube link.` | URL without an 11-character id |
| 422 | `Could not transcribe the YouTube video: ...` | No captions and the audio fallback failed |
| 501 | `openai-whisper is not installed; ...` | Audio / caption-less video without Whisper |
| 501 | `This video has no captions and yt-dlp is not installed.` | |
| 413 | `Upload is larger than the N MB limit.` / `'<file>' is larger than ...` | A file or the whole request exceeds `MAX_UPLOAD_MB` |
| 500 | | Direct audio upload that Whisper/ffmpeg cannot decode |

`metadata` tells you how trustworthy the text is: `aiGenerated` is true when at least one LLM call succeeded,
`aiCalls` counts the calls, and `fallbackUsed` is true when **any** field fell back to extracted text (including
when there is no API key at all). `transcriptUsed` says whether audio/video speech took part.

**Side effects:** writes `data/lecture_plans.json` (keeps the 10 newest) and `data/rag/<sessionId>.json`.
A failure while *indexing* is logged and ignored: the call still succeeds.

**Duration:** from a second (no AI key, small file) to several minutes (long audio, many topics).
There is no progress channel; the request is synchronous.

---

## `GET /get-lecture-plan`

Fetch a previously saved plan.

| Query parameter | Type | Description |
|---|---|---|
| `sessionId` | string | Match `plan.sessionId` |
| `lectureId` | string | Match `plan.lectureId` |
| `latest` | boolean | Fall back to the most recent plan if no id matches |

Lookup rules (first that applies):

1. `sessionId` **or** `lectureId` matches a saved plan → that plan.
2. `latest=true`, or neither id was given → the newest saved plan.
3. Otherwise **404**.

```bash
curl "http://localhost:8001/get-lecture-plan?sessionId=fae8e470-eaf2-4406-98d9-da0aa53855f3"
curl "http://localhost:8001/get-lecture-plan?latest=true"
```

**Response 200:** the plan (same shape as above, including `generated_at`).

| Status | `detail` | Cause |
|---|---|---|
| 404 | `No lecture plans found` | Nothing has been analysed yet (or `data/` was cleared) |
| 404 | `Lecture plan not found for that id` | Unknown id and `latest` not set |

Only the **10 most recent** plans are kept, so older ids start returning 404.
