import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BarChart2, Download,
  FlaskConical, PackageX, Stethoscope, Truck, Users,
  ClipboardList, ShoppingCart, Activity, TrendingDown
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar, Cell
} from 'recharts';
import api from '../api/axios';
import Loading from '../components/Loading';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const RISK_CONFIG = {
  'Critical (<30d)': { bg: 'bg-rose-100', text: 'text-rose-700', bar: '#ef4444' },
  'Warning (30-60d)': { bg: 'bg-amber-100', text: 'text-amber-700', bar: '#f59e0b' },
  'Safe (>60d)': { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: '#10b981' },
};

function StatCard({ label, value, icon: Icon, iconColor, bg, sub, onClick, urgent }) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${urgent ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-extrabold ${urgent ? 'text-rose-600' : 'text-slate-900'}`}>{value ?? '—'}</p>
          {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${bg || 'bg-slate-100'}`}>
          <Icon size={18} className={iconColor || 'text-slate-500'} />
        </div>
      </div>
      {urgent && value > 0 && <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />}
    </div>
  );
}

function StockStatusBadge({ status }) {
  if (status === 'out_of_stock') return <span className="badge badge-danger">Out of Stock</span>;
  if (status === 'low_stock') return <span className="badge badge-warning">Low Stock</span>;
  return <span className="badge badge-success">OK</span>;
}

function QuickLink({ to, label, icon: Icon, description }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(to)}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Icon size={18} className="text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      <ArrowRight size={14} className="text-slate-400" />
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/analytics'),
      api.get('/dashboard/low-stock'),
      api.get('/dashboard/expiring-batches?days=60'),
    ])
      .then(([s, a, ls, eb]) => {
        setSummary(s.data);
        setAnalytics(a.data);
        setLowStock(ls.data);
        setExpiringBatches(eb.data);
      })
      .catch(err => setError(err.response?.data?.message || 'Unable to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const r = await api.get('/dashboard/reports/inventory/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch(e) { setError('Export failed'); } finally { setExporting(false); }
  };

  if (loading) return <Loading text="Loading dashboard…" />;

  const maxQty = Math.max(...(analytics?.topMedicines||[]).map(m=>m.quantity), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600">PharmaCare</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Operations Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Live overview of inventory, prescriptions, and expiry status.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Download size={14} /> {exporting ? 'Exporting…' : 'Export Inventory'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Alert banners */}
      {summary && (summary.outOfStockMedicines > 0 || summary.lowStockMedicines > 0) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          {summary.outOfStockMedicines > 0 && (
            <div onClick={() => navigate('/medicines')} className="flex cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 hover:bg-rose-100 flex-1">
              <PackageX size={14} className="shrink-0" />
              <span><strong>{summary.outOfStockMedicines}</strong> medicine{summary.outOfStockMedicines!==1?'s':''} out of stock — reorder immediately</span>
              <ArrowRight size={12} className="ml-auto" />
            </div>
          )}
          {summary.expiringBatches > 0 && (
            <div onClick={() => navigate('/batches')} className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100 flex-1">
              <AlertTriangle size={14} className="shrink-0" />
              <span><strong>{summary.expiringBatches}</strong> batch{summary.expiringBatches!==1?'es':''} expiring within 60 days</span>
              <ArrowRight size={12} className="ml-auto" />
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Medicines" value={summary?.totalMedicines} icon={FlaskConical} iconColor="text-indigo-600" bg="bg-indigo-50" sub="Unique medicine types" onClick={() => navigate('/medicines')} />
        <StatCard label="Total Stock Units" value={summary?.totalStockUnits?.toLocaleString()} icon={Activity} iconColor="text-emerald-600" bg="bg-emerald-50" sub="Units across all batches" />
        <StatCard label="Low Stock" value={summary?.lowStockMedicines} icon={TrendingDown} iconColor="text-amber-600" bg="bg-amber-50" sub="Needs reorder" onClick={() => navigate('/medicines')} urgent={summary?.lowStockMedicines > 0} />
        <StatCard label="Out of Stock" value={summary?.outOfStockMedicines} icon={PackageX} iconColor="text-rose-600" bg="bg-rose-50" sub="Reorder immediately" onClick={() => navigate('/medicines')} urgent={summary?.outOfStockMedicines > 0} />
        <StatCard label="Pending Orders" value={summary?.pendingOrders} icon={ShoppingCart} iconColor="text-blue-600" bg="bg-blue-50" sub="Awaiting approval" onClick={() => navigate('/purchase-orders')} urgent={summary?.pendingOrders > 0} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Suppliers" value={summary?.totalSuppliers} icon={Truck} iconColor="text-violet-600" bg="bg-violet-50" onClick={() => navigate('/suppliers')} />
        <StatCard label="Customers" value={summary?.totalPatients} icon={Users} iconColor="text-sky-600" bg="bg-sky-50" onClick={() => navigate('/patients')} />
        <StatCard label="Doctors" value={summary?.totalDoctors} icon={Stethoscope} iconColor="text-teal-600" bg="bg-teal-50" onClick={() => navigate('/doctors')} />
        <StatCard label="Rx (30 days)" value={summary?.prescriptionsLast30Days} icon={ClipboardList} iconColor="text-pink-600" bg="bg-pink-50" onClick={() => navigate('/prescriptions')} />
      </div>

      {/* Charts + Tables */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Monthly Spend */}
        <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Monthly Purchase Spend</h2>
          <p className="text-xs text-slate-500">Last 6 months</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.monthlySpend} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v=>`${Math.round(v/1000)}k`} tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v=>money.format(Number(v||0))} />
                <Area type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiry Risk */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Expiry Risk</h2>
          <p className="text-xs text-slate-500">Current batch risk levels</p>
          <div className="mt-4 space-y-3">
            {(analytics?.expiryRisk||[]).map(item => {
              const cfg = RISK_CONFIG[item.level] || { bg:'bg-slate-100', text:'text-slate-600', bar:'#94a3b8' };
              return (
                <div key={item.level} className={`rounded-lg ${cfg.bg} p-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${cfg.text}`}>{item.level}</span>
                    <span className={`text-xs font-bold ${cfg.text}`}>{item.batches} batch{item.batches!==1?'es':''}</span>
                  </div>
                  <p className={`mt-0.5 text-[11px] ${cfg.text} opacity-80`}>At-risk value: {money.format(item.value)}</p>
                </div>
              );
            })}
            {(!analytics?.expiryRisk||analytics.expiryRisk.length===0) && (
              <p className="text-xs text-slate-400 text-center py-4">No active batches tracked</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top Prescribed */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Top Prescribed Medicines</h2>
          <p className="text-xs text-slate-500">By total quantity dispensed</p>
          <div className="mt-4 space-y-3">
            {(analytics?.topMedicines||[]).map(item => (
              <div key={item.medicine}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 truncate pr-2">{item.medicine}</span>
                  <span className="font-bold text-slate-500 shrink-0">{item.quantity}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width:`${Math.max((item.quantity/maxQty)*100,4)}%` }} />
                </div>
              </div>
            ))}
            {(!analytics?.topMedicines||analytics.topMedicines.length===0) && (
              <p className="text-xs text-slate-400 text-center py-4">No prescription data available</p>
            )}
          </div>
        </div>

        {/* Low Stock Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Low Stock Medicines</h2>
              <p className="text-xs text-slate-500">Medicines at or below minimum stock level</p>
            </div>
            {lowStock.length > 5 && (
              <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View all ({lowStock.length})
              </button>
            )}
          </div>
          <div className="mt-3">
            {lowStock.length === 0 ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
                <p className="text-xs font-medium text-emerald-700">All medicines are adequately stocked.</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left font-semibold text-slate-600">Medicine</th>
                      <th className="pb-2 text-right font-semibold text-slate-600">Stock</th>
                      <th className="pb-2 text-right font-semibold text-slate-600">Min</th>
                      <th className="pb-2 text-right font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.slice(0,8).map(m => (
                      <tr key={m.medicine_id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 font-medium text-slate-800 max-w-[140px] truncate">{m.medicine_name}</td>
                        <td className={`py-2 text-right font-bold ${m.current_stock===0?'text-rose-600':'text-amber-600'}`}>{m.current_stock}</td>
                        <td className="py-2 text-right text-slate-400">{m.min_stock_level}</td>
                        <td className="py-2 text-right"><StockStatusBadge status={m.stock_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expiring batches detail */}
      {expiringBatches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Batches Expiring Within 60 Days</h2>
              <p className="text-xs text-slate-500">{expiringBatches.length} batch{expiringBatches.length!==1?'es':''} require attention</p>
            </div>
            <button onClick={() => navigate('/batches')} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900">
              Manage Batches <ArrowRight size={12} />
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left font-semibold text-slate-600">Batch</th>
                  <th className="pb-2 text-left font-semibold text-slate-600">Medicine</th>
                  <th className="pb-2 text-right font-semibold text-slate-600">Expiry</th>
                  <th className="pb-2 text-right font-semibold text-slate-600">Days Left</th>
                  <th className="pb-2 text-right font-semibold text-slate-600">Qty</th>
                </tr>
              </thead>
              <tbody>
                {expiringBatches.slice(0,6).map(b => (
                  <tr key={b.batch_id} className="border-b border-slate-50 hover:bg-amber-50">
                    <td className="py-2 font-mono text-slate-700">{b.batch_number}</td>
                    <td className="py-2 font-medium text-slate-800">{b.medicine_name}</td>
                    <td className="py-2 text-right text-slate-600">{
                      (() => {
                        const raw = String(b.expiry_date).slice(0,10);
                        const [y,m,d] = raw.split('-').map(Number);
                        return new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
                      })()
                    }</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold ${b.urgency==='critical'?'text-rose-600':b.urgency==='warning'?'text-amber-600':'text-slate-600'}`}>
                        {b.days_until_expiry}d
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-700">{b.batch_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-700">Quick Navigation</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QuickLink to="/medicines" icon={FlaskConical} label="Medicines" description="Manage stock and categories" />
          <QuickLink to="/prescriptions" icon={ClipboardList} label="Prescriptions" description="Issue and track prescriptions" />
          <QuickLink to="/batches" icon={Activity} label="Batches" description="Track expiry and bulk import" />
          <QuickLink to="/reports" icon={BarChart2} label="Reports" description="Inventory and expiry reports" />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
