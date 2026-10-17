# Extending the backend

Recipes for the most common changes. After any change to an endpoint or model: run `pytest`, then
`python export_openapi.py`, then update the affected docs.

## Add an endpoint

1. Declare a Pydantic model for the body (near the other models at the top of `main.py`) or use `Body(...)`
   parameters like `generate_dynamic_slide`.
2. Add the function with a **docstring** (it becomes the OpenAPI description). Use plain `def` if it blocks
   (LLM, files, ML) so it runs in the thread pool; use `async def` only for non-blocking work.
3. Raise `HTTPException(status_code, detail="...")` for client errors; follow the status-code conventions in
   [api/README.md](../api/README.md#conventions-fastapi).
4. Add tests (monkeypatch `llm_message` rather than calling a real model).
5. Document it: a section in the matching file under `docs/api/`, a row in the index tables, and a feature doc
   if it is a new capability.

For a group of related endpoints create a router in a new module (as `classroom.py` does) and include it:
`app.include_router(my_module.router)`.

## Add a slide action type

1. In `generate_slide_with_ai`, add an `elif action_type == 'my-action':` branch that sets `user_prompt`.
   Reuse the shared system prompt (it already requests the slide JSON).
2. In `generate_dynamic_slide`, decide whether the action should use retrieval: add it to the tuple
   `('concept_explanation', 'explain-more', 'ask-question', 'simplified-explanation')`, and set
   `include_explanations` if earlier explanations help.
3. Decide whether it should be remembered: actions other than `quiz-results` and `completion` are stored as
   `explanation` documents automatically.
4. Add the action to `test_dynamic_slide_all_actions`' parameters and to
   [api/slides.md](../api/slides.md#action-types) and [features/slide-generation.md](../features/slide-generation.md#3-action-types).

## Change how topics are scored

* Weights: `compute_importance`. Keywords and their weights: `KEYWORDS`. Thresholds: `label_importance`.
  Topic counts: `calculate_topic_count`. Chunk size: `chunk_text(max_tokens=...)`.
* Keep scores in [0, 1] so the `high`/`medium`/`low` thresholds stay meaningful.
* Update [topic-scoring-and-plans](../features/topic-scoring-and-plans.md).

## Use a different LLM or provider

* Another OpenRouter model: set `OPENROUTER_MODEL`.
* Another OpenAI-compatible server: set `OPENROUTER_URL` (+ a non-empty `OPENROUTER_API_KEY`).
* A non-OpenAI protocol: replace the body of `make_openrouter_request` (the only function that talks HTTP to
  the model) so that it returns a dict shaped like `{"choices": [{"message": {"content": "..."}}]}`; nothing
  else needs to change.

## Swap the vector store

`rag.VectorStore` is used through four calls: `add(name, docs)`, `query(name, text, k, kinds, min_score)`,
`count(name, kind)`, `delete(name)`. To use Chroma, Qdrant, pgvector or similar:

1. Write a class with the same four methods returning the same result dicts
   (`{id, text, kind, meta, score}`).
2. Replace `rag_store = VectorStore(...)` in `main.py` with your class.
3. Keep `test_features.py`'s retrieval tests: they describe the behaviour the rest of the code relies on
   (ranking, kind filter, replace-by-id, empty results for unknown collections).

## Add an input format (for example `.docx`)

1. Write `extract_docx_text(upload)` next to `extract_pdf_text`: save with `_save_upload`, parse, always delete
   the temp file in `finally`, wrap parser errors in `HTTPException(422, ...)`.
2. Add an optional `File(None)` parameter to `analyze_lecture` and concatenate its text into `source_text`.
3. Add a corrupt-file test like `test_corrupt_uploads_return_422_with_a_message` and update
   [lecture-ingestion](../features/lecture-ingestion.md).

## Persist classes (scale the classroom)

`classroom.py` keeps everything in the module-level dict `_classes`. To survive restarts or run several
workers: replace the dict with a store (Redis hashes work well: one key per class, TTL = `CLASS_TTL_S`), keep
the same function bodies, and move `_lock` to a distributed lock or use atomic Redis operations. For hundreds
of students consider pushing state over WebSockets instead of polling.

## Add authentication

All lecture/slide/quiz endpoints are open. Add a FastAPI dependency (`Depends`) that validates a session
cookie or bearer token and apply it with `app.include_router(..., dependencies=[Depends(require_user)])`, or
put the service behind a gateway that authenticates requests. Teacher actions already have their own token.

## Keep the docs honest

* `python export_openapi.py` regenerates [openapi.json](../openapi.json).
* If you change a response field, search these docs for the field name and update
  [reference/data-models.md](../reference/data-models.md).
* New environment variable → [configuration.md](../configuration.md).
