import { useEffect, useState } from 'react';
import { listAuditLogs } from '../../api/auditLogs';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLogs()
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Audit Log</h1>
      <table className="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Entity</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.action}</td>
              <td>
                {log.entity} #{log.entityId}
              </td>
              <td>{log.user?.name || 'system'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
