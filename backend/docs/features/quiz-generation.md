# Feature: Quiz generation

Two generators serve two purposes:

| | Diagnostic MCQs | Topic quiz |
|---|---|---|
| Purpose | Measure prior knowledge across the whole lecture (the "knowledge test") | Practise and check one topic during study; pause-quizzes in live classes |
| Endpoint | [`POST /generate-diagnostic-mcq`](../api/quizzes.md#post-generate-diagnostic-mcq) | [`POST /generate-topic-quiz`](../api/quizzes.md#post-generate-topic-quiz) |
| LLM calls | one per question (parallel) | one for the whole quiz |
| Fallback without AI | **template question** (always succeeds) | **503** (caller falls back) |
| Code | `generate_mcq_with_llm`, `create_diagnostic_question`, `generate_diagnostic_mcq` | `generate_topic_quiz_with_llm`, `generate_topic_quiz` |

Both rely on `normalize_mcq` to guarantee well-formed questions.

## 1. Validation & shuffling: `normalize_mcq`

Every LLM question must pass these checks or it is **rejected**:

* it is a JSON object with a non-empty `question`;
* `options` is a list of **exactly 4** objects, each with non-empty `text`;
* **exactly one** option has `isCorrect: true`.

Accepted questions are rebuilt as `{question, options, explanation}`:

* options are **shuffled** (models tend to put the answer first) and re-labelled `A`-`D`;
* `isCorrect` is kept as a boolean on each option; the question-level `correctAnswer` is the *letter* of the
  correct option.

## 2. Diagnostic MCQs

### 2.1 Which topics

`num_questions` is clamped to 1-30. Questions are distributed round-robin over the plan's topics
(`topics[i % len(topics)]`) and then grouped by topic. Example: 3 topics, 7 questions → topic 1 ×3,
topic 2 ×2, topic 3 ×2.

### 2.2 AI path

`generate_mcq_with_llm` sends the topic title, the first 800 characters of the topic's content
(`full_content`, else `description`) and the first two key insights, and asks for one question with four
options and an explanation as JSON (temperature 0.7, 400 tokens, 30 s). The answer is passed through
`normalize_mcq`. Result: `source: "ai"`.

### 2.3 Template fallback (`source: "template"`)

Used when the LLM is unavailable **or** the question failed validation.

* **Question:** `Which statement is correct about <title>?`
* **Correct option:** the topic's first key insight (≥10 characters), else the first sentence of its
  description (≤200 chars), else `<title> is covered in this lecture.`
* **Distractors:** the first available statement from each *other* topic (these are true statements about
  other subjects, so they are plausible but wrong for this question), up to 3; any shortfall is filled from
  generic distractors (`"<title> is not part of this lecture's material."`, ...).
* Options shuffled, labelled `A`-`D`; explanation `According to the lecture: <correct statement>`.

Quality note: template questions test recall of the plan's own statements; they exist so the knowledge test
never fails, not to replace AI questions.

### 2.4 Question object

See [data-models](../reference/data-models.md#diagnostic-question). `difficulty` mirrors the topic's
`importance` (`high` / `medium` / `low`).

## 3. Topic quiz

### 3.1 Prompt

* **System:** "expert `<GOAL>` exam tutor", *N* questions at `difficulty`, mention of the student's cognitive
  load ("keep wording clear"), a mix of `conceptual`, `application`, `analysis` questions, optional focus on
  up to 3 known weak areas (`misconceptions[].concept` or `.topic`), and the required JSON:

```json
{"questions": [{"question": "...", "type": "conceptual",
                "options": [{"text": "...", "isCorrect": true}, ... 4 options ...],
                "explanation": "...", "misconception": "the wrong belief a wrong answer reveals"}]}
```

* **User:** topic title, description (≤600 chars), up to 4 key insights, up to 3 misconceptions and, if
  `recentContext` is non-empty, `The teacher just said (base some questions on this): <≤1200 chars>`.

### 3.2 Post-processing

For every question in the reply: `normalize_mcq` (invalid ones are dropped), `type` forced to one of the three
allowed values, then it is given an id `q<n>_<6 hex>`, `text` = `question`, `timeEstimate` 75 s, `topic`
`{id,title}`, `conceptsTested [title]`. If **no** question survives the endpoint returns 503. The quiz gets
`id: ai_quiz_<10 hex>`, `title: "<GOAL> Quiz: <topic title>"`, `estimatedTime` = sum of the question times.

### 3.3 Adaptivity

The service adapts *prompts*; deciding the difficulty is the caller's job. The web app maps the student's
cognitive load to difficulty (high → easy, low → hard) before calling. `previousPerformance` is accepted for
compatibility but unused.

## 4. Failure modes

| Failure | Diagnostic MCQs | Topic quiz |
|---|---|---|
| No key / LLM down | template questions | 503 |
| LLM returns invalid JSON | that question → template | 503 |
| Some questions invalid | those become templates | those are dropped (fewer questions returned) |
| Plan without topics | 400 | n/a |

## 5. Tests

`test_api.py`: `test_diagnostic_mcq_template_fallback_is_valid`, `test_normalize_mcq_rejects_bad_and_shuffles`,
`test_topic_quiz_unavailable_without_ai`, `test_topic_quiz_with_ai`.
`test_features.py`: `test_topic_quiz_includes_recent_context`.
