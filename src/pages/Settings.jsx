import { useState, useEffect } from 'react';
import { subscribeWarehouses, addWarehouse, updateWarehouse, deleteWarehouse } from '../lib/db';
import Members from './Members';

export default function Settings() {
  const [warehouses, setWarehouses] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }

  useEffect(() => {
    const unsub = subscribeWarehouses(setWarehouses);
    return () => unsub();
  }, []);

  const handleAddWarehouse = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await addWarehouse({ name: name.trim(), location: '' });
      setName('');
    } catch (e) {
      setError(e.message || 'Failed to add warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (w) => {
    setEditingId(w.id);
    setEditName(w.name || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault();
    if (!editingId) return;
    const next = editName.trim();
    if (!next) return;
    setError('');
    setSubmitting(true);
    try {
      await updateWarehouse(editingId, { name: next });
      setEditingId(null);
      setEditName('');
    } catch (e) {
      setError(e.message || 'Failed to update warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!deleteConfirm) return;
    setError('');
    setSubmitting(true);
    try {
      await deleteWarehouse(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message || 'Failed to delete warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <h1 className="page-head mb-6">Settings</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Warehouses box */}
        <section className="min-w-0">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
              <h2 className="text-lg font-semibold">Warehouses</h2>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Quickly add warehouses. You can view and manage full details from the Warehouses page.
              </p>
            </div>
            <div className="p-4">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}
              <form onSubmit={handleAddWarehouse} className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-sm text-[var(--color-muted)]">Name</label>
                  <input
                    type="text"
                    placeholder="Warehouse name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input w-full"
                    required
                  />
                </div>
                <div className="flex items-end justify-start">
                  <button type="submit" disabled={submitting || !name.trim()} className="btn-primary">
                    {submitting ? 'Adding…' : 'Add warehouse'}
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-[var(--color-muted)]">Name</th>
                      <th className="px-4 py-2 text-left text-[var(--color-muted)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouses.map((w) => (
                      <tr key={w.id} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-2">
                          {editingId === w.id ? (
                            <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
                                className="input py-1 text-sm max-w-[220px]"
                                autoFocus
                              />
                              <button type="submit" className="btn-ghost py-1 text-xs">Save</button>
                              <button type="button" onClick={cancelEdit} className="btn-ghost py-1 text-xs text-[var(--color-muted)]">
                                Cancel
                              </button>
                            </form>
                          ) : (
                            w.name
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(w)}
                              className="btn-ghost py-1 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ id: w.id, name: w.name })}
                              className="btn-ghost py-1 text-xs text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {warehouses.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                    No warehouses yet. Add one above.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Members box */}
        <section className="min-w-0">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
              <h2 className="text-lg font-semibold">Members</h2>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Only listed members can sign in with Google.
              </p>
            </div>
            <div className="p-4">
              <Members embedInSettings />
            </div>
          </div>
        </section>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="card max-w-sm w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Delete warehouse</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Delete <strong>{deleteConfirm.name}</strong>? This cannot be undone and may affect linked stock.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDeleteWarehouse} disabled={submitting} className="btn-danger">
                {submitting ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
