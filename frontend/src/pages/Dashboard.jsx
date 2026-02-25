import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

function formatDate(ms) {
  if (ms == null) return '—';
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { getIdToken } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStock] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [error, setError] = useState('');

  const fetchWarehouses = () => apiGet(getIdToken, '/api/warehouses').then(setWarehouses).catch(() => setWarehouses([]));
  const fetchStock = () => {
    const q = selectedWarehouse ? { warehouseId: selectedWarehouse } : {};
    return apiGet(getIdToken, '/api/stock', q).then(setStock).catch(() => setStock([]));
  };
  const fetchSkus = () => apiGet(getIdToken, '/api/skus').then(setSkus).catch(() => setSkus([]));

  usePoll(() => { fetchWarehouses(); fetchStock(); }, [selectedWarehouse]);
  useEffect(() => { fetchSkus(); }, []);

  const skuMap = Object.fromEntries(skus.map((s) => [s.skuCode, s]));

  const rows = stock.map((s) => {
    const sku = skuMap[s.skuCode] || {};
    const dailyAvgSale = Number(s.dailyAvgSale) || 0;
    const leadTime = Number(s.leadTime) || 0;
    const safetyStock = dailyAvgSale * leadTime;
    const daysLeft = dailyAvgSale > 0 ? s.currentStock / dailyAvgSale : null;
    const stockOutDate = daysLeft != null ? new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000) : null;
    const projectedSales = (Number(s.currentStock) || 0) * (Number(sku.sellRate) || 0);
    const totalWeight = (Number(s.currentStock) || 0) * (Number(sku.weightPerUnit) || 0);
    return {
      ...s,
      skuName: sku.name,
      category: sku.category,
      sellRate: sku.sellRate,
      weightPerUnit: sku.weightPerUnit,
      safetyStock,
      daysLeft: daysLeft != null ? Math.round(daysLeft * 10) / 10 : null,
      stockOutDate: stockOutDate ? stockOutDate.getTime() : null,
      projectedSales: Math.round(projectedSales * 100) / 100,
      totalWeight: Math.round(totalWeight * 100) / 100,
    };
  });

  const updateStock = (warehouseId, skuCode, currentStock) => {
    const s = stock.find((x) => x.warehouseId === warehouseId && x.skuCode === skuCode);
    if (!s) return;
    apiPut(getIdToken, `/api/stock/${warehouseId}/${encodeURIComponent(skuCode)}`, {
      currentStock: Number(currentStock),
      dailyAvgSale: s.dailyAvgSale,
      leadTime: s.leadTime,
    })
      .then(() => { fetchStock(); setError(''); })
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Current View (Dashboard)</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <label className="text-sm text-gray-600 mr-2">Warehouse:</label>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[900px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Current Stock</th>
              <th className="px-3 py-2 font-medium">Daily Avg Sale</th>
              <th className="px-3 py-2 font-medium">Safety Stock</th>
              <th className="px-3 py-2 font-medium">Stock-out Date</th>
              <th className="px-3 py-2 font-medium">Days Left</th>
              <th className="px-3 py-2 font-medium">Projected Sales</th>
              <th className="px-3 py-2 font-medium">Total Weight</th>
              <th className="px-3 py-2 font-medium">Warehouse</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{r.skuCode} {r.skuName && `(${r.skuName})`}</td>
                <td className="px-3 py-2">{r.currentStock}</td>
                <td className="px-3 py-2">{r.dailyAvgSale}</td>
                <td className="px-3 py-2">{r.safetyStock}</td>
                <td className="px-3 py-2">{formatDate(r.stockOutDate)}</td>
                <td className="px-3 py-2">{r.daysLeft != null ? r.daysLeft : '—'}</td>
                <td className="px-3 py-2">{r.projectedSales}</td>
                <td className="px-3 py-2">{r.totalWeight}</td>
                <td className="px-3 py-2 text-gray-600">
                  {warehouses.find((w) => w.id === r.warehouseId)?.name || r.warehouseId}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = prompt('Closing stock:', r.currentStock);
                      if (v !== null) updateStock(r.warehouseId, r.skuCode, v);
                    }}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-3 py-4 text-gray-500 text-sm">No stock. Add warehouses, SKUs, and stock records.</p>
        )}
      </div>
    </div>
  );
}
