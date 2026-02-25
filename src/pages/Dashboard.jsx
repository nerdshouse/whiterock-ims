import { useState, useEffect } from 'react';
import {
  getWarehouses,
  setStock,
  subscribeWarehouses,
  subscribeStock,
  subscribeSkus,
} from '../lib/db';

function formatDate(ms) {
  if (ms == null) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStockList] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeStock(selectedWarehouse || null, setStockList);
    return () => unsub();
  }, [selectedWarehouse]);

  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);

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
      safetyStock,
      daysLeft: daysLeft != null ? Math.round(daysLeft * 10) / 10 : null,
      stockOutDate: stockOutDate ? stockOutDate.getTime() : null,
      projectedSales: Math.round(projectedSales * 100) / 100,
      totalWeight: Math.round(totalWeight * 100) / 100,
    };
  });

  const updateStock = async (warehouseId, skuCode, currentStock) => {
    const s = stock.find((x) => x.warehouseId === warehouseId && x.skuCode === skuCode);
    if (!s) return;
    setError('');
    try {
      await setStock(warehouseId, skuCode, { currentStock: Number(currentStock), dailyAvgSale: s.dailyAvgSale, leadTime: s.leadTime }, s.currentStock);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="page-head">Current View</h1>
      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="mb-6">
        <label className="mb-1 block text-sm text-[var(--color-muted)]">Warehouse</label>
        <select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="input max-w-xs">
          <option value="">All</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="table-wrapper overflow-x-auto">
        <table className="min-w-[900px]">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Current Stock</th>
              <th>Daily Avg Sale</th>
              <th>Safety Stock</th>
              <th>Stock-out Date</th>
              <th>Days Left</th>
              <th>Projected Sales</th>
              <th>Total Weight</th>
              <th>Warehouse</th>
              <th className="w-0">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.skuCode} {r.skuName && <span className="text-[var(--color-muted)]">({r.skuName})</span>}</td>
                <td>{r.currentStock}</td>
                <td>{r.dailyAvgSale}</td>
                <td>{r.safetyStock}</td>
                <td>{formatDate(r.stockOutDate)}</td>
                <td>{r.daysLeft != null ? r.daysLeft : '—'}</td>
                <td>{r.projectedSales}</td>
                <td>{r.totalWeight}</td>
                <td className="text-[var(--color-muted)]">{warehouses.find((w) => w.id === r.warehouseId)?.name || r.warehouseId}</td>
                <td>
                  <button type="button" onClick={() => { const v = prompt('Closing stock:', r.currentStock); if (v !== null) updateStock(r.warehouseId, r.skuCode, v); }} className="btn-ghost py-1 text-xs">Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-[var(--color-muted)]">No stock. Add warehouses and stock records.</p>}
      </div>
    </div>
  );
}
