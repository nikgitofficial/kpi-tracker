"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom"; 
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";


type SnackbarType = "success" | "error" | "info" | "warning";

interface SnackbarMessage {
  id: string;
  type: SnackbarType;
  title: string;
  message?: string;
  duration?: number;
}

interface SnackbarContextValue {
  showSnackbar: (type: SnackbarType, title: string, message?: string, duration?: number) => void;
  hideSnackbar: (id: string) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SnackbarMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showSnackbar = useCallback((type: SnackbarType, title: string, message?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 10);
    setMessages((prev) => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, duration);
  }, []);

  const hideSnackbar = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getIcon = (type: SnackbarType) => {
    switch (type) {
      case "success": return <CheckCircle2 size={16} className="text-emerald-500" />;
      case "error": return <AlertCircle size={16} className="text-red-500" />;
      case "warning": return <AlertTriangle size={16} className="text-amber-500" />;
      case "info": return <Info size={16} className="text-sky-500" />;
    }
  };

  const getStyles = (type: SnackbarType) => {
    switch (type) {
      case "success": return "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200";
      case "error": return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200";
      case "warning": return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200";
      case "info": return "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-200";
    }
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
      {children}
      {mounted && typeof window !== "undefined" && createPortal(
        <div style={{ position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)", zIndex: 99999, display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", pointerEvents: "none" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
             style={{ pointerEvents: "auto" }}
className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-bottom-5 duration-300 max-w-sm w-80 ${getStyles(msg.type)}`}
            >
              {getIcon(msg.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{msg.title}</p>
                {msg.message && <p className="text-xs opacity-80 mt-0.5">{msg.message}</p>}
              </div>
              <button
                onClick={() => hideSnackbar(msg.id)}
                className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </SnackbarContext.Provider>
  );
}