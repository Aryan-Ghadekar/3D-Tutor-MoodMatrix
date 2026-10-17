# Quiz result endpoints

Feature doc: [quiz-analysis-and-storage](../features/quiz-analysis-and-storage.md).

---

## `POST /analyze-quiz-results`

Scores a set of answers against their questions and reports weak topics, misconceptions and study
recommendations. Pure computation: no LLM, no storage.

**Request** (`application/json`)

| Field | Type | Description |
|---|---|---|
| `session_id` | string | *required*; not used in the calculation |
| `questions` | object[] | *required*. Each: `id`, `correctAnswer` (option id), `conceptsTested[]`, optionally `question`, `explanation` |
| `answers` | object[] | *required*. Each: `questionId`, `selectedAnswer` (option id) |
| `student_goal` | string \| null | Accepted; unused |

Answers are matched to questions by comparing `str(answer.questionId)` with `str(question.id)`.
A question with **no matching answer counts as wrong**. An answer whose `selectedAnswer` differs from
`correctAnswer` is wrong.

**Example**

```json
{
  "session_id": "s",
  "questions": [
    { "id": "q1", "question": "Q1", "correctAnswer": "A", "conceptsTested": ["Hash Tables"], "explanation": "e" },
    { "id": "q2", "question": "Q2", "correctAnswer": "B", "conceptsTested": ["Trees"], "explanation": "e" }
  ],
  "answers": [
    { "questionId": "q1", "selectedAnswer": "A" },
    { "questionId": "q2", "selectedAnswer": "C" }
  ]
}
```

**Response 200**

```json
{
  "success": true,
  "score": 50.0,
  "correct": 1,
  "total": 2,
  "misconceptions": [
    { "topic": "Trees", "question": "Q2", "yourAnswer": "C", "correctAnswer": "B", "explanation": "e", "type": "knowledge_gap" }
  ],
  "weakTopics": ["Trees"],
  "recommendations": ["Review fundamental concepts from the lecture", "Focus on: Trees"],
  "knowledgeState": { "overallMastery": 50.0, "conceptualUnderstanding": 50.0, "needsReview": true }
}
```

| Field | Rule |
|---|---|
| `score` | `correct / total * 100`, rounded to 1 decimal; `0` if there are no questions |
| `weakTopics` | Topic of each wrong question (`conceptsTested[0]`, or `"Unknown"`), de-duplicated, original order |
| `recommendations` | `score < 60` → "Review fundamental concepts from the lecture"; any weak topic → "Focus on: <first 3 weak topics>"; `score ≥ 80` → "Strong understanding! Move to advanced topics" |
| `knowledgeState.needsReview` | `score < 70` |

---

## `POST /save-quiz-results`

Persists a finished quiz (for example the knowledge test) to `data/quiz_results.json`.

**Request** (`application/json`; every field is required)

| Field | Type |
|---|---|
| `session_id`, `lecture_id` | string |
| `score` | number (percent) |
| `correct`, `total` | integer |
| `questions`, `answers`, `misconceptions` | object[] (stored as given) |
| `weak_topics`, `recommendations` | string[] |

**Response 200**

```json
{ "success": true, "message": "Quiz results saved successfully", "session_id": "s" }
```

The record is stored with two timestamps added: `timestamp` (request time) and `saved_at` (write time).
Records are stored **newest first** and only the **latest 50** are kept.

| Status | Cause |
|---|---|
| 422 | A required field is missing or has the wrong type |
| 500 `Failed to save results: ...` | The data directory is not writable |

> There is no endpoint to read stored results back; they are for offline analysis. The web app also keeps its
> own copy in the browser.
