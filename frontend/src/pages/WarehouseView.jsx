import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut, apiPost } from '../lib/api';
import { usePoll } from '../hooks/usePoll';

export default function WarehouseView() {
  const { id } = useParams();
  const { getIdToken } = useAuth();
  const [warehouse, setWarehouse] = useState(null);
  const [stock, setStock] = useState([]);
  const [skus, setSkus] = useState([]);
  const [error, setError] = useState('');
  const [showAddStock, setShowAddStock] = useState(false);
  const [addSku, setAddSku] = useState('');
  const [addCurrent, setAddCurrent] = useState('');
  const [addDaily, setAddDaily] = useState('');
  const [addLead, setAddLead] = useState('');

  const fetchWarehouse = () => apiGet(getIdToken, `/api/warehouses/${id}`).then(setWarehouse).catch(() => setWarehouse(null));
  const fetchStock = () => apiGet(getIdToken, '/api/stock', { warehouseId: id }).then(setStock).catch(() => setStock([]));
  const fetchSkus = () => apiGet(getIdToken, '/api/skus').then(setSkus).catch(() => setSkus([]));

  usePoll(() => {
    fetchWarehouse();
    fetchStock();
  });
  useEffect(() => { fetchSkus(); }, []);

  const skuMap = Object.fromEntries(skus.map((s) => [s.skuCode, s]));
  const updateStock = (warehouseId, skuCode, currentStock, dailyAvgSale, leadTime) => {
    apiPut(getIdToken, `/api/stock/${warehouseId}/${encodeURIComponent(skuCode)}`, {
      currentStock: currentStock != null ? Number(currentStock) : undefined,
      dailyAvgSale: dailyAvgSale != null ? Number(dailyAvgSale) : undefined,
      leadTime: leadTime != null ? Number(leadTime) : undefined,
    })
      .then(() => { fetchStock(); setError(''); })
      .catch((e) => setError(e.message));
  };

  const handleAddStock = (e) => {
    e.preventDefault();
    if (!addSku) return;
    setError('');
    apiPost(getIdToken, '/api/stock', {
      warehouseId: id,
      skuCode: addSku,
      currentStock: Number(addCurrent) || 0,
      dailyAvgSale: Number(addDaily) || 0,
      leadTime: Number(addLead) || 0,
    })
      .then(() => {
        setAddSku(''); setAddCurrent(''); setAddDaily(''); setAddLead('');
        setShowAddStock(false);
        fetchStock();
      })
      .catch((e) => setError(e.message));
  };

  if (!warehouse) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/warehouses" className="text-gray-500 hover:text-gray-700 text-sm">← Warehouses</Link>
        <h1 className="text-lg font-semibold text-gray-900">{warehouse.name}</h1>
        {warehouse.location && <span className="text-gray-500 text-sm">{warehouse.location}</span>}
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAddStock((x) => !x)}
          className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
        >
          {showAddStock ? 'Cancel' : 'Add stock line'}
        </button>
      </div>
      {showAddStock && (
        <form onSubmit={handleAddStock} className="mb-4 flex flex-wrap gap-2 items-end">
          <select value={addSku} onChange={(e) => setAddSku(e.target.value)} className="border rounded px-2 py-1.5 text-sm" required>
            <option value="">Select SKU</option>
            {skus.filter((s) => !stock.some((st) => st.skuCode === s.skuCode)).map((s) => (
              <option key={s.id} value={s.skuCode}>{s.skuCode} – {s.name}</option>
            ))}
          </select>
          <input type="number" min="0" placeholder="Current stock" value={addCurrent} onChange={(e) => setAddCurrent(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-24" />
          <input type="number" step="any" min="0" placeholder="Daily avg sale" value={addDaily} onChange={(e) => setAddDaily(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-28" />
          <input type="number" min="0" placeholder="Lead time (days)" value={addLead} onChange={(e) => setAddLead(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-28" />
          <button type="submit" className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm">Add</button>
        </form>
      )}
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[600px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Current Stock</th>
              <th className="px-3 py-2 font-medium">Daily Avg Sale</th>
              <th className="px-3 py-2 font-medium">Lead Time (days)</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{s.skuCode} {skuMap[s.skuCode]?.name && `(${skuMap[s.skuCode].name})`}</td>
                <td className="px-3 py-2">{s.currentStock}</td>
                <td className="px-3 py-2">{s.dailyAvgSale}</td>
                <td className="px-3 py-2">{s.leadTime}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const v = prompt('New current stock:', s.currentStock);
                      if (v !== null) updateStock(id, s.skuCode, v, s.dailyAvgSale, s.leadTime);
                    }}
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Update stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stock.length === 0 && (
          <p className="px-3 py-4 text-gray-500 text-sm">No stock records. Add stock from Dashboard or create a PO and receive it.</p>
        )}
      </div>
    </div>
  );
}
