import { create } from 'zustand';

type ToastTone = 'success' | 'info' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

interface ToastState {
  toasts: ToastItem[];
  push: (toast: ToastInput) => void;
  remove: (id: string) => void;
}

const generateId = () => `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ message, tone = 'info', durationMs = 2800 }) => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }]
    }));
    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id)
      }));
    }, durationMs);
  },
  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }))
}));
