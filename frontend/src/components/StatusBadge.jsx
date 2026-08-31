const COLORS = {
  DRAFT: '#9ca3af',
  PROCESSING: '#60a5fa',
  PENDING_REVIEW: '#fbbf24',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#34d399',
  REJECTED: '#f87171',
  PAID: '#10b981',
  CANCELLED: '#6b7280',
  NOT_CHECKED: '#9ca3af',
  MATCHED: '#34d399',
  MISMATCHED: '#f87171',
  PARTIAL: '#fbbf24',
  LOW: '#34d399',
  MEDIUM: '#fbbf24',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
  PENDING: '#60a5fa',
  COMPLETED: '#10b981',
  FAILED: '#f87171',
};

export default function StatusBadge({ value }) {
  const color = COLORS[value] || '#9ca3af';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: '#111',
        background: color,
        whiteSpace: 'nowrap',
      }}
    >
      {value?.replaceAll('_', ' ')}
    </span>
  );
}
