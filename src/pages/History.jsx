import { useState, useEffect } from 'react';
import { subscribeWarehouses, subscribeAllStock } from '../lib/db';

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function History() {
  const [warehouses, setWarehouses] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllStock(setStock);
    return () => unsub();
  }, []);

  const warehouseNames = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  const rows = stock
    .filter((s) => !warehouseId || s.warehouseId === warehouseId)
    .map((s) => {
      const dailyAvg = num(s.dailyAvgSale);
      const safetyDays = s.safetyStockDays != null ? num(s.safetyStockDays) : (dailyAvg > 0 ? num(s.safetyStock) / dailyAvg : 0);
      const seasonalDays = s.seasonalBufferDays != null ? num(s.seasonalBufferDays) : (dailyAvg > 0 ? num(s.seasonalBuffer) / dailyAvg : 0);
      const growthDays = s.growthBufferDays != null ? num(s.growthBufferDays) : (dailyAvg > 0 ? num(s.stockForGrowth) / dailyAvg : 0);
      return {
        id: s.id,
        warehouseId: s.warehouseId,
        warehouseName: warehouseNames[s.warehouseId] || s.warehouseId,
        skuCode: s.skuCode,
        dailyAverage: dailyAvg,
        safetyStockDays: safetyDays,
        seasonalBufferDays: seasonalDays,
        growthBufferDays: growthDays,
        updatedAt: s.updatedAt ?? s.closingStockUpdateDate,
      };
    });

  return (
    <div>
      <h1 className="page-head">History</h1>
      <p className="mb-4 text-sm text-[var(--color-muted)]">
        History entries cannot be deleted manually. Data older than 90 days is removed automatically.
      </p>
      <div className="mb-6">
        <label className="mb-1 block text-sm text-[var(--color-muted)]">Warehouse</label>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input max-w-xs">
          <option value="">All</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
      <div className="table-wrapper overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Warehouse</th>
              <th>SKU</th>
              <th>Daily average</th>
              <th>Safety Stock (Days)</th>
              <th>Seasonal Buffer (Days)</th>
              <th>Growth Buffer (Days)</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.warehouseName}</td>
                <td className="font-medium">{r.skuCode}</td>
                <td>{r.dailyAverage}</td>
                <td>{r.safetyStockDays}</td>
                <td>{r.seasonalBufferDays}</td>
                <td>{r.growthBufferDays}</td>
                <td className="text-[var(--color-muted)]">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-state">No stock entries. Add data in SKU Database.</p>
        )}
      </div>
    </div>
  );
}
