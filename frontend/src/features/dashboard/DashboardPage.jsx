import { useEffect, useState } from 'react';
import { getDashboardSummary, getRiskFlaggedInvoices } from '../../api/dashboard';
import StatusBadge from '../../components/StatusBadge';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [riskInvoices, setRiskInvoices] = useState([]);

  useEffect(() => {
    getDashboardSummary().then(setSummary);
    getRiskFlaggedInvoices().then(setRiskInvoices);
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {summary && (
        <div className="kpi-row">
          <div className="kpi-tile">
            <div className="kpi-value">{summary.totalPayable}</div>
            <div className="kpi-label">Total Payable</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-value">{summary.overdueCount}</div>
            <div className="kpi-label">Overdue Invoices</div>
          </div>
          {summary.statusCounts.map((s) => (
            <div className="kpi-tile" key={s.status}>
              <div className="kpi-value">{s.count}</div>
              <div className="kpi-label">{s.status.replaceAll('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}

      <h2>High/Critical Risk Invoices</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {riskInvoices.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.invoiceNumber}</td>
              <td>{inv.vendor?.name}</td>
              <td>{inv.totalAmount}</td>
              <td>
                <StatusBadge value={inv.riskAssessment?.riskLevel} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
