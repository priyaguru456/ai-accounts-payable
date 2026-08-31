import client from './client';

export const listVendors = (params) => client.get('/vendors', { params }).then((r) => r.data.vendors);
export const getVendor = (id) => client.get(`/vendors/${id}`).then((r) => r.data.vendor);
export const createVendor = (payload) => client.post('/vendors', payload).then((r) => r.data.vendor);
export const updateVendor = (id, payload) => client.patch(`/vendors/${id}`, payload).then((r) => r.data.vendor);
export const deactivateVendor = (id) => client.delete(`/vendors/${id}`).then((r) => r.data.vendor);
