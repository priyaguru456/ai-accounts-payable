import { useEffect, useState } from 'react';
import { listVendors, createVendor } from '../../api/vendors';

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', gstin: '' });
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    listVendors()
      .then(setVendors)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createVendor(form);
      setForm({ name: '', email: '', phone: '', gstin: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create vendor');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Vendors</h1>
        <button onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New Vendor'}</button>
      </div>

      {showForm && (
        <form className="card form-grid" onSubmit={handleCreate}>
          {error && <div className="alert error">{error}</div>}
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            GSTIN
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </label>
          <button type="submit">Save Vendor</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>GSTIN</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.email || '-'}</td>
                <td>{v.phone || '-'}</td>
                <td>{v.gstin || '-'}</td>
                <td>{v.isActive ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
