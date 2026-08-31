import client from './client';

export const listInvoices = (params) => client.get('/invoices', { params }).then((r) => r.data.invoices);
export const getInvoice = (id) => client.get(`/invoices/${id}`).then((r) => r.data.invoice);
export const uploadInvoice = (formData) =>
  client.post('/invoices/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data.invoice);
export const reprocessInvoice = (id) => client.post(`/invoices/${id}/reprocess`).then((r) => r.data);
export const matchInvoice = (id) => client.post(`/invoices/${id}/match`).then((r) => r.data);
