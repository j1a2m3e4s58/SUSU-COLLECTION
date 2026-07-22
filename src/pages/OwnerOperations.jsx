import React, { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, DatabaseZap, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { getOwnerReconciliation, getOwnerSessions, revokeOwnerSession, runRetentionCleanup } from "@/api/portalClient";
import ConfirmActionDialog from "@/components/ui/confirm-action-dialog";
import PageControls from "@/components/PageControls";

export default function OwnerOperations() {
  const [reconciliation, setReconciliation] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [recon, sessionPage] = await Promise.all([
        getOwnerReconciliation(),
        getOwnerSessions(page, 20),
      ]);
      setReconciliation(recon);
      setSessions(sessionPage.items);
      setPagination(sessionPage.pagination);
    } catch (err) {
      setError(err.message || "Could not load Owner operations.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const revoke = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const result = await revokeOwnerSession(target.id);
      setTarget(null);
      if (result.revokedCurrent) {
        window.location.href = "/login";
        return;
      }
      setMessage("The selected device session has been revoked.");
      await load();
    } catch (err) {
      setError(err.message || "Could not revoke this device.");
    } finally {
      setBusy(false);
    }
  };

  const runCleanup = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await runRetentionCleanup();
      const removed = Object.entries(result.summary || {})
        .filter(([key]) => key !== "completedAt")
        .reduce((sum, [, value]) => sum + Number(value || 0), 0);
      setMessage(`Retention cleanup completed. ${removed} expired record(s) removed.`);
    } catch (err) {
      setError(err.message || "Could not run retention cleanup.");
    } finally {
      setBusy(false);
    }
  };

  const summary = reconciliation?.summary || {};
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Owner only</p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <ShieldCheck className="h-7 w-7 text-blue-500" /> Owner Operations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Reconciliation, active devices, retention, and production assurance.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh checks
        </button>
      </div>

      {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600">{message}</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"><Activity className="h-5 w-5 text-blue-500" /> Financial Reconciliation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compares deposit records, customer balances, daily closes, and report totals.</p>
          </div>
          {reconciliation && (reconciliation.ok
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Balanced</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500"><XCircle className="h-4 w-4" /> Review needed</span>)}
        </div>
        {loading && !reconciliation ? <div className="mt-5 h-28 animate-pulse rounded-lg bg-muted/40" /> : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Deposits", summary.deposits || 0],
                ["Deposit total", `GHS ${Number(summary.depositTotal || 0).toLocaleString()}`],
                ["Customer total", `GHS ${Number(summary.customerTotal || 0).toLocaleString()}`],
                ["Report total", `GHS ${Number(summary.reportTotal || 0).toLocaleString()}`],
                ["Issues", summary.issueCount || 0],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-background/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold text-foreground">{value}</p></div>)}
            </div>
            {(reconciliation?.issues || []).length > 0 && <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              {reconciliation.issues.map((issue, index) => <div key={`${issue.type}-${index}`} className="flex gap-2 text-xs text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{issue.type.replace(/_/g, " ")} · {issue.accountNumber || issue.reference || issue.date || "record"}</span></div>)}
            </div>}
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"><MonitorSmartphone className="h-5 w-5 text-blue-500" /> Active Sessions</h2><p className="mt-1 text-sm text-muted-foreground">Review and revoke individual signed-in devices.</p></div>
        </div>
        <div className="mt-4 space-y-3">
          {sessions.map((session) => <article key={session.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{session.userName}</p>{session.isCurrent && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500">This device</span>}</div><p className="truncate text-xs text-muted-foreground">{session.device} · {session.ipAddress}</p><p className="mt-1 text-[11px] text-muted-foreground">Last active {session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString() : "Unknown"}</p></div>
            <button onClick={() => setTarget(session)} className="h-9 shrink-0 rounded-lg border border-red-500/30 px-3 text-xs font-medium text-red-500 hover:bg-red-500/10">Revoke device</button>
          </article>)}
          {!loading && sessions.length === 0 && <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">No active sessions.</p>}
        </div>
        <PageControls pagination={pagination} onPageChange={setPage} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground"><DatabaseZap className="h-5 w-5 text-blue-500" /> Retention Cleanup</h2><p className="mt-1 text-sm text-muted-foreground">Applies the periods configured in Portal Control and records the cleanup in the audit log.</p></div><button onClick={runCleanup} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />} Run cleanup</button></div>
      </section>

      <ConfirmActionDialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} title="Revoke this device session?" description={`${target?.userName || "This user"} will be signed out on ${target?.device || "the selected device"}.`} confirmLabel="Revoke Device" destructive busy={busy} onConfirm={revoke} />
    </div>
  );
}
