# System endpoints

## `GET /`

Service banner. Useful to check that the service is up **and** whether an AI key is configured.

**Response 200**

```json
{
  "message": "Study Plan Generator API",
  "version": "2.1",
  "ai_configured": true,
  "auth_required": false,
  "endpoints": [
    "/analyze-lecture", "/generate-diagnostic-mcq", "/generate-dynamic-slide", "/generate-topic-quiz",
    "/analyze-quiz-results", "/save-quiz-results", "/get-lecture-plan", "/rag/query", "/classroom"
  ]
}
```

| Field | Notes |
|---|---|
| `version` | API version string (`2.1`). The lecture-plan `metadata.processingVersion` is versioned separately |
| `ai_configured` | `true` when `OPENROUTER_API_KEY` is non-empty. It does **not** verify that the key is valid |
| `auth_required` | `true` when `API_TOKEN` is set, i.e. callers must send `X-API-Key` (this endpoint itself stays open) |

## `GET /health`

Liveness probe. Does no I/O.

```json
{ "status": "healthy" }
```

Use it for load-balancer / container health checks:

```bash
curl -f http://localhost:8001/health
```

## Interactive documentation

FastAPI serves, without extra configuration:

| URL | Content |
|---|---|
| `/docs` | Swagger UI (try requests in the browser) |
| `/redoc` | ReDoc reference |
| `/openapi.json` | Live schema (a committed copy is at [../openapi.json](../openapi.json)) |
