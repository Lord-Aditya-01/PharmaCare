import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2,
  PackagePlus, CheckCircle2, X, RefreshCw
} from 'lucide-react';
import api from '../api/axios';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';

const STATUS_BADGE = {
  Pending:   'badge badge-warning',
  Approved:  'badge badge-info',
  Received:  'badge badge-success',
  Cancelled: 'badge badge-neutral',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

// ─── Receive Modal — create batches from PO items ────────────────────────────
function ReceiveModal({ po, onClose, onDone }) {
  const [batchData, setBatchData] = useState(
    (po.items || []).map(item => ({
      medicine_id: item.medicine_id,
      medicine_name: item.medicine_name,
      quantity: item.quantity,
      batch_number: `PO${po.po_id}-M${item.medicine_id}`,
      manufacture_date: '',
      expiry_date: '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (idx, field, val) => {
    setBatchData(prev => prev.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  };

  const handleReceive = async () => {
    setError('');
    // Validate: at least expiry_date required and must be future
    for (let i = 0; i < batchData.length; i++) {
      const b = batchData[i];
      if (!b.expiry_date) { setError(`Row ${i+1} (${b.medicine_name}): expiry date required`); return; }
      const expiry = new Date(b.expiry_date);
      const today = new Date(); today.setHours(0,0,0,0);
      if (expiry <= today) { setError(`Row ${i+1}: expiry date must be in the future`); return; }
      if (b.manufacture_date) {
        const mfg = new Date(b.manufacture_date);
        if (mfg >= expiry) { setError(`Row ${i+1}: manufacture date must be before expiry`); return; }
      }
    }

    setSaving(true);
    try {
      await api.patch(`/purchase-orders/${po.po_id}`, {
        status: 'Received',
        receive_as_batches: batchData
      });
      onDone();
      onClose();
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to mark as received');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Mark PO #{po.po_id} as Received</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fill batch details — stock will be updated automatically</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16}/></button>
        </div>
        <div className="overflow-auto flex-1 p-5 space-y-3">
          {batchData.map((b, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">{b.medicine_name} — Qty: {b.quantity}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  Batch Number
                  <input value={b.batch_number} onChange={e => update(i,'batch_number',e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500"/>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  Manufacture Date
                  <input type="date" value={b.manufacture_date} onChange={e => update(i,'manufacture_date',e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500"/>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  Expiry Date *
                  <input type="date" value={b.expiry_date} onChange={e => update(i,'expiry_date',e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500"/>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  Quantity to Receive
                  <input type="number" value={b.quantity} onChange={e => update(i,'quantity',e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-indigo-500"/>
                </label>
              </div>
            </div>
          ))}
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="border-t border-slate-100 p-4 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleReceive} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            <CheckCircle2 size={14}/> {saving ? 'Processing…' : 'Confirm Received & Create Batches'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create PO Form ──────────────────────────────────────────────────────────
function CreatePOForm({ suppliers, medicines, onCreated }) {
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0,10),
    supplier_id: '', status: 'Pending'
  });
  const [items, setItems] = useState([]);
  const [itemForm, setItemForm] = useState({ medicine_id: '', quantity: 1, purchase_price: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.purchase_price), 0);

  const addItem = () => {
    setError('');
    if (!itemForm.medicine_id) { setError('Select a medicine'); return; }
    const qty = Number(itemForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) { setError('Quantity must be a positive integer'); return; }
    const price = Number(itemForm.purchase_price);
    if (!Number.isFinite(price) || price < 0) { setError('Purchase price must be a valid number'); return; }
    if (items.some(it => String(it.medicine_id) === String(itemForm.medicine_id))) {
      setError('This medicine is already in the order. Edit existing row instead.'); return;
    }
    const med = medicines.find(m => String(m.medicine_id) === String(itemForm.medicine_id));
    setItems(prev => [...prev, { medicine_id: Number(itemForm.medicine_id), medicine_name: med?.medicine_name, quantity: qty, purchase_price: price }]);
    setItemForm({ medicine_id: '', quantity: 1, purchase_price: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!form.supplier_id) { setError('Select a supplier'); return; }
    if (!form.order_date) { setError('Order date is required'); return; }
    if (items.length === 0) { setError('Add at least one medicine item'); return; }
    const d = new Date(form.order_date);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (d > tomorrow) { setError('Order date cannot be in the future'); return; }

    setSaving(true);
    try {
      await api.post('/purchase-orders', { ...form, items });
      setMessage('Purchase order created successfully');
      setItems([]);
      setForm({ order_date: new Date().toISOString().slice(0,10), supplier_id: '', status: 'Pending' });
      onCreated();
    } catch(err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
  const labelCls = 'flex flex-col gap-1 text-xs font-semibold text-slate-600';

  return (
    <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-900">New Purchase Order</h3>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <label className={labelCls}>
          Order Date *
          <input type="date" value={form.order_date} onChange={e => setForm(f=>({...f,order_date:e.target.value}))} required className={inputCls}/>
        </label>
        <label className={labelCls}>
          Supplier *
          <select value={form.supplier_id} onChange={e => setForm(f=>({...f,supplier_id:e.target.value}))} required className={inputCls}>
            <option value="">Select supplier…</option>
            {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.company_name}</option>)}
          </select>
        </label>
        <label className={labelCls}>
          Status
          <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} className={inputCls}>
            {['Pending','Approved'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* Line items */}
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
        <p className="text-xs font-bold text-slate-700">Order Items</p>
        <div className="grid gap-2 md:grid-cols-[2fr_100px_120px_auto]">
          <label className={labelCls}>
            Medicine
            <select value={itemForm.medicine_id} onChange={e => {
              const med = medicines.find(m => String(m.medicine_id) === e.target.value);
              setItemForm(f => ({ ...f, medicine_id: e.target.value, purchase_price: med?.unit_price || '' }));
            }} className={inputCls}>
              <option value="">Select medicine…</option>
              {medicines.map(m => <option key={m.medicine_id} value={m.medicine_id}>{m.medicine_name}{m.brand_name?` (${m.brand_name})`:''}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            Qty
            <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f=>({...f,quantity:e.target.value}))} className={inputCls}/>
          </label>
          <label className={labelCls}>
            Purchase Price (₹)
            <input type="number" step="0.01" min="0" value={itemForm.purchase_price} onChange={e => setItemForm(f=>({...f,purchase_price:e.target.value}))} className={inputCls}/>
          </label>
          <div className="flex items-end">
            <button type="button" onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 w-full justify-center">
              <Plus size={13}/> Add
            </button>
          </div>
        </div>

        {/* Items list */}
        <div className="min-h-[44px] rounded-lg border border-slate-200 bg-white overflow-hidden">
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">No items added yet</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Medicine</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Price</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Subtotal</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{it.medicine_name}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right">₹{Number(it.purchase_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-indigo-700">₹{(it.quantity * it.purchase_price).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => setItems(prev => prev.filter((_,idx) => idx !== i))}
                        className="text-rose-400 hover:text-rose-600"><Trash2 size={11}/></button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-indigo-50 font-bold text-xs">
                  <td colSpan={3} className="px-3 py-2 text-right text-indigo-800">Total:</td>
                  <td className="px-3 py-2 text-right text-indigo-800">₹{total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <button type="submit" disabled={saving || items.length === 0}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        <PackagePlus size={15}/> {saving ? 'Creating…' : `Create Order (₹${total.toFixed(2)})`}
      </button>
    </form>
  );
}

// ─── Main PO Page ─────────────────────────────────────────────────────────────
function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [receivePO, setReceivePO] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 10;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/purchase-orders', { params: { paginate:true, page, limit:PAGE_SIZE, search, sortBy:'po_id', sortOrder:'desc' } });
      setOrders(r.data.data || []); setTotalPages(r.data.pagination?.totalPages || 1); setTotalRecords(r.data.pagination?.total || 0);
    } catch(err) { setError(err.response?.data?.message || 'Failed to load orders'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => {
    Promise.all([api.get('/suppliers'), api.get('/medicines')]).then(([s, m]) => {
      setSuppliers(s.data); setMedicines(Array.isArray(m.data) ? m.data : m.data?.data || []);
    }).catch(() => {});
    loadOrders();
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedData[id]) {
      try {
        const r = await api.get(`/purchase-orders/${id}`);
        setExpandedData(prev => ({ ...prev, [id]: r.data }));
      } catch(e) {}
    }
  };

  const handleStatusChange = async (po, newStatus) => {
    if (newStatus === 'Received') {
      // Load full PO data first for receive modal
      if (!expandedData[po.po_id]) {
        try { const r = await api.get(`/purchase-orders/${po.po_id}`); setExpandedData(prev => ({...prev,[po.po_id]:r.data})); } catch(e) {}
      }
      setReceivePO(expandedData[po.po_id] || po);
      return;
    }
    setStatusUpdating(po.po_id);
    try {
      await api.patch(`/purchase-orders/${po.po_id}`, { status: newStatus });
      setMessage(`Order #${po.po_id} marked as ${newStatus}`);
      setExpandedData(prev => { const n={...prev}; delete n[po.po_id]; return n; });
      loadOrders();
    } catch(err) { setError(err.response?.data?.message || 'Status update failed'); }
    finally { setStatusUpdating(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase order?')) return;
    try {
      await api.delete(`/purchase-orders/${id}`);
      setMessage('Order deleted');
      loadOrders();
    } catch(err) { setError(err.response?.data?.message || 'Delete failed'); }
  };

  const totalSpend = orders.filter(o => o.status === 'Received').reduce((s,o) => s + Number(o.total_amount||0), 0);

  return (
    <section>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage medicine procurement. Create orders with line items — mark Received to auto-create batches."
        action={
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search orders…"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 sm:w-64"/>
        }
      />

      {message && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{message}</div>}
      <Alert type="error" message={error}/>

      {/* Summary strip */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label:'Total Orders', val:totalRecords },
          { label:'Pending', val:orders.filter(o=>o.status==='Pending').length, cls:'text-amber-600' },
          { label:'Received Value', val:`₹${totalSpend.toLocaleString('en-IN')}`, cls:'text-emerald-700' },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <p className="text-[11px] text-slate-500">{c.label}</p>
            <p className={`text-lg font-extrabold ${c.cls||'text-slate-900'}`}>{c.val}</p>
          </div>
        ))}
      </div>

      <CreatePOForm suppliers={suppliers} medicines={medicines} onCreated={loadOrders}/>

      {loading ? <Loading/> : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['ID','Date','Supplier','Phone','Items','Amount (₹)','Status','Actions'].map(h => (
                  <th key={h} className="border-b border-slate-100 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(po => (
                <React.Fragment key={po.po_id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">#{po.po_id}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmt(po.order_date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{po.supplier_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{po.supplier_phone || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleExpand(po.po_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        {expandedId === po.po_id ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                        {po.item_count ?? '—'} item{po.item_count !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">₹{Number(po.total_amount||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <select
                        value={po.status}
                        disabled={statusUpdating === po.po_id || po.status === 'Received' || po.status === 'Cancelled'}
                        onChange={e => handleStatusChange(po, e.target.value)}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold outline-none cursor-pointer
                          ${po.status==='Pending'?'border-amber-200 bg-amber-50 text-amber-700':
                            po.status==='Approved'?'border-blue-200 bg-blue-50 text-blue-700':
                            po.status==='Received'?'border-emerald-200 bg-emerald-50 text-emerald-700':
                            'border-slate-200 bg-slate-50 text-slate-500'}
                          disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {['Pending','Approved','Received','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(po.po_id)} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Delete</button>
                    </td>
                  </tr>
                  {expandedId === po.po_id && expandedData[po.po_id] && (
                    <tr>
                      <td colSpan={8} className="bg-indigo-50 px-6 py-3 border-t border-indigo-100">
                        <p className="text-xs font-bold text-indigo-800 mb-2">Order Items:</p>
                        {(expandedData[po.po_id]?.items || []).length === 0 ? (
                          <p className="text-xs text-slate-400">No line items recorded for this order.</p>
                        ) : (
                          <div className="overflow-auto">
                            <table className="text-xs w-full">
                              <thead>
                                <tr className="border-b border-indigo-200">
                                  <th className="pb-1 text-left font-semibold text-indigo-700">Medicine</th>
                                  <th className="pb-1 text-right font-semibold text-indigo-700">Qty</th>
                                  <th className="pb-1 text-right font-semibold text-indigo-700">Purchase Price</th>
                                  <th className="pb-1 text-right font-semibold text-indigo-700">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expandedData[po.po_id].items.map((it, i) => (
                                  <tr key={i} className="border-b border-indigo-100">
                                    <td className="py-1.5 font-medium text-slate-800">{it.medicine_name}{it.brand_name?` (${it.brand_name})`:''}</td>
                                    <td className="py-1.5 text-right">{it.quantity}</td>
                                    <td className="py-1.5 text-right">₹{Number(it.purchase_price).toFixed(2)}</td>
                                    <td className="py-1.5 text-right font-semibold text-indigo-700">₹{(it.quantity * it.purchase_price).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No purchase orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Page {page} of {totalPages} — {totalRecords} total orders</p>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={() => setPage(p=>p-1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-60 hover:bg-slate-50">Previous</button>
          <button disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-60 hover:bg-slate-50">Next</button>
        </div>
      </div>

      {receivePO && (
        <ReceiveModal
          po={expandedData[receivePO.po_id] || receivePO}
          onClose={() => setReceivePO(null)}
          onDone={() => { loadOrders(); setExpandedData({}); }}
        />
      )}
    </section>
  );
}

export default PurchaseOrders;
