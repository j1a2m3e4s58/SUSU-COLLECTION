import { useEffect, useState } from "react";
import { CloudCog, RefreshCw, Wifi, WifiOff, X } from "lucide-react";

export default function NetworkStatusBanner() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let clearTimer;
    const update = (next) => {
      window.clearTimeout(clearTimer);
      setState(next);
      if (next?.status === "recovered") {
        clearTimer = window.setTimeout(() => setState(null), 4000);
      }
    };
    const handleState = (event) => update(event.detail || null);
    const handleOffline = () => update({ status: "offline" });
    const handleOnline = () => update({ status: "recovered" });
    window.addEventListener("portal-network-state", handleState);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(clearTimer);
      window.removeEventListener("portal-network-state", handleState);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!state) return null;
  const recovered = state.status === "recovered";
  const retrying = state.status === "retrying";
  const Icon = recovered ? Wifi : retrying ? CloudCog : WifiOff;
  return (
    <aside role={recovered || retrying ? "status" : "alert"} aria-live="polite" className={`fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110] rounded-xl border p-3 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[360px] ${recovered ? "border-emerald-500/30 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50" : "border-amber-500/30 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50"}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${retrying ? "animate-pulse" : ""}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{recovered ? "Connection restored" : retrying ? "Waking the secure service" : "Connection unavailable"}</p>
          <p className="mt-0.5 text-xs opacity-80">{recovered ? "The portal is ready again." : retrying ? `Retrying request ${state.attempt || 1}...` : "Check your connection, then retry."}</p>
        </div>
        {!retrying && <button type="button" onClick={() => setState(null)} aria-label="Dismiss connection notice" className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"><X className="h-4 w-4" /></button>}
      </div>
      {!recovered && !retrying && <button type="button" onClick={() => window.location.reload()} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-current/20 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"><RefreshCw className="h-3.5 w-3.5" /> Retry Now</button>}
    </aside>
  );
}
