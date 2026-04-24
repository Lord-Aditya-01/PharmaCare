import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/axios';
import Alert from './Alert';
import Loading from './Loading';
import PageHeader from './PageHeader';

function emptyForm(fields) {
  return fields.reduce((acc, f) => ({ ...acc, [f.name]: f.defaultValue || '' }), {});
}

/**
 * Generic CRUD entity page.
 *
 * Props:
 *   clientValidate(form) → string|null  — cross-field validation before submit
 *   cellRenderer(col, val, row) → node|null  — custom cell render per column
 *   extraHeaderActions → ReactNode  — buttons in header area
 *   fields[].hint, fields[].optionLabels
 */
function EntityPage({
  title, subtitle, endpoint, idField, fields, columns,
  formMode = 'default', clientValidate, cellRenderer, extraHeaderActions,
  extraParams = {}, rowActions,
}) {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortBy, setSortBy] = useState(columns[0]?.key || idField);
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clientError, setClientError] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, { params:{ paginate:true, page, limit:pageSize, search, sortBy, sortOrder, ...extraParams } });
      if (Array.isArray(data)) {
        setRecords(data); setTotalRecords(data.length); setTotalPages(1);
      } else {
        setRecords(data.data||[]); setTotalRecords(data.pagination?.total||0); setTotalPages(data.pagination?.totalPages||1);
      }
    } catch(err) { setError(err.response?.data?.message||'Unable to load records'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [endpoint, page, pageSize, sortBy, sortOrder, search]);

  const handleChange = e => { setForm({...form,[e.target.name]:e.target.value}); setClientError(''); };
  const reset = () => { setForm(emptyForm(fields)); setEditingId(null); setClientError(''); };

  const handleSubmit = async e => {
    e.preventDefault(); setMessage(''); setError(''); setClientError('');
    if (clientValidate) {
      const msg = clientValidate(form);
      if (msg) { setClientError(msg); return; }
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, form);
        setMessage(`${title} updated successfully`);
      } else {
        await api.post(endpoint, form);
        setMessage(`${title} added successfully`);
      }
      reset();
      if (page!==1&&!editingId) { setPage(1); return; }
      fetch();
    } catch(err) {
      const details = err.response?.data?.details;
      const msg = err.response?.data?.message||'Unable to save record';
      setError(details ? `${msg} — ${details.map(d=>d.message).join('; ')}` : msg);
    } finally { setSaving(false); }
  };

  const handleEdit = record => {
    const next = {};
    fields.forEach(f => {
      const v = record[f.name]??'';
      next[f.name] = f.type==='date'&&v ? String(v).slice(0,10) : v;
    });
    setForm(next); setEditingId(record[idField]); setClientError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setMessage(`${title} deleted successfully`);
      if (records.length===1&&page>1) { setPage(c=>c-1); return; }
      fetch();
    } catch(err) { setError(err.response?.data?.message||'Unable to delete record'); }
  };

  const handleSort = key => {
    if (sortBy===key) setSortOrder(o=>o==='asc'?'desc':'asc');
    else { setSortBy(key); setSortOrder('asc'); }
    setPage(1);
  };

  const renderInput = field => {
    const base = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
    if (formMode==='compact-floating') {
      if (field.type==='select') return (
        <div key={field.name} className="flex flex-col gap-0.5">
          <div className="relative">
            <label className="absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-[11px] font-medium text-slate-500">
              {field.label}{field.required&&<span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <select name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} className={base+' pt-3 pb-2'}>
              <option value="">Select…</option>
              {(field.options||[]).map(o=><option key={o} value={o}>{field.optionLabels?.[o]||o}</option>)}
            </select>
          </div>
          {field.hint&&<p className="px-1 text-[10px] text-slate-400">{field.hint}</p>}
        </div>
      );
      return (
        <div key={field.name} className="flex flex-col gap-0.5">
          <div className="relative">
            <input name={field.name} type={field.type||'text'} value={form[field.name]} onChange={handleChange}
              required={field.required} step={field.step} placeholder=" "
              className="peer w-full rounded-lg border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm outline-none focus:border-indigo-500"/>
            <label className="pointer-events-none absolute left-3 top-2 bg-white px-1 text-[11px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-focus:top-2 peer-focus:text-[11px]">
              {field.label}{field.required&&<span className="text-rose-500 ml-0.5">*</span>}
            </label>
          </div>
          {field.hint&&<p className="px-1 text-[10px] text-slate-400">{field.hint}</p>}
        </div>
      );
    }
    // default mode
    return (
      <label key={field.name} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
        <span>{field.label}{field.required&&<span className="text-rose-500 ml-0.5">*</span>}</span>
        {field.type==='select' ? (
          <select name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} className={base}>
            <option value="">Select…</option>
            {(field.options||[]).map(o=><option key={o} value={o}>{field.optionLabels?.[o]||o}</option>)}
          </select>
        ) : (
          <input name={field.name} type={field.type||'text'} value={form[field.name]} onChange={handleChange}
            required={field.required} step={field.step} className={base}/>
        )}
        {field.hint&&<p className="text-[10px] text-slate-400 font-normal">{field.hint}</p>}
      </label>
    );
  };

  return (
    <section>
      <PageHeader title={title} subtitle={subtitle} action={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center flex-wrap">
          {extraHeaderActions}
          <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search records…"
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 sm:w-64"/>
          <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(1);}}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500">
            {columns.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button type="button" onClick={()=>{setSortOrder(o=>o==='asc'?'desc':'asc');setPage(1);}}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {sortOrder==='asc'?'Asc ↑':'Desc ↓'}
          </button>
        </div>
      }/>

      <Alert message={message}/>
      {clientError&&<div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{clientError}</div>}
      <Alert type="error" message={error}/>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fields.map(renderInput)}
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving?'Saving…':editingId?'Update':'Add'}
          </button>
          {editingId&&(
            <button type="button" onClick={reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      {loading ? <Loading/> : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[520px]">
          <table className="min-w-full divide-y divide-slate-100 text-sm sticky-thead">
            <thead className="bg-slate-50">
              <tr>
                {columns.map(col=>(
                  <th key={col.key} onClick={()=>handleSort(col.key)}
                    className="border-b border-slate-200 bg-slate-50 cursor-pointer select-none px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortBy===col.key ? (sortOrder==='asc'?<ChevronUp size={11}/>:<ChevronDown size={11}/>) : null}
                    </span>
                  </th>
                ))}
                <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.map(record=>(
                <tr key={record[idField]} className="hover:bg-slate-50 transition-colors">
                  {columns.map(col=>{
                    const val = record[col.key]??col.fallback??'';
                    const custom = cellRenderer ? cellRenderer(col, val, record) : null;
                    // Auto-format ISO date strings
                    let displayVal = val;
                    // Auto-format date strings to readable dates in table display
                    if (custom === null && val && typeof val === 'string'
                        && /^\d{4}-\d{2}-\d{2}/.test(val)
                        && col.key !== 'batch_id' && col.key !== 'medicine_id') {
                      const raw = String(val).slice(0, 10);
                      const parts = raw.split('-').map(Number);
                      if (parts.length === 3 && parts[0] > 1900) {
                        const dt = new Date(parts[0], parts[1]-1, parts[2]);
                        displayVal = isNaN(dt) ? val : dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
                      }
                    }
                    return (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {custom !== null ? custom : String(displayVal ?? '')}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 space-x-3 whitespace-nowrap">
                    <button onClick={()=>handleEdit(record)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button onClick={()=>handleDelete(record[idField])} className="text-xs font-semibold text-rose-600 hover:text-rose-800">Delete</button>
                    {rowActions && rowActions(record)}
                  </td>
                </tr>
              ))}
              {records.length===0&&(
                <tr><td colSpan={columns.length+1} className="px-4 py-10 text-center text-slate-400">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <p>Page {page} of {totalPages} &mdash; {totalRecords} total records</p>
        <div className="flex items-center gap-2">
          <select value={String(pageSize)} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {[10,25,50].map(n=><option key={n} value={n}>{n} / page</option>)}
          </select>
          <button type="button" disabled={page<=1} onClick={()=>setPage(c=>Math.max(1,c-1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50">Previous</button>
          <button type="button" disabled={page>=totalPages} onClick={()=>setPage(c=>Math.min(totalPages,c+1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-slate-50">Next</button>
        </div>
      </div>
    </section>
  );
}

export default EntityPage;
