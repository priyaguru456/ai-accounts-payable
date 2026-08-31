# AI Accounts Payable Automation Platform

A production-grade AP automation platform: vendor management, purchase orders, AI-powered
invoice OCR/extraction, 2-way/3-way PO matching, duplicate detection, AI risk assessment,
approval workflows, payment tracking, audit logs, and a reporting dashboard.

## Architecture

- **backend/** — Node.js + Express 5 + Prisma ORM, MySQL. REST API, auth/RBAC, business logic.
- **ai-service/** — Python + FastAPI. OCR + LLM invoice extraction, risk assessment. Internal-only,
  never exposed to the internet; called only by `backend`/`worker`.
- **worker/** — Node.js + BullMQ. Consumes the `invoice-processing` queue and runs the AI pipeline
  asynchronously (reuses `backend/src/modules/invoiceProcessing` directly).
- **frontend/** — React + Vite. All user-facing screens.
- **infrastructure/** — `docker-compose.yml` for local parity; AWS deployment notes below.

See `docs/architecture.md`, `docs/api.md`, and `docs/ai-pipeline.md` for details.

## Local development

### Prerequisites
- Node.js 22+
- Python 3.12+
- MySQL 8
- Redis (optional — if `REDIS_URL` is unset, the backend processes invoices inline instead of via
  a queue, which is fine for local dev without the worker running)

### 1. Backend
```
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### 2. AI service
```
cd ai-service
python -m venv venv && venv\Scripts\activate   # (already created; re-run if needed)
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY, INTERNAL_API_KEY
uvicorn app.main:app --reload --port 8000
```

### 3. Worker (optional locally; needs Redis)
```
cd worker
cp .env.example .env
npm install
npm run dev
```

### 4. Frontend
```
cd frontend
npm install
npm run dev
```

### All-in-one with Docker
```
cd infrastructure
docker compose up --build
```

## Security notes
- Rotate the `JWT_SECRET` and `DATABASE_URL` password currently in `backend/.env` before this repo
  is pushed anywhere public — they were pre-populated in the scaffold.
- The AI service must never be reachable from outside the private network in any deployed
  environment; it is authenticated only by a shared internal key, not end-user auth.
