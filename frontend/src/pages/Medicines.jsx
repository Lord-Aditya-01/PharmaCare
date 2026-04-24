import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, PackageX, SlidersHorizontal, X, Plus, Minus, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import Alert from '../components/Alert';
import EntityPage from '../components/EntityPage';

// ─── Stock Adjust Modal ───────────────────────────────────────────────────────
function AdjustModal({ medicine, onClose, onDone }) {
  const [qty, setQty] = useState('');
  const [direction, setDirection] = useState('add'); // add | remove
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const REASONS_ADD    = ['Batch Received', 'Inventory Correction', 'Return from Customer', 'Transfer In', 'Other'];
  const REASONS_REMOVE = ['Wastage / Expired', 'Sample Dispensed', 'Breakage / Damage', 'Transfer Out', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) { setError('Enter a valid positive integer'); return; }
    if (!reason) { setError('Select a reason'); return; }

    const finalQty = direction === 'remove' ? -n : n;
    const currentStock = Number(medicine.current_stock || 0);
    if (direction === 'remove' && n > currentStock) {
      setError(`Cannot remove ${n} — only ${currentStock} in stock`);
      return;
    }

    setSaving(true);
    try {
      await api.post(`/medicines/${medicine.medicine_id}/adjust-stock`, {
        quantity: finalQty,
        reason: `${direction === 'add' ? 'Added' : 'Removed'}: ${reason}`
      });
      onDone();
      onClose();
    } catch(err) {
      setError(err.response?.data?.message || 'Adjustment failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Adjust Stock</h2>
            <p className="text-xs text-slate-500 mt-0.5">{medicine.medicine_name}{medicine.brand_name ? ` (${medicine.brand_name})` : ''}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-center flex-1">
              <p className="text-xs text-slate-500">Current Stock</p>
              <p className={`text-2xl font-extrabold ${Number(medicine.current_stock)===0?'text-rose-600':Number(medicine.current_stock)<=Number(medicine.min_stock_level)?'text-amber-600':'text-slate-900'}`}>
                {medicine.current_stock ?? 0}
              </p>
            </div>
            <div className="text-center flex-1 border-l border-slate-200">
              <p className="text-xs text-slate-500">Min Level</p>
              <p className="text-2xl font-bold text-slate-400">{medicine.min_stock_level}</p>
            </div>
          </div>

          {/* Direction toggle */}
          <div className="flex gap-2">
            <button type="button" onClick={() => setDirection('add')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors
                ${direction==='add'?'border-emerald-500 bg-emerald-50 text-emerald-700':'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Plus size={14}/> Add Stock
            </button>
            <button type="button" onClick={() => setDirection('remove')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors
                ${direction==='remove'?'border-rose-400 bg-rose-50 text-rose-700':'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Minus size={14}/> Remove Stock
            </button>
          </div>

          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Quantity *
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                placeholder="Enter quantity"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Reason *
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
                <option value="">Select reason…</option>
                {(direction === 'add' ? REASONS_ADD : REASONS_REMOVE).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60
                ${direction==='add'?'bg-emerald-600 hover:bg-emerald-700':'bg-rose-600 hover:bg-rose-700'}`}>
              {saving ? 'Saving…' : `${direction==='add'?'Add':'Remove'} ${qty||'?'} units`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function Medicines() {
  const [lowStockCount, setLowStockCount] = useState(null);
  const [outCount, setOutCount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [adjustMed, setAdjustMed] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadMeta = useCallback(() => {
    api.get('/dashboard/low-stock').then(r => {
      setLowStockCount(r.data.filter(m => m.stock_status === 'low_stock').length);
      setOutCount(r.data.filter(m => m.stock_status === 'out_of_stock').length);
    }).catch(() => {});
    api.get('/medicines?paginate=false').then(r => {
      const cats = [...new Set((Array.isArray(r.data) ? r.data : r.data?.data || []).map(m => m.category).filter(Boolean))].sort();
      setCategories(cats);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadMeta(); }, []);

  const filterParams = {};
  if (stockFilter !== 'all') filterParams.stock_status = stockFilter;
  if (categoryFilter !== 'all') filterParams.category = categoryFilter;

  return (
    <>
      {/* Alert strip */}
      {(outCount > 0 || lowStockCount > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {outCount > 0 && (
            <button onClick={() => { setStockFilter('out_of_stock'); setRefreshKey(k=>k+1); }}
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100">
              <PackageX size={13}/>
              <strong>{outCount}</strong> out of stock — click to filter
            </button>
          )}
          {lowStockCount > 0 && (
            <button onClick={() => { setStockFilter('low_stock'); setRefreshKey(k=>k+1); }}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100">
              <AlertTriangle size={13}/>
              <strong>{lowStockCount}</strong> low stock — click to filter
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SlidersHorizontal size={14} className="text-slate-400"/>
        <select value={stockFilter} onChange={e => { setStockFilter(e.target.value); setRefreshKey(k=>k+1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-500">
          <option value="all">All Stock Status</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="ok">In Stock (OK)</option>
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setRefreshKey(k=>k+1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-indigo-500">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(stockFilter !== 'all' || categoryFilter !== 'all') && (
          <button onClick={() => { setStockFilter('all'); setCategoryFilter('all'); setRefreshKey(k=>k+1); }}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
            <X size={12}/> Clear filters
          </button>
        )}
      </div>

      <EntityPage
        key={refreshKey}
        title="Medicines"
        subtitle="Manage hospital medicine catalogue. Stock levels update automatically from batch records."
        endpoint="/medicines"
        idField="medicine_id"
        extraParams={filterParams}
        fields={[
          { name: 'medicine_name', label: 'Medicine Name', required: true },
          { name: 'brand_name', label: 'Brand Name' },
          { name: 'generic_name', label: 'Generic Name' },
          { name: 'category', label: 'Category' },
          { name: 'unit_price', label: 'Unit Price (₹)', type: 'number', step: '0.01', required: true, hint: 'Price per unit' },
          { name: 'min_stock_level', label: 'Min Stock Level', type: 'number', required: true, hint: 'Alert threshold' },
          { name: 'storage_type', label: 'Storage Type', hint: 'e.g. Refrigerated, Room Temp' },
        ]}
        columns={[
          { key: 'medicine_id', label: 'ID' },
          { key: 'medicine_name', label: 'Medicine' },
          { key: 'brand_name', label: 'Brand' },
          { key: 'generic_name', label: 'Generic' },
          { key: 'category', label: 'Category' },
          { key: 'unit_price', label: 'Price (₹)' },
          { key: 'current_stock', label: 'Stock', fallback: 0 },
          { key: 'min_stock_level', label: 'Min' },
          { key: 'nearest_expiry', label: 'Nearest Expiry' },
          { key: 'batch_count', label: 'Batches', fallback: 0 },
        ]}
        cellRenderer={(col, val, row) => {
          if (col.key === 'current_stock') {
            const n = Number(val ?? 0);
            const m = Number(row?.min_stock_level ?? 0);
            if (n === 0) return (
              <span className="badge badge-danger inline-flex items-center gap-1">
                <PackageX size={10}/> 0 — Out
              </span>
            );
            if (n <= m) return (
              <span className="badge badge-warning inline-flex items-center gap-1">
                <AlertTriangle size={10}/> {n} Low
              </span>
            );
            return <span className="font-bold text-emerald-700">{n}</span>;
          }
          if (col.key === 'nearest_expiry') {
            if (!val) return <span className="text-slate-300">—</span>;
            const days = Number(row?.days_to_expiry ?? 999);
            const dateStr = String(val).slice(0, 10);
            if (days < 0) return <span className="badge badge-danger">Expired</span>;
            if (days < 30) return <span className="badge badge-danger">{dateStr} <span className="ml-1 font-bold">({days}d)</span></span>;
            if (days < 60) return <span className="badge badge-warning">{dateStr} <span className="ml-1">({days}d)</span></span>;
            return <span className="text-xs text-slate-500">{dateStr}</span>;
          }
          if (col.key === 'unit_price') return <span>₹{Number(val||0).toFixed(2)}</span>;
          return null;
        }}
        rowActions={(record) => (
          <button
            onClick={() => setAdjustMed(record)}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 ml-2"
          >
            Adjust
          </button>
        )}
        clientValidate={(form) => {
          if (Number(form.unit_price) <= 0) return 'Unit price must be greater than 0';
          if (Number(form.min_stock_level) < 0) return 'Min stock level cannot be negative';
          return null;
        }}
      />

      {adjustMed && (
        <AdjustModal
          medicine={adjustMed}
          onClose={() => setAdjustMed(null)}
          onDone={() => { setRefreshKey(k => k + 1); loadMeta(); }}
        />
      )}
    </>
  );
}

export default Medicines;
