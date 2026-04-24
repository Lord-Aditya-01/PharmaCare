import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Upload, X } from 'lucide-react';
import api from '../api/axios';
import Alert from '../components/Alert';
import EntityPage from '../components/EntityPage';

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { error: 'CSV must have a header row and at least one data row.' };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const required = ['batch_number','expiry_date','batch_quantity','medicine_id'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { error: `CSV missing columns: ${missing.join(', ')}` };
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const vals = lines[i].split(',').map(v=>v.trim().replace(/^"|"$/g,''));
    if (vals.every(v=>!v)) continue;
    const obj={}; headers.forEach((h,idx)=>{obj[h]=vals[idx]??'';});
    rows.push(obj);
  }
  return { rows };
}

function validateRow(row, i) {
  const errs=[]; const r=i+1;
  if (!row.batch_number?.trim()) errs.push(`Row ${r}: batch_number required`);
  if (!row.medicine_id||isNaN(Number(row.medicine_id))) errs.push(`Row ${r}: medicine_id invalid`);
  const qty=Number(row.batch_quantity);
  if (!Number.isInteger(qty)||qty<=0) errs.push(`Row ${r}: batch_quantity must be positive integer`);
  if (!row.expiry_date?.trim()) { errs.push(`Row ${r}: expiry_date required`); return errs; }
  const expiry=new Date(row.expiry_date);
  const today=new Date();today.setHours(0,0,0,0);
  if(isNaN(expiry.getTime())) errs.push(`Row ${r}: expiry_date invalid`);
  else if(expiry<=today) errs.push(`Row ${r}: expiry_date must be future`);
  if(row.manufacture_date?.trim()){
    const mfg=new Date(row.manufacture_date);
    if(isNaN(mfg.getTime())) errs.push(`Row ${r}: manufacture_date invalid`);
    else if(mfg>=expiry) errs.push(`Row ${r}: manufacture_date must be before expiry`);
    else if(mfg>today) errs.push(`Row ${r}: manufacture_date cannot be future`);
  }
  return errs;
}

function ImportModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('upload');
  const [rows, setRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [serverError, setServerError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const TEMPLATE = `batch_number,manufacture_date,expiry_date,batch_quantity,medicine_id\nBATCH-001,2024-01-01,2027-01-01,100,1\nBATCH-002,,2027-06-30,50,2`;

  const handleFile = e => {
    const f=e.target.files?.[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const {rows:r,error}=parseCSV(ev.target.result);
      if(error){setParseErrors([error]);return;}
      const errs=r.flatMap((row,i)=>validateRow(row,i));
      setParseErrors(errs);setRows(r);
      if(!errs.length)setStep('preview');
    };
    reader.readAsText(f);
  };

  const doImport=async()=>{
    setStep('importing');
    try{
      const result=await api.post('/batches/import',{batches:rows});
      setImportResult(result.data);setStep('done');onSuccess();
    }catch(err){
      const details=err.response?.data?.details;
      setServerError(details?details.map(d=>d.message).join('\n'):(err.response?.data?.message||'Import failed'));
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Bulk Batch Import</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-4">
          {step==='upload'&&(
            <>
              <p className="text-sm text-slate-600">All rows validated before saving. Download template to get started.</p>
              <button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([TEMPLATE],{type:'text/csv'}));a.download='batch_template.csv';a.click();}}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
                <Upload size={13}/> Download Template
              </button>
              <div onClick={()=>fileRef.current?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <Upload size={24} className="mx-auto text-slate-400 mb-2"/>
                <p className="text-sm font-medium text-slate-600">Click to select CSV</p>
                <p className="text-xs text-slate-400 mt-1">Max 500 rows</p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden"/>
              </div>
              {parseErrors.length>0&&<div className="rounded-lg border border-rose-200 bg-rose-50 p-3 max-h-40 overflow-auto space-y-1">
                {parseErrors.map((e,i)=><p key={i} className="text-xs text-rose-600">• {e}</p>)}
              </div>}
            </>
          )}
          {step==='preview'&&(
            <>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0"/>
                <p className="text-xs font-semibold text-emerald-700">{rows.length} rows ready — all validated</p>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 text-xs">
                <table className="w-full"><thead className="sticky top-0 bg-slate-50"><tr>{Object.keys(rows[0]||{}).map(k=><th key={k} className="border-b px-2 py-1.5 text-left font-semibold text-slate-600">{k}</th>)}</tr></thead>
                <tbody>{rows.map((r,i)=><tr key={i} className="border-b hover:bg-slate-50">{Object.values(r).map((v,j)=><td key={j} className="px-2 py-1.5">{v}</td>)}</tr>)}</tbody></table>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>setStep('upload')} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Back</button>
                <button onClick={doImport} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Import {rows.length} Rows</button>
              </div>
            </>
          )}
          {step==='importing'&&<div className="flex flex-col items-center gap-3 py-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"/><p className="text-sm text-slate-600">Importing…</p></div>}
          {step==='done'&&<div className="flex flex-col items-center gap-3 py-6 text-center"><CheckCircle2 size={40} className="text-emerald-500"/><p className="text-sm font-bold text-slate-900">{importResult?.message}</p><button onClick={onClose} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Close</button></div>}
          {step==='error'&&<div className="space-y-3"><div className="rounded-lg border border-rose-200 bg-rose-50 p-3 max-h-40 overflow-auto">{serverError.split('\n').map((l,i)=><p key={i} className="text-xs text-rose-700">• {l}</p>)}</div><button onClick={()=>setStep('upload')} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Try Again</button></div>}
        </div>
      </div>
    </div>
  );
}

function Batches() {
  const [medicines, setMedicines] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [showAlertBar, setShowAlertBar] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get('/medicines').then(r => setMedicines(Array.isArray(r.data)?r.data:r.data?.data||[])).catch(()=>{});
    api.get('/batches/alerts/expiry?days=90').then(r=>setAlerts(r.data)).catch(()=>{}).finally(()=>setLoadingAlerts(false));
  }, [refreshKey]);

  const medLabels = medicines.reduce((acc, m) => {
    acc[String(m.medicine_id)] = `${m.medicine_name}${m.brand_name?` (${m.brand_name})`:''}`;
    return acc;
  }, {});

  const critical = alerts.filter(a=>a.days_until_expiry<30);
  const warning = alerts.filter(a=>a.days_until_expiry>=30&&a.days_until_expiry<60);

  function fmtDate(val) {
    if (!val) return '—';
    const raw = String(val).slice(0,10);
    const [y,m,d] = raw.split('-').map(Number);
    if (!y||!m||!d) return raw;
    return new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  }

  return (
    <>
      {showAlertBar && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 shrink-0"/>
              {loadingAlerts ? <p className="text-xs text-amber-700">Checking expiry…</p> : (
                <p className="text-xs font-medium text-amber-800">
                  {alerts.length===0?'No batches expiring in next 90 days.'
                    :`${alerts.length} batch${alerts.length!==1?'es':''} expiring within 90 days`
                    +(critical.length>0?` — ${critical.length} critical (<30d)`:'')
                    +(warning.length>0?` — ${warning.length} warning (30-60d)`:'')}
                </p>
              )}
            </div>
            <button onClick={()=>setShowAlertBar(false)} className="text-xs font-medium text-amber-700 hover:text-amber-900">Dismiss</button>
          </div>
        </div>
      )}

      <EntityPage
        key={refreshKey}
        title="Batches"
        subtitle="Track medicine batches. Sorted by expiry by default. All dates fully validated."
        endpoint="/batches"
        idField="batch_id"
        formMode="compact-floating"
        extraHeaderActions={
          <button onClick={()=>setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
            <Upload size={13}/> Bulk Import
          </button>
        }
        fields={[
          {name:'batch_number',label:'Batch Number',required:true},
          {name:'manufacture_date',label:'Manufacture Date',type:'date',hint:'Today or earlier, before expiry'},
          {name:'expiry_date',label:'Expiry Date',type:'date',required:true,hint:'Must be a future date'},
          {name:'batch_quantity',label:'Quantity',type:'number',required:true,hint:'Positive integer'},
          {name:'medicine_id',label:'Medicine',type:'select',required:true,
           options:medicines.map(m=>String(m.medicine_id)),optionLabels:medLabels},
        ]}
        columns={[
          {key:'batch_id',label:'ID'},
          {key:'batch_number',label:'Batch No.'},
          {key:'medicine_id',label:'Medicine'},
          {key:'manufacture_date',label:'Manufactured'},
          {key:'expiry_date',label:'Expires'},
          {key:'batch_quantity',label:'Qty'},
          {key:'days_until_expiry',label:'Days Left'},
        ]}
        cellRenderer={(col,val,row)=>{
          if(col.key==='medicine_id') return <span className="font-medium text-slate-700">{medLabels[String(val)]||val}</span>;
          if(col.key==='manufacture_date') return <span className="text-slate-500">{fmtDate(val)}</span>;
          if(col.key==='expiry_date'){
            const days=Number(row?.days_until_expiry??999);
            const cls=days<0?'text-rose-600 font-bold':days<30?'text-rose-600 font-bold':days<60?'text-amber-600 font-semibold':'text-slate-600';
            return <span className={cls}>{fmtDate(val)}</span>;
          }
          if(col.key==='days_until_expiry'){
            const d=Number(val??999);
            if(d<0) return <span className="badge badge-danger">Expired</span>;
            if(d<30) return <span className="badge badge-danger font-bold">{d}d</span>;
            if(d<60) return <span className="badge badge-warning">{d}d</span>;
            return <span className="text-xs text-slate-500">{d}d</span>;
          }
          return null;
        }}
        clientValidate={form=>{
          if(!form.expiry_date) return 'Expiry date is required';
          const expiry=new Date(form.expiry_date);
          const today=new Date();today.setHours(0,0,0,0);
          if(isNaN(expiry.getTime())) return 'Expiry date is invalid';
          if(expiry<=today) return 'Expiry date must be a future date';
          if(form.manufacture_date){
            const mfg=new Date(form.manufacture_date);
            if(isNaN(mfg.getTime())) return 'Manufacture date is invalid';
            if(mfg>=expiry) return 'Manufacture date must be before expiry date';
            if(mfg>today) return 'Manufacture date cannot be in the future';
          }
          const qty=Number(form.batch_quantity);
          if(!Number.isInteger(qty)||qty<=0) return 'Quantity must be a positive integer';
          return null;
        }}
      />
      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onSuccess={()=>setRefreshKey(k=>k+1)}/>}
    </>
  );
}

export default Batches;
