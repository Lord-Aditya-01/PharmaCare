function Loading({ text = 'Loading records...' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
      <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-700" />
      {text}
    </div>
  );
}

export default Loading;

