# Slide generation endpoint

Feature docs: [slide-generation](../features/slide-generation.md), [images](../features/images.md),
[rag](../features/rag.md).

## `POST /generate-dynamic-slide`

Generates **one teaching slide** for one topic of a lecture plan, adapted to the student's goal, level and
weak areas, grounded in retrieved lecture passages, with an illustration.

**Content type:** `application/json`

| Field | Type | Default | Description |
|---|---|---|---|
| `session_id` | string | *required* | The caller's study-session id. Echoed into `slide.metadata.sessionId`; not used for retrieval |
| `lecture_plan` | object | *required* | A full [lecture plan](../reference/data-models.md#lecture-plan). `impTopics` must be non-empty. `sessionId` selects the retrieval collection |
| `student_goal` | string | `"gate"` | Exam / purpose; upper-cased into prompts |
| `knowledge_state` | object | `{}` | See [common fragments](README.md#student-knowledge-state-slides) |
| `current_topic_index` | integer | `0` | Index into `lecture_plan.impTopics` |
| `action_type` | string \| null | `"concept_explanation"` | What kind of slide to make (table below). `null` or empty means the default |
| `user_question` | string \| null | `null` | The student's question (for `ask-question`) |
| `context` | string \| null | `""` | Extra context; meaning depends on the action |

> These are **top-level body fields** (not nested in an object), because the endpoint declares each one as a
> `Body` parameter.

### Action types

| `action_type` | Purpose | Uses | Retrieval | Earlier explanations |
|---|---|---|---|---|
| `concept_explanation` | The main slide for a topic | topic fields | yes | no |
| `explain-more` | Deeper, more detailed treatment | topic, knowledge level | yes | yes |
| `ask-question` | Directly answer a student's question | `user_question` | yes (query = the question) | yes |
| `simplified-explanation` | Short, spoken-friendly re-explanation for an overloaded student | `context` = what the teacher just said (optional) | yes | no |
| `quiz-results` | Review of a finished quiz | `context` = score and missed questions text | no | no |
| `quiz-feedback` | Explain one wrong answer | `context` = JSON string `{wrongAnswer:{question,selectedAnswer:{text},correctAnswer:{text},explanation}, studentPerformance:{wrongAnswersCount}}` | no | no |
| `completion` | End-of-lecture summary and study plan | `context` = topic titles (defaults to all titles) | no | no |
| *anything else* | Generic slide about the topic | | no | no |

**Example request**

```json
{
  "session_id": "study-1",
  "lecture_plan": { "sessionId": "fae8e470-...", "impTopics": [ { "id": "topic-1", "title": "Hash Tables" } ] },
  "student_goal": "gate",
  "current_topic_index": 0,
  "action_type": "ask-question",
  "user_question": "How are collisions resolved?",
  "knowledge_state": { "knowledgeLevel": "beginner", "averageScore": 40, "weakTopics": ["Hash Tables"] }
}
```

**Response 200**

```json
{
  "success": true,
  "message": "AI-generated slide for ask-question",
  "slide": {
    "id": "slide_1792243672369",
    "title": "Hash Tables and Collisions",
    "type": "ask-question",
    "content": {
      "title": "Hash Tables and Collisions",
      "narrative": "A hash table maps keys to buckets...",
      "keyInsights": ["A good hash function spreads keys evenly", "Chaining stores colliding keys in a list"],
      "analogies": [{ "domain": "Coat check", "comparison": "Numbered hooks", "lesson": "The number tells you where to look" }],
      "realWorldScenario": { "situation": "A web cache", "application": "Hash the URL", "outcome": "O(1) lookups" },
      "interactiveElement": "What happens when two keys collide?",
      "examRelevance": "Frequently tested",
      "commonTraps": ["Assuming no collisions"],
      "memoryHook": "Hash, bucket, chain"
    },
    "images": [
      {
        "id": "img_99d602fb0b",
        "url": "https://thumb.wikimedia.org/...Hash_table_4_1_1_0_0_1_0_LL_mk.svg/960px-....png",
        "caption": "Hash Tables (Wikimedia Commons)",
        "alt": "Illustration related to Hash Tables",
        "source": "wikimedia",
        "sourcePage": "https://commons.wikimedia.org/wiki/File:Hash_table_4_1_1_0_0_1_0_LL_mk.svg",
        "isPlaceholder": false
      }
    ],
    "metadata": {
      "generatedAt": "2026-10-17T18:57:52.369246",
      "sessionId": "study-1",
      "topicIndex": 0,
      "topicTitle": "Hash Tables",
      "studentGoal": "gate",
      "knowledgeLevel": "beginner",
      "actionType": "ask-question",
      "hasImages": true,
      "generatedBy": "AI",
      "aiModel": "openai/gpt-3.5-turbo",
      "sources": [
        { "id": "chunk-4", "kind": "lecture", "snippet": "map keys to buckets using a hash function. Important: ...", "score": 0.3347 }
      ]
    }
  }
}
```

Notes on the response:

* `slide.type` equals the action actually used (`concept_explanation` when `null` was sent).
* `slide.content` is **whatever JSON object the LLM returned**. The prompt requests the fields shown above,
  but the service only checks that the reply is a JSON object. Clients should treat every field as optional.
* `images` has **at most one** entry and is `[]` when nothing relevant was found.
* `metadata.sources` lists the retrieved lecture/transcript passages given to the LLM (empty for actions that
  skip retrieval or when the collection has no match). `kind` is `lecture` or `transcript`.

**Side effect:** unless the action is `quiz-results` or `completion`, a short text of the slide (title,
narrative, up to four key insights) is added to the retrieval collection as an `explanation`, so later
questions can build on it.

**Errors**

| Status | `detail` | Cause |
|---|---|---|
| 400 | `Lecture plan has no topics` | `impTopics` missing or empty |
| 400 | `Invalid topic index: N` | `current_topic_index` out of range |
| 502 | `AI model unavailable: ...` | HTTP error from the LLM provider |
| 502 | `Slide generation error: ...` | No API key, timeout, connection error, or the reply was not a JSON object |
| 422 | (validation array) | Missing `session_id` / `lecture_plan` |

A 502 is the signal for the client to fall back to locally generated content; the web app does exactly that.

**Timing:** one LLM call (timeout 45 s) plus an image lookup (≤ 8 s per query, up to three queries, cached).
