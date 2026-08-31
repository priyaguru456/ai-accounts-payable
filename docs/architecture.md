# Architecture

## Services

| Service | Stack | Responsibility |
|---|---|---|
| backend | Node.js, Express 5, Prisma, MySQL | REST API, auth/RBAC, business rules, orchestrates AI calls |
| ai-service | Python, FastAPI | OCR + LLM extraction, risk assessment. Internal-only |
| worker | Node.js, BullMQ | Async invoice processing pipeline (queue consumer) |
| frontend | React, Vite | User-facing SPA |

## Invoice lifecycle

```
DRAFT -> PROCESSING -> (PENDING_REVIEW | PENDING_APPROVAL) -> APPROVED -> PAID
                                                             -> REJECTED
```

`PROCESSING` triggers the AI pipeline (`backend/src/modules/invoiceProcessing/processInvoice.js`):
1. OCR + LLM extraction (`ai-service /extract`) -> `AIExtraction`
2. Fuzzy duplicate detection (`backend/src/modules/duplicateDetection`)
3. 2-way/3-way PO/goods-receipt matching (`backend/src/modules/matching`) -> `matchStatus`
4. Risk assessment (`ai-service /assess-risk`) -> `AIRiskAssessment`
5. Status decision: low confidence, high/critical risk, fuzzy duplicates, or a mismatched PO always
   route to `PENDING_REVIEW` (human-in-the-loop). Otherwise `PENDING_APPROVAL`.

AI output never has write/approve authority on its own — only a human approver (via `/approvals`)
can move an invoice to `APPROVED` or `REJECTED`.

## Queueing

`backend/src/services/queueService.js` enqueues onto BullMQ (`invoice-processing` queue) when
`REDIS_URL` is set. If unset (e.g. local dev without Redis running), it falls back to processing
the invoice inline in the backend process, so the pipeline still works end-to-end without extra
infrastructure.

## AI service boundary

The AI service is stateless, has no direct DB access, and is only reachable from `backend`/`worker`
via an internal shared secret header (`X-Internal-Key`). It must be deployed on a private subnet in
any real environment (see `docs/ai-pipeline.md` for the full AI architecture).
