import client from './client';

export const listPayments = (params) => client.get('/payments', { params }).then((r) => r.data.payments);
export const createPayment = (invoiceId, payload) =>
  client.post(`/payments/invoices/${invoiceId}`, payload).then((r) => r.data.payment);
export const updatePayment = (id, payload) => client.patch(`/payments/${id}`, payload).then((r) => r.data.payment);
