import client from './client';

export const getDashboardSummary = () => client.get('/dashboard/summary').then((r) => r.data);
export const getRiskFlaggedInvoices = () => client.get('/dashboard/risk').then((r) => r.data.invoices);
