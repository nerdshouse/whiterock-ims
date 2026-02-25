import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

export default function Warehouses() {
  const { getIdToken } = useAuth();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const fetchList = () => {
    apiGet(getIdToken, '/api/warehouses')
      .then(setList)
      .catch((e) => setError(e.message));
  };

  usePoll(fetchList);

  const handleAdd = (e) => {
    e.preventDefault();
    setError('');
    apiPost(getIdToken, '/api/warehouses', { name, location })
      .then(() => {
        setName('');
        setLocation('');
        setShowForm(false);
        fetchList();
      })
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Warehouses</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowForm((x) => !x)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
        >
          {showForm ? 'Cancel' : 'Add warehouse'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 flex gap-2 items-end">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
            required
          />
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
          <button type="submit" className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm">
            Save
          </button>
        </form>
      )}
      <div className="border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id} className="border-t border-gray-200">
                <td className="px-3 py-2">
                  <Link to={`/warehouses/${w.id}`} className="text-blue-600 hover:underline">
                    {w.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-600">{w.location || '—'}</td>
                <td className="px-3 py-2">
                  <Link to={`/warehouses/${w.id}`} className="text-blue-600 hover:underline text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && (
          <p className="px-3 py-4 text-gray-500 text-sm">No warehouses. Add one above.</p>
        )}
      </div>
    </div>
  );
}
