import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInvoices } from '../../api/invoices';
import StatusBadge from '../../components/StatusBadge';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    listInvoices(statusFilter ? { status: statusFilter } : {})
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  return (
    <div>
      <div className="page-header">
        <h1>Invoices</h1>
        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Link to="/invoices/upload" className="button-link">
            Upload Invoice
          </Link>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Vendor</th>
              <th>Total</th>
              <th>Status</th>
              <th>Match</th>
              <th>Risk</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>{inv.vendor?.name}</td>
                <td>{inv.totalAmount}</td>
                <td>
                  <StatusBadge value={inv.status} />
                </td>
                <td>
                  <StatusBadge value={inv.matchStatus} />
                </td>
                <td>{inv.riskAssessment ? <StatusBadge value={inv.riskAssessment.riskLevel} /> : '-'}</td>
                <td>
                  <Link to={`/invoices/${inv.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
