import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, KeyRound, LockKeyhole, Search, ShieldAlert, UserCheck, UserRoundCog } from "lucide-react";
import { getOwnerAccountStatus, getPortalSettings } from "@/api/portalClient";
import ControlledSelect from "@/components/ui/controlled-select";
import PageControls from "@/components/PageControls";

const statusConfig = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600", icon: UserCheck },
  locked: { label: "Locked", className: "bg-red-500/10 text-red-500", icon: LockKeyhole },
  "first-login-pending": { label: "First Login Pending", className: "bg-amber-500/10 text-amber-600", icon: KeyRound },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground", icon: Archive },
  "password-reset-required": { label: "Password Reset Required", className: "bg-orange-500/10 text-orange-600", icon: ShieldAlert },
  inactive: { label: "Inactive", className: "bg-slate-500/10 text-slate-500", icon: UserRoundCog },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.inactive;
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}><Icon className="h-3.5 w-3.5" />{config.label}</span>;
}

export default function AccountStatus() {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState(null);
  const [branches, setBranches] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, settings] = await Promise.all([
        getOwnerAccountStatus({ page, pageSize: 25, search: debouncedSearch, status, branch }),
        getPortalSettings(),
      ]);
      setAccounts(result.items);
      setPagination(result.pagination);
      setSummary(result.summary);
      setBranches(settings.branches || []);
    } catch (err) {
      setError(err.message || "Could not load account status.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, branch]);

  useEffect(() => { load(); }, [load]);

  const inputClass = "h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground";
  const statusOptions = Object.entries(statusConfig).map(([value, item]) => ({ value, label: item.label }));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Owner only</p>
        <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl"><UserRoundCog className="h-7 w-7 text-blue-500" /> Account Status</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor staff access states. New accounts are still created only through Add Agent or Add Supervisor.</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {["active", "locked", "first-login-pending", "archived", "password-reset-required"].map((key) => {
          const config = statusConfig[key];
          const Icon = config.icon;
          return <div key={key} className="rounded-xl border border-border bg-card p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{config.label}</p><Icon className="h-4 w-4 text-blue-500" /></div><p className="mt-2 text-2xl font-bold text-foreground">{summary[key] || 0}</p></div>;
        })}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, username, or phone..." className={`${inputClass} w-full pl-10`} /></div>
          <ControlledSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={statusOptions} placeholder="All statuses" emptyLabel="All statuses" className={inputClass} />
          <ControlledSelect value={branch} onChange={(value) => { setBranch(value); setPage(1); }} options={branches} placeholder="All branches" emptyLabel="All branches" className={inputClass} />
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="px-3 py-3">User</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Branch</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Sessions</th><th className="px-3 py-3 text-right">Manage</th></tr></thead><tbody>
            {loading ? Array.from({ length: 6 }).map((_, index) => <tr key={index}><td colSpan={6} className="px-3 py-3"><div className="h-10 animate-pulse rounded bg-muted/40" /></td></tr>) : accounts.map((account) => <tr key={account.id} className="border-b border-border/60"><td className="px-3 py-3"><p className="font-semibold text-foreground">{account.fullname}</p><p className="text-xs text-muted-foreground">{account.username || account.email}</p></td><td className="px-3 py-3 text-muted-foreground">{account.role}</td><td className="px-3 py-3 text-muted-foreground">{account.branch}</td><td className="px-3 py-3"><StatusBadge status={account.status} />{account.isTestData && <span className="ml-2 rounded-full bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-600">Test</span>}</td><td className="px-3 py-3 text-muted-foreground">{account.activeSessions}</td><td className="px-3 py-3 text-right"><Link to={account.role === "Supervisor" ? "/supervisor-management" : account.status === "archived" ? "/past-staff" : "/agents"} className="text-xs font-semibold text-blue-500 hover:underline">Open role manager</Link></td></tr>)}
          </tbody></table>
        </div>

        <div className="mt-4 space-y-3 md:hidden">
          {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-border bg-muted/30" />) : accounts.map((account) => <article key={account.id} className="rounded-xl border border-border bg-background/40 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{account.fullname}</p><p className="truncate text-xs text-muted-foreground">{account.username || account.email}</p></div><StatusBadge status={account.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{account.role}</span><span className="text-right">{account.branch}</span><span>{account.activeSessions} active session(s)</span>{account.isTestData && <span className="text-right font-semibold text-purple-600">Test account</span>}</div><Link to={account.role === "Supervisor" ? "/supervisor-management" : account.status === "archived" ? "/past-staff" : "/agents"} className="mt-3 inline-flex w-full justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-blue-500">Open role manager</Link></article>)}
          {!loading && accounts.length === 0 && <p className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">No accounts match these filters.</p>}
        </div>
        <PageControls pagination={pagination} onPageChange={setPage} />
      </section>
    </div>
  );
}
