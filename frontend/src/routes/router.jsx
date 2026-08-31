import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtectedRoute from '../auth/ProtectedRoute';
import LoginPage from '../features/auth/LoginPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import VendorsPage from '../features/vendors/VendorsPage';
import PurchaseOrdersPage from '../features/purchaseOrders/PurchaseOrdersPage';
import InvoicesPage from '../features/invoices/InvoicesPage';
import UploadInvoicePage from '../features/invoices/UploadInvoicePage';
import InvoiceDetailPage from '../features/invoices/InvoiceDetailPage';
import ApprovalsPage from '../features/approvals/ApprovalsPage';
import PaymentsPage from '../features/payments/PaymentsPage';
import AuditLogPage from '../features/audit/AuditLogPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/vendors', element: <VendorsPage /> },
          { path: '/purchase-orders', element: <PurchaseOrdersPage /> },
          { path: '/invoices', element: <InvoicesPage /> },
          { path: '/invoices/upload', element: <UploadInvoicePage /> },
          { path: '/invoices/:id', element: <InvoiceDetailPage /> },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER', 'APPROVER']} />,
            children: [{ path: '/approvals', element: <ApprovalsPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN', 'FINANCE_MANAGER']} />,
            children: [{ path: '/payments', element: <PaymentsPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']} />,
            children: [{ path: '/audit-logs', element: <AuditLogPage /> }],
          },
        ],
      },
    ],
  },
]);
