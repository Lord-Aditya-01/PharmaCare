import { useEffect, useState, useMemo } from 'react';
import { Download, RefreshCw, AlertTriangle, PackageX, Activity, BarChart2 } from 'lucide-react';
import api from '../api/axios';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function StockStatusBadge({ status }) {
  if (status === 'out_of_stock') return <span className="badge badge-danger">Out of Stock</span>;
  if (status === 'low_stock') return <span className="badge badge-warning">Low Stock</span>;
  return <span className="badge badge-success">OK</span>;
}

function UrgencyBadge({ urgency }) {
  if (urgency === 'critical') return <span className="badge badge-danger">Critical</span>;
  if (urgency === 'warning') return <span className="badge badge-warning">Warning</span>;
  return <span className="badge badge-info">Notice</span>;
}

function StatusBadge({ status }) {
  const map = { Pending:'badge badge-warning', Approved:'badge badge-info', Received:'badge badge-success', Cancelled:'badge badge-neutral' };
  return <span className={map[status] || 'badge badge-neutral'}>{status}</span>;
}

/* ─── Tab: Inventory ──────────────────────────────────────────────────────── */
function InventoryReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search:'', stock_status:'all', category:'all' });
  const [categories, setCategories] = useState([]);

  const load = () => {
    setLoading(true);
    api.get('/dashboard/reports/inventory', { params: { ...filters, category: filters.category==='all'?undefined:filters.category, stock_status: filters.stock_status==='all'?undefined:filters.stock_status } })
      .then(r => { setData(r.data); const cats=[...new Set(r.data.map(m=>m.category).filter(Boolean))]; setCategories(cats); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    const r = await api.get('/dashboard/reports/inventory/export', { responseType:'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.data],{type:'text/csv'}));
    a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const summary = useMemo(() => ({
    total: data.length,
    out: data.filter(m=>m.stock_status==='out_of_stock').length,
    low: data.filter(m=>m.stock_status==='low_stock').length,
    ok: data.filter(m=>m.stock_status==='ok').length,
    totalValue: data.reduce((s,m)=>s+Number(m.stock_value||0),0)
  }), [data]);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label:'Total Medicines', val:summary.total, cls:'text-slate-900' },
          { label:'Out of Stock', val:summary.out, cls:summary.out>0?'text-rose-600':'text-slate-900' },
          { label:'Low Stock', val:summary.low, cls:summary.low>0?'text-amber-600':'text-slate-900' },
          { label:'Total Stock Value', val:money.format(summary.totalValue), cls:'text-emerald-700' },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] text-slate-500">{c.label}</p>
            <p className={`text-xl font-extrabold ${c.cls}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}
          placeholder="Search medicine…"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 w-52" />
        <select value={filters.stock_status} onChange={e=>setFilters(f=>({...f,stock_status:e.target.value}))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="all">All Statuses</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="ok">OK</option>
        </select>
        <select value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw size={14}/> Apply
        </button>
        <button onClick={handleExport} className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          <Download size={14}/> Export CSV
        </button>
      </div>

      {loading ? <Loading/> : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[560px]">
          <table className="min-w-full text-xs sticky-thead">
            <thead className="bg-slate-50">
              <tr>
                {['ID','Medicine','Brand','Category','Price','Stock','Min Stock','Stock Value','Status'].map(h=>(
                  <th key={h} className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map(m=>(
                <tr key={m.medicine_id} className={`hover:bg-slate-50 ${m.stock_status==='out_of_stock'?'bg-rose-50/30':m.stock_status==='low_stock'?'bg-amber-50/30':''}`}>
                  <td className="px-3 py-2 text-slate-500">{m.medicine_id}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{m.medicine_name}</td>
                  <td className="px-3 py-2 text-slate-600">{m.brand_name||'—'}</td>
                  <td className="px-3 py-2 text-slate-600">{m.category||'—'}</td>
                  <td className="px-3 py-2 text-slate-700">₹{m.unit_price}</td>
                  <td className={`px-3 py-2 font-bold ${m.stock_status==='out_of_stock'?'text-rose-600':m.stock_status==='low_stock'?'text-amber-600':'text-slate-700'}`}>{m.current_stock}</td>
                  <td className="px-3 py-2 text-slate-500">{m.min_stock_level}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-700">{money.format(Number(m.stock_value||0))}</td>
                  <td className="px-3 py-2"><StockStatusBadge status={m.stock_status}/></td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Expiry ─────────────────────────────────────────────────────────── */
function ExpiryReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [urgency, setUrgency] = useState('all');

  const load = () => {
    setLoading(true);
    api.get('/dashboard/expiring-batches', { params:{ days, urgency:urgency==='all'?undefined:urgency } })
      .then(r=>setData(r.data))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); }, []);

  const handleExport = async () => {
    const r = await api.get(`/dashboard/reports/expiry/export?days=${days}`, { responseType:'blob' });
    const a = document.createElement('a');
    a.href=URL.createObjectURL(new Blob([r.data],{type:'text/csv'}));
    a.download=`expiry-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const totalValue = data.reduce((s,b)=>s+Number(b.stock_value||0),0);
  const critical = data.filter(b=>b.urgency==='critical');

  return (
    <div className="space-y-4">
      {critical.length>0 && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5">
          <AlertTriangle size={14} className="text-rose-600 shrink-0"/>
          <p className="text-xs font-semibold text-rose-800">{critical.length} batch{critical.length!==1?'es':''} expire within 30 days — at-risk value: {money.format(critical.reduce((s,b)=>s+Number(b.stock_value||0),0))}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Days Range</label>
          <select value={days} onChange={e=>setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={180}>Next 180 days</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Urgency</label>
          <select value={urgency} onChange={e=>setUrgency(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
            <option value="all">All</option>
            <option value="critical">Critical (&lt;30d)</option>
            <option value="warning">Warning (30-60d)</option>
            <option value="notice">Notice (&gt;60d)</option>
          </select>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 self-end">
          <RefreshCw size={14}/> Apply
        </button>
        <button onClick={handleExport} className="ml-auto flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 self-end">
          <Download size={14}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          {label:'Total Batches',val:data.length,cls:'text-slate-900'},
          {label:'Critical (<30d)',val:data.filter(b=>b.urgency==='critical').length,cls:'text-rose-600'},
          {label:'Total At-Risk Value',val:money.format(totalValue),cls:'text-amber-700'},
        ].map(c=>(
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] text-slate-500">{c.label}</p>
            <p className={`text-xl font-extrabold ${c.cls}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {loading ? <Loading/> : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[520px]">
          <table className="min-w-full text-xs sticky-thead">
            <thead className="bg-slate-50">
              <tr>
                {['Batch No.','Medicine','Brand','Exp. Date','Days Left','Qty','At-Risk Value','Urgency'].map(h=>(
                  <th key={h} className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map(b=>(
                <tr key={b.batch_id} className={`hover:bg-slate-50 ${b.urgency==='critical'?'bg-rose-50/30':b.urgency==='warning'?'bg-amber-50/30':''}`}>
                  <td className="px-3 py-2 font-mono text-slate-700">{b.batch_number}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{b.medicine_name}</td>
                  <td className="px-3 py-2 text-slate-600">{b.brand_name||'—'}</td>
                  <td className="px-3 py-2 text-slate-600">{String(b.expiry_date).slice(0,10)}</td>
                  <td className={`px-3 py-2 font-bold ${b.urgency==='critical'?'text-rose-600':b.urgency==='warning'?'text-amber-600':'text-slate-700'}`}>{b.days_until_expiry}d</td>
                  <td className="px-3 py-2 text-slate-700">{b.batch_quantity}</td>
                  <td className="px-3 py-2 font-semibold text-amber-700">{money.format(Number(b.stock_value||0))}</td>
                  <td className="px-3 py-2"><UrgencyBadge urgency={b.urgency}/></td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No expiring batches in this range.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Purchases ─────────────────────────────────────────────────────── */
function PurchaseReport() {
  const [data, setData] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status:'all', supplier_id:'all', from_date:'', to_date:'' });

  useEffect(()=>{
    api.get('/suppliers').then(r=>setSuppliers(r.data)).catch(()=>{});
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    const p = {};
    if (filters.status!=='all') p.status=filters.status;
    if (filters.supplier_id!=='all') p.supplier_id=filters.supplier_id;
    if (filters.from_date) p.from_date=filters.from_date;
    if (filters.to_date) p.to_date=filters.to_date;
    api.get('/dashboard/reports/purchases', { params:p })
      .then(r=>setData(r.data))
      .finally(()=>setLoading(false));
  };

  const total = data.reduce((s,o)=>s+Number(o.total_amount||0),0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Status</label>
          <select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
            <option value="all">All Statuses</option>
            {['Pending','Approved','Received','Cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">Supplier</label>
          <select value={filters.supplier_id} onChange={e=>setFilters(f=>({...f,supplier_id:e.target.value}))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
            <option value="all">All Suppliers</option>
            {suppliers.map(s=><option key={s.supplier_id} value={s.supplier_id}>{s.company_name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">From</label>
          <input type="date" value={filters.from_date} onChange={e=>setFilters(f=>({...f,from_date:e.target.value}))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">To</label>
          <input type="date" value={filters.to_date} onChange={e=>setFilters(f=>({...f,to_date:e.target.value}))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
        </div>
        <button onClick={loadData} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 self-end">
          <RefreshCw size={14}/> Apply
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          {label:'Total Orders',val:data.length},
          {label:'Pending',val:data.filter(o=>o.status==='Pending').length},
          {label:'Total Spend',val:money.format(total)},
        ].map(c=>(
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] text-slate-500">{c.label}</p>
            <p className="text-xl font-extrabold text-slate-900">{c.val}</p>
          </div>
        ))}
      </div>

      {loading ? <Loading/> : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[520px]">
          <table className="min-w-full text-xs sticky-thead">
            <thead className="bg-slate-50">
              <tr>
                {['PO ID','Date','Supplier','Amount','Status'].map(h=>(
                  <th key={h} className="border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map(o=>(
                <tr key={o.po_id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-500">#{o.po_id}</td>
                  <td className="px-3 py-2 text-slate-700">{String(o.order_date).slice(0,10)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{o.supplier_name}</td>
                  <td className="px-3 py-2 font-bold text-slate-700">₹{Number(o.total_amount||0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2"><StatusBadge status={o.status}/></td>
                </tr>
              ))}
              {data.length===0&&<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No purchase orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Main Reports Page ────────────────────────────────────────────────────── */
const TABS = [
  { id:'inventory', label:'Inventory', icon:BarChart2 },
  { id:'expiry', label:'Expiry Tracker', icon:AlertTriangle },
  { id:'purchases', label:'Purchase History', icon:Activity },
];

function Reports() {
  const [activeTab, setActiveTab] = useState('inventory');

  return (
    <section className="space-y-4">
      <PageHeader
        title="Reports"
        subtitle="Filterable reports for inventory, batch expiry, and purchase history with CSV export."
      />

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors
                ${activeTab===tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
              <Icon size={13}/> {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'inventory' && <InventoryReport />}
        {activeTab === 'expiry' && <ExpiryReport />}
        {activeTab === 'purchases' && <PurchaseReport />}
      </div>
    </section>
  );
}

export default Reports;
