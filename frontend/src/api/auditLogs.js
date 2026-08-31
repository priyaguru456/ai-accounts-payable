import client from './client';

export const listAuditLogs = (params) => client.get('/audit-logs', { params }).then((r) => r.data.logs);
