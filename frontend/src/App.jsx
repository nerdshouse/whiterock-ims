import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Warehouses from './pages/Warehouses';
import WarehouseView from './pages/WarehouseView';
import Dashboard from './pages/Dashboard';
import SkuMaster from './pages/SkuMaster';
import History from './pages/History';
import PurchaseOrders from './pages/PurchaseOrders';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  if (!user) return children;

  const nav = [
    { to: '/warehouses', label: 'Warehouse' },
    { to: '/dashboard', label: 'Current View' },
    { to: '/skus', label: 'Database (SKU Master)' },
    { to: '/purchase-orders', label: 'Purchase Orders' },
    { to: '/history', label: 'History' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex gap-4">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                loc.pathname.startsWith(to) ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{user.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/warehouses" element={<Warehouses />} />
                <Route path="/warehouses/:id" element={<WarehouseView />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/skus" element={<SkuMaster />} />
                <Route path="/history" element={<History />} />
                <Route path="/purchase-orders" element={<PurchaseOrders />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
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
