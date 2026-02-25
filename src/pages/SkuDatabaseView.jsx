import { useState, useEffect } from 'react';
import { subscribeWarehouses, subscribeSkus, subscribeStock } from '../lib/db';

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export default function SkuDatabaseView() {
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!warehouseId) {
      setStock([]);
      return;
    }
    const unsub = subscribeStock(warehouseId, setStock);
    return () => unsub();
  }, [warehouseId]);

  useEffect(() => {
    if (warehouseId || warehouses.length === 0) return;
    setWarehouseId(warehouses[0]?.id ?? '');
  }, [warehouses, warehouseId]);

  const skuMap = Object.fromEntries(skus.map((s) => [s.skuCode, s]));

  const rows = stock.map((st) => {
    const sku = skuMap[st.skuCode];
    const dailyAvg = num(st.dailyAvgSale);
    const safety = num(st.safetyStock);
    const closing = num(st.currentStock);
    const leadTime = num(st.leadTime);
    const purchaseRate = num(sku?.purchaseRate);
    const sellRate = num(sku?.sellRate);
    const reorderPoint = safety + dailyAvg * leadTime;
    const netSellable = Math.max(0, closing - safety);
    const reorderQty = Math.max(0, Math.ceil(reorderPoint - closing));
    const monthlyPurchaseProj = dailyAvg * 30 * purchaseRate;
    const monthlySellProj = dailyAvg * 30 * sellRate;
    return {
      ...st,
      skuName: sku?.name ?? '—',
      weightKg: num(sku?.weightPerUnit),
      pcsInBox: num(sku?.pcsInBox),
      purchaseRate,
      sellRate,
      dailyAvg,
      safetyStock: safety,
      seasonalBuffer: num(st.seasonalBuffer),
      stockForGrowth: num(st.stockForGrowth),
      reorderPoint,
      closingStock: closing,
      netSellableStock: netSellable,
      reorderQty,
      monthlyPurchaseProj,
      monthlySellProj,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      monthlyPurchaseProj: acc.monthlyPurchaseProj + r.monthlyPurchaseProj,
      monthlySellProj: acc.monthlySellProj + r.monthlySellProj,
    }),
    { monthlyPurchaseProj: 0, monthlySellProj: 0 }
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">SKU Database View</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted)]">Warehouse</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input w-auto min-w-[180px]">
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {warehouseId && (
        <>
          <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--color-primary)]">Automatic calculations</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Monthly Purchase Projection = daily average × 30 × purchase rate
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Monthly Sell projection = daily average × 30 × sell rate
            </p>
            <div className="mt-2 flex flex-wrap gap-6 text-sm">
              <span><strong>Total Monthly Purchase Projection:</strong> {totals.monthlyPurchaseProj.toFixed(2)}</span>
              <span><strong>Total Monthly Sell projection:</strong> {totals.monthlySellProj.toFixed(2)}</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Item Name</th>
                  <th>Weight (kg)</th>
                  <th>Pcs in a Box</th>
                  <th>Purchase Rate</th>
                  <th>Sell rate</th>
                  <th>Daily average</th>
                  <th>Safety stock</th>
                  <th>Seasonal buffer</th>
                  <th>Stock for Growth</th>
                  <th>Reorder point</th>
                  <th>Closing stock</th>
                  <th>Net Sellable Stock</th>
                  <th>Reorder QTY</th>
                  <th>Monthly Purchase Proj.</th>
                  <th>Monthly Sell Proj.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.skuCode}</td>
                    <td>{r.skuName}</td>
                    <td>{r.weightKg}</td>
                    <td>{r.pcsInBox}</td>
                    <td>{r.purchaseRate}</td>
                    <td>{r.sellRate}</td>
                    <td>{r.dailyAvg}</td>
                    <td>{r.safetyStock}</td>
                    <td>{r.seasonalBuffer}</td>
                    <td>{r.stockForGrowth}</td>
                    <td>{r.reorderPoint.toFixed(0)}</td>
                    <td>{r.closingStock}</td>
                    <td>{r.netSellableStock}</td>
                    <td>{r.reorderQty}</td>
                    <td className="text-[var(--color-muted)]">{r.monthlyPurchaseProj.toFixed(2)}</td>
                    <td className="text-[var(--color-muted)]">{r.monthlySellProj.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-4 py-8 text-center text-[var(--color-muted)]">No stock in this warehouse. Add stock from the warehouse view.</p>
            )}
          </div>
        </>
      )}
      {!warehouseId && warehouses.length > 0 && (
        <p className="text-[var(--color-muted)]">Select a warehouse to see the SKU database view.</p>
      )}
      {warehouses.length === 0 && (
        <p className="text-[var(--color-muted)]">Add a warehouse first, then add stock to see data here.</p>
      )}
    </div>
  );
}
