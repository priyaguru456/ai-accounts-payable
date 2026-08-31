FROM node:22-slim AS base
WORKDIR /app

# Reuses backend/src/modules/invoiceProcessing directly (see src/jobs/processInvoice.job.js),
# so both service directories are needed inside the image.
COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm ci --omit=dev

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/prisma ./backend/prisma
RUN cd backend && npx prisma generate
COPY backend/src ./backend/src

COPY worker/src ./worker/src

WORKDIR /app/worker
CMD ["node", "src/index.js"]
