import client from './client';

export const listPurchaseOrders = (params) =>
  client.get('/purchase-orders', { params }).then((r) => r.data.purchaseOrders);
export const getPurchaseOrder = (id) => client.get(`/purchase-orders/${id}`).then((r) => r.data.purchaseOrder);
export const createPurchaseOrder = (payload) =>
  client.post('/purchase-orders', payload).then((r) => r.data.purchaseOrder);
export const createGoodsReceipt = (payload) =>
  client.post('/purchase-orders/goods-receipts', payload).then((r) => r.data.goodsReceipt);
