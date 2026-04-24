import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Search, FileDown, Eye, X } from 'lucide-react';
import api from '../api/axios';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import PageHeader from '../components/PageHeader';

function StockHint({ medicine }) {
  if (!medicine) return null;
  const s = Number(medicine.current_stock ?? 0);
  const m = Number(medicine.min_stock_level ?? 0);
  if (s === 0) return <span className="badge badge-danger ml-1">Out of stock</span>;
  if (s <= m) return <span className="badge badge-warning ml-1">Low ({s})</span>;
  return <span className="text-[10px] text-slate-400 ml-1">({s} in stock)</span>;
}

function Prescriptions() {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    customer_name: '', doctor_id: '', patient_id: '', notes: '',
    medicine_id: '', dosage: '', quantity: 1
  });
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [billPreview, setBillPreview] = useState(null);

  const money = useMemo(
    () => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
    []
  );

  const fetch = () => api.get('/prescriptions').then(r => setPrescriptions(r.data));

  useEffect(() => {
    Promise.all([
      api.get('/doctors'), api.get('/patients'),
      api.get('/medicines'), api.get('/prescriptions')
    ]).then(([d, p, m, rx]) => {
      setDoctors(d.data); setPatients(p.data);
      setMedicines(Array.isArray(m.data) ? m.data : m.data?.data || []);
      setPrescriptions(rx.data);
    }).catch(err => setError(err.response?.data?.message || 'Unable to load data'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prescriptions.filter(rx =>
      Object.values(rx).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }, [prescriptions, search]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const selectedMed = medicines.find(m => String(m.medicine_id) === String(form.medicine_id));

  const addMedicine = () => {
    setError('');
    if (!form.medicine_id) { setError('Select a medicine'); return; }
    if (!form.dosage.trim()) { setError('Enter a dosage'); return; }
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty <= 0) { setError('Quantity must be a positive integer'); return; }
    const med = medicines.find(m => String(m.medicine_id) === String(form.medicine_id));
    if (med && Number(med.current_stock) === 0) { setError(`${med.medicine_name} is out of stock`); return; }
    const already = selectedMedicines.filter(m => String(m.medicine_id) === String(form.medicine_id)).reduce((s,m)=>s+m.quantity,0);
    if (med && (already + qty) > Number(med.current_stock)) {
      setError(`Only ${med.current_stock} units available for ${med.medicine_name}`); return;
    }
    setSelectedMedicines(prev => [...prev, {
      medicine_id: Number(form.medicine_id),
      medicine_name: med?.medicine_name,
      brand_name: med?.brand_name,
      dosage: form.dosage,
      quantity: qty
    }]);
    setForm(f => ({ ...f, medicine_id: '', dosage: '', quantity: 1 }));
  };

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setMessage('');
    if (!form.customer_name.trim()) { setError('Customer / Buyer name is required'); return; }
    if (!form.doctor_id) { setError('Select a prescribing doctor'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (selectedMedicines.length === 0) { setError('Add at least one medicine'); return; }

    setSaving(true);
    try {
      await api.post('/prescriptions', {
        date: form.date, customer_name: form.customer_name.trim(),
        doctor_id: form.doctor_id, patient_id: form.patient_id || null,
        notes: form.notes.trim() || null,
        medicines: selectedMedicines
      });
      setMessage('Prescription created successfully');
      setSelectedMedicines([]);
      setForm({ date: new Date().toISOString().slice(0,10), customer_name:'', doctor_id:'', patient_id:'', notes:'', medicine_id:'', dosage:'', quantity:1 });
      fetch();
    } catch(err) { setError(err.response?.data?.message || 'Unable to create prescription'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this prescription? Stock will be restored.')) return;
    try {
      await api.delete(`/prescriptions/${id}`);
      setMessage('Prescription deleted — stock restored');
      fetch();
    } catch(err) { setError(err.response?.data?.message || 'Unable to delete'); }
  };

  const getErrorMessage = async (err, fallback) => {
    const data = err?.response?.data;
    if (data && typeof data === 'object' && data.message) return data.message;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed?.message) return parsed.message;
      } catch (_) {}
    }
    return fallback;
  };

  const handleOpenBillPreview = async (id) => {
    setError('');
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const response = await api.get(`/prescriptions/${id}/bill-preview`);
      setBillPreview(response.data);
    } catch (err) {
      setPreviewOpen(false);
      setBillPreview(null);
      const msg = await getErrorMessage(err, 'Unable to load bill preview');
      setError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadBill = async (id) => {
    try {
      setError('');
      const response = await api.get(`/prescriptions/${id}/bill`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = `prescription-bill-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (err) {
      const msg = await getErrorMessage(err, 'Unable to download prescription bill');
      setError(msg);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setBillPreview(null);
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!expandedData[id]) {
      try {
        const r = await api.get(`/prescriptions/${id}`);
        setExpandedData(prev => ({ ...prev, [id]: r.data }));
      } catch(e) {}
    }
  };

  const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500';
  const lbl = 'flex flex-col gap-1 text-xs font-semibold text-slate-600';

  return (
    <section>
      <PageHeader
        title="Prescriptions"
        subtitle="Issue prescriptions to customers. Doctor required; customer record is optional."
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search prescriptions…"
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-4 py-2 text-sm outline-none focus:border-indigo-500 sm:w-64"/>
          </div>
        }
      />

      {message && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{message}</div>}
      <Alert type="error" message={error}/>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">New Prescription</h3>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className={lbl}>
            Date *
            <input type="date" name="date" value={form.date} onChange={handleChange} required className={inp}/>
          </label>
          <label className={lbl}>
            Customer / Buyer Name *
            <input name="customer_name" value={form.customer_name} onChange={handleChange}
              placeholder="e.g. Rahul Sharma / Walk-in" className={inp}/>
          </label>
          <label className={lbl}>
            Doctor *
            <select name="doctor_id" value={form.doctor_id} onChange={handleChange} required className={inp}>
              <option value="">Select doctor…</option>
              {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.first_name} {d.last_name}{d.specialization ? ` — ${d.specialization}` : ''}</option>)}
            </select>
          </label>
          <label className={lbl}>
            Customer <span className="font-normal text-slate-400">(optional)</span>
            <select name="patient_id" value={form.patient_id} onChange={handleChange} className={inp}>
              <option value="">No linked customer</option>
              {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.first_name} {p.last_name}{p.age ? ` (${p.age}y)` : ''}</option>)}
            </select>
          </label>
        </div>

        <label className={lbl}>
          Notes <span className="font-normal text-slate-400">(optional)</span>
          <input name="notes" value={form.notes} onChange={handleChange}
            placeholder="e.g. Take after food, avoid dairy…" className={inp}/>
        </label>

        {/* Medicine row */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
          <p className="text-xs font-bold text-slate-700">Add Medicines</p>
          <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_90px_auto]">
            <label className={lbl}>
              Medicine
              <select name="medicine_id" value={form.medicine_id} onChange={handleChange} className={inp}>
                <option value="">Select medicine…</option>
                {medicines.map(m => (
                  <option key={m.medicine_id} value={m.medicine_id} disabled={Number(m.current_stock)===0}>
                    {m.medicine_name}{m.brand_name?` (${m.brand_name})`:''} — Stock: {m.current_stock??0}{Number(m.current_stock)===0?' [OUT]':''}
                  </option>
                ))}
              </select>
              {selectedMed && <StockHint medicine={selectedMed}/>}
            </label>
            <label className={lbl}>
              Dosage
              <input name="dosage" value={form.dosage} onChange={handleChange} placeholder="e.g. 1 tablet twice daily" className={inp}/>
            </label>
            <label className={lbl}>
              Qty
              <input type="number" name="quantity" min="1" value={form.quantity} onChange={handleChange} className={inp}/>
            </label>
            <div className="flex items-end">
              <button type="button" onClick={addMedicine}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 w-full justify-center">
                <Plus size={13}/> Add
              </button>
            </div>
          </div>

          {/* Selected list */}
          <div className="min-h-[40px] rounded-lg border border-slate-200 bg-white p-2">
            {selectedMedicines.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-1">No medicines added yet</p>
            ) : (
              <div className="space-y-1">
                {selectedMedicines.map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-indigo-50 border border-indigo-100 px-3 py-1.5">
                    <span className="text-xs text-slate-700">
                      <strong>{m.medicine_name}</strong>{m.brand_name?` (${m.brand_name})`:''} · {m.dosage} · Qty: <strong>{m.quantity}</strong>
                    </span>
                    <button type="button" onClick={() => setSelectedMedicines(prev => prev.filter((_,idx)=>idx!==i))}
                      className="text-rose-400 hover:text-rose-600"><Trash2 size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button disabled={saving || selectedMedicines.length === 0}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Creating…' : 'Create Prescription'}
        </button>
      </form>

      {/* Table */}
      {loading ? <Loading/> : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['ID','Date','Customer','Doctor','Linked Customer','Actions'].map(h => (
                  <th key={h} className="border-b border-slate-100 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(rx => (
                <React.Fragment key={rx.prescription_id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs">#{rx.prescription_id}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{String(rx.date).slice(0,10)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{rx.customer_name}</td>
                    <td className="px-4 py-3 text-slate-600">{rx.doctor_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{rx.patient_name || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 flex items-center gap-3">
                      <button onClick={() => toggleExpand(rx.prescription_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                        {expandedId === rx.prescription_id ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                        Details
                      </button>
                      <button onClick={() => handleOpenBillPreview(rx.prescription_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">
                        <Eye size={12} /> Preview Bill
                      </button>
                      <button onClick={() => handleDownloadBill(rx.prescription_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                        <FileDown size={12} /> Bill PDF
                      </button>
                      <button onClick={() => handleDelete(rx.prescription_id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800">Delete</button>
                    </td>
                  </tr>
                  {expandedId === rx.prescription_id && expandedData[rx.prescription_id] && (
                    <tr>
                      <td colSpan={6} className="bg-indigo-50 px-6 py-3 border-t border-indigo-100">
                        {expandedData[rx.prescription_id]?.notes && (
                          <p className="text-xs text-indigo-700 mb-2 italic">📋 {expandedData[rx.prescription_id].notes}</p>
                        )}
                        <p className="text-xs font-bold text-indigo-800 mb-2">Medicines Prescribed:</p>
                        <div className="flex flex-wrap gap-2">
                          {(expandedData[rx.prescription_id]?.medicines || []).map((m, i) => (
                            <div key={i} className="rounded-lg bg-white border border-indigo-200 px-3 py-1.5 text-xs">
                              <strong>{m.medicine_name}</strong>{m.brand_name?` (${m.brand_name})`:''} · {m.dosage} · Qty: <strong>{m.quantity}</strong>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No prescriptions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Prescription Bill Preview</h3>
                <p className="text-xs text-slate-500">Review before downloading PDF</p>
              </div>
              <button onClick={closePreview} className="rounded-md p-1 text-slate-500 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto p-4 sm:p-6">
              {previewLoading ? (
                <div className="py-8"><Loading /></div>
              ) : billPreview ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold text-teal-800">PharmaCare</p>
                        <p className="text-sm font-semibold text-teal-700">Prescription Bill</p>
                      </div>
                      <div className="text-right text-xs text-teal-900">
                        <p><strong>Bill No:</strong> {billPreview.billNo}</p>
                        <p><strong>Date:</strong> {billPreview.date}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</p>
                      <p className="mt-1 font-semibold text-slate-800">{billPreview.customerName}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Doctor</p>
                      <p className="mt-1 font-semibold text-slate-800">{billPreview.doctorName}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Linked Customer Record</p>
                    <p className="mt-1 text-slate-700">{billPreview.linkedCustomer}</p>
                    {billPreview.notes && (
                      <>
                        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Notes</p>
                        <p className="mt-1 text-slate-700">{billPreview.notes}</p>
                      </>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-[760px] w-full table-fixed divide-y divide-slate-200 text-sm">
                      <colgroup>
                        <col className="w-[44px]" />
                        <col className="w-[290px]" />
                        <col className="w-[150px]" />
                        <col className="w-[70px]" />
                        <col className="w-[100px]" />
                        <col className="w-[106px]" />
                      </colgroup>
                      <thead className="bg-slate-100">
                        <tr>
                          {['#', 'Medicine', 'Dosage', 'Qty', 'Unit Price', 'Total'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {billPreview.items.map((item, index) => (
                          <tr key={`${item.medicineId}-${index}`}>
                            <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {item.medicineName}{item.brandName ? ` (${item.brandName})` : ''}
                            </td>
                            <td className="px-3 py-2 text-slate-600 truncate">{item.dosage}</td>
                            <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-slate-700 tabular-nums whitespace-nowrap">{money.format(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">{money.format(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{money.format(billPreview.totals.subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>GST ({Math.round((billPreview.totals.taxRate || 0) * 100)}%)</span>
                      <span>{money.format(billPreview.totals.taxAmount)}</span>
                    </div>
                    <div className="mt-2 border-t border-slate-300 pt-2 flex items-center justify-between font-bold text-slate-900">
                      <span>Grand Total</span>
                      <span>{money.format(billPreview.totals.grandTotal)}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button onClick={closePreview} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Close
              </button>
              <button
                onClick={() => billPreview && handleDownloadBill(billPreview.prescriptionId)}
                disabled={!billPreview || previewLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <FileDown size={12} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Prescriptions;
