function Alert({ type = 'success', message }) {
  if (!message) return null;

  const styles = type === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const icon = type === 'error' ? '!' : 'OK';

  return (
    <div className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${styles}`}>
      <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-current px-1 text-[10px] font-bold">
        {icon}
      </span>
      <span>{message}</span>
    </div>
  );
}

export default Alert;

