import { useState, useEffect } from 'react';
import { subscribeWarehouses, subscribeSkus, subscribeAllStock } from '../lib/db';

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function formatShortDate(ms) {
  if (ms == null) return '—';
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export default function Dashboard() {
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState('');

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = subscribeAllStock(setStock);
    return () => unsub();
  }, []);

  const skuMap = Object.fromEntries(skus.map((s) => [s.skuCode, s]));
  const warehouseNames = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  const rows = stock
    .filter((s) => !warehouseFilter || s.warehouseId === warehouseFilter)
    .map((st) => {
      const sku = skuMap[st.skuCode];
      const dailyAvg = num(st.dailyAvgSale);
      const closingStock = num(st.currentStock);
      const stockEndDateMs = dailyAvg > 0 && closingStock >= 0
        ? Date.now() + (closingStock / dailyAvg) * 24 * 60 * 60 * 1000
        : null;
      return {
        id: st.id,
        warehouseName: warehouseNames[st.warehouseId] || st.warehouseId,
        warehouseId: st.warehouseId,
        itemName: sku?.name ?? '—',
        closingStock,
        warehouseStockEndDate: stockEndDateMs,
      };
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">Dashboard</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted)]">Warehouse</label>
          <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="input w-auto min-w-[180px]">
            <option value="">All</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        Single view of warehouse stock: closing stock and when stock is expected to run out. Use this to decide on reordering.
      </p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>Item Name</th>
              <th>Closing Stock</th>
              <th>Warehouse Stock end Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.warehouseName}</td>
                <td>{r.itemName}</td>
                <td>{r.closingStock}</td>
                <td className="text-[var(--color-muted)]">{formatShortDate(r.warehouseStockEndDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-state">No stock data. Add warehouses and stock entries in SKU Database or Warehouse view.</p>
        )}
      </div>
    </div>
  );
}
