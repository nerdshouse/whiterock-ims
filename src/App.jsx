import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Warehouses from './pages/Warehouses';
import WarehouseView from './pages/WarehouseView';
import Dashboard from './pages/Dashboard';
import SkuMaster from './pages/SkuMaster';
import SkuDatabaseView from './pages/SkuDatabaseView';
import History from './pages/History';
import PurchaseOrders from './pages/PurchaseOrders';
import Members from './pages/Members';

function Layout({ children }) {
  const { user, memberRole, logout } = useAuth();
  const loc = useLocation();
  if (!user) return children;
  const nav = [
    { to: '/warehouses', label: 'Warehouse' },
    { to: '/dashboard', label: 'Current View' },
    { to: '/skus', label: 'SKU Master' },
    { to: '/sku-database', label: 'SKU Database' },
    { to: '/purchase-orders', label: 'Purchase Orders' },
    { to: '/history', label: 'History' },
    ...(memberRole === 'Admin' ? [{ to: '/members', label: 'Members' }] : []),
  ];
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <nav className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  loc.pathname.startsWith(to)
                    ? 'bg-gray-100 text-[var(--color-primary)]'
                    : 'text-[var(--color-muted)] hover:bg-gray-50 hover:text-[var(--color-primary)]'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted)]">{user.email}</span>
            <button type="button" onClick={() => logout()} className="btn-ghost py-1.5 text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function MembersRoute() {
  const { memberRole } = useAuth();
  return memberRole === 'Admin' ? <Members /> : <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/warehouses/:id" element={<WarehouseView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/skus" element={<SkuMaster />} />
              <Route path="/sku-database" element={<SkuDatabaseView />} />
              <Route path="/history" element={<History />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/members" element={<MembersRoute />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
