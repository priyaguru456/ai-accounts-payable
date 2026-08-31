import { useEffect, useState } from 'react';
import { listPendingApprovals, actOnApproval } from '../../api/approvals';
import StatusBadge from '../../components/StatusBadge';

export default function ApprovalsPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState({});
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    listPendingApprovals()
      .then(setInvoices)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAction = async (invoiceId, status) => {
    setError('');
    // Optimistically remove the invoice from the queue immediately, since the two
    // outcomes of an approve/reject are "stays gone" (success) or "comes back with an
    // error to retry" (failure) — no in-between state the user needs to see.
    const previous = invoices;
    setInvoices((current) => current.filter((inv) => inv.id !== invoiceId));

    try {
      await actOnApproval(invoiceId, status, comments[invoiceId] || '');
    } catch (err) {
      setInvoices(previous);
      setError(err.response?.data?.error || `Failed to ${status === 'APPROVED' ? 'approve' : 'reject'} invoice`);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Pending Approvals</h1>
      {error && <div className="alert error">{error}</div>}
      {invoices.length === 0 && <p>Nothing pending your approval.</p>}
      {invoices.map((inv) => (
        <div className="card" key={inv.id}>
          <div className="page-header">
            <div>
              <strong>{inv.invoiceNumber}</strong> - {inv.vendor?.name} - {inv.totalAmount}
            </div>
            {inv.riskAssessment && <StatusBadge value={inv.riskAssessment.riskLevel} />}
          </div>
          {inv.riskAssessment?.reasons && (
            <ul>
              {inv.riskAssessment.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <input
            placeholder="Comments (optional)"
            value={comments[inv.id] || ''}
            onChange={(e) => setComments({ ...comments, [inv.id]: e.target.value })}
          />
          <div>
            <button onClick={() => handleAction(inv.id, 'APPROVED')}>Approve</button>
            <button onClick={() => handleAction(inv.id, 'REJECTED')}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
