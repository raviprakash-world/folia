import { create } from 'zustand';

type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  showToast: (tone: ToastTone, message: string) => void;
  dismissToast: (id: string) => void;
}

const TOAST_DURATION_MS = 3500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (tone, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({ toasts: [...get().toasts, { id, tone, message }] });
    setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
