import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Activity, BarChart2, ChevronLeft, ChevronRight,
  ClipboardList, FlaskConical, LayoutDashboard,
  PackagePlus, ShoppingCart, Stethoscope, Truck,
  Users, Menu, X, AlertTriangle, LogOut, Bell, History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const navLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/medicines', label: 'Medicines', icon: FlaskConical },
  { to: '/batches', label: 'Batches', icon: Activity },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/patients', label: 'Customers', icon: Users },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/prescriptions', label: 'Prescriptions', icon: ClipboardList },
  { to: '/purchase-orders', label: 'Orders', icon: ShoppingCart },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/activity', label: 'Activity Log', icon: History },
];

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.get('/dashboard/summary')
      .then(r => setAlertCount((r.data.lowStockMedicines || 0) + (r.data.outOfStockMedicines || 0) + (r.data.expiringBatches || 0)))
      .catch(() => {});
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700 ${collapsed && !mobile ? 'justify-center px-2' : ''}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-sm">Rx</div>
        {(!collapsed || mobile) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hospital</p>
            <p className="text-sm font-bold text-white leading-tight">PharmaCare</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => mobile && setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
               ${isActive ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
               ${collapsed && !mobile ? 'justify-center px-2' : ''}`
            }
            title={collapsed && !mobile ? label : undefined}
          >
            <Icon size={16} className="shrink-0" />
            {(!collapsed || mobile) && <span className="truncate">{label}</span>}
            {(!collapsed || mobile) && label === 'Medicines' && alertCount > 0 && (
              <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-slate-700 p-3 ${collapsed && !mobile ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-3 rounded-lg bg-slate-800 p-2.5 ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
            {(user?.name || 'U')[0].toUpperCase()}
          </div>
          {(!collapsed || mobile) && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'Pharmacist'}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.role || 'pharmacist'}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors" title="Logout">
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-700 sidebar-transition ${collapsed ? 'w-16' : 'w-64'} shrink-0`}>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-900 flex flex-col z-10">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <Menu size={18} />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex items-center justify-center rounded-lg border border-slate-200 h-8 w-8 text-slate-500 hover:bg-slate-50"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Breadcrumb / Title */}
          <div className="flex-1 flex items-center">
            <span className="text-sm font-semibold text-slate-500">PharmaCare</span>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            {alertCount > 0 && (
              <button onClick={() => navigate('/reports')} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <Bell size={18} />
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              </button>
            )}
            <button
              onClick={() => navigate('/medicines')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <PackagePlus size={13} /> Add Medicine
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Alert banner for critical stock */}
        {alertCount > 0 && (
          <div className="flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-800">
                {alertCount} alert{alertCount !== 1 ? 's' : ''} require attention — low stock or expiring batches detected.
              </p>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-amber-700 underline underline-offset-2">
              View Report
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Mobile tab bar */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors
                   ${isActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
