import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

export default function SkuMaster() {
  const { getIdToken } = useAuth();
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    skuCode: '', name: '', category: '', status: 'Active',
    purchaseRate: '', sellRate: '', weightPerUnit: '',
  });

  const fetchList = () => apiGet(getIdToken, '/api/skus').then(setList).catch((e) => setError(e.message));
  usePoll(fetchList);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      skuCode: form.skuCode,
      name: form.name,
      category: form.category || '',
      status: form.status,
      purchaseRate: Number(form.purchaseRate) || 0,
      sellRate: Number(form.sellRate) || 0,
      weightPerUnit: Number(form.weightPerUnit) || 0,
    };
    apiPost(getIdToken, '/api/skus', payload)
      .then(() => {
        setForm({ skuCode: '', name: '', category: '', status: 'Active', purchaseRate: '', sellRate: '', weightPerUnit: '' });
        setShowForm(false);
        fetchList();
      })
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Database (SKU Master)</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowForm((x) => !x)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm"
        >
          {showForm ? 'Cancel' : 'Add SKU'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 border border-gray-200 rounded bg-white grid grid-cols-2 gap-2 max-w-2xl">
          <input placeholder="SKU Code" value={form.skuCode} onChange={(e) => setForm((f) => ({ ...f, skuCode: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" required />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="border rounded px-2 py-1.5 text-sm">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <input type="number" step="any" placeholder="Purchase Rate" value={form.purchaseRate} onChange={(e) => setForm((f) => ({ ...f, purchaseRate: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
          <input type="number" step="any" placeholder="Sell Rate" value={form.sellRate} onChange={(e) => setForm((f) => ({ ...f, sellRate: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
          <input type="number" step="any" placeholder="Weight per unit" value={form.weightPerUnit} onChange={(e) => setForm((f) => ({ ...f, weightPerUnit: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
          <button type="submit" className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm col-span-2">Save</button>
        </form>
      )}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">SKU Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Purchase Rate</th>
              <th className="px-3 py-2 font-medium">Sell Rate</th>
              <th className="px-3 py-2 font-medium">Weight/unit</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{s.skuCode}</td>
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.category || '—'}</td>
                <td className="px-3 py-2">{s.status}</td>
                <td className="px-3 py-2">{s.purchaseRate}</td>
                <td className="px-3 py-2">{s.sellRate}</td>
                <td className="px-3 py-2">{s.weightPerUnit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && !error && <p className="px-3 py-4 text-gray-500 text-sm">No SKUs. Add one above.</p>}
      </div>
    </div>
  );
}
