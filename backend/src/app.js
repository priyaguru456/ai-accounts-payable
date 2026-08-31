const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { requestContext, httpLogger } = require('./middleware/requestContext');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const vendorsRoutes = require('./routes/vendors.routes');
const purchaseOrdersRoutes = require('./routes/purchaseOrders.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const approvalsRoutes = require('./routes/approvals.routes');
const paymentsRoutes = require('./routes/payments.routes');
const auditLogsRoutes = require('./routes/auditLogs.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(requestContext);
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/vendors', vendorsRoutes);
app.use('/api/v1/purchase-orders', purchaseOrdersRoutes);
app.use('/api/v1/invoices', invoicesRoutes);
app.use('/api/v1/approvals', approvalsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/audit-logs', auditLogsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
