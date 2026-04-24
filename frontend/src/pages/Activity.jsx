import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity as ActivityIcon } from 'lucide-react';
import api from '../api/axios';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

const ACTION_BADGE = {
  prescription_created: { cls: 'badge badge-info', label: 'Rx Created' },
  prescription_deleted: { cls: 'badge badge-danger', label: 'Rx Deleted' },
  stock_adjusted:       { cls: 'badge badge-warning', label: 'Stock Adjusted' },
  batch_added:          { cls: 'badge badge-success', label: 'Batch Added' },
  po_created:           { cls: 'badge badge-neutral', label: 'PO Created' },
  po_status_changed:    { cls: 'badge badge-neutral', label: 'PO Updated' },
};

function Activity() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/activity-log', { params: { limit: LIMIT, offset, action_type: filter || undefined } });
      setLogs(r.data.data || []); setTotal(r.data.total || 0);
    } catch(e) { }
    finally { setLoading(false); }
  }, [offset, filter]);

  useEffect(() => { setOffset(0); }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Activity Log"
        subtitle="Full audit trail of stock adjustments, prescriptions, batch additions, and order changes."
        action={
          <button onClick={load} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={13}/> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500">Filter:</span>
        {[
          { val: '', label: 'All' },
          { val: 'prescription_created', label: 'Prescriptions' },
          { val: 'stock_adjusted', label: 'Stock Adjustments' },
          { val: 'batch_added', label: 'Batches' },
          { val: 'po_created', label: 'PO Created' },
        ].map(f => (
          <button key={f.val} onClick={() => setFilter(f.val)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors
              ${filter === f.val ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">{total} total entries</span>
      </div>

      {loading ? <Loading text="Loading activity log…"/> : (
        <>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <ActivityIcon size={32} className="mx-auto mb-3 text-slate-300"/>
              <p className="text-sm font-medium text-slate-500">No activity recorded yet.</p>
              <p className="text-xs text-slate-400 mt-1">Actions like creating prescriptions and adjusting stock will appear here.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {['Time','Action','Description','User','Medicine'].map(h => (
                      <th key={h} className="border-b border-slate-100 px-4 py-3 text-left font-bold uppercase tracking-wide text-slate-600 text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map(log => {
                    const badge = ACTION_BADGE[log.action_type] || { cls:'badge badge-neutral', label: log.action_type };
                    return (
                      <tr key={log.log_id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmt(log.created_at)}</td>
                        <td className="px-4 py-2.5"><span className={badge.cls}>{badge.label}</span></td>
                        <td className="px-4 py-2.5 text-slate-700 max-w-xs">{log.description}</td>
                        <td className="px-4 py-2.5 text-slate-500">{log.user_name || 'System'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{log.medicine_name || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {total > LIMIT && (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <p>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</p>
              <div className="flex gap-2">
                <button disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-60 hover:bg-slate-50">Previous</button>
                <button disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-60 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default Activity;
