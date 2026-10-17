"""Write the service's OpenAPI schema to backend/docs/openapi.json.

Run after changing any endpoint or request model so the docs stay in sync:

    python export_openapi.py
"""
import json
from pathlib import Path

import main

target = Path(__file__).resolve().parent.parent / "docs" / "openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(main.app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {target}")
