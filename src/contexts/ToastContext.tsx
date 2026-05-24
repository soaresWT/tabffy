import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      const timer = setTimeout(() => removeToast(id), 3000);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-lg shadow-black/30 pointer-events-auto min-w-[220px] max-w-[360px] animate-in slide-in-from-right-full fade-in duration-200",
              t.type === "success" &&
                "bg-zinc-900 border-emerald-500/20 text-emerald-300",
              t.type === "error" &&
                "bg-zinc-900 border-red-500/20 text-red-300",
              t.type === "info" &&
                "bg-zinc-900 border-zinc-700/60 text-zinc-300"
            )}
          >
            {t.type === "success" && (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            )}
            {t.type === "error" && (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            {t.type === "info" && <Info className="w-3.5 h-3.5 shrink-0" />}
            <span className="text-[12px] leading-snug">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-auto p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
