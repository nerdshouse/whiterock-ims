import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

const STATUS_OPTIONS = ['Pending', 'In Transit', 'Received'];

function formatDate(ms) {
  if (ms == null) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

export default function PurchaseOrders() {
  const { getIdToken } = useAuth();
  const [list, setList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    poNumber: '', warehouseId: '', skuCode: '', quantity: '', etd: new Date().toISOString().slice(0, 10),
  });

  const fetchWarehouses = () => apiGet(getIdToken, '/api/warehouses').then(setWarehouses).catch(() => setWarehouses([]));
  const fetchSkus = () => apiGet(getIdToken, '/api/skus').then(setSkus).catch(() => setSkus([]));
  const fetchList = () => {
    apiGet(getIdToken, '/api/purchase-orders', { withinDays: 60 })
      .then(setList)
      .catch((e) => setError(e.message));
  };

  usePoll(() => { fetchWarehouses(); fetchSkus(); fetchList(); });
  useEffect(() => { fetchWarehouses(); fetchSkus(); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    apiPost(getIdToken, '/api/purchase-orders', {
      poNumber: form.poNumber,
      warehouseId: form.warehouseId,
      skuCode: form.skuCode,
      quantity: Number(form.quantity),
      etd: form.etd || undefined,
    })
      .then(() => {
        setForm({ poNumber: '', warehouseId: '', skuCode: '', quantity: '', etd: new Date().toISOString().slice(0, 10) });
        setShowForm(false);
        fetchList();
      })
      .catch((e) => setError(e.message));
  };

  const setStatus = (id, status) => {
    setError('');
    apiPatch(getIdToken, `/api/purchase-orders/${id}/status`, { status })
      .then(fetchList)
      .catch((e) => setError(e.message));
  };

  const warehouseNames = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Purchase Orders (60-day window)</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowForm((x) => !x)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
        >
          {showForm ? 'Cancel' : 'Create PO'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 border border-gray-200 rounded bg-white grid grid-cols-2 gap-2 max-w-2xl">
          <input placeholder="PO Number (e.g. PO1)" value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required />
          <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={form.skuCode} onChange={(e) => setForm((f) => ({ ...f, skuCode: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required>
            <option value="">Select SKU</option>
            {skus.filter((s) => s.status === 'Active').map((s) => <option key={s.id} value={s.skuCode}>{s.skuCode} – {s.name}</option>)}
          </select>
          <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required />
          <input type="date" value={form.etd} onChange={(e) => setForm((f) => ({ ...f, etd: e.target.value }))} className="border rounded px-2 py-1.5 text-sm col-span-2" />
          <button type="submit" className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm col-span-2">Create PO</button>
        </form>
      )}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">PO Number</th>
              <th className="px-3 py-2 font-medium">Warehouse</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">ETD</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((po) => (
              <tr key={po.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{po.poNumber}</td>
                <td className="px-3 py-2">{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                <td className="px-3 py-2">{po.skuCode}</td>
                <td className="px-3 py-2">{po.quantity}</td>
                <td className="px-3 py-2">{formatDate(po.etd)}</td>
                <td className="px-3 py-2">{po.status}</td>
                <td className="px-3 py-2">
                  {po.status !== 'Received' && (
                    <div className="flex gap-1">
                      {STATUS_OPTIONS.filter((st) => st !== po.status).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setStatus(po.id, st)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-3 py-4 text-gray-500 text-sm">No POs in 60-day window. Create one above.</p>}
      </div>
    </div>
  );
}
