import client from './client';

export const listPendingApprovals = () => client.get('/approvals/pending').then((r) => r.data.invoices);
export const actOnApproval = (invoiceId, status, comments) =>
  client.post(`/approvals/invoices/${invoiceId}`, { status, comments }).then((r) => r.data.approval);
