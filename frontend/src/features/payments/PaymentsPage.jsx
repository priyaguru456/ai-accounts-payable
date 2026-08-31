import { useEffect, useState } from 'react';
import { listPayments, updatePayment } from '../../api/payments';
import StatusBadge from '../../components/StatusBadge';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listPayments()
      .then(setPayments)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const markCompleted = async (id) => {
    await updatePayment(id, { status: 'COMPLETED' });
    load();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Payments</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.invoice?.invoiceNumber}</td>
              <td>{p.invoice?.vendor?.name}</td>
              <td>{p.amount}</td>
              <td>
                <StatusBadge value={p.status} />
              </td>
              <td>
                {p.status !== 'COMPLETED' && <button onClick={() => markCompleted(p.id)}>Mark Completed</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
