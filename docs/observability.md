# Observability

## What's implemented (no external accounts required)
- **Structured JSON logging**: `backend/src/config/logger.js` (pino). Every log line is JSON with
  a `service` field, ISO timestamp, and level — ready to ship to CloudWatch/any log aggregator.
- **Correlation IDs**: `backend/src/middleware/requestContext.js` generates (or forwards) an
  `x-correlation-id` per request, attaches it to every log line via AsyncLocalStorage, returns it
  in the response header, and propagates it to `ai-service` calls
  (`backend/src/services/aiServiceClient.js`). Grep any correlation id across backend + ai-service
  logs to follow one request end-to-end without a tracing backend.
- **Circuit breaker**: `aiServiceClient.js` opens after 5 consecutive AI-service failures and
  short-circuits for 30s, so a down ai-service doesn't get hammered by every invoice upload.
- **Error tracking seam**: `backend/src/config/errorTracking.js` — set `SENTRY_DSN` and install
  `@sentry/node` to enable; a safe no-op otherwise.

## What's intentionally not done yet
Full OpenTelemetry (spans/traces visualized in Grafana Tempo, Jaeger, or AWS X-Ray) needs an actual
collector running somewhere — there's nowhere to send traces to in this project's current state (no
cloud account, no local observability stack running). The correlation-id approach above gets you
most of the practical value (finding all log lines for one request) without that infrastructure.

**To upgrade to full tracing** once you have somewhere to send spans:
1. `npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node` in `backend/`.
2. Initialize the SDK before any other import in `server.js`, exporting to your collector's endpoint.
3. Do the same for `ai-service` with the Python OTel SDK (`opentelemetry-instrumentation-fastapi`).
4. Keep the correlation-id header — OTel can pick it up as a baggage/trace attribute so old log
   lines and new trace spans stay cross-referenceable during the migration.
