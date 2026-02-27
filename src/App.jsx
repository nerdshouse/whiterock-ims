import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Warehouses from './pages/Warehouses';
import WarehouseView from './pages/WarehouseView';
import Dashboard from './pages/Dashboard';
import SkuDatabaseView from './pages/SkuDatabaseView';
import History from './pages/History';
import PurchaseOrders from './pages/PurchaseOrders';
import Members from './pages/Members';
import Settings from './pages/Settings';

function Layout({ children }) {
  const { user, memberRole, logout } = useAuth();
  const loc = useLocation();
  if (!user) return children;
  const nav = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/warehouses', label: 'Warehouse' },
    { to: '/sku-database', label: 'SKU Database' },
    { to: '/purchase-orders', label: 'PO' },
    { to: '/history', label: 'History' },
    ...(memberRole === 'Admin' ? [{ to: '/settings', label: 'Settings' }] : []),
  ];
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <nav className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`nav-link ${loc.pathname.startsWith(to) ? 'active' : ''}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted)] truncate max-w-[180px]">{user.email}</span>
            <button type="button" onClick={() => logout()} className="btn-ghost text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-muted)]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SettingsRoute() {
  const { memberRole } = useAuth();
  return memberRole === 'Admin' ? <Settings /> : <Navigate to="/warehouses" replace />;
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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/warehouses/:id" element={<WarehouseView />} />
              <Route path="/sku-database" element={<SkuDatabaseView />} />
              <Route path="/history" element={<History />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/settings" element={<SettingsRoute />} />
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
