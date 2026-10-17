# Quiz generation endpoints

Feature doc: [quiz-generation](../features/quiz-generation.md).

---

## `POST /generate-diagnostic-mcq`

Builds the **knowledge-test** questions that measure what a student already knows about a lecture.
Never fails because of the LLM: each question falls back to a template built from the lecture plan.

**Request** (`application/json`)

| Field | Type | Default | Description |
|---|---|---|---|
| `lecture_plan` | object | *required* | A [lecture plan](../reference/data-models.md#lecture-plan) with non-empty `impTopics` |
| `num_questions` | integer | `10` | Clamped to **1-30** |
| `question_types` | string[] | `[]` | Question styles to cycle through: `conceptual`, `application`, `misconception`, `definition`, `analysis`, `practical`, `evaluation`. Unknown names are ignored; empty means all `conceptual` |

Questions are spread round-robin over the topics (`topics[i % len(topics)]`), then ordered by topic. With 5
topics and 2 questions you get topics 1 and 2; with 3 topics and 7 questions you get 3/2/2.

**Response 200**

```json
{
  "success": true,
  "questions": [
    {
      "id": "q1",
      "question": "What resolves collisions?",
      "options": [
        { "id": "A", "text": "Chaining", "isCorrect": true },
        { "id": "B", "text": "Deleting keys", "isCorrect": false },
        { "id": "C", "text": "Hashing twice only", "isCorrect": false },
        { "id": "D", "text": "Sorting", "isCorrect": false }
      ],
      "correctAnswer": "A",
      "explanation": "Chaining stores them together.",
      "difficulty": "medium",
      "conceptsTested": ["Hash Tables and Collision Handling"],
      "topicId": "topic-1",
      "topicName": "Hash Tables and Collision Handling",
      "diagnosticFocus": "knowledge_verification",
      "type": "conceptual",
      "assessedSkill": "conceptual_understanding",
      "source": "ai"
    }
  ],
  "metadata": { "generatedAt": "2026-10-17T18:57:52.382894", "totalQuestions": 2, "topicsUsed": 5 }
}
```

| Field | Notes |
|---|---|
| `id` | `q1`, `q2`, ... in order |
| `options` | Always exactly four, ids `A`-`D`, **shuffled**, exactly one `isCorrect` |
| `correctAnswer` | The **option id** (letter) of the correct option |
| `difficulty` | Copies the topic's *importance* (`high` / `medium` / `low`), not an easy/hard rating |
| `type` | The question style requested for this position (styles are cycled over the questions) |
| `assessedSkill` | Skill the style measures: `conceptual_understanding`, `practical_application`, `misconception_identification`, `definitional_knowledge`, `analytical_thinking`, `practical_reasoning`, `evaluative_judgment` |
| `source` | `"ai"` (LLM wrote it) or `"template"` (fallback) |

**Errors:** 400 `No topics found in lecture plan`; 422 validation. Slow only when the LLM is slow: up to 4
questions are generated in parallel, each LLM call has a 30 s timeout before falling back to a template.

---

## `POST /generate-topic-quiz`

Generates an **adaptive multi-question quiz for one topic**, used during a study session and for
pause-quizzes in a live class.

**Request** (`application/json`)

| Field | Type | Default | Description |
|---|---|---|---|
| `topic` | object | *required* | A topic from the plan: `title`, `description`, `keyInsights[]`, `commonMisconceptions[]`, `id` |
| `difficulty` | string | `"medium"` | Free text placed in the prompt (`easy` / `medium` / `hard` in practice) |
| `studentGoal` | string | `"gate"` | Upper-cased into the prompt |
| `numberOfQuestions` | integer | `5` | Clamped to **1-10** |
| `sessionId` | string \| null | `null` | Echoed in `quiz.metadata.sessionId` |
| `misconceptions` | object[] | `[]` | Up to the first 3 `concept` (or `topic`) values are requested as focus areas |
| `previousPerformance` | object | `{}` | Accepted; **currently unused** |
| `cognitiveLoad` | string | `"medium"` | `low` / `medium` / `high`; put in the prompt so wording stays clear under load |
| `recentContext` | string | `""` | Text the teacher just said; up to 1200 characters are appended so some questions target it |

**Response 200**

```json
{
  "success": true,
  "quiz": {
    "id": "ai_quiz_57a587eb43",
    "title": "GATE Quiz: Hash Tables and Collision Handling",
    "topic": "Hash Tables and Collision Handling",
    "studentGoal": "gate",
    "difficulty": "easy",
    "questions": [
      {
        "id": "q1_be9f2b",
        "text": "Question 1?",
        "question": "Question 1?",
        "type": "conceptual",
        "difficulty": "easy",
        "options": [
          { "id": "A", "text": "Wrong 1", "isCorrect": false },
          { "id": "B", "text": "Right", "isCorrect": true },
          { "id": "C", "text": "Wrong 0", "isCorrect": false },
          { "id": "D", "text": "Wrong 2", "isCorrect": false }
        ],
        "correctAnswer": "B",
        "explanation": "Because.",
        "misconception": "A wrong belief",
        "conceptsTested": ["Hash Tables and Collision Handling"],
        "timeEstimate": 75,
        "topic": { "id": "topic-1", "title": "Hash Tables and Collision Handling" }
      }
    ],
    "totalQuestions": 2,
    "estimatedTime": 150,
    "metadata": { "generatedAt": "2026-10-17T18:57:52.387477", "source": "ai", "topicId": "topic-1", "sessionId": null }
  }
}
```

| Field | Notes |
|---|---|
| `questions[].type` | `conceptual`, `application` or `analysis` (anything else the LLM returns becomes `conceptual`) |
| `questions[].text` / `question` | Same string twice (clients use either name) |
| `questions[].misconception` | The wrong belief a wrong answer reveals; used by the client's misconception tracker |
| `timeEstimate` | Seconds; fixed at 75 per question. `estimatedTime` is the sum |
| `totalQuestions` | May be **less than requested**: questions the LLM got wrong (not 4 options, not exactly one correct) are dropped |

**Errors**

| Status | Cause |
|---|---|
| 503 `AI quiz generation is unavailable` | No API key, LLM error/timeout, unparsable reply, **or no valid question survived validation**. The client should fall back to its own templates |
| 422 | Missing `topic` |

There is intentionally no template fallback inside this endpoint: a 503 lets the caller decide.
