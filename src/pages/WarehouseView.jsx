import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getWarehouse,
  setStock,
  addStockRecord,
  subscribeStock,
  subscribeSkus,
} from '../lib/db';

export default function WarehouseView() {
  const { id } = useParams();
  const [warehouse, setWarehouse] = useState(null);
  const [stock, setStockList] = useState([]);
  const [skus, setSkus] = useState([]);
  const [error, setError] = useState('');
  const [showAddStock, setShowAddStock] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [addCurrent, setAddCurrent] = useState('');
  const [addDaily, setAddDaily] = useState('');
  const [addLead, setAddLead] = useState('');
  const [addSafety, setAddSafety] = useState('');
  const [addSeasonal, setAddSeasonal] = useState('');
  const [addGrowth, setAddGrowth] = useState('');
  const [editingStock, setEditingStock] = useState(null); // { skuCode, currentStock, dailyAvgSale, leadTime, safetyStockDays, seasonalBufferDays, growthBufferDays }

  useEffect(() => {
    if (!id) return;
    getWarehouse(id).then(setWarehouse);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = subscribeStock(id, setStockList);
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);

  const updateStock = async (warehouseId, skuCode, currentStock, dailyAvgSale, leadTime, safetyStockDays, seasonalBufferDays, growthBufferDays) => {
    setError('');
    try {
      const prev = stock.find((s) => s.warehouseId === warehouseId && s.skuCode === skuCode);
      await setStock(warehouseId, skuCode, {
        currentStock: Number(currentStock),
        dailyAvgSale: Number(dailyAvgSale),
        leadTime: Number(leadTime),
        safetyStockDays: Number(safetyStockDays) || 0,
        seasonalBufferDays: Number(seasonalBufferDays) || 0,
        growthBufferDays: Number(growthBufferDays) || 0,
      }, prev?.currentStock ?? null);
      setEditingStock(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEditStock = () => {
    if (!editingStock) return;
    updateStock(id, editingStock.skuCode, editingStock.currentStock, editingStock.dailyAvgSale, editingStock.leadTime, editingStock.safetyStockDays, editingStock.seasonalBufferDays, editingStock.growthBufferDays);
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!addSku) return;
    setError('');
    try {
      await addStockRecord(id, addSku.trim(), {
        currentStock: Number(addCurrent) || 0,
        dailyAvgSale: Number(addDaily) || 0,
        leadTime: Number(addLead) || 0,
        safetyStockDays: Number(addSafety) || 0,
        seasonalBufferDays: Number(addSeasonal) || 0,
        growthBufferDays: Number(addGrowth) || 0,
      });
      setAddSku('');
      setAddCurrent('');
      setAddDaily('');
      setAddLead('');
      setAddSafety('');
      setAddSeasonal('');
      setAddGrowth('');
      setShowAddStock(false);
    } catch (e) {
      setError(e.message || 'Failed to add stock line');
    }
  };

  if (!warehouse) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-muted)]">Loading…</div>;

  const skuMap = Object.fromEntries(skus.map((s) => [s.skuCode, s]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/warehouses" className="link text-sm">← Warehouses</Link>
        <h1 className="page-head mb-0">{warehouse.name}</h1>
        {warehouse.location && <span className="text-sm text-[var(--color-muted)]">{warehouse.location}</span>}
      </div>
      {error && <div className="alert-error mb-4">{error}</div>}
      <div className="mb-6">
        <button type="button" onClick={() => setShowAddStock((x) => !x)} className="btn-secondary">
          {showAddStock ? 'Cancel' : 'Add stock line'}
        </button>
      </div>
      {showAddStock && (
        <form onSubmit={handleAddStock} className="card mb-6 max-w-3xl p-6">
          <h2 className="mb-4 text-lg font-semibold">Add stock line</h2>
          {skus.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No SKUs yet. Add SKUs from SKU Database (use &quot;Add SKU&quot; there) first.</p>
          ) : (
            <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">SKU</label>
              <select value={addSku} onChange={(e) => setAddSku(e.target.value)} className="input" required>
                <option value="">Select SKU</option>
                {skus.filter((s) => !stock.some((st) => st.skuCode === s.skuCode)).map((s) => <option key={s.id} value={s.skuCode}>{s.skuCode} – {s.name}</option>)}
              </select>
              {skus.filter((s) => !stock.some((st) => st.skuCode === s.skuCode)).length === 0 && skus.length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-muted)]">All SKUs already have stock in this warehouse.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Current stock</label>
              <input type="number" min="0" placeholder="0" value={addCurrent} onChange={(e) => setAddCurrent(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Daily avg sale</label>
              <input type="number" step="any" min="0" placeholder="0" value={addDaily} onChange={(e) => setAddDaily(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Lead time (days)</label>
              <input type="number" min="0" placeholder="0" value={addLead} onChange={(e) => setAddLead(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Safety stock (days)</label>
              <input type="number" min="0" step="any" placeholder="0" value={addSafety} onChange={(e) => setAddSafety(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Seasonal buffer (days)</label>
              <input type="number" min="0" step="any" placeholder="0" value={addSeasonal} onChange={(e) => setAddSeasonal(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--color-muted)]">Growth buffer (days)</label>
              <input type="number" min="0" step="any" placeholder="0" value={addGrowth} onChange={(e) => setAddGrowth(e.target.value)} className="input" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={!addSku || skus.filter((s) => !stock.some((st) => st.skuCode === s.skuCode)).length === 0}>Add</button>
            <button type="button" onClick={() => setShowAddStock(false)} className="btn-secondary">Cancel</button>
          </div>
            </>
          )}
        </form>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Current Stock</th>
              <th>Daily Avg Sale</th>
              <th>Lead Time (days)</th>
              <th className="w-0 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.id}>
                <td>{s.skuCode} {skuMap[s.skuCode]?.name && <span className="text-[var(--color-muted)]">({skuMap[s.skuCode].name})</span>}</td>
                <td>{s.currentStock}</td>
                <td>{s.dailyAvgSale}</td>
                <td>{s.leadTime}</td>
                <td className="whitespace-nowrap">
                  <button type="button" onClick={() => setEditingStock({ skuCode: s.skuCode, currentStock: s.currentStock, dailyAvgSale: s.dailyAvgSale, leadTime: s.leadTime, safetyStockDays: s.safetyStockDays ?? (s.dailyAvgSale > 0 && s.safetyStock ? s.safetyStock / s.dailyAvgSale : 0), seasonalBufferDays: s.seasonalBufferDays ?? (s.dailyAvgSale > 0 && s.seasonalBuffer ? s.seasonalBuffer / s.dailyAvgSale : 0), growthBufferDays: s.growthBufferDays ?? (s.dailyAvgSale > 0 && s.stockForGrowth ? s.stockForGrowth / s.dailyAvgSale : 0) })} className="btn-ghost py-1 text-xs">Update stock</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.length === 0 && <p className="empty-state">No stock records. Use &quot;Add stock line&quot; to add one.</p>}
      </div>

      {/* Edit stock modal */}
      {editingStock && (
        <div className="modal-backdrop" onClick={() => setEditingStock(null)}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Update stock</h2>
            <p className="mb-3 text-sm text-[var(--color-muted)]">{editingStock.skuCode} {skuMap[editingStock.skuCode]?.name && `– ${skuMap[editingStock.skuCode].name}`}</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Current stock</label>
                <input type="number" min="0" value={editingStock.currentStock} onChange={(e) => setEditingStock((x) => ({ ...x, currentStock: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Daily avg sale</label>
                <input type="number" step="any" min="0" value={editingStock.dailyAvgSale} onChange={(e) => setEditingStock((x) => ({ ...x, dailyAvgSale: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Lead time (days)</label>
                <input type="number" min="0" value={editingStock.leadTime} onChange={(e) => setEditingStock((x) => ({ ...x, leadTime: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Safety stock (days)</label>
                <input type="number" min="0" step="any" value={editingStock.safetyStockDays} onChange={(e) => setEditingStock((x) => ({ ...x, safetyStockDays: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Seasonal buffer (days)</label>
                <input type="number" min="0" step="any" value={editingStock.seasonalBufferDays} onChange={(e) => setEditingStock((x) => ({ ...x, seasonalBufferDays: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Growth buffer (days)</label>
                <input type="number" min="0" step="any" value={editingStock.growthBufferDays} onChange={(e) => setEditingStock((x) => ({ ...x, growthBufferDays: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleEditStock} className="btn-primary">Save</button>
              <button type="button" onClick={() => setEditingStock(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
