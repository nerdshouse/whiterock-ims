import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWarehouseFilter = searchParams.get('warehouseId') || '';
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
  const [editForm, setEditForm] = useState({ poNumber: '', quantity: '', etd: '', eta: '', finalEtaEarlyBy: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [newRowA, setNewRowA] = useState(null);
  const [newRowB, setNewRowB] = useState(null);
  const [archiveToggle, setArchiveToggle] = useState(false);
  const [planningInputs, setPlanningInputs] = useState({}); // { [poId]: { etd: string, eta: string, maxLoadingDays: string } }
  const [planningExtras, setPlanningExtras] = useState([]); // extra planning-only rows not backed by POs
  const [newPlanningRow, setNewPlanningRow] = useState(null); // draft planning-only row
  const [itemPicker, setItemPicker] = useState(null); // { context: 'A' | 'B' | 'planning' }
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseFilter);

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

  // Keep URL in sync with warehouse filter so links from Warehouses page can pre-filter PO list
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (warehouseFilter) {
        next.set('warehouseId', warehouseFilter);
      } else {
        next.delete('warehouseId');
      }
      return next;
    });
  }, [warehouseFilter, setSearchParams]);

  // Pre-fill UID from SKU Database when warehouse + SKU is selected (link PO UID with SKU Database UID)
  useEffect(() => {
    if (!newRowA?.warehouseId || !newRowA?.skuCode) return;
    const stock = stockList.find(
      (s) => s.warehouseId === newRowA.warehouseId && s.skuCode === newRowA.skuCode,
    );
    if (stock?.uid)
      setNewRowA((prev) => (prev && prev.groupId !== stock.uid ? { ...prev, groupId: stock.uid } : prev));
  }, [newRowA?.warehouseId, newRowA?.skuCode, stockList]);
  useEffect(() => {
    if (!newRowB?.warehouseId || !newRowB?.skuCode) return;
    const stock = stockList.find(
      (s) => s.warehouseId === newRowB.warehouseId && s.skuCode === newRowB.skuCode,
    );
    if (stock?.uid)
      setNewRowB((prev) =>
        prev && (prev.groupId === '' || prev.groupId == null)
          ? { ...prev, groupId: stock.uid }
          : prev,
      );
  }, [newRowB?.warehouseId, newRowB?.skuCode, stockList]);

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
      finalEtaEarlyBy: po.type === 'B' && (po.finalEtaEarlyBy != null && po.finalEtaEarlyBy !== '') ? String(po.finalEtaEarlyBy) : '',
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
        ...(editModal.po.type === 'B'
          ? { finalEtaEarlyBy: editForm.finalEtaEarlyBy === '' ? null : (Number(editForm.finalEtaEarlyBy) || null) }
          : {}),
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
        multiSkuCodes: [],
        multiSkuQuantities: {},
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
        multiSkuCodes: [],
        multiSkuQuantities: {},
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
    const multiSkuCodes = Array.isArray(newRowA.multiSkuCodes)
      ? newRowA.multiSkuCodes.filter((v) => v && v.trim())
      : [];
    const skusToUse = multiSkuCodes.length > 0 ? multiSkuCodes : (skuCode ? [skuCode] : []);
    const qtyMap = newRowA.multiSkuQuantities || {};
    const cleanGroupId = (newRowA.groupId || '').trim() || cleanPo;
    if (!cleanPo || !cleanWarehouse || skusToUse.length === 0) {
      setError('PO Number, Warehouse, and at least one SKU are required.');
      return;
    }
    const perItemQtys = skusToUse.map((code) => {
      const raw = qtyMap[code];
      if (raw !== undefined && raw !== null && raw !== '') return Number(raw);
      return NaN;
    });
    if (!perItemQtys.every((q) => Number.isFinite(q) && q >= 1)) {
      setError('Please enter quantity next to each selected item in the chooser (at least 1).');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        skusToUse.map((code, index) =>
          addPurchaseOrder({
            poNumber: cleanPo,
            warehouseId: cleanWarehouse,
            skuCode: code,
            quantity: perItemQtys[index],
            etd: newRowA.etd || undefined,
            eta: newRowA.eta || undefined,
            type: 'A',
            groupId: cleanGroupId,
            archived: false,
          }),
        ),
      );
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
    const multiSkuCodes = Array.isArray(newRowB.multiSkuCodes)
      ? newRowB.multiSkuCodes.filter((v) => v && v.trim())
      : [];
    const skusToUse = multiSkuCodes.length > 0 ? multiSkuCodes : (skuCode ? [skuCode] : []);
    const qtyMap = newRowB.multiSkuQuantities || {};
    const cleanGroupId = (newRowB.groupId || '').trim();
    const perItemQtys = skusToUse.map((code) => {
      const raw = qtyMap[code];
      if (raw !== undefined && raw !== null && raw !== '') return Number(raw);
      return NaN;
    });
    if (!cleanPo || !cleanWarehouse || skusToUse.length === 0) {
      setError('PO Number, Warehouse, and at least one SKU are required.');
      return;
    }
    if (!perItemQtys.every((q) => Number.isFinite(q) && q >= 1)) {
      setError('Please enter quantity next to each selected item in the chooser (at least 1).');
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
      await Promise.all(
        skusToUse.map((code, index) =>
          addPurchaseOrder({
            poNumber: cleanPo,
            warehouseId: cleanWarehouse,
            skuCode: code,
            quantity: perItemQtys[index],
            etd: newRowB.etd || undefined,
            eta: newRowB.eta || undefined,
            type: 'B',
            groupId: cleanGroupId || cleanPo,
            finalEtaEarlyBy,
            archived: false,
          }),
        ),
      );
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
  const skuCodeToName = useMemo(
    () => Object.fromEntries(skus.map((s) => [s.skuCode, s.name || s.skuCode])),
    [skus],
  );
  const filteredList = useMemo(() => {
    if (!warehouseFilter) return list;
    return list.filter((po) => po.warehouseId === warehouseFilter);
  }, [list, warehouseFilter]);

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

  const tableARows = filteredList.filter((po) => (po.type ?? 'A') === 'A' && !po.archived);
  const allTableARows = filteredList.filter((po) => (po.type ?? 'A') === 'A');
  const tableBRows = filteredList.filter((po) => po.type === 'B' && !po.archived);
  const archivedTableARows = allTableARows.filter((po) => po.archived);
  const archivedTableBRows = filteredList.filter((po) => po.type === 'B' && po.archived);
  const hasAnyTableA = tableARows.length > 0;

  // Planning table rows = Table B rows + extra planning-only rows (not backed by purchaseOrders)
  const planningRows = [...tableBRows, ...planningExtras];

  // Earliest / latest stock end dates for highlighting
  const tableAStockEndDates = tableARows
    .map((po) => computeRowA(po).stockEndDateMs)
    .filter((v) => v != null);
  const earliestTableAStockEnd =
    tableAStockEndDates.length > 0 ? Math.min(...tableAStockEndDates) : null;
  const latestTableAStockEnd =
    tableAStockEndDates.length > 0 ? Math.max(...tableAStockEndDates) : null;

  const tableBStockEndDates = tableBRows
    .map((po) => {
      const groupRowsAWithEnd = getGroupRowsAWithEndForB(po);
      const b = computeRowB(po, groupRowsAWithEnd);
      return b.stockEndDateMs;
    })
    .filter((v) => v != null);
  const earliestTableBStockEnd =
    tableBStockEndDates.length > 0 ? Math.min(...tableBStockEndDates) : null;
  const latestTableBStockEnd =
    tableBStockEndDates.length > 0 ? Math.max(...tableBStockEndDates) : null;

  const getStockEndClassForTableA = (ms) => {
    if (ms == null) return 'text-[var(--color-muted)]';
    if (
      earliestTableAStockEnd != null &&
      latestTableAStockEnd != null &&
      earliestTableAStockEnd !== latestTableAStockEnd
    ) {
      if (ms === earliestTableAStockEnd) return 'text-red-600 font-semibold';
      if (ms === latestTableAStockEnd) return 'text-emerald-600 font-semibold';
    }
    return 'text-[var(--color-muted)]';
  };

  const getStockEndClassForTableB = (ms) => {
    if (ms == null) return 'text-[var(--color-muted)]';
    if (
      earliestTableBStockEnd != null &&
      latestTableBStockEnd != null &&
      earliestTableBStockEnd !== latestTableBStockEnd
    ) {
      if (ms === earliestTableBStockEnd) return 'text-red-600 font-semibold';
      if (ms === latestTableBStockEnd) return 'text-emerald-600 font-semibold';
    }
    return 'text-[var(--color-muted)]';
  };

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
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-muted)]" htmlFor="po-warehouse-filter">
            Warehouse:
          </label>
          <select
            id="po-warehouse-filter"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="input w-auto min-w-[180px]"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
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
                <th>Item Name</th>
                <th>PO Number</th>
                <th>ETA</th>
                <th>PO Qty</th>
                <th>Stock End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRowA && (() => {
                return (
                <tr key="new-A">
                  <td className={`text-xs font-medium ${getUidColor(newRowA.groupId || '')}`}>
                    {newRowA.groupId}
                  </td>
                  <td style={{ minWidth: 160 }}>
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
                  <td style={{ minWidth: 220 }}>
                    <div className="flex items-center gap-2">
                      <select
                        value={newRowA.skuCode}
                        onChange={(e) =>
                          setNewRowA((prev) => ({
                            ...(prev || {}),
                            skuCode: e.target.value,
                            multiSkuCodes: prev?.multiSkuCodes && prev.multiSkuCodes.length > 0
                              ? prev.multiSkuCodes
                              : e.target.value
                              ? [e.target.value]
                              : [],
                          }))
                        }
                        className="input w-full"
                      >
                        <option value="">Select item</option>
                        {activeSkus.map((s) => (
                          <option key={s.id} value={s.skuCode}>
                            {s.name || s.skuCode}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setItemPicker({ context: 'A' })}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Choose…
                      </button>
                    </div>
                    {Array.isArray(newRowA.multiSkuCodes) && newRowA.multiSkuCodes.length > 1 && (
                      <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                        {newRowA.multiSkuCodes.length} items selected
                      </div>
                    )}
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
                      value={newRowA.eta}
                      onChange={(e) =>
                        setNewRowA((prev) => ({ ...(prev || {}), eta: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td className="text-[10px] text-[var(--color-muted)]">
                    Set quantity per item in “Choose…” dialog
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
                    <td>{skuCodeToName[po.skuCode] ?? po.skuCode}</td>
                    <td>{po.poNumber}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                    <td>{po.quantity}</td>
                    <td className={getStockEndClassForTableA(a.stockEndDateMs)}>
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
                <th>Item Name</th>
                <th>PO Number</th>
                <th>ETA</th>
                <th>PO Qty</th>
                <th>Stock End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {newRowB && (() => {
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
                  <td style={{ minWidth: 160 }}>
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
                  <td style={{ minWidth: 220 }}>
                    <div className="flex items-center gap-2">
                      <select
                        value={newRowB.skuCode}
                        onChange={(e) =>
                          setNewRowB((prev) => ({
                            ...(prev || {}),
                            skuCode: e.target.value,
                            multiSkuCodes: prev?.multiSkuCodes && prev.multiSkuCodes.length > 0
                              ? prev.multiSkuCodes
                              : e.target.value
                              ? [e.target.value]
                              : [],
                          }))
                        }
                        className="input w-full"
                      >
                        <option value="">Select item</option>
                        {activeSkus.map((s) => (
                          <option key={s.id} value={s.skuCode}>
                            {s.name || s.skuCode}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setItemPicker({ context: 'B' })}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Choose…
                      </button>
                    </div>
                    {Array.isArray(newRowB.multiSkuCodes) && newRowB.multiSkuCodes.length > 1 && (
                      <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                        {newRowB.multiSkuCodes.length} items selected
                      </div>
                    )}
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
                      value={newRowB.eta}
                      onChange={(e) =>
                        setNewRowB((prev) => ({ ...(prev || {}), eta: e.target.value }))
                      }
                      className="input w-full"
                    />
                  </td>
                  <td className="text-[10px] text-[var(--color-muted)]">
                    Set quantity per item in “Choose…” dialog
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
                    <td>{skuCodeToName[po.skuCode] ?? po.skuCode}</td>
                    <td>{po.poNumber}</td>
                    <td className="text-[var(--color-muted)]">{formatShortDate(po.eta)}</td>
                    <td>{po.quantity}</td>
                    <td className={getStockEndClassForTableB(b.stockEndDateMs)}>
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

      {/* Planning table linked to Table B (per UID and SKU), with option to add standalone planning rows */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-muted)]">
            Planning (per PO / UID)
          </h2>
          <button
            type="button"
            onClick={() => {
              setError('');
              setNewPlanningRow((prev) =>
                prev || {
                  id: `planning-${Date.now()}`,
                  groupId: '',
                  warehouseId: '',
                  skuCode: '',
                  multiSkuCodes: [],
                  poNumber: '',
                  eta: '',
                  maxLoadingDays: '',
                },
              );
            }}
            className="btn-secondary py-1 px-2 text-xs"
          >
            + Add line
          </button>
        </div>
        <div className="table-wrapper overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>UID</th>
                <th>Warehouse</th>
                <th>SKU</th>
                <th>PO Number</th>
                <th>ETA</th>
                <th>Max loading days</th>
                <th>Suggested PO Qty (Daily average × min days)</th>
                <th className="w-0 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {newPlanningRow && (
                <tr key={newPlanningRow.id}>
                  <td>
                    <input
                      type="text"
                      value={newPlanningRow.groupId}
                      onChange={(e) =>
                        setNewPlanningRow((prev) =>
                          prev ? { ...prev, groupId: e.target.value } : prev,
                        )
                      }
                      className="input w-full"
                      placeholder="UID"
                    />
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <select
                      value={newPlanningRow.warehouseId}
                      onChange={(e) =>
                        setNewPlanningRow((prev) =>
                          prev ? { ...prev, warehouseId: e.target.value } : prev,
                        )
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
                  <td style={{ minWidth: 220 }}>
                    <div className="flex items-center gap-2">
                      <select
                        value={newPlanningRow.skuCode}
                        onChange={(e) =>
                          setNewPlanningRow((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  skuCode: e.target.value,
                                  multiSkuCodes:
                                    prev.multiSkuCodes && prev.multiSkuCodes.length > 0
                                      ? prev.multiSkuCodes
                                      : e.target.value
                                      ? [e.target.value]
                                      : [],
                                }
                              : prev,
                          )
                        }
                        className="input w-full"
                      >
                        <option value="">Select item</option>
                        {activeSkus.map((s) => (
                          <option key={s.id} value={s.skuCode}>
                            {s.name || s.skuCode}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setItemPicker({ context: 'planning' })}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Choose…
                      </button>
                    </div>
                    {Array.isArray(newPlanningRow.multiSkuCodes) &&
                      newPlanningRow.multiSkuCodes.length > 1 && (
                        <div className="mt-1 text-[10px] text-[var(--color-muted)]">
                          {newPlanningRow.multiSkuCodes.length} items selected
                        </div>
                      )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={newPlanningRow.poNumber}
                      onChange={(e) =>
                        setNewPlanningRow((prev) =>
                          prev ? { ...prev, poNumber: e.target.value } : prev,
                        )
                      }
                      className="input w-full"
                      placeholder="PO number (optional)"
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={newPlanningRow.eta}
                      onChange={(e) =>
                        setNewPlanningRow((prev) =>
                          prev ? { ...prev, eta: e.target.value } : prev,
                        )
                      }
                      className="input w-full"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={newPlanningRow.maxLoadingDays}
                      onChange={(e) =>
                        setNewPlanningRow((prev) =>
                          prev ? { ...prev, maxLoadingDays: e.target.value } : prev,
                        )
                      }
                      className="input w-24"
                      placeholder="Days"
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cleanUid = (newPlanningRow.groupId || '').trim();
                          const cleanWarehouse = (newPlanningRow.warehouseId || '').trim();
                          const skuCode = (newPlanningRow.skuCode || '').trim();
                          const multiSkuCodes = Array.isArray(newPlanningRow.multiSkuCodes)
                            ? newPlanningRow.multiSkuCodes.filter((v) => v && v.trim())
                            : [];
                          const skusToUse =
                            multiSkuCodes.length > 1 ? multiSkuCodes : (skuCode ? [skuCode] : []);
                          if (!cleanUid || !cleanWarehouse || skusToUse.length === 0) {
                            setError(
                              'UID, Warehouse, and at least one SKU are required for planning row.',
                            );
                            return;
                          }
                          const baseId = newPlanningRow.id || `planning-${Date.now()}`;
                          const etaVal = newPlanningRow.eta || '';
                          const maxDaysVal = newPlanningRow.maxLoadingDays || '';

                          const newExtras = skusToUse.map((code, index) => {
                            const id =
                              index === 0 ? baseId : `${baseId}-${index}-${code || 'sku'}`;
                            return {
                              id,
                              groupId: cleanUid,
                              warehouseId: cleanWarehouse,
                              skuCode: code,
                              poNumber: (newPlanningRow.poNumber || '').trim(),
                              __planningExtra: true,
                            };
                          });
                          setPlanningExtras((prev) => [...prev, ...newExtras]);

                          if (etaVal || maxDaysVal) {
                            setPlanningInputs((prev) => {
                              const next = { ...prev };
                              newExtras.forEach((row) => {
                                next[row.id] = {
                                  ...(next[row.id] || {}),
                                  eta: etaVal,
                                  maxLoadingDays: maxDaysVal,
                                };
                              });
                              return next;
                            });
                          }
                          setNewPlanningRow(null);
                        }}
                        className="btn-primary py-1 px-3 text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPlanningRow(null)}
                        className="btn-ghost py-1 px-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {planningRows.map((po) => {
                const key = po.id;
                const input = planningInputs[key] || {
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

                  const isExtra = po.__planningExtra === true;

                  return (
                    <tr key={key}>
                      <td className={`text-xs font-medium ${getUidColor(po.groupId || '')}`}>
                        {po.groupId || ''}
                      </td>
                      <td>{warehouseNames[po.warehouseId] || po.warehouseId}</td>
                      <td>{po.skuCode}</td>
                      <td>{po.poNumber}</td>
                      <td>
                        <input
                          type="date"
                          value={input.eta}
                          onChange={(e) =>
                            setPlanningInputs((prev) => ({
                              ...prev,
                              [key]: {
                                ...(prev[key] || {}),
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
                              [key]: {
                                ...(prev[key] || {}),
                                maxLoadingDays: e.target.value,
                              },
                            }))
                          }
                          className="input w-24"
                          placeholder="Days"
                        />
                      </td>
                      <td>
                        {suggestedQty != null ? suggestedQty : '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-2">
                          {!isExtra && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(po)}
                                className="btn-ghost py-1 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ po })}
                                className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {isExtra && (
                            <button
                              type="button"
                              onClick={() =>
                                setPlanningExtras((prev) =>
                                  prev.filter((row) => row.id !== key),
                                )
                              }
                              className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {planningRows.length === 0 && !newPlanningRow && (
                  <tr>
                    <td colSpan={12} className="text-center text-sm text-[var(--color-muted)] py-3">
                      No planning rows yet. Add a planning row above, or create Table B lines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                        <th>Item Name</th>
                        <th>PO Number</th>
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
                          <td>{skuCodeToName[po.skuCode] ?? po.skuCode}</td>
                          <td>{po.poNumber}</td>
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
                        <th>Item Name</th>
                        <th>PO Number</th>
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
                          <td>{skuCodeToName[po.skuCode] ?? po.skuCode}</td>
                          <td>{po.poNumber}</td>
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

      {/* Item picker modal for selecting multiple SKUs under one PO/UID */}
      {itemPicker && (
        <div className="modal-backdrop" onClick={() => setItemPicker(null)}>
          <div className="card modal-content max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-semibold">Select items</h2>
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              Pick one or more items to add under the same PO number and UID.
            </p>
            <div className="max-h-80 overflow-y-auto border border-[var(--color-border)] rounded-md">
              {activeSkus.map((s) => {
                const code = s.skuCode;
                const label = s.name || s.skuCode;
                let selected = false;
                if (itemPicker.context === 'A' && newRowA) {
                  selected = Array.isArray(newRowA.multiSkuCodes)
                    ? newRowA.multiSkuCodes.includes(code)
                    : newRowA.skuCode === code;
                } else if (itemPicker.context === 'B' && newRowB) {
                  selected = Array.isArray(newRowB.multiSkuCodes)
                    ? newRowB.multiSkuCodes.includes(code)
                    : newRowB.skuCode === code;
                } else if (itemPicker.context === 'planning' && newPlanningRow) {
                  selected = Array.isArray(newPlanningRow.multiSkuCodes)
                    ? newPlanningRow.multiSkuCodes.includes(code)
                    : newPlanningRow.skuCode === code;
                }
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const update = (prevCodes = [], fallbackCode) => {
                          const base = Array.isArray(prevCodes) && prevCodes.length > 0
                            ? prevCodes
                            : fallbackCode
                            ? [fallbackCode]
                            : [];
                          if (checked) {
                            return base.includes(code) ? base : [...base, code];
                          }
                          return base.filter((c) => c !== code);
                        };

                        if (itemPicker.context === 'A') {
                          setNewRowA((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  skuCode: checked
                                    ? code
                                    : prev.skuCode && prev.skuCode !== code
                                    ? prev.skuCode
                                    : '',
                                  multiSkuCodes: update(prev.multiSkuCodes, prev.skuCode),
                                }
                              : prev,
                          );
                        } else if (itemPicker.context === 'B') {
                          setNewRowB((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  skuCode: checked
                                    ? code
                                    : prev.skuCode && prev.skuCode !== code
                                    ? prev.skuCode
                                    : '',
                                  multiSkuCodes: update(prev.multiSkuCodes, prev.skuCode),
                                }
                              : prev,
                          );
                        } else if (itemPicker.context === 'planning') {
                          setNewPlanningRow((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  skuCode: checked
                                    ? code
                                    : prev.skuCode && prev.skuCode !== code
                                    ? prev.skuCode
                                    : '',
                                  multiSkuCodes: update(prev.multiSkuCodes, prev.skuCode),
                                }
                              : prev,
                          );
                        }
                      }}
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <span className="font-medium">{label}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">
                        {code}
                      </span>
                    </div>
                    {itemPicker.context !== 'planning' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[var(--color-muted)]">Qty</span>
                        <input
                          type="number"
                          min="1"
                          className="input h-7 w-20 px-2 text-xs"
                          value={(() => {
                            if (itemPicker.context === 'A' && newRowA) {
                              const map = newRowA.multiSkuQuantities || {};
                              return map[code] ?? '';
                            }
                            if (itemPicker.context === 'B' && newRowB) {
                              const map = newRowB.multiSkuQuantities || {};
                              return map[code] ?? '';
                            }
                            return '';
                          })()}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (itemPicker.context === 'A') {
                              setNewRowA((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      multiSkuQuantities: {
                                        ...(prev.multiSkuQuantities || {}),
                                        [code]: val,
                                      },
                                    }
                                  : prev,
                              );
                            } else if (itemPicker.context === 'B') {
                              setNewRowB((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      multiSkuQuantities: {
                                        ...(prev.multiSkuQuantities || {}),
                                        [code]: val,
                                      },
                                    }
                                  : prev,
                              );
                            }
                          }}
                          disabled={!selected}
                        />
                      </div>
                    )}
                  </label>
                );
              })}
              {activeSkus.length === 0 && (
                <p className="px-3 py-2 text-sm text-[var(--color-muted)]">
                  No active SKUs available. Add SKUs first in the SKU Database.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemPicker(null)}
                className="btn-secondary"
              >
                Done
              </button>
            </div>
          </div>
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
      {editModal && (() => {
        const po = editModal.po;
        const isB = po.type === 'B';
        const groupRowsA = isB ? getGroupRowsAWithEndForB(po) : [];
        const computed = isB ? computeRowB(po, groupRowsA) : computeRowA(po);
        return (
        <div className="modal-backdrop" onClick={() => { setEditModal(null); setError(''); }}>
          <div className="card modal-content p-6 max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit purchase order</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Warehouse: <strong>{warehouseNames[po.warehouseId] || po.warehouseId}</strong> · Item: <strong>{skuCodeToName[po.skuCode] ?? po.skuCode}</strong> (read-only)
            </p>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">PO Number</label>
                <input placeholder="PO Number" value={editForm.poNumber} onChange={(e) => setEditForm((f) => ({ ...f, poNumber: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">ETD (departure)</label>
                <input type="date" value={editForm.etd} onChange={(e) => setEditForm((f) => ({ ...f, etd: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">ETA (arrival)</label>
                <input type="date" value={editForm.eta} onChange={(e) => setEditForm((f) => ({ ...f, eta: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">PO Qty</label>
                <input type="number" min="1" placeholder="Quantity" value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} className="input w-full" required />
              </div>
              {isB && (
                <div>
                  <label className="mb-1 block text-sm text-[var(--color-muted)]">Final ETA early by</label>
                  <input type="number" placeholder="Optional" value={editForm.finalEtaEarlyBy} onChange={(e) => setEditForm((f) => ({ ...f, finalEtaEarlyBy: e.target.value }))} className="input w-full" />
                </div>
              )}
              <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                <p className="text-sm font-medium text-[var(--color-muted)]">Calculated (read-only)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>ETA early by (days):</span>
                  <span>{computed.etaEarlyByDays != null ? Math.round(computed.etaEarlyByDays) : '—'}</span>
                  <span>PO Qty stock end days:</span>
                  <span>{computed.poQtyStockEndDays != null ? computed.poQtyStockEndDays.toFixed(1) : '—'}</span>
                  <span>Total Stock end days:</span>
                  <span>{computed.totalStockEndDays != null ? computed.totalStockEndDays.toFixed(1) : '—'}</span>
                  <span>Stock End Date:</span>
                  <span>{computed.stockEndDateMs != null ? formatShortDate(computed.stockEndDateMs) : '—'}</span>
                  {isB && (
                    <>
                      <span>Final ETA early by:</span>
                      <span>{computed.finalEtaEarlyBy != null ? Math.round(computed.finalEtaEarlyBy) : '—'}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={editSubmitting} className="btn-primary">{editSubmitting ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => { setEditModal(null); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
        );})()}
    </div>
  );
}
