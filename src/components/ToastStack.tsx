import { useToastStore } from '../store/toastStore';

const toneStyles: Record<string, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
  info: 'border-sky-500/40 bg-sky-500/15 text-sky-100',
  error: 'border-rose-500/40 bg-rose-500/15 text-rose-100'
};

const ToastStack = () => {
  const { toasts, remove } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-xs font-semibold shadow-xl ${toneStyles[toast.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastStack;
