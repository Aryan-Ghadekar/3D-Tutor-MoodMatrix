# Feature: Adaptive slide generation

Produces the teaching content a student sees: one slide at a time, written for *this* student and grounded in
*this* lecture.

* **Endpoint:** [`POST /generate-dynamic-slide`](../api/slides.md)
* **Code:** `main.py`: `generate_slide_with_ai` (prompting) and `generate_dynamic_slide` (orchestration)
* **Uses:** [retrieval](rag.md), [images](images.md), [LLM client](ai-generation.md)

## 1. The three inputs

Each slide is generated from three streams, matching the product's design:

| Stream | Request fields | Effect on the prompt |
|---|---|---|
| **Student goal** | `student_goal` | "specializing in `<GOAL>` exam preparation"; exam relevance, traps and examples are tailored to it |
| **Student knowledge** | `knowledge_state.knowledgeLevel`, `averageScore`, `weakTopics`, `misconceptions` | complexity rules (beginner → simple language, step-by-step; intermediate → balanced; advanced → depth and edge cases), extra clarity for the first 3 weak topics, number of known misconceptions to correct |
| **Lecture content** | `lecture_plan.impTopics[current_topic_index]` | title, description, key insights, misconceptions, applications, importance |

## 2. Prompt structure

Every call sends two messages:

1. **System prompt**: role ("expert educational content creator"), the critical requirements populated from
   the knowledge state, the **required JSON shape** (below), adaptation rules per level, and "Return ONLY valid
   JSON".
2. **User prompt**: depends on the [action type](#3-action-types), optionally followed by retrieved source
   material.

### Requested slide JSON (`slide.content`)

| Field | Type | Meaning |
|---|---|---|
| `title` | string | Slide title (≤10 words) |
| `narrative` | string | The explanation (3-4 paragraphs, conversational) |
| `keyInsights` | string[] | 4-5 exam-relevant points |
| `analogies` | `{domain, comparison, lesson}[]` | Relatable comparisons |
| `realWorldScenario` | `{situation, application, outcome}` | A practical example |
| `interactiveElement` | string | A question to make the student think |
| `examRelevance` | string | How it appears in the chosen exam |
| `commonTraps` | string[] | 3-4 typical mistakes |
| `memoryHook` | string | Mnemonic / memorable phrase |

The service verifies only that the reply is a JSON **object**; individual fields are not validated.

## 3. Action types

| Action | When the web app uses it | What the prompt asks for |
|---|---|---|
| `concept_explanation` | First slide of every topic | Comprehensive slide from the topic details, student context and recent performance band (<60 "Below expectations", <80 "Good", else "Excellent") |
| `explain-more` | "Explain More" button | A deeper treatment: nuances, edge cases, several perspectives. Advanced content if `averageScore ≥ 70`, otherwise "clearer explanations with more examples" |
| `ask-question` | "Ask Questions" / voice question | A slide that *directly answers* `user_question`: step-by-step, examples, how to verify, exam pattern |
| `simplified-explanation` | Help offer, avatar "Simpler", teacher's avatar pause | Short sentences, one core idea, one example, one analogy, an "In other words..." restatement, 3 very short insights. `context` (what the teacher said) is included |
| `quiz-results` | After a topic quiz | Performance analysis from `context` (score and missed questions) plus weak topics and recent mistakes, with encouragement |
| `quiz-feedback` | *(available; not used by the current UI)* | Explains one wrong answer from a JSON `context` |
| `completion` | After the last topic | Congratulation, recap of all topics (`context`, default: all titles), revision list, exam study plan |
| other | | A generic slide about the topic |

`null`/empty `action_type` becomes `concept_explanation`.

## 4. Grounding with retrieved sources

For `concept_explanation`, `explain-more`, `ask-question` and `simplified-explanation` the service first
searches the lecture's [retrieval collection](rag.md):

* **Query:** the student's question if there is one, else `"<topic title> <first 200 chars of the description>"`.
* **Sources:** top 4 passages of kind `lecture` / `transcript` (similarity ≥ 0.05).
* **Earlier explanations** (only `ask-question` and `explain-more`): top 2 passages of kind `explanation`.

Whatever is found is appended to the user prompt:

```
SOURCE MATERIAL FROM THE TEACHER'S LECTURE (ground your answer in this; if it does not cover the point, say so instead of guessing):
[1] <passage up to 600 chars>
[2] ...

EARLIER EXPLANATIONS GIVEN TO THIS STUDENT (do not repeat them, build on them):
- <explanation up to 300 chars>
```

and returned to the client as `slide.metadata.sources` so the UI can show "Based on N passages from the
lecture". With no matches nothing is appended and `sources` is `[]`.

## 5. Images

After the text is generated, [`get_wikimedia_images`](images.md) looks for one relevant illustration for the
topic title. No image is better than a wrong image, so an empty list is common for abstract topics.

## 6. Remembering what was explained

Unless the action is `quiz-results` or `completion`, the slide's title, narrative and first four key insights
are stored in the retrieval collection (`kind: "explanation"`, id = slide id). Later `ask-question` and
`explain-more` requests can retrieve these so the tutor builds on, rather than repeats, earlier explanations.

## 7. Response metadata

| Field | Value |
|---|---|
| `id` | `slide_<unix ms>` |
| `type` / `metadata.actionType` | the action used |
| `metadata.topicIndex`, `topicTitle` | which topic |
| `metadata.studentGoal`, `knowledgeLevel` | echoed (level defaults to `intermediate`) |
| `metadata.generatedBy` / `aiModel` | `"AI"` / the model id |
| `metadata.hasImages`, `sources`, `generatedAt`, `sessionId` | as named |

## 8. Failure modes

| Failure | Result |
|---|---|
| Plan without topics / bad index | 400 |
| No key, timeout, provider error, reply not a JSON object | **502**; the web app then generates a local template slide |
| Reply truncated by `max_tokens` (2000) | invalid JSON → 502 |
| Retrieval fails or collection missing | slide is still generated without sources |
| Wikimedia down | slide without an image |

## 9. Tests

`test_api.py`: `test_dynamic_slide_all_actions` (every action incl. `null`), `test_dynamic_slide_bad_index_and_ai_failure`,
`test_dynamic_slide_accepts_weak_topics_and_misconceptions`.
`test_features.py`: `test_ask_question_is_grounded_in_retrieved_sources_and_remembered`,
`test_simplified_explanation_action_uses_recent_teacher_audio`.
