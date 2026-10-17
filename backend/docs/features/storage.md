# Feature: Persistence

The FastAPI service has no database. State is split between small JSON files and process memory.

## 1. Where things live

| Data | Location | Survives restart? | Retention |
|---|---|---|---|
| Lecture plans | `DATA_DIR/lecture_plans.json` | yes | newest **10** |
| Quiz results | `DATA_DIR/quiz_results.json` | yes | newest **50** |
| Retrieval collections | `DATA_DIR/rag/<sessionId>.json` | yes (embeddings are recomputed) | unbounded (see [rag §7](rag.md#7-operations)) |
| Live classes | process memory (`classroom._classes`) | **no** | 12 h, max 200 |
| Loaded ML models, image-search cache | process memory | no | process lifetime |

`DATA_DIR` defaults to `backend/fastapi-service/data` and is git-ignored. Override with the `DATA_DIR`
environment variable (read once at import time).

## 2. File formats

* `lecture_plans.json`: a JSON array of [lecture plans](../reference/data-models.md#lecture-plan), newest first,
  each with an added `generated_at` ISO timestamp.
* `quiz_results.json`: a JSON array of objects with the fields of `SaveResultsRequest` plus `timestamp` and
  `saved_at`.
* `rag/*.json`: a JSON array of documents `{id, text, kind, meta}`.

All files are UTF-8, pretty-printed (plans/results) or compact (retrieval), and safe to read with any JSON tool.

## 3. Write algorithm

`_prepend_json_list(path, item, keep)` (plans and results):

1. acquire the global `_file_lock`;
2. create `DATA_DIR` if needed;
3. read the current list (missing file or unreadable JSON → empty list, with a log line);
4. write `[item] + list[:keep-1]` to `<file>.tmp`;
5. `os.replace(tmp, file)`: atomic on the same filesystem, so a crash never leaves half a file.

`VectorStore._save` uses the same temp-file + replace approach under its own lock.

## 4. Behaviours worth knowing

* **Corrupt file = silent reset.** If a file cannot be parsed it is treated as empty and overwritten on the
  next write. Keep backups if the data matters.
* **Rolling out plans leaves orphans.** When the 11th plan is saved, the oldest plan disappears from
  `lecture_plans.json` but its `rag/<sessionId>.json` stays.
* **Single process.** Locks are per process. Two service processes writing the same `DATA_DIR` could
  overwrite each other's plan list. Run one process, or give each its own `DATA_DIR`.
* **Privacy.** Plans and retrieval files contain lecture text and generated explanations; quiz results contain
  question text and answers. No account data is stored by the FastAPI service.

## 5. Operations

| Task | How |
|---|---|
| Back up | Copy the `data/` directory while the service is idle (or at any time for the atomically written files) |
| Reset everything | Stop the service and delete `data/` |
| Move to another disk | Set `DATA_DIR` and copy the folder |
| Inspect a plan | `curl localhost:8001/get-lecture-plan?latest=true` or open the JSON file |
| Remove old retrieval data | Delete files in `data/rag/` whose id is not in `lecture_plans.json` |

## 6. Tests

All tests point `DATA_DIR` at a fresh temp directory before importing the app, so they never touch real data.
`test_api.py`: `test_save_quiz_results_round_trip`, `test_get_lecture_plan_lookup_rules`.
`test_features.py`: `test_add_replaces_by_id_and_persists`.
