import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvoice, reprocessInvoice, matchInvoice } from '../../api/invoices';
import StatusBadge from '../../components/StatusBadge';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  const load = () => {
    setLoading(true);
    getInvoice(id)
      .then(setInvoice)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleReprocess = async () => {
    setActionMessage('Reprocessing triggered...');
    await reprocessInvoice(id);
    setTimeout(load, 1500);
  };

  const handleMatch = async () => {
    await matchInvoice(id);
    load();
  };

  if (loading) return <p>Loading...</p>;
  if (!invoice) return <p>Invoice not found</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Invoice {invoice.invoiceNumber}</h1>
        <div>
          <button onClick={handleMatch}>Re-run Match</button>
          <button onClick={handleReprocess}>Reprocess (AI)</button>
        </div>
      </div>
      {actionMessage && <div className="alert info">{actionMessage}</div>}

      <div className="detail-grid">
        <section className="card">
          <h2>Overview</h2>
          <dl>
            <dt>Vendor</dt>
            <dd>{invoice.vendor?.name}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge value={invoice.status} />
            </dd>
            <dt>Match Status</dt>
            <dd>
              <StatusBadge value={invoice.matchStatus} />
            </dd>
            <dt>Total Amount</dt>
            <dd>
              {invoice.currency} {invoice.totalAmount}
            </dd>
            <dt>Invoice Date</dt>
            <dd>{new Date(invoice.invoiceDate).toLocaleDateString()}</dd>
            <dt>Document</dt>
            <dd>
              {invoice.documentUrl ? (
                <a href={invoice.documentUrl} target="_blank" rel="noreferrer">
                  View original
                </a>
              ) : (
                '-'
              )}
            </dd>
          </dl>
        </section>

        <section className="card">
          <h2>AI Extraction</h2>
          {invoice.aiExtraction ? (
            <dl>
              <dt>Confidence</dt>
              <dd>{invoice.aiExtraction.confidence != null ? `${(invoice.aiExtraction.confidence * 100).toFixed(1)}%` : '-'}</dd>
              <dt>Model</dt>
              <dd>{invoice.aiExtraction.modelName || '-'}</dd>
              {invoice.aiExtraction.errorMessage && <div className="alert error">{invoice.aiExtraction.errorMessage}</div>}
              <dt>Extracted Data</dt>
              <dd>
                <pre className="json-block">{JSON.stringify(invoice.aiExtraction.extractedData, null, 2)}</pre>
              </dd>
            </dl>
          ) : (
            <p>Not yet processed.</p>
          )}
        </section>

        <section className="card">
          <h2>Risk Assessment</h2>
          {invoice.riskAssessment ? (
            <dl>
              <dt>Score</dt>
              <dd>{invoice.riskAssessment.riskScore}</dd>
              <dt>Level</dt>
              <dd>
                <StatusBadge value={invoice.riskAssessment.riskLevel} />
              </dd>
              <dt>Reasons</dt>
              <dd>
                <ul>
                  {(invoice.riskAssessment.reasons || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </dd>
            </dl>
          ) : (
            <p>Not yet assessed.</p>
          )}
        </section>

        <section className="card">
          <h2>Line Items</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unitPrice}</td>
                  <td>{item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Approval History</h2>
          {invoice.approvals?.length ? (
            <ul>
              {invoice.approvals.map((a) => (
                <li key={a.id}>
                  <StatusBadge value={a.status} /> by {a.approver?.name} {a.comments && `- "${a.comments}"`}
                </li>
              ))}
            </ul>
          ) : (
            <p>No approval actions yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
