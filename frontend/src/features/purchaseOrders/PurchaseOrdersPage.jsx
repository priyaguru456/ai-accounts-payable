import { useEffect, useState } from 'react';
import { listPurchaseOrders, createPurchaseOrder } from '../../api/purchaseOrders';
import { listVendors } from '../../api/vendors';

const emptyItem = { description: '', quantity: 1, unitPrice: 0 };

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poNumber: '', vendorId: '', orderDate: '', items: [{ ...emptyItem }] });
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    listPurchaseOrders()
      .then(setPos)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    listVendors().then(setVendors);
  }, []);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createPurchaseOrder({
        ...form,
        items: form.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      });
      setForm({ poNumber: '', vendorId: '', orderDate: '', items: [{ ...emptyItem }] });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create purchase order');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Purchase Orders</h1>
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New PO'}</button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleCreate}>
          {error && <div className="alert error">{error}</div>}
          <label>
            PO Number
            <input required value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
          </label>
          <label>
            Vendor
            <select required value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order Date
            <input type="date" required value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
          </label>

          <div className="items-section">
            <h3>Line Items</h3>
            {form.items.map((item, idx) => (
              <div className="item-row" key={idx}>
                <input placeholder="Description" required value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                <input type="number" step="0.001" placeholder="Qty" required value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                <input type="number" step="0.01" placeholder="Unit Price" required value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
              </div>
            ))}
            <button type="button" onClick={addItem}>
              + Add Item
            </button>
          </div>

          <button type="submit">Save Purchase Order</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Vendor</th>
              <th>Order Date</th>
              <th>Total</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => (
              <tr key={po.id}>
                <td>{po.poNumber}</td>
                <td>{po.vendor?.name}</td>
                <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                <td>{po.totalAmount}</td>
                <td>{po.items?.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
