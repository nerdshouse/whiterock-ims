import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addWarehouse, updateWarehouse, deleteWarehouse, subscribeWarehouses } from '../lib/db';

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | { id, name, location }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | { id, name }
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const unsub = subscribeWarehouses(setList);
    return () => unsub();
  }, []);

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      await updateWarehouse(editing.id, { name, location });
      setEditing(null);
      setName('');
      setLocation('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setError('');
    try {
      await deleteWarehouse(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (w) => {
    setEditing({ id: w.id, name: w.name, location: w.location ?? '' });
    setName(w.name);
    setLocation(w.location ?? '');
    setError('');
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-head">Warehouses</h1>
      </div>
      {error && <p className="mb-4 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th className="w-0 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id} className="align-middle">
                <td className="align-middle"><Link to={`/warehouses/${w.id}`} className="link font-medium">{w.name}</Link></td>
                <td className="align-middle text-[var(--color-muted)]">{w.location || '—'}</td>
                <td className="align-middle whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Link to={`/warehouses/${w.id}`} className="link text-xs">View</Link>
                    <button type="button" onClick={() => startEdit(w)} className="btn-ghost py-0 text-xs leading-normal">Edit</button>
                    <button type="button" onClick={() => setDeleteConfirm({ id: w.id, name: w.name })} className="btn-ghost py-0 text-xs leading-normal text-[var(--color-danger)] hover:bg-red-50 hover:text-[var(--color-danger)]">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-4 py-8 text-center text-[var(--color-muted)]">No warehouses yet. Add one above.</p>}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEditing(null); setError(''); }}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit warehouse</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Name</label>
                <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" required />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Location</label>
                <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="input w-full" />
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
            <h2 className="mb-2 text-lg font-semibold">Remove warehouse</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Remove <strong>{deleteConfirm.name}</strong>? This cannot be undone. Stock and links to this warehouse may be affected.
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
