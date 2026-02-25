import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

function formatTime(ms) {
  if (ms == null) return '—';
  return new Date(ms).toLocaleString();
}

export default function History() {
  const { getIdToken } = useAuth();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState([]);

  const fetchWarehouses = () => apiGet(getIdToken, '/api/warehouses').then(setWarehouses).catch(() => setWarehouses([]));
  const fetchList = () => {
    const q = warehouseId ? { warehouseId, limit: 200 } : { limit: 200 };
    apiGet(getIdToken, '/api/history', q).then(setList).catch((e) => setError(e.message));
  };

  usePoll(() => { fetchWarehouses(); fetchList(); }, [warehouseId]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">History (Stock Movements)</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <label className="text-sm text-gray-600 mr-2">Warehouse:</label>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Warehouse</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Delta</th>
              <th className="px-3 py-2 font-medium">Previous</th>
              <th className="px-3 py-2 font-medium">New</th>
              <th className="px-3 py-2 font-medium">PO</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{formatTime(h.timestamp)}</td>
                <td className="px-3 py-2">{h.warehouseId}</td>
                <td className="px-3 py-2">{h.skuCode}</td>
                <td className="px-3 py-2">{h.changeType}</td>
                <td className="px-3 py-2">{h.quantityDelta >= 0 ? '+' : ''}{h.quantityDelta}</td>
                <td className="px-3 py-2">{h.previousStock}</td>
                <td className="px-3 py-2">{h.newStock}</td>
                <td className="px-3 py-2">{h.metadata?.poNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-3 py-4 text-gray-500 text-sm">No movements yet.</p>}
      </div>
    </div>
  );
}
