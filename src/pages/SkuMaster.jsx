import { useState, useEffect } from 'react';
import { addSku, updateSku, deleteSku, getSkuByCode, subscribeSkus } from '../lib/db';

export default function SkuMaster() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // null | sku doc
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | { id, skuCode }
  const [form, setForm] = useState({ skuCode: '', name: '', category: '', status: 'Active', purchaseRate: '', sellRate: '', weightPerUnit: '', pcsInBox: '' });

  useEffect(() => {
    const unsub = subscribeSkus(setList);
    return () => unsub();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const existing = await getSkuByCode(form.skuCode);
      if (existing) throw new Error('SKU code already exists');
      await addSku({
        skuCode: form.skuCode,
        name: form.name,
        category: form.category || '',
        status: form.status,
        purchaseRate: Number(form.purchaseRate) || 0,
        sellRate: Number(form.sellRate) || 0,
        weightPerUnit: Number(form.weightPerUnit) || 0,
        pcsInBox: Number(form.pcsInBox) || 0,
      });
      setForm({ skuCode: '', name: '', category: '', status: 'Active', purchaseRate: '', sellRate: '', weightPerUnit: '', pcsInBox: '' });
      setShowForm(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      await updateSku(editing.id, {
        name: form.name,
        category: form.category || '',
        status: form.status,
        purchaseRate: Number(form.purchaseRate) || 0,
        sellRate: Number(form.sellRate) || 0,
        weightPerUnit: Number(form.weightPerUnit) || 0,
      });
      setEditing(null);
      setForm({ skuCode: '', name: '', category: '', status: 'Active', purchaseRate: '', sellRate: '', weightPerUnit: '', pcsInBox: '' });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    try {
      await deleteSku(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (s) => {
    setEditing(s);
    setForm({
      skuCode: s.skuCode,
      name: s.name || '',
      category: s.category || '',
      status: s.status || 'Active',
      purchaseRate: s.purchaseRate ?? '',
      sellRate: s.sellRate ?? '',
      weightPerUnit: s.weightPerUnit ?? '',
      pcsInBox: s.pcsInBox ?? '',
    });
    setError('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">SKU Master</h1>
        <button type="button" onClick={() => { setShowForm((x) => !x); setEditing(null); setError(''); }} className="btn-primary">
          {showForm ? 'Cancel' : 'Add SKU'}
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}
      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 grid grid-cols-2 gap-4 p-6 max-w-2xl">
          <input placeholder="SKU Code" value={form.skuCode} onChange={(e) => setForm((f) => ({ ...f, skuCode: e.target.value }))} className="input" required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input" />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <input type="number" step="any" placeholder="Purchase Rate" value={form.purchaseRate} onChange={(e) => setForm((f) => ({ ...f, purchaseRate: e.target.value }))} className="input" />
          <input type="number" step="any" placeholder="Sell Rate" value={form.sellRate} onChange={(e) => setForm((f) => ({ ...f, sellRate: e.target.value }))} className="input" />
          <input type="number" step="any" placeholder="Weight per unit (kg)" value={form.weightPerUnit} onChange={(e) => setForm((f) => ({ ...f, weightPerUnit: e.target.value }))} className="input" />
          <input type="number" min="0" placeholder="Pcs in a Box" value={form.pcsInBox} onChange={(e) => setForm((f) => ({ ...f, pcsInBox: e.target.value }))} className="input" />
          <div className="col-span-2">
            <button type="submit" className="btn-secondary">Save</button>
          </div>
        </form>
      )}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SKU Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Purchase Rate</th>
              <th>Sell Rate</th>
              <th>Weight (kg)</th>
              <th>Pcs in Box</th>
              <th className="w-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.skuCode}</td>
                <td>{s.name}</td>
                <td className="text-[var(--color-muted)]">{s.category || '—'}</td>
                <td>{s.status}</td>
                <td>{s.purchaseRate}</td>
                <td>{s.sellRate}</td>
                <td>{s.weightPerUnit}</td>
                <td>{s.pcsInBox ?? '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(s)} className="btn-ghost py-0 text-xs">Edit</button>
                    <button type="button" onClick={() => setDeleteConfirm({ id: s.id, skuCode: s.skuCode })} className="btn-ghost py-0 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-4 py-8 text-center text-[var(--color-muted)]">No SKUs yet.</p>}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEditing(null); setError(''); }}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit SKU</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">SKU Code</label>
                <input value={form.skuCode} disabled className="input w-full bg-gray-50" />
                <p className="mt-1 text-xs text-[var(--color-muted)]">SKU code cannot be changed.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Name</label>
                <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Category</label>
                <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input w-full">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Purchase Rate</label>
                <input type="number" step="any" placeholder="Purchase Rate" value={form.purchaseRate} onChange={(e) => setForm((f) => ({ ...f, purchaseRate: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Sell Rate</label>
                <input type="number" step="any" placeholder="Sell Rate" value={form.sellRate} onChange={(e) => setForm((f) => ({ ...f, sellRate: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Weight per unit (kg)</label>
                <input type="number" step="any" placeholder="Weight per unit" value={form.weightPerUnit} onChange={(e) => setForm((f) => ({ ...f, weightPerUnit: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Pcs in a Box</label>
                <input type="number" min="0" placeholder="Pcs in a Box" value={form.pcsInBox} onChange={(e) => setForm((f) => ({ ...f, pcsInBox: e.target.value }))} className="input w-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary">Update</button>
                <button type="button" onClick={() => { setEditing(null); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="card max-w-sm w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Remove SKU</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Remove SKU <strong>{deleteConfirm.skuCode}</strong>? This cannot be undone. Stock and purchase orders may reference this SKU.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} className="btn-danger">Remove</button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
