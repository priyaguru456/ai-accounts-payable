# API Reference

Base URL: `/api/v1`. All routes except `/auth/register` and `/auth/login` require
`Authorization: Bearer <JWT>`.

## Auth
- `POST /auth/register` — `{ email, password, name, role? }`
- `POST /auth/login` — `{ email, password }` -> `{ user, token }`
- `GET /auth/me`

## Users (ADMIN only)
- `GET /users`
- `PATCH /users/:id` — `{ role?, status? }`

## Vendors
- `GET /vendors?search=&isActive=`
- `GET /vendors/:id`
- `POST /vendors` (ADMIN, AP_SPECIALIST)
- `PATCH /vendors/:id` (ADMIN, AP_SPECIALIST)
- `DELETE /vendors/:id` — soft-delete (ADMIN)

## Purchase Orders
- `GET /purchase-orders?vendorId=`
- `GET /purchase-orders/:id`
- `POST /purchase-orders` — `{ poNumber, vendorId, orderDate, items: [{description, quantity, unitPrice}] }`
- `POST /purchase-orders/:id/items` — `{ items: [...] }`
- `POST /purchase-orders/goods-receipts` — `{ receiptNumber, purchaseOrderId, receivedDate, items }`

## Invoices
- `GET /invoices?status=&vendorId=&matchStatus=`
- `GET /invoices/:id`
- `POST /invoices/upload` — multipart: `document` file + invoice metadata fields + `items` (JSON string)
- `POST /invoices/:id/reprocess` — re-runs the AI pipeline
- `POST /invoices/:id/match` — manually re-runs 2-way/3-way matching

## Approvals
- `GET /approvals/pending` (ADMIN, FINANCE_MANAGER, APPROVER)
- `POST /approvals/invoices/:id` — `{ status: "APPROVED"|"REJECTED", comments? }`

## Payments
- `GET /payments?status=`
- `POST /payments/invoices/:id` — `{ amount, paymentDate?, transactionId? }` (invoice must be APPROVED)
- `PATCH /payments/:id` — `{ status, transactionId?, paymentDate? }`; `COMPLETED` flips invoice to `PAID`

## Audit Logs (ADMIN, AUDITOR)
- `GET /audit-logs?entity=&userId=&invoiceId=&from=&to=`

## Dashboard
- `GET /dashboard/summary` — status counts, total payable, overdue count
- `GET /dashboard/risk` — invoices with HIGH/CRITICAL risk assessment
