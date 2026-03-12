interface LoadingOverlayProps {
  label?: string;
}

const LoadingOverlay = ({ label = 'Loading…' }: LoadingOverlayProps) => {
  return (
    <div
      className="fixed right-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm"
      style={{
        left: '16rem',
        top: 'calc(var(--titlebar-height) + var(--header-height))',
        bottom: 0
      }}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-5 text-slate-100 shadow-2xl">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-200" />
        <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
