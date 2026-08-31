import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadInvoice } from '../../api/invoices';
import { listVendors } from '../../api/vendors';
import { listPurchaseOrders } from '../../api/purchaseOrders';

const emptyItem = { description: '', quantity: 1, unitPrice: 0 };

export default function UploadInvoicePage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    vendorId: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    purchaseOrderId: '',
    currency: 'INR',
    subtotal: '',
    taxAmount: '',
    totalAmount: '',
    items: [{ ...emptyItem }],
  });

  useEffect(() => {
    listVendors().then(setVendors);
    listPurchaseOrders().then(setPurchaseOrders);
  }, []);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Please attach the invoice document');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'items') {
          fd.append('items', JSON.stringify(value.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) }))));
        } else if (value !== '') {
          fd.append(key, value);
        }
      });

      const invoice = await uploadInvoice(fd);
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Upload Invoice</h1>
      <form className="card form-grid" onSubmit={handleSubmit}>
        {error && <div className="alert error">{error}</div>}

        <label>
          Invoice Document (PDF/PNG/JPEG)
          <input type="file" accept=".pdf,image/png,image/jpeg" required onChange={(e) => setFile(e.target.files[0])} />
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
          Purchase Order (optional)
          <select value={form.purchaseOrderId} onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}>
            <option value="">No linked PO</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.poNumber}
              </option>
            ))}
          </select>
        </label>

        <label>
          Invoice Number
          <input required value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
        </label>

        <label>
          Invoice Date
          <input type="date" required value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
        </label>

        <label>
          Due Date
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </label>

        <label>
          Currency
          <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </label>

        <label>
          Subtotal
          <input type="number" step="0.01" required value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
        </label>

        <label>
          Tax Amount
          <input type="number" step="0.01" required value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} />
        </label>

        <label>
          Total Amount
          <input type="number" step="0.01" required value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
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

        <button type="submit" disabled={submitting}>
          {submitting ? 'Uploading...' : 'Upload Invoice'}
        </button>
      </form>
    </div>
  );
}
