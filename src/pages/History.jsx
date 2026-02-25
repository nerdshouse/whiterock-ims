import { useState, useEffect } from 'react';
import { subscribeWarehouses, subscribeStockMovements } from '../lib/db';

function formatTime(ms) {
  if (ms == null) return '—';
  return new Date(ms).toLocaleString();
}

export default function History() {
  const [list, setList] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeStockMovements(warehouseId || null, setList);
    return () => unsub();
  }, [warehouseId]);

  return (
    <div>
      <h1 className="page-head">History</h1>
      <div className="mb-6">
        <label className="mb-1 block text-sm text-[var(--color-muted)]">Warehouse</label>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input max-w-xs">
          <option value="">All</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="table-wrapper overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Warehouse</th>
              <th>SKU</th>
              <th>Type</th>
              <th>Delta</th>
              <th>Previous</th>
              <th>New</th>
              <th>PO</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id}>
                <td className="text-[var(--color-muted)]">{formatTime(h.timestamp)}</td>
                <td>{h.warehouseId}</td>
                <td>{h.skuCode}</td>
                <td>{h.changeType}</td>
                <td>{h.quantityDelta >= 0 ? '+' : ''}{h.quantityDelta}</td>
                <td>{h.previousStock}</td>
                <td>{h.newStock}</td>
                <td className="text-[var(--color-muted)]">{h.metadata?.poNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="px-4 py-8 text-center text-[var(--color-muted)]">No movements yet.</p>}
      </div>
    </div>
  );
}
