import { useState, useEffect } from 'react';
import {
  addPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  subscribeWarehouses,
  subscribeSkus,
  subscribePurchaseOrders,
  subscribeAllStock,
} from '../lib/db';

const STATUS_OPTIONS = ['Pending', 'In Transit', 'Received'];

function formatDate(ms) {
  if (ms == null) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

function formatShortDate(ms) {
  if (ms == null) return '—';
  const d = new Date(ms);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function PurchaseOrders() {
  const [list, setList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ poNumber: '', warehouseId: '', skuCode: '', quantity: '', etd: new Date().toISOString().slice(0, 10), eta: '' });
  const [statusModal, setStatusModal] = useState(null); // { po, newStatus } when open
  const [statusReason, setStatusReason] = useState('');
  const [stockList, setStockList] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { po } when open
  const [deleting, setDeleting] = useState(false);
  const [editModal, setEditModal] = useState(null); // { po } when open
  const [editForm, setEditForm] = useState({ poNumber: '', quantity: '', etd: '', eta: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribePurchaseOrders(60, setList);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllStock(setStockList);
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await addPurchaseOrder({
        poNumber: form.poNumber.trim(),
        warehouseId: form.warehouseId.trim(),
        skuCode: form.skuCode.trim(),
        quantity: Number(form.quantity) || 1,
        etd: form.etd || undefined,
        eta: form.eta?.trim() || undefined,
      });
      setForm({ poNumber: '', warehouseId: '', skuCode: '', quantity: '', etd: new Date().toISOString().slice(0, 10), eta: '' });
      setShowForm(false);
    } catch (e) {
      setError(e.message || 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async () => {
    if (!statusModal) return;
    const reason = statusReason.trim();
    if (!reason) {
      setError('Please enter a reason for the status change.');
      return;
    }
    setError('');
    try {
      await updatePurchaseOrderStatus(statusModal.po.id, statusModal.newStatus, reason);
      setStatusModal(null);
      setStatusReason('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleStatusClick = (po, newStatus) => {
    if (po.status === 'Pending') {
      setError('');
      updatePurchaseOrderStatus(po.id, newStatus, '').catch((e) => setError(e.message));
    } else {
      setStatusModal({ po, newStatus });
      setStatusReason('');
      setError('');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    setDeleting(true);
    try {
      await deletePurchaseOrder(deleteConfirm.po.id);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (po) => {
    setEditModal({ po });
    setEditForm({
      poNumber: po.poNumber || '',
      quantity: String(po.quantity ?? ''),
      etd: po.etd ? new Date(po.etd).toISOString().slice(0, 10) : '',
      eta: po.eta ? new Date(po.eta).toISOString().slice(0, 10) : '',
    });
    setError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModal) return;
    setError('');
    setEditSubmitting(true);
    try {
      const qty = Number(editForm.quantity);
      if (!Number.isFinite(qty) || qty < 1) throw new Error('Quantity must be at least 1');
      await updatePurchaseOrder(editModal.po.id, {
        poNumber: editForm.poNumber.trim(),
        quantity: qty,
        etd: editForm.etd || undefined,
        eta: editForm.eta?.trim() || null,
      });
      setEditModal(null);
    } catch (e) {
      setError(e.message || 'Failed to update PO');
    } finally {
      setEditSubmitting(false);
    }
  };

  const warehouseNames = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  function getStockForPo(po) {
    return stockList.find((s) => s.warehouseId === po.warehouseId && s.skuCode === po.skuCode);
  }

  function computePoRow(po) {
    const stock = getStockForPo(po);
    const dailyAvgSale = stock?.dailyAvgSale ?? 0;
    const currentStock = stock?.currentStock ?? 0;
    const poQtyStockEndDays = dailyAvgSale > 0 ? Math.round(po.quantity / dailyAvgSale) : null;
    const totalStockEndDays = dailyAvgSale > 0 ? Math.round((currentStock + po.quantity) / dailyAvgSale) : null;
    const stockEndDate = totalStockEndDays != null ? formatShortDate(Date.now() + totalStockEndDays * DAY_MS) : '—';
    const etaEarlyByDays = (po.eta != null && po.etd != null) ? Math.round((po.etd - po.eta) / DAY_MS) : null;
    return { poQtyStockEndDays, totalStockEndDays, stockEndDate, etaEarlyByDays };
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">Purchase Orders</h1>
        <button type="button" onClick={() => setShowForm((x) => !x)} className="btn-primary">
          {showForm ? 'Cancel' : 'Create PO'}
        </button>
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 grid grid-cols-2 gap-4 p-6 max-w-2xl">
          <input placeholder="PO Number (e.g. PO1)" value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} className="input" required />
          <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))} className="input" required>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={form.skuCode} onChange={(e) => setForm((f) => ({ ...f, skuCode: e.target.value }))} className="input" required>
            <option value="">Select SKU</option>
            {skus.filter((s) => s.status === 'Active').map((s) => <option key={s.id} value={s.skuCode}>{s.skuCode} – {s.name}</option>)}
          </select>
          <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className="input" required />
          <div className="col-span-2">
            <label className="mb-1 block text-sm text-[var(--color-muted)]">ETD (departure)</label>
            <input type="date" value={form.etd} onChange={(e) => setForm((f) => ({ ...f, etd: e.target.value }))} className="input max-w-xs" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm text-[var(--color-muted)]">ETA (arrival) – optional</label>
            <input type="date" value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} className="input max-w-xs" />
          </div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="submit" disabled={submitting || warehouses.length === 0 || skus.filter((s) => s.status === 'Active').length === 0} className="btn-primary">
              {submitting ? 'Creating…' : 'Create PO'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Warehouse</th>
              <th>SKU</th>
              <th>ETD (departure)</th>
              <th>ETA (arrival)</th>
              <th>Status</th>
              <th>ETA early by (days)</th>
              <th>PO Qty</th>
              <th>PO Qty stock end days</th>
              <th>Total Stock end days</th>
              <th>Stock End Date</th>
              <th className="w-0 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((po) => {
              const row = computePoRow(po);
              return (
                <tr key={po.id}>
                  <td className="font-medium">{po.poNumber}</td>
                  <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                  <td>{po.skuCode}</td>
                  <td className="text-[var(--color-muted)]">{formatShortDate(po.etd)}</td>
                  <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                  <td>
                    <span>{po.status}</span>
                    {po.statusReason && <span className="ml-1 block text-xs text-[var(--color-muted)]" title={po.statusReason}>{po.statusReason}</span>}
                  </td>
                  <td>{row.etaEarlyByDays != null ? row.etaEarlyByDays : '—'}</td>
                  <td>{po.quantity}</td>
                  <td>{row.poQtyStockEndDays != null ? row.poQtyStockEndDays : '—'}</td>
                  <td>{row.totalStockEndDays != null ? row.totalStockEndDays : '—'}</td>
                  <td>{row.stockEndDate}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openEdit(po)} className="btn-ghost py-1 text-xs">Edit</button>
                      {po.status !== 'Received' && (
                        <>
                          {STATUS_OPTIONS.filter((st) => st !== po.status).map((st) => (
                            <button key={st} type="button" onClick={() => handleStatusClick(po, st)} className="btn-ghost py-1 text-xs">{st}</button>
                          ))}
                          <span className="text-[var(--color-border)]">|</span>
                        </>
                      )}
                      <button type="button" onClick={() => setDeleteConfirm({ po })} className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-4 py-8 text-center text-[var(--color-muted)]">No POs in 60-day window.</p>}
      </div>

      {/* Status change modal */}
      {statusModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => { setStatusModal(null); setStatusReason(''); setError(''); }}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Change status</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Changing <strong>{statusModal.po.poNumber}</strong> to <strong>{statusModal.newStatus}</strong>. Please provide a reason for this change.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--color-muted)]">Reason (required)</label>
              <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} className="input min-h-[80px] resize-y" placeholder="e.g. Shipped via XYZ, Delivered to dock" rows={3} required />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={setStatus} className="btn-primary" disabled={!statusReason.trim()}>Update status</button>
              <button type="button" onClick={() => { setStatusModal(null); setStatusReason(''); setError(''); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="card max-w-sm w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Delete purchase order</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Delete <strong>{deleteConfirm.po.poNumber}</strong>? This cannot be undone. {deleteConfirm.po.status === 'Received' && 'Stock was already added when marked Received.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger">{deleting ? 'Deleting…' : 'Delete'}</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit PO modal */}
      {editModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEditModal(null); setError(''); }}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit purchase order</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Warehouse: <strong>{warehouseNames[editModal.po.warehouseId] || editModal.po.warehouseId}</strong> · SKU: <strong>{editModal.po.skuCode}</strong> (read-only)
            </p>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">PO Number</label>
                <input placeholder="PO Number" value={editForm.poNumber} onChange={(e) => setEditForm((f) => ({ ...f, poNumber: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Quantity</label>
                <input type="number" min="1" placeholder="Quantity" value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">ETD (departure)</label>
                <input type="date" value={editForm.etd} onChange={(e) => setEditForm((f) => ({ ...f, etd: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">ETA (arrival) – optional</label>
                <input type="date" value={editForm.eta} onChange={(e) => setEditForm((f) => ({ ...f, eta: e.target.value }))} className="input w-full" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={editSubmitting} className="btn-primary">{editSubmitting ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => { setEditModal(null); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
