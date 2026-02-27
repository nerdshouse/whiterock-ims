import { useState, useEffect } from 'react';
import { subscribeLocations, addLocation, deleteLocation, updateLocation } from '../lib/db';
import Members from './Members';

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="m2.695 14.762-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a2 2 0 0 0 1.11-.57L17.5 5.5a2.121 2.121 0 0 0-3-3L3.265 13.653a2 2 0 0 0-.57 1.11Z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
  </svg>
);

export default function Settings() {
  const [locations, setLocations] = useState([]);
  const [locationName, setLocationName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const unsub = subscribeLocations(setLocations);
    return () => unsub();
  }, []);

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const name = locationName.trim();
    if (!name) return;
    setError('');
    setSubmitting(true);
    try {
      await addLocation(name);
      setLocationName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveLocation = async (id) => {
    setError('');
    try {
      await deleteLocation(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditName(loc.name || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (e) => {
    e?.preventDefault();
    if (editingId == null) return;
    const name = editName.trim();
    if (!name) return cancelEdit();
    setError('');
    setSubmitting(true);
    try {
      await updateLocation(editingId, name);
      setEditingId(null);
      setEditName('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="page-head mb-6">Settings</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Locations box - reduced width */}
        <section className="max-w-sm">
          <div className="card overflow-hidden p-0">
            <div className="border-b border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
              <h2 className="text-lg font-semibold">Locations</h2>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Add locations here. They appear in the Warehouse page when setting a warehouse&apos;s Location.
              </p>
            </div>
            <div className="p-4">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}
              <form onSubmit={handleAddLocation} className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[120px] flex-1">
                  <label className="mb-1 block text-sm text-[var(--color-muted)]">Add location</label>
                  <input
                    type="text"
                    placeholder="e.g. Bhiwandi, Mumbai"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <button type="submit" disabled={submitting || !locationName.trim()} className="btn-primary">
                  {submitting ? 'Adding…' : 'Add'}
                </button>
              </form>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                <table className="w-full locations-settings-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => (
                      <tr key={loc.id}>
                        <td className="align-middle py-2">
                          {editingId === loc.id ? (
                            <form onSubmit={saveEdit} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Escape' && cancelEdit()}
                                style={{ width: `${Math.max(8, Math.min(24, editName.length + 2))}ch` }}
                                className="input py-1 text-sm max-w-[180px]"
                                autoFocus
                              />
                              <button type="submit" className="btn-ghost p-1 text-green-600 hover:text-green-700" title="Save">
                                <CheckIcon />
                              </button>
                              <button type="button" onClick={cancelEdit} className="btn-ghost p-1 text-xs text-[var(--color-muted)]" title="Cancel">
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{loc.name}</span>
                              <button
                                type="button"
                                onClick={() => startEdit(loc)}
                                className="btn-ghost p-1 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                                title="Edit"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLocation(loc.id)}
                                className="btn-ghost p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-red-50"
                                title="Delete"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {locations.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">No locations yet. Add one above.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Members box - next to Locations */}
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
    </div>
  );
}
