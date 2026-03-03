import { useState, useEffect, useMemo } from 'react';
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

function parseDateInputToMs(value) {
  if (!value) return null;
  const d = new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

const UID_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-purple-50 text-purple-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
];

function computeWarehouseStockEndDate(stock) {
  if (!stock) return null;
  const dailyAvg = Number(stock.dailyAvgSale) || 0;
  const safetyDays = Number(stock.safetyStockDays ?? 0);
  const seasonalDays = Number(stock.seasonalBufferDays ?? 0);
  const growthDays = Number(stock.growthBufferDays ?? 0);
  const safetyQty = dailyAvg * safetyDays;
  const seasonalQty = dailyAvg * seasonalDays;
  const growthQty = dailyAvg * growthDays;
  const totalBuffer = safetyQty + seasonalQty + growthQty;
  const closingStock = Number(stock.currentStock) || 0;
  const effectiveStock = closingStock - totalBuffer;
  const stockEndDays = dailyAvg > 0 ? effectiveStock / dailyAvg : null;
  if (stockEndDays == null) return null;
  const baseMs = stock.closingStockUpdateDate ?? stock.updatedAt ?? Date.now();
  return baseMs + stockEndDays * DAY_MS;
}

export default function PurchaseOrders() {
  const [list, setList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState(null); // { po, newStatus } when open
  const [statusReason, setStatusReason] = useState('');
  const [stockList, setStockList] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { po } when open
  const [deleting, setDeleting] = useState(false);
  const [editModal, setEditModal] = useState(null); // { po } when open
  const [editForm, setEditForm] = useState({ poNumber: '', quantity: '', etd: '', eta: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [newRowA, setNewRowA] = useState(null);
  const [newRowB, setNewRowB] = useState(null);
  const [archiveToggle, setArchiveToggle] = useState(false);
  const [planningInputs, setPlanningInputs] = useState({}); // { [poId]: { etd: string, eta: string, maxLoadingDays: string } }

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeSkus(setSkus);
    return () => unsub();
  }, []);

  useEffect(() => {
    // Show all POs regardless of ETD date so newly created lines
    // (even with past ETD) always appear in Table A/B.
    const unsub = subscribePurchaseOrders(0, setList);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllStock(setStockList);
    return () => unsub();
  }, []);

  const activeSkus = skus.filter((s) => s.status === 'Active');

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

  const markComplete = async (po) => {
    setError('');
    try {
      await updatePurchaseOrder(po.id, { archived: true });
    } catch (e) {
      setError(e.message || 'Failed to mark as complete.');
    }
  };

  const restoreFromArchive = async (po) => {
    setError('');
    try {
      await updatePurchaseOrder(po.id, { archived: false });
    } catch (e) {
      setError(e.message || 'Failed to restore line.');
    }
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

  const getNextUid = () => {
    const prefix = 'WHPO';
    let max = 0;
    for (const po of list) {
      const id = po.groupId || po.poNumber;
      if (typeof id === 'string' && id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return `${prefix}${max + 1}`;
  };

  const startNewRowA = () => {
    setError('');
    const defaultUid = getNextUid();
    setNewRowA((prev) =>
      prev ||
      {
        poNumber: '',
        groupId: defaultUid,
        warehouseId: '',
        skuCode: '',
        quantity: '',
        etd: formatDate(Date.now()),
        eta: '',
      },
    );
  };

  const startNewRowB = () => {
    setError('');
    setNewRowB((prev) =>
      prev ||
      {
        poNumber: '',
        groupId: '',
        warehouseId: '',
        skuCode: '',
        quantity: '',
        etd: formatDate(Date.now()),
        eta: '',
        finalEtaEarlyBy: '',
      },
    );
  };

  const saveNewRowA = async () => {
    if (!newRowA) return;
    setError('');
    const cleanPo = (newRowA.poNumber || '').trim();
    const cleanWarehouse = (newRowA.warehouseId || '').trim();
    const skuCode = (newRowA.skuCode || '').trim();
    const cleanGroupId = (newRowA.groupId || '').trim() || cleanPo;
    const qty = Number(newRowA.quantity);
    if (!cleanPo || !cleanWarehouse || !skuCode) {
      setError('PO Number, Warehouse, and SKU are required.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    setSubmitting(true);
    try {
      await addPurchaseOrder({
        poNumber: cleanPo,
        warehouseId: cleanWarehouse,
        skuCode,
        quantity: qty,
        etd: newRowA.etd || undefined,
        eta: newRowA.eta || undefined,
        type: 'A',
        groupId: cleanGroupId,
        archived: false,
      });
      setNewRowA(null);
    } catch (e) {
      setError(e.message || 'Failed to add PO line.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveNewRowB = async () => {
    if (!newRowB) return;
    setError('');
    const cleanPo = (newRowB.poNumber || '').trim();
    const cleanWarehouse = (newRowB.warehouseId || '').trim();
    const skuCode = (newRowB.skuCode || '').trim();
    const cleanGroupId = (newRowB.groupId || '').trim();
    const qty = Number(newRowB.quantity);
    if (!cleanPo || !cleanWarehouse || !skuCode) {
      setError('PO Number, Warehouse, and SKU are required.');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    const finalEtaEarlyBy =
      newRowB.finalEtaEarlyBy !== '' && newRowB.finalEtaEarlyBy != null
        ? Number(newRowB.finalEtaEarlyBy)
        : undefined;
    if (finalEtaEarlyBy !== undefined && !Number.isFinite(finalEtaEarlyBy)) {
      setError('Final ETA early by must be a number.');
      return;
    }
    setSubmitting(true);
    try {
      await addPurchaseOrder({
        poNumber: cleanPo,
        warehouseId: cleanWarehouse,
        skuCode,
        quantity: qty,
        etd: newRowB.etd || undefined,
        eta: newRowB.eta || undefined,
        type: 'B',
        groupId: cleanGroupId || cleanPo,
        finalEtaEarlyBy,
        archived: false,
      });
      setNewRowB(null);
    } catch (e) {
      setError(e.message || 'Failed to add PO line.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelNewRowA = () => {
    if (submitting) return;
    setNewRowA(null);
  };

  const cancelNewRowB = () => {
    if (submitting) return;
    setNewRowB(null);
  };

  const warehouseNames = Object.fromEntries(warehouses.map((w) => [w.id, w.name]));

  function getStockForPo(po) {
    if (!po) return null;
    const exact = stockList.find(
      (s) => s.warehouseId === po.warehouseId && s.skuCode === po.skuCode,
    );
    if (exact) return exact;
    // Fallback: use any stock row for this SKU if warehouse-specific data is not available
    return stockList.find((s) => s.skuCode === po.skuCode) || null;
  }

  function computeRowA(po) {
    const stock = getStockForPo(po);
    const dailyAvg = stock?.dailyAvgSale ?? 0;
    const warehouseStockEndDateMs = computeWarehouseStockEndDate(stock);
    const etaMs = po.eta ?? null;
    const etaEarlyByDays =
      etaMs != null && warehouseStockEndDateMs != null
        ? Math.round((warehouseStockEndDateMs - etaMs) / DAY_MS)
        : null;
    const poQtyStockEndDays = dailyAvg > 0 ? po.quantity / dailyAvg : null;
    const totalStockEndDays =
      poQtyStockEndDays != null && etaEarlyByDays != null
        ? poQtyStockEndDays + etaEarlyByDays
        : null;
    const stockEndDateMs =
      etaMs != null && totalStockEndDays != null ? etaMs + totalStockEndDays * DAY_MS : null;
    return {
      dailyAvg,
      etaEarlyByDays,
      poQtyStockEndDays,
      totalStockEndDays,
      stockEndDateMs,
    };
  }

  function computeRowB(po, groupRowsA) {
    const stock = getStockForPo(po);
    const dailyAvg = stock?.dailyAvgSale ?? 0;

    // Stock end date must come from Table A for this PO group / SKU
    let stockEndDateMsFromA = null;
    if (Array.isArray(groupRowsA) && groupRowsA.length > 0) {
      const matchingA =
        groupRowsA.find(
          (row) => row.skuCode === po.skuCode && ((row.type ?? 'A') === 'A'),
        ) || groupRowsA[0];
      stockEndDateMsFromA = matchingA?.stockEndDateMs ?? null;
    }

    const etaMs = po.eta ?? null;
    const etaEarlyByDays =
      etaMs != null && stockEndDateMsFromA != null
        ? Math.round((stockEndDateMsFromA - etaMs) / DAY_MS)
        : null;
    // Final ETA early by is a manual override; default is 0 (does not use ETA early by).
    let finalEtaEarlyBy = 0;
    if (po.finalEtaEarlyBy != null && po.finalEtaEarlyBy !== '') {
      const v = Number(po.finalEtaEarlyBy);
      if (Number.isFinite(v)) finalEtaEarlyBy = v;
    }
    const poQtyStockEndDays = dailyAvg > 0 ? po.quantity / dailyAvg : null;
    const totalStockEndDays =
      poQtyStockEndDays != null ? poQtyStockEndDays + finalEtaEarlyBy : null;
    const stockEndDateMs =
      etaMs != null && totalStockEndDays != null ? etaMs + totalStockEndDays * DAY_MS : null;
    return {
      dailyAvg,
      etaEarlyByDays,
      finalEtaEarlyBy,
      poQtyStockEndDays,
      totalStockEndDays,
      stockEndDateMs,
    };
  }

  const tableARows = list.filter((po) => (po.type ?? 'A') === 'A' && !po.archived);
  const allTableARows = list.filter((po) => (po.type ?? 'A') === 'A');
  const tableBRows = list.filter((po) => po.type === 'B' && !po.archived);
  const archivedTableARows = allTableARows.filter((po) => po.archived);
  const archivedTableBRows = list.filter((po) => po.type === 'B' && po.archived);
  const hasAnyTableA = tableARows.length > 0;

  const uidToColorIndex = useMemo(() => {
    const set = new Set();
    tableARows.forEach((po) => {
      const u = (po.groupId || po.poNumber || '').toString().trim();
      if (u) set.add(u);
    });
    if (newRowA?.groupId) set.add(String(newRowA.groupId).trim());
    tableBRows.forEach((po) => {
      const u = (po.groupId || '').toString().trim();
      if (u) set.add(u);
    });
    if (newRowB?.groupId) set.add(String(newRowB.groupId).trim());
    archivedTableARows.forEach((po) => {
      const u = (po.groupId || po.poNumber || '').toString().trim();
      if (u) set.add(u);
    });
    archivedTableBRows.forEach((po) => {
      const u = (po.groupId || '').toString().trim();
      if (u) set.add(u);
    });
    const sorted = Array.from(set).sort();
    const map = {};
    sorted.forEach((uid, i) => {
      map[uid] = i % UID_COLORS.length;
    });
    return map;
  }, [
    tableARows,
    tableBRows,
    archivedTableARows,
    archivedTableBRows,
    newRowA?.groupId,
    newRowB?.groupId,
  ]);

  const getUidColor = (uid) => {
    const key = (uid || '').toString().trim();
    if (!key) return '';
    const index = uidToColorIndex[key];
    if (index === undefined) return '';
    return UID_COLORS[index];
  };

  function getGroupRowsAWithEndForB(po) {
    const uid = (po.groupId || '').trim();
    if (!uid) return [];
    const groupRowsA = allTableARows.filter(
      (p) => (p.groupId || p.poNumber) === uid,
    );
    return groupRowsA.map((p) => ({
      ...p,
      stockEndDateMs: computeRowA(p).stockEndDateMs,
    }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">Purchase Orders</h1>
      </div>
      {error && <div className="alert-error mb-4">{error}</div>}

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-muted)]">Table A</h2>
          <button
            type="button"
            onClick={startNewRowA}
            disabled={submitting || !!newRowA}
            className="btn-secondary py-1 px-2 text-xs"
          >
            + Add line
          </button>
        </div>
        <div className="table-wrapper overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 96 }}>UID</th>
                <th>Warehouse</th>
                <th style={{ minWidth: 220 }}>SKU</th>
                <th>PO Number</th>
                <th>ETD</th>
                <th>ETA</th>
                <th>ETA early by (days)</th>
                <th>PO Qty</th>
                <th>PO Qty stock end days</th>
                <th>Total Stock end days</th>
                <th>Stock End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRowA && (() => {
                const draftPo = {
                  warehouseId: newRowA.warehouseId,
                  skuCode: newRowA.skuCode,
                  quantity: Number(newRowA.quantity) || 0,
                  eta: parseDateInputToMs(newRowA.eta),
                };
                const draftCalc = computeRowA(draftPo);
                return (
                <tr key="new-A">
                  <td className={`text-xs font-medium ${getUidColor(newRowA.groupId || '')}`}>
                    {newRowA.groupId}
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <select
                      value={newRowA.warehouseId}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), warehouseId: e.target.value }))
                      }
                      className="input w-full"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRowA.skuCode}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), skuCode: e.target.value }))
                      }
                      className="input w-full"
                    >
                      <option value="">Select SKU</option>
                      {activeSkus.map((s) => (
                        <option key={s.id} value={s.skuCode}>
                          {s.skuCode} – {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={newRowA.poNumber}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), poNumber: e.target.value }))
                      }
                      className="input w-full"
                      placeholder="PO number"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={newRowA.etd}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), etd: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={newRowA.eta}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), eta: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    {draftCalc.etaEarlyByDays != null
                      ? Math.round(draftCalc.etaEarlyByDays)
                      : '—'}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={newRowA.quantity}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), quantity: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    {draftCalc.poQtyStockEndDays != null
                      ? draftCalc.poQtyStockEndDays.toFixed(1)
                      : '—'}
                  </td>
                  <td>
                    {draftCalc.totalStockEndDays != null
                      ? draftCalc.totalStockEndDays.toFixed(1)
                      : '—'}
                  </td>
                  <td>—</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveNewRowA}
                        disabled={submitting}
                        className="btn-primary py-1 px-3 text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelNewRowA}
                        disabled={submitting}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              );})()}
              {tableARows.map((po) => {
                const a = computeRowA(po);
                const uid = po.groupId || po.poNumber;
                return (
                  <tr key={po.id}>
                    <td className={`text-xs font-medium ${getUidColor(uid || '')}`}>
                      {uid}
                    </td>
                    <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                    <td style={{ minWidth: 220 }}>{po.skuCode}</td>
                    <td>{po.poNumber}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.etd)}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                    <td>{a.etaEarlyByDays != null ? Math.round(a.etaEarlyByDays) : '—'}</td>
                    <td>{po.quantity}</td>
                    <td>{a.poQtyStockEndDays != null ? a.poQtyStockEndDays.toFixed(1) : '—'}</td>
                    <td>{a.totalStockEndDays != null ? a.totalStockEndDays.toFixed(1) : '—'}</td>
                    <td className="text-[var(--color-muted)]">
                      {a.stockEndDateMs != null ? formatShortDate(a.stockEndDateMs) : '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(po)}
                          className="btn-ghost py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => markComplete(po)}
                          className="btn-ghost py-1 text-xs"
                        >
                          Mark complete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ po })}
                          className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-muted)]">Table B</h2>
            {!hasAnyTableA && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Add at least one line in Table A to unlock Table B.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={startNewRowB}
            disabled={submitting || !!newRowB || !hasAnyTableA}
            className="btn-secondary py-1 px-2 text-xs"
          >
            + Add line
          </button>
        </div>
        <div className="table-wrapper overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 96 }}>UID</th>
                <th>Warehouse</th>
                <th style={{ minWidth: 220 }}>SKU</th>
                <th>PO Number</th>
                <th>ETD</th>
                <th>ETA</th>
                <th>ETA early by (days)</th>
                <th>Final ETA early by</th>
                <th>PO Qty</th>
                <th>PO Qty stock end days</th>
                <th>Total Stock end days</th>
                <th>Stock End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRowB && (() => {
                // For draft Table B calculations, use Table A rows with the same UID only.
                const uid = (newRowB.groupId || '').trim();
                const groupRowsAForDraft = uid
                  ? allTableARows.filter(
                      (p) => (p.groupId || p.poNumber) === uid,
                    )
                  : [];
                const groupRowsAWithEnd = groupRowsAForDraft.map((p) => ({
                  ...p,
                  stockEndDateMs: computeRowA(p).stockEndDateMs,
                }));
                const draftPoB = {
                  warehouseId: newRowB.warehouseId,
                  skuCode: newRowB.skuCode,
                  quantity: Number(newRowB.quantity) || 0,
                  eta: parseDateInputToMs(newRowB.eta),
                  finalEtaEarlyBy:
                    newRowB.finalEtaEarlyBy !== ''
                      ? Number(newRowB.finalEtaEarlyBy)
                      : undefined,
                };
                const draftCalcB = computeRowB(draftPoB, groupRowsAWithEnd);
                return (
                <tr key="new-B">
                  <td>
                    <input
                      type="text"
                      value={newRowB.groupId}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), groupId: e.target.value }))
                      }
                      className="input w-full"
                      placeholder="UID"
                    />
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <select
                      value={newRowB.warehouseId}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), warehouseId: e.target.value }))
                      }
                      className="input w-full"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={newRowB.skuCode}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), skuCode: e.target.value }))
                      }
                      className="input w-full"
                    >
                      <option value="">Select SKU</option>
                      {activeSkus.map((s) => (
                        <option key={s.id} value={s.skuCode}>
                          {s.skuCode} – {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={newRowB.poNumber}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), poNumber: e.target.value }))
                      }
                      className="input w-full"
                      placeholder="PO number"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={newRowB.etd}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), etd: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={newRowB.eta}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), eta: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    {draftCalcB.etaEarlyByDays != null
                      ? Math.round(draftCalcB.etaEarlyByDays)
                      : '—'}
                  </td>
                  <td>
                    <input
                      type="number"
                      value={newRowB.finalEtaEarlyBy}
                      onChange={(e) =>
                        setNewRowB((prev) => ({
                          ...(prev || {}),
                          finalEtaEarlyBy: e.target.value,
                        }))
                      }
                      className="input w-full"
                      placeholder="Final ETA early by"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={newRowB.quantity}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), quantity: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    {draftCalcB.poQtyStockEndDays != null
                      ? draftCalcB.poQtyStockEndDays.toFixed(1)
                      : '—'}
                  </td>
                  <td>
                    {draftCalcB.totalStockEndDays != null
                      ? draftCalcB.totalStockEndDays.toFixed(1)
                      : '—'}
                  </td>
                  <td>
                    {draftCalcB.stockEndDateMs != null
                      ? formatShortDate(draftCalcB.stockEndDateMs)
                      : '—'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveNewRowB}
                        disabled={submitting || !hasAnyTableA}
                        className="btn-primary py-1 px-3 text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelNewRowB}
                        disabled={submitting}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              );})()}
              {tableBRows.map((po) => {
                const groupRowsAWithEnd = getGroupRowsAWithEndForB(po);
                const b = computeRowB(po, groupRowsAWithEnd);
                return (
                  <tr key={po.id}>
                    <td className={`text-xs font-medium ${getUidColor(po.groupId || '')}`}>
                      {po.groupId || ''}
                    </td>
                    <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                    <td style={{ minWidth: 220 }}>{po.skuCode}</td>
                    <td>{po.poNumber}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.etd)}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                    <td>{b.etaEarlyByDays != null ? Math.round(b.etaEarlyByDays) : '—'}</td>
                    <td>{b.finalEtaEarlyBy != null ? Math.round(b.finalEtaEarlyBy) : '—'}</td>
                    <td>{po.quantity}</td>
                    <td>{b.poQtyStockEndDays != null ? b.poQtyStockEndDays.toFixed(1) : '—'}</td>
                    <td>{b.totalStockEndDays != null ? b.totalStockEndDays.toFixed(1) : '—'}</td>
                    <td className="text-[var(--color-muted)]">
                      {b.stockEndDateMs != null ? formatShortDate(b.stockEndDateMs) : '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(po)}
                          className="btn-ghost py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => markComplete(po)}
                          className="btn-ghost py-1 text-xs"
                        >
                          Mark complete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ po })}
                          className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planning table linked to Table B (per UID and SKU) */}
      {tableBRows.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-muted)]">
            Planning (per PO / UID)
          </h2>
          <div className="table-wrapper overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Warehouse</th>
                  <th>SKU</th>
                  <th>PO Number</th>
                  <th>ETD</th>
                  <th>ETA</th>
                  <th>Max loading days</th>
                  <th>Estimated stock-out date</th>
                  <th>Stock End Date of previous PO</th>
                  <th>Days required to reach estimated stock-out date</th>
                  <th>Minimum between Max loading and Days required</th>
                  <th>Suggested PO Qty (Daily average × min days)</th>
                </tr>
              </thead>
              <tbody>
                {tableBRows.map((po) => {
                  const input = planningInputs[po.id] || {
                    etd: '',
                    eta: '',
                    maxLoadingDays: '',
                  };
                  const maxLoadingDaysNum = Number(input.maxLoadingDays);
                  const maxLoadingValid =
                    !Number.isNaN(maxLoadingDaysNum) && maxLoadingDaysNum > 0;

                  const planningEtaMs = parseDateInputToMs(input.eta);
                  const estimatedStockOutMs =
                    planningEtaMs != null && maxLoadingValid
                      ? planningEtaMs + maxLoadingDaysNum * DAY_MS
                      : null;

                  // Previous PO = latest Table B row for same UID
                  const uid = (po.groupId || '').trim();
                  const allPreviousCandidates = [...archivedTableBRows, ...tableBRows];
                  const prevPo = allPreviousCandidates
                    .filter(
                      (p) =>
                        (p.groupId || '').trim() === uid,
                    )
                    .sort((a, b) => (b.eta ?? 0) - (a.eta ?? 0))[0];

                  let prevStockEndMs = null;
                  if (prevPo) {
                    const prevGroupA = getGroupRowsAWithEndForB(prevPo);
                    const prevB = computeRowB(prevPo, prevGroupA);
                    prevStockEndMs = prevB.stockEndDateMs ?? null;
                  }

                  const daysRequired =
                    estimatedStockOutMs != null && prevStockEndMs != null
                      ? Math.round(
                          (estimatedStockOutMs - prevStockEndMs) / DAY_MS,
                        )
                      : null;

                  let minDays = null;
                  if (maxLoadingValid && daysRequired != null) {
                    minDays = Math.min(maxLoadingDaysNum, daysRequired);
                  }

                  const stock = getStockForPo(po);
                  const dailyAvg = stock?.dailyAvgSale ?? 0;
                  const suggestedQty =
                    minDays != null && dailyAvg > 0
                      ? Math.round(dailyAvg * minDays)
                      : null;

                  return (
                    <tr key={po.id}>
                      <td className={`text-xs font-medium ${getUidColor(po.groupId || '')}`}>
                        {po.groupId || ''}
                      </td>
                      <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                      <td>{po.skuCode}</td>
                      <td>{po.poNumber}</td>
                      <td>
                        <input
                          type="date"
                          value={input.etd}
                          onChange={(e) =>
                            setPlanningInputs((prev) => ({
                              ...prev,
                              [po.id]: {
                                ...(prev[po.id] || {}),
                                etd: e.target.value,
                              },
                            }))
                          }
                          className="input w-36"
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={input.eta}
                          onChange={(e) =>
                            setPlanningInputs((prev) => ({
                              ...prev,
                              [po.id]: {
                                ...(prev[po.id] || {}),
                                eta: e.target.value,
                              },
                            }))
                          }
                          className="input w-36"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={input.maxLoadingDays}
                          onChange={(e) =>
                            setPlanningInputs((prev) => ({
                              ...prev,
                              [po.id]: {
                                ...(prev[po.id] || {}),
                                maxLoadingDays: e.target.value,
                              },
                            }))
                          }
                          className="input w-24"
                          placeholder="Days"
                        />
                      </td>
                      <td className="text-[var(--color-muted)]">
                        {estimatedStockOutMs != null
                          ? formatShortDate(estimatedStockOutMs)
                          : '—'}
                      </td>
                      <td className="text-[var(--color-muted)]">
                        {prevStockEndMs != null
                          ? formatShortDate(prevStockEndMs)
                          : '—'}
                      </td>
                      <td>
                        {daysRequired != null ? daysRequired : '—'}
                      </td>
                      <td>
                        {minDays != null ? minDays : '—'}
                      </td>
                      <td>
                        {suggestedQty != null ? suggestedQty : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archived section */}
      {(archivedTableARows.length > 0 || archivedTableBRows.length > 0) && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-muted)]">
              Archived lines
            </h2>
            <button
              type="button"
              onClick={() => setArchiveToggle((v) => !v)}
              className="btn-secondary py-1 px-2 text-xs"
            >
              {archiveToggle ? 'Hide archive' : 'Show archive'}
            </button>
          </div>
          {archiveToggle && (
            <div className="space-y-4">
              {archivedTableARows.length > 0 && (
                <div className="table-wrapper overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>UID</th>
                        <th>Warehouse</th>
                        <th>SKU</th>
                        <th>PO Number</th>
                        <th>ETD</th>
                        <th>ETA</th>
                        <th>PO Qty</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedTableARows.map((po) => (
                        <tr key={po.id}>
                          <td className={`text-xs font-medium ${getUidColor(po.groupId || po.poNumber || '')}`}>
                            {po.groupId || po.poNumber}
                          </td>
                          <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                          <td>{po.skuCode}</td>
                          <td>{po.poNumber}</td>
                          <td className="text-[var(--color-muted)]">{formatShortDate(po.etd)}</td>
                          <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                          <td>{po.quantity}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => restoreFromArchive(po)}
                              className="btn-ghost py-1 text-xs"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {archivedTableBRows.length > 0 && (
                <div className="table-wrapper overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>UID</th>
                        <th>Warehouse</th>
                        <th>SKU</th>
                        <th>PO Number</th>
                        <th>ETD</th>
                        <th>ETA</th>
                        <th>PO Qty</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedTableBRows.map((po) => (
                        <tr key={po.id}>
                          <td className={`text-xs font-medium ${getUidColor(po.groupId || '')}`}>
                            {po.groupId || ''}
                          </td>
                          <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                          <td>{po.skuCode}</td>
                          <td>{po.poNumber}</td>
                          <td className="text-[var(--color-muted)]">{formatShortDate(po.etd)}</td>
                          <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                          <td>{po.quantity}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => restoreFromArchive(po)}
                              className="btn-ghost py-1 text-xs"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status change modal */}
      {statusModal && (
        <div className="modal-backdrop" onClick={() => { setStatusModal(null); setStatusReason(''); setError(''); }}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
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
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
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
        <div className="modal-backdrop" onClick={() => { setEditModal(null); setError(''); }}>
          <div className="card modal-content p-6" onClick={(e) => e.stopPropagation()}>
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
