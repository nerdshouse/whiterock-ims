import { useState, useEffect } from 'react';
import { subscribeMembers, addMember, updateMember, deleteMember } from '../lib/db';

const ROLES = ['Admin', 'User'];

function formatDate(ms) {
  if (ms == null) return '—';
  return new Date(ms).toLocaleDateString();
}

export default function Members({ embedInSettings = false }) {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | { type: 'edit', member } | { type: 'delete', member }
  const [form, setForm] = useState({ email: '', displayName: '', role: 'User' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeMembers(setList);
    return () => unsub();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await addMember({ email: form.email, displayName: form.displayName, role: form.role });
      setForm({ email: '', displayName: '', role: 'User' });
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!modal?.member) return;
    setError('');
    setLoading(true);
    try {
      await updateMember(modal.member.id, { displayName: form.displayName, role: form.role });
      setForm({ email: '', displayName: '', role: 'User' });
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!modal?.member) return;
    setError('');
    setLoading(true);
    try {
      await deleteMember(modal.member.id);
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (member) => {
    setForm({
      email: member.email,
      displayName: member.displayName || '',
      role: member.role || 'User',
    });
    setModal({ type: 'edit', member });
    setError('');
  };

  const openAdd = () => {
    setForm({ email: '', displayName: '', role: 'User' });
    setModal('add');
    setError('');
  };

  return (
    <div>
      {!embedInSettings && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="page-head">Members</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Only listed members can sign in with Google.</p>
          </div>
          <button type="button" onClick={openAdd} className="btn-primary">
            Add member
          </button>
        </div>
      )}
      {embedInSettings && (
        <div className="flex flex-wrap items-center justify-end gap-4 mb-4">
          <button type="button" onClick={openAdd} className="btn-primary">
            Add member
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Added</th>
              <th className="w-0">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td>{m.displayName || '—'}</td>
                <td>{m.email}</td>
                <td>{m.role || 'User'}</td>
                <td className="text-[var(--color-muted)]">{formatDate(m.createdAt)}</td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(m)} className="btn-ghost py-1 text-xs">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'delete', member: m })}
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
        {list.length === 0 && (
          <p className="px-4 py-8 text-center text-[var(--color-muted)]">No members yet. Add one to get started.</p>
        )}
      </div>

      {/* Add modal */}
      {modal === 'add' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Add member</h2>
            <p className="mb-3 text-xs text-[var(--color-muted)]">This email will be allowed to sign in with Google. They do not need a password.</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" placeholder="email@example.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Name</label>
                <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="input" placeholder="Display name" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary">Add</button>
                <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal?.type === 'edit' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="card max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Edit member</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Email</label>
                <input type="email" value={form.email} disabled className="input bg-gray-50" />
                <p className="mt-1 text-xs text-[var(--color-muted)]">Email cannot be changed.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Name</label>
                <input type="text" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className="input" placeholder="Display name" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--color-muted)]">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary">Save</button>
                <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {modal?.type === 'delete' && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="card max-w-sm w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Delete member</h2>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Remove <strong>{modal.member.email}</strong>? They will no longer be able to sign in with Google.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={handleDelete} disabled={loading} className="btn-danger">Delete</button>
              <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
