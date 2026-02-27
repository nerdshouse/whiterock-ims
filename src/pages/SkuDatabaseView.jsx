import { useState, useEffect } from 'react';
import {
  subscribeWarehouses,
  subscribeSkus,
  subscribeAllStock,
  addSku,
  addStockRecord,
  updateSku,
  updateStock,
  deleteStockRecord,
  getSkuByCode,
} from '../lib/db';

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

function formatClosingStockDate(ms) {
  if (ms == null) return '—';
  const d = new Date(ms);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateInput(ms) {
  if (ms == null) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function formatINR(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹ 0.00';
  const [intPart, decPart] = n.toFixed(2).split('.');
  const len = intPart.length;
  if (len <= 3) return `₹ ${intPart}.${decPart}`;
  let result = intPart.slice(-3);
  let i = len - 3;
  while (i > 0) {
    const start = Math.max(0, i - 2);
    result = intPart.slice(start, i) + ',' + result;
    i = start;
  }
  return '₹ ' + result + '.' + decPart;
}

function escapeCsvCell(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadSkuDatabaseCsv(rows, formatShortDateFn) {
  const headers = [
    'Warehouse', 'SKU', 'Item Name', 'Weight (kg)', 'Pcs in a Box', 'Lead time', 'Purchase Rate', 'Sell rate',
    'Daily average', 'Safety Stock (Days)', 'Safety Stock (QTY)', 'Seasonal Buffer (Days)', 'Seasonal Buffer (QTY)',
    'Growth Buffer (Days)', 'Growth Buffer (QTY)', 'Re-order Point', 'Closing Stock', 'Closing stock update date',
    'Effective Stock', 'Stock end (days)',
  ];
  const line = (r) => [
    escapeCsvCell(r.warehouseName),
    escapeCsvCell(r.skuCode),
    escapeCsvCell(r.itemName),
    escapeCsvCell(r.weightKg),
    escapeCsvCell(r.pcsInBox),
    escapeCsvCell(r.leadTime),
    escapeCsvCell(r.purchaseRate),
    escapeCsvCell(r.sellRate),
    escapeCsvCell(r.dailyAvg),
    escapeCsvCell(r.safetyStockDays),
    escapeCsvCell(r.safetyStockQty),
    escapeCsvCell(r.seasonalBufferDays),
    escapeCsvCell(r.seasonalBufferQty),
    escapeCsvCell(r.growthBufferDays),
    escapeCsvCell(r.growthBufferQty),
    escapeCsvCell(r.reorderPoint != null ? Math.round(r.reorderPoint) : ''),
    escapeCsvCell(r.closingStock),
    escapeCsvCell(r.closingStockUpdateDate != null ? formatShortDateFn(r.closingStockUpdateDate) : ''),
    escapeCsvCell(r.effectiveStock),
    escapeCsvCell(r.stockEndDays != null ? r.stockEndDays : ''),
  ].join(',');
  const csv = [headers.join(','), ...rows.map(line)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sku-database-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SkuDatabaseView() {
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [error, setError] = useState('');
  const [addRowModal, setAddRowModal] = useState(false);
  const [addSkuModal, setAddSkuModal] = useState(false);
  const [editModal, setEditModal] = useState(null); // { row, skuEdits, stockEdits }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { row }
  const [submitting, setSubmitting] = useState(false);
  const [addRowForm, setAddRowForm] = useState({ warehouseId: '', skuCode: '' });

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

  function getStockRows() {
    let list = stock;
    if (warehouseFilter) list = list.filter((s) => s.warehouseId === warehouseFilter);
    return list.map((st) => {
      const sku = skuMap[st.skuCode];
      const dailyAvg = num(st.dailyAvgSale);
      const leadTime = num(st.leadTime);
      const safetyDays = st.safetyStockDays != null ? num(st.safetyStockDays) : (dailyAvg > 0 ? num(st.safetyStock) / dailyAvg : 0);
      const seasonalDays = st.seasonalBufferDays != null ? num(st.seasonalBufferDays) : (dailyAvg > 0 ? num(st.seasonalBuffer) / dailyAvg : 0);
      const growthDays = st.growthBufferDays != null ? num(st.growthBufferDays) : (dailyAvg > 0 ? num(st.stockForGrowth) / dailyAvg : 0);
      const safetyQty = Math.round(dailyAvg * safetyDays);
      const seasonalQty = Math.round(dailyAvg * seasonalDays);
      const growthQty = Math.round(dailyAvg * growthDays);
      const reorderPoint = dailyAvg * leadTime + safetyQty + seasonalQty + growthQty;
      const closingStock = num(st.currentStock);
      const totalBufferQty = safetyQty + seasonalQty + growthQty;
      // Effective Stock = closing stock − (safety stock QTY + seasonal stock QTY + growth buffer stock QTY)
      const effectiveStock = closingStock - totalBufferQty;
      const stockEndDays = dailyAvg > 0 ? Math.round(effectiveStock / dailyAvg) : null;
      return {
        ...st,
        sku,
        warehouseName: warehouseNames[st.warehouseId] || st.warehouseId,
        itemName: sku?.name ?? '—',
        weightKg: num(sku?.weightPerUnit),
        pcsInBox: num(sku?.pcsInBox),
        purchaseRate: num(sku?.purchaseRate),
        sellRate: num(sku?.sellRate),
        dailyAvg,
        leadTime,
        safetyStockDays: safetyDays,
        seasonalBufferDays: seasonalDays,
        growthBufferDays: growthDays,
        safetyStockQty: safetyQty,
        seasonalBufferQty: seasonalQty,
        growthBufferQty: growthQty,
        reorderPoint,
        closingStock,
        closingStockUpdateDate: st.closingStockUpdateDate ?? st.updatedAt,
        effectiveStock,
        stockEndDays,
        monthlyPurchaseProj: dailyAvg * 30 * num(sku?.purchaseRate),
        monthlySellProj: dailyAvg * 30 * num(sku?.sellRate),
      };
    });
  }

  const rows = getStockRows();
  const totalMonthlyPurchase = rows.reduce((s, r) => s + r.monthlyPurchaseProj, 0);
  const totalMonthlySell = rows.reduce((s, r) => s + r.monthlySellProj, 0);

  const handleAddRow = async (e) => {
    e.preventDefault();
    const warehouseId = addRowForm.warehouseId?.trim();
    const skuCode = addRowForm.skuCode?.trim();
    if (!warehouseId || !skuCode) {
      setError('Please select warehouse and SKU');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await addStockRecord(warehouseId, skuCode, {
        currentStock: 0,
        dailyAvgSale: 0,
        leadTime: 0,
        safetyStockDays: 0,
        seasonalBufferDays: 0,
        growthBufferDays: 0,
      });
      setAddRowForm({ warehouseId: '', skuCode: '' });
      setAddRowModal(false);
    } catch (err) {
      setError(err.message || 'Failed to add row');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSkuSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const skuCode = form.skuCode?.value?.trim();
    const name = form.name?.value?.trim();
    if (!skuCode || !name) return;
    setError('');
    setSubmitting(true);
    try {
      const existing = await getSkuByCode(skuCode);
      if (existing) throw new Error('SKU code already exists');
      await addSku({
        skuCode,
        name,
        category: '',
        status: 'Active',
        purchaseRate: Number(form.purchaseRate?.value) || 0,
        sellRate: Number(form.sellRate?.value) || 0,
        weightPerUnit: Number(form.weightKg?.value) || 0,
        pcsInBox: Number(form.pcsInBox?.value) || 0,
      });
      setAddSkuModal(false);
    } catch (err) {
      setError(err.message || 'Failed to add SKU');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    const { row, skuEdits, stockEdits } = editModal;
    setError('');
    setSubmitting(true);
    try {
      if (row.sku && Object.keys(skuEdits).length > 0) {
        await updateSku(row.sku.id, skuEdits);
      }
      const stockPayload = {};
      if (stockEdits.leadTime !== undefined && stockEdits.leadTime !== '') stockPayload.leadTime = Number(stockEdits.leadTime);
      if (stockEdits.dailyAvgSale !== undefined && stockEdits.dailyAvgSale !== '') stockPayload.dailyAvgSale = Number(stockEdits.dailyAvgSale);
      if (stockEdits.safetyStockDays !== undefined && stockEdits.safetyStockDays !== '') stockPayload.safetyStockDays = Number(stockEdits.safetyStockDays);
      if (stockEdits.seasonalBufferDays !== undefined && stockEdits.seasonalBufferDays !== '') stockPayload.seasonalBufferDays = Number(stockEdits.seasonalBufferDays);
      if (stockEdits.growthBufferDays !== undefined && stockEdits.growthBufferDays !== '') stockPayload.growthBufferDays = Number(stockEdits.growthBufferDays);
      // Always include currentStock when updating a stock row so Dashboard and real-time listeners get the latest value
      if (row.warehouseId != null && row.skuCode != null) {
        const v = stockEdits.currentStock;
        const numVal = v !== undefined && v !== null && v !== '' ? Number(v) : NaN;
        stockPayload.currentStock = Number.isFinite(numVal) ? numVal : Number(row.closingStock ?? row.currentStock ?? 0);
      }
      if (stockEdits.closingStockUpdateDate !== undefined) {
        if (stockEdits.closingStockUpdateDate !== null && stockEdits.closingStockUpdateDate !== '') {
          const ms = typeof stockEdits.closingStockUpdateDate === 'number' ? stockEdits.closingStockUpdateDate : new Date(stockEdits.closingStockUpdateDate).getTime();
          if (Number.isFinite(ms)) stockPayload.closingStockUpdateDate = ms;
        } else {
          stockPayload.closingStockUpdateDate = null;
        }
      }
      if (Object.keys(stockPayload).length > 0) {
        await updateStock(row.warehouseId, row.skuCode, stockPayload);
      }
      setEditModal(null);
    } catch (err) {
      setError(err.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row) => {
    setEditModal({
      row,
      skuEdits: {
        name: row.itemName || '',
        weightPerUnit: row.weightKg ?? '',
        pcsInBox: row.pcsInBox ?? '',
        purchaseRate: row.purchaseRate ?? '',
        sellRate: row.sellRate ?? '',
      },
      stockEdits: {
        leadTime: row.leadTime ?? '',
        dailyAvgSale: row.dailyAvg ?? '',
        safetyStockDays: row.safetyStockDays ?? '',
        seasonalBufferDays: row.seasonalBufferDays ?? '',
        growthBufferDays: row.growthBufferDays ?? '',
        currentStock: row.closingStock ?? '',
        closingStockUpdateDate: row.closingStockUpdateDate,
      },
    });
    setError('');
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    setSubmitting(true);
    try {
      const { row } = deleteConfirm;
      // Delete this warehouse+SKU stock row
      await deleteStockRecord(row.warehouseId, row.skuCode);

      // If this was the last stock row for this SKU across all warehouses,
      // mark the SKU as Inactive so it no longer appears in dropdowns.
      const remainingForSku = stock.filter(
        (s) => s.skuCode === row.skuCode && s.id !== row.id,
      );
      if (remainingForSku.length === 0 && row.sku?.id) {
        await updateSku(row.sku.id, { status: 'Inactive' });
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">SKU Database</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-[var(--color-muted)]">Warehouse</label>
          <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="input w-auto min-w-[180px]">
            <option value="">All</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => { setAddRowModal(true); setError(''); }} className="btn-primary">Add row</button>
          <button type="button" onClick={() => { setAddSkuModal(true); setError(''); }} className="btn-secondary">Add SKU</button>
          <button type="button" onClick={() => downloadSkuDatabaseCsv(rows, formatClosingStockDate)} className="btn-secondary" disabled={rows.length === 0}>Download CSV</button>
        </div>
      </div>

      {error && (
        <div className="alert-error mb-4">{error}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm">
        <div>
          <span className="text-[var(--color-muted)]">Monthly Purchase Projection:</span>
          <span className="ml-2 font-medium">{formatINR(totalMonthlyPurchase)}</span>
          <span className="ml-1 text-xs text-[var(--color-muted)]">(daily average × 30 × purchase rate)</span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Monthly Sell projection:</span>
          <span className="ml-2 font-medium">{formatINR(totalMonthlySell)}</span>
          <span className="ml-1 text-xs text-[var(--color-muted)]">(daily average × 30 × sell rate)</span>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>Warehouse</th>
              <th rowSpan={2}>SKU</th>
              <th rowSpan={2}>Item Name</th>
              <th rowSpan={2}>Weight (kg)</th>
              <th rowSpan={2}>Pcs in a Box</th>
              <th rowSpan={2}>Lead time</th>
              <th rowSpan={2}>Purchase Rate</th>
              <th rowSpan={2}>Sell rate</th>
              <th rowSpan={2}>Daily average</th>
              <th colSpan={2} className="bg-[#dbeafe]">Safety Stock</th>
              <th colSpan={2} className="bg-[#fef3c7]">Seasonal Buffer</th>
              <th colSpan={2} className="bg-[#d1fae5]">Growth Buffer</th>
              <th rowSpan={2}>Re-order Point</th>
              <th rowSpan={2}>Closing Stock</th>
              <th rowSpan={2}>Closing stock update date</th>
              <th rowSpan={2}>Effective Stock</th>
              <th rowSpan={2}>Stock end (days)</th>
              <th rowSpan={2} className="w-0 whitespace-nowrap">Actions</th>
            </tr>
            <tr>
              <th className="bg-[#dbeafe]">Days</th>
              <th className="bg-[#dbeafe]">Quantity</th>
              <th className="bg-[#fef3c7]">Days</th>
              <th className="bg-[#fef3c7]">Quantity</th>
              <th className="bg-[#d1fae5]">Days</th>
              <th className="bg-[#d1fae5]">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.warehouseName}</td>
                <td className="font-medium">{r.skuCode}</td>
                <td>{r.itemName}</td>
                <td>{r.weightKg != null && r.weightKg !== '' ? `${r.weightKg} KG` : '—'}</td>
                <td>{r.pcsInBox}</td>
                <td>{r.leadTime != null && r.leadTime !== '' ? `${r.leadTime} Days` : '—'}</td>
                <td>{r.purchaseRate != null && r.purchaseRate !== '' ? `₹ ${r.purchaseRate}` : '—'}</td>
                <td>{r.sellRate != null && r.sellRate !== '' ? `₹ ${r.sellRate}` : '—'}</td>
                <td>{r.dailyAvg}</td>
                <td className="bg-[#eff6ff]">{r.safetyStockDays != null && r.safetyStockDays !== '' ? `${r.safetyStockDays} Days` : '—'}</td>
                <td className="bg-[#eff6ff]">{r.safetyStockQty}</td>
                <td className="bg-[#fffbeb]">{r.seasonalBufferDays != null && r.seasonalBufferDays !== '' ? `${r.seasonalBufferDays} Days` : '—'}</td>
                <td className="bg-[#fffbeb]">{r.seasonalBufferQty}</td>
                <td className="bg-[#ecfdf5]">{r.growthBufferDays != null && r.growthBufferDays !== '' ? `${r.growthBufferDays} Days` : '—'}</td>
                <td className="bg-[#ecfdf5]">{r.growthBufferQty}</td>
                <td>{Math.round(r.reorderPoint)}</td>
                <td>{r.closingStock}</td>
                <td className="text-[var(--color-muted)]">{formatClosingStockDate(r.closingStockUpdateDate)}</td>
                <td>{r.effectiveStock}</td>
                <td>{r.stockEndDays != null ? `${r.stockEndDays} Days` : '—'}</td>
                <td className="whitespace-nowrap">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openEdit(r)} className="btn-ghost py-1 text-xs">Edit</button>
                    <button type="button" onClick={() => setDeleteConfirm({ row: r })} className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-state">
            No entries yet. Add a warehouse and SKUs, then use &quot;Add row&quot; to create stock entries.
          </p>
        )}
      </div>

      {/* Add row modal */}
      {addRowModal && (
        <div className="modal-backdrop" onClick={() => { setAddRowModal(false); setError(''); setAddRowForm({ warehouseId: '', skuCode: '' }); }}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Add row</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">Create a new stock entry (warehouse + SKU). Edit the row after to set quantities and buffers.</p>
            {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}
            <form onSubmit={handleAddRow} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Warehouse</label>
                <select value={addRowForm.warehouseId} onChange={(e) => setAddRowForm((f) => ({ ...f, warehouseId: e.target.value }))} className="input w-full" required>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">SKU</label>
                <select value={addRowForm.skuCode} onChange={(e) => setAddRowForm((f) => ({ ...f, skuCode: e.target.value }))} className="input w-full" required>
                  <option value="">Select SKU</option>
                  {skus.filter((s) => s.status === 'Active').map((s) => (
                    <option key={s.id} value={s.skuCode}>{s.skuCode} – {s.name}</option>
                  ))}
                </select>
                {skus.filter((s) => s.status === 'Active').length === 0 && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">No active SKUs. Use &quot;Add SKU&quot; first.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={submitting || !addRowForm.warehouseId || !addRowForm.skuCode || skus.filter((s) => s.status === 'Active').length === 0} className="btn-primary">{submitting ? 'Adding…' : 'Add'}</button>
                <button type="button" onClick={() => { setAddRowModal(false); setError(''); setAddRowForm({ warehouseId: '', skuCode: '' }); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add SKU modal */}
      {addSkuModal && (
        <div className="modal-backdrop" onClick={() => { setAddSkuModal(false); setError(''); }}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Add SKU</h2>
            <form onSubmit={handleAddSkuSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">SKU Code</label>
                <input name="skuCode" placeholder="e.g. SKU001" className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Item Name</label>
                <input name="name" placeholder="Item name" className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Weight (kg)</label>
                <input name="weightKg" type="number" step="any" min="0" placeholder="0" className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Pcs in a Box</label>
                <input name="pcsInBox" type="number" min="0" placeholder="0" className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Purchase Rate</label>
                <input name="purchaseRate" type="number" step="any" min="0" placeholder="0" className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Sell rate</label>
                <input name="sellRate" type="number" step="any" min="0" placeholder="0" className="input w-full" />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Adding…' : 'Add SKU'}</button>
                <button type="button" onClick={() => { setAddSkuModal(false); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="modal-backdrop" onClick={() => { setEditModal(null); setError(''); }}>
          <div className="card modal-content max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit – {editModal.row.skuCode} ({editModal.row.warehouseName})</h2>
            <form onSubmit={handleEditSave} className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--color-muted)]">SKU (Item)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Item Name</label>
                    <input
                      value={editModal.skuEdits.name}
                      onChange={(e) => setEditModal((m) => ({ ...m, skuEdits: { ...m.skuEdits, name: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Weight (kg)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editModal.skuEdits.weightPerUnit}
                      onChange={(e) => setEditModal((m) => ({ ...m, skuEdits: { ...m.skuEdits, weightPerUnit: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Pcs in a Box</label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.skuEdits.pcsInBox}
                      onChange={(e) => setEditModal((m) => ({ ...m, skuEdits: { ...m.skuEdits, pcsInBox: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Purchase Rate</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editModal.skuEdits.purchaseRate}
                      onChange={(e) => setEditModal((m) => ({ ...m, skuEdits: { ...m.skuEdits, purchaseRate: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Sell rate</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editModal.skuEdits.sellRate}
                      onChange={(e) => setEditModal((m) => ({ ...m, skuEdits: { ...m.skuEdits, sellRate: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-[var(--color-muted)]">Stock (warehouse)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Lead time (days)</label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.stockEdits.leadTime}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, leadTime: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Daily average</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editModal.stockEdits.dailyAvgSale}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, dailyAvgSale: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Safety Stock (Days)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editModal.stockEdits.safetyStockDays}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, safetyStockDays: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Seasonal Buffer (Days)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editModal.stockEdits.seasonalBufferDays}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, seasonalBufferDays: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Growth Buffer (Days)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editModal.stockEdits.growthBufferDays}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, growthBufferDays: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Closing Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={editModal.stockEdits.currentStock}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, currentStock: e.target.value } }))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">Closing stock update date</label>
                    <input
                      type="date"
                      value={editModal.stockEdits.closingStockUpdateDate ? formatDateInput(editModal.stockEdits.closingStockUpdateDate) : ''}
                      onChange={(e) => setEditModal((m) => ({ ...m, stockEdits: { ...m.stockEdits, closingStockUpdateDate: e.target.value ? new Date(e.target.value).getTime() : null } }))}
                      className="input w-full"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => { setEditModal(null); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Delete entry</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Delete stock entry <strong>{deleteConfirm.row.skuCode}</strong> at <strong>{deleteConfirm.row.warehouseName}</strong>? This cannot be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleDelete} disabled={submitting} className="btn-danger">{submitting ? 'Deleting…' : 'Delete'}</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
