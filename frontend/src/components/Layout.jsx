import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: null },
  { to: '/vendors', label: 'Vendors', roles: null },
  { to: '/purchase-orders', label: 'Purchase Orders', roles: null },
  { to: '/invoices', label: 'Invoices', roles: null },
  { to: '/approvals', label: 'Approvals', roles: ['ADMIN', 'FINANCE_MANAGER', 'APPROVER'] },
  { to: '/payments', label: 'Payments', roles: ['ADMIN', 'FINANCE_MANAGER'] },
  { to: '/audit-logs', label: 'Audit Log', roles: ['ADMIN', 'AUDITOR'] },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">AP Automation</div>
        <nav>
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-panel">
          <div className="user-name">{user?.name}</div>
          <div className="user-role">{user?.role}</div>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
