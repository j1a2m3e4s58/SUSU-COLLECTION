import { useEffect, useState } from "react";
import { CloudCog, RefreshCw, WifiOff } from "lucide-react";

export default function PortalStartupState({ error, onRetry }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const Icon = error ? WifiOff : CloudCog;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <section role={error ? "alert" : "status"} aria-live="polite" className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-xl">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${error ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}>
          <Icon className={`h-6 w-6 ${error ? "" : "animate-pulse"}`} />
        </div>
        <h1 className="mt-4 font-heading text-xl font-bold">
          {error ? "The portal is temporarily unavailable" : slow ? "Waking the secure service" : "Opening the portal"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error
            ? "Render or the database did not respond. Your records were not changed."
            : slow
              ? "A sleeping Render service can take up to a minute to respond. Please keep this page open."
              : "Checking the secure service and your session..."}
        </p>
        {error ? (
          <button type="button" onClick={onRetry} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <RefreshCw className="h-4 w-4" /> Retry Connection
          </button>
        ) : (
          <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        )}
      </section>
    </main>
  );
}
