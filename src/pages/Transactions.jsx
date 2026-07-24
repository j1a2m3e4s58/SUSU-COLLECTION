import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCollectionEfficiency, getCollectionsPage, getPortalSettings, updateCollectionReview } from '@/api/portalClient';
import PageControls from '@/components/PageControls';
import ControlledSelect from '@/components/ui/controlled-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { useAuth } from '@/lib/AuthContext';
import { useWorkDate } from '@/lib/WorkDateContext';
import {
  Search, Receipt, Download, UserCheck, CheckCircle, AlertTriangle,
  Clock3, Timer, HandCoins, Banknote,
} from 'lucide-react';

const statusColors = {
  completed: 'bg-emerald-500/10 text-emerald-500',
  pending: 'bg-amber-500/10 text-amber-500',
  reversed: 'bg-red-500/10 text-red-500',
};
const reviewColors = {
  pending: 'bg-amber-500/10 text-amber-500',
  approved: 'bg-emerald-500/10 text-emerald-500',
  queried: 'bg-orange-500/10 text-orange-500',
  rejected: 'bg-red-500/10 text-red-500',
};

const formatClock = (value) => value ? String(value).slice(0, 5) : '--';

const formatMinutes = (value) => {
  if (value === null || value === undefined) return '--';
  const rounded = Math.round(Number(value));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

function EfficiencySummary({ data, loading, error }) {
  const needsReview = Boolean(data?.lateStart || data?.longGapCount);
  const metrics = [
    { label: 'First Collection', value: formatClock(data?.firstCollectionTime), icon: Clock3, tone: 'text-blue-500' },
    { label: 'Last Collection', value: formatClock(data?.lastCollectionTime), icon: Timer, tone: 'text-cyan-500' },
    { label: 'Collections', value: data?.collectionCount ?? 0, icon: HandCoins, tone: 'text-emerald-500' },
    { label: 'Total Collected', value: `GHS ${(data?.totalAmount || 0).toLocaleString()}`, icon: Banknote, tone: 'text-emerald-600' },
    { label: 'Average Interval', value: formatMinutes(data?.averageGapMinutes), icon: Timer, tone: 'text-violet-500' },
    {
      label: 'Timing Review',
      value: needsReview ? 'Attention' : data?.collectionCount ? 'On schedule' : 'No activity',
      icon: needsReview ? AlertTriangle : CheckCircle,
      tone: needsReview ? 'text-amber-500' : data?.collectionCount ? 'text-emerald-500' : 'text-muted-foreground',
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="efficiency-title">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-500">Supervisor efficiency monitoring</p>
          <h2 id="efficiency-title" className="mt-1 font-heading text-lg font-bold text-foreground">Daily Collection Efficiency</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.agent?.name || 'Selected agent'} - {data?.date || 'Selected day'}
          </p>
        </div>
        <p className="max-w-md text-xs text-muted-foreground sm:text-right">
          Late start after {formatClock(data?.thresholds?.lateStartAfter)}. Long-gap indicator above {data?.thresholds?.longGapMinutes || 90} minutes.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border-b border-r border-border/70 p-4">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6">
            {metrics.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="min-w-0 border-b border-r border-border/70 p-4 lg:border-b-0">
                <div className={`flex items-center gap-2 ${tone}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <p className="truncate text-[11px] font-semibold uppercase">{label}</p>
                </div>
                <p className="mt-2 break-words text-lg font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs">
            {!data?.collectionCount && (
              <span className="text-muted-foreground">No completed collections were recorded for this agent on the selected day.</span>
            )}
            {data?.collectionCount > 0 && !needsReview && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" /> No timing indicators for this day
              </span>
            )}
            {data?.lateStart && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 font-medium text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Late start at {formatClock(data.firstCollectionTime)}
              </span>
            )}
            {data?.longGapCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 font-medium text-orange-600">
                <Timer className="h-3.5 w-3.5" /> {data.longGapCount} long gap{data.longGapCount === 1 ? '' : 's'} - longest {formatMinutes(data.longestGapMinutes)}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function Transactions() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedDate, selectedMonth, selectedScope, selectedLabel, selectDay } = useWorkDate();
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const [collections, setCollections] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') || selectedDate);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const canReviewTransactions = user?.role === 'OwnerAdmin' || user?.role === 'Supervisor';
  const [efficiency, setEfficiency] = useState(null);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);
  const [efficiencyError, setEfficiencyError] = useState('');

  useEffect(() => {
    Promise.all([
      getCollectionsPage(page, 25),
      getPortalSettings(),
    ]).then(([c, b]) => { setCollections(c.items || []); setPagination(c.pagination); setBranches(b?.branches || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    const date = searchParams.get('date') || '';
    setDateFilter(date || (selectedScope === 'day' ? selectedDate : ''));
  }, [searchParams, selectedDate, selectedScope]);

  useEffect(() => {
    if (!canReviewTransactions || !selectedAgent?.id || !dateFilter) {
      setEfficiency(null);
      setEfficiencyError('');
      setEfficiencyLoading(false);
      return undefined;
    }
    let active = true;
    setEfficiencyLoading(true);
    setEfficiencyError('');
    getCollectionEfficiency(selectedAgent.id, dateFilter)
      .then((data) => {
        if (active) setEfficiency(data);
      })
      .catch((err) => {
        if (active) {
          setEfficiency(null);
          setEfficiencyError(err.message || 'Could not load collection efficiency.');
        }
      })
      .finally(() => {
        if (active) setEfficiencyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canReviewTransactions, dateFilter, selectedAgent?.id]);

  const handleDateFilter = (value) => {
    setDateFilter(value);
    if (value) selectDay(value);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('date', value);
    } else {
      next.delete('date');
    }
    setSearchParams(next, { replace: true });
  };

  const filtered = collections.filter(c => {
    if (canUseAgentScope && !selectedAgent) return false;
    if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(c)) return false;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || c.account_name?.toLowerCase().includes(q) || c.account_number?.toLowerCase().includes(q) || c.transaction_reference?.toLowerCase().includes(q);
    const matchBranch = !branchFilter || c.branch_name === branchFilter || c.branch_id === branchFilter;
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchReview = !reviewFilter || c.supervisor_review_status === reviewFilter;
    const matchDate = dateFilter
      ? c.transaction_date === dateFilter
      : selectedScope === 'month'
        ? String(c.transaction_date || '').startsWith(selectedMonth)
        : c.transaction_date === selectedDate;
    return matchSearch && matchBranch && matchStatus && matchReview && matchDate;
  });

  const totalAmount = filtered.reduce((s, c) => s + (c.amount || 0), 0);
  const inputClass = "bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  const approveTransaction = async (item) => {
    setError('');
    try {
      const updated = await updateCollectionReview(item.id, { supervisor_review_status: 'approved' });
      setCollections((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (err) {
      setError(err.message || 'Could not approve transaction.');
    }
  };

  const submitCorrectionRequest = async () => {
    if (!reviewTarget) return;
    if (!reviewNote.trim()) {
      setError('Enter the correction needed before sending.');
      return;
    }
    setReviewSaving(true);
    setError('');
    try {
      const updated = await updateCollectionReview(reviewTarget.id, {
        supervisor_review_status: 'queried',
        correction_note: reviewNote.trim(),
      });
      setCollections((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setReviewTarget(null);
      setReviewNote('');
    } catch (err) {
      setError(err.message || 'Could not send correction request.');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground">Transaction History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canUseAgentScope && selectedAgent
            ? `Transactions for ${selectedAgent.fullname || selectedAgent.full_name}. Showing ${dateFilter || selectedLabel}.`
            : `All collection transactions with full audit trail. Showing ${dateFilter || selectedLabel}.`}
        </p>
      </div>

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose an agent above to review that agent&apos;s transactions.</p>
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && (
        <>
      {canReviewTransactions && selectedAgent && (
        <EfficiencySummary data={efficiency} loading={efficiencyLoading} error={efficiencyError} />
      )}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Transactions</p>
          <p className="text-xl font-bold text-foreground mt-1">{filtered.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total Collected</p>
          <p className="text-xl font-bold text-emerald-500 mt-1">GHS {totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Avg Deposit</p>
          <p className="text-xl font-bold text-blue-500 mt-1">GHS {filtered.length > 0 ? Math.round(totalAmount / filtered.length).toLocaleString() : 0}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Pending Review</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{filtered.filter(c => c.supervisor_review_status === 'pending').length}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference, name, or account..."
              className={`w-full ${inputClass} pl-10`} />
          </div>
          <input type="date" value={dateFilter} onChange={e => handleDateFilter(e.target.value)} className={inputClass} />
          <ControlledSelect value={branchFilter} onChange={setBranchFilter} options={branches} placeholder="All Branches" emptyLabel="All Branches" className={inputClass} />
          <ControlledSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }, { value: 'reversed', label: 'Reversed' }]} placeholder="All Status" emptyLabel="All Status" className={inputClass} />
          <ControlledSelect value={reviewFilter} onChange={setReviewFilter} options={[{ value: 'pending', label: 'Pending Review' }, { value: 'approved', label: 'Approved' }, { value: 'queried', label: 'Queried' }, { value: 'rejected', label: 'Rejected' }]} placeholder="All Reviews" emptyLabel="All Reviews" className={inputClass} />
          <button className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Reference</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Customer</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Agent</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Branch</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Review</th>
                {canReviewTransactions && <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wide text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <tr key={i} className="border-b border-border/50"><td colSpan={canReviewTransactions ? 9 : 8} className="py-4 px-3"><div className="h-8 rounded bg-muted/40 animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canReviewTransactions ? 9 : 8} className="py-12 text-center">
                  <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No transactions found</p>
                </td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-mono text-xs text-blue-500">{t.transaction_reference}</td>
                  <td className="py-3 px-3"><p className="font-medium text-foreground">{t.account_name}</p><p className="text-xs text-muted-foreground">{t.account_number}</p></td>
                  <td className="py-3 px-3 text-right font-semibold text-emerald-500">GHS {(t.amount || 0).toLocaleString()}</td>
                  <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">{t.agent_name || '-'}</td>
                  <td className="py-3 px-3 text-muted-foreground hidden lg:table-cell">{t.branch_name || '-'}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs hidden md:table-cell">
                    {t.transaction_date}
                    {canReviewTransactions && t.transaction_time && <><br /><span className="text-muted-foreground/70">{t.transaction_time}</span></>}
                  </td>
                  <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status] || statusColors.pending}`}>{t.status}</span></td>
                  <td className="py-3 px-3 hidden lg:table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reviewColors[t.supervisor_review_status] || reviewColors.pending}`}>{t.supervisor_review_status}</span></td>
                  {canReviewTransactions && (
                    <td className="py-3 px-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => approveTransaction(t)} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">Approve</button>
                        <button onClick={() => { setReviewTarget(t); setReviewNote(t.correction_note || ''); }} className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20">Query</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-border bg-muted/30" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No transactions found</p>
            </div>
          ) : filtered.map((t) => (
            <article key={t.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.account_name}</p>
                  <p className="font-mono text-[11px] text-blue-500">{t.transaction_reference}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.account_number}</p>
                </div>
                <p className="shrink-0 text-right text-base font-bold text-emerald-500">GHS {(t.amount || 0).toLocaleString()}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{t.transaction_date}{canReviewTransactions && t.transaction_time ? ` ${t.transaction_time}` : ''}</span>
                <span className="text-right">{t.branch_name || '-'}</span>
                <span>{t.agent_name || '-'}</span>
                <span className="flex justify-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${statusColors[t.status] || statusColors.pending}`}>{t.status}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${reviewColors[t.supervisor_review_status] || reviewColors.pending}`}>{t.supervisor_review_status}</span>
                </span>
              </div>
              {t.correction_note && <p className="mt-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600">{t.correction_note}</p>}
              {canReviewTransactions && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => approveTransaction(t)} className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600">Approve</button>
                  <button onClick={() => { setReviewTarget(t); setReviewNote(t.correction_note || ''); }} className="flex-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600">Query</button>
                </div>
              )}
            </article>
          ))}
        </div>
        {!loading && <p className="text-xs text-muted-foreground mt-3 px-3">{filtered.length} transactions - Total GHS {totalAmount.toLocaleString()}</p>}
        <PageControls pagination={pagination} onPageChange={setPage} />
      </div>
        </>
      )}

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(nextOpen) => !nextOpen && setReviewTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Correction</DialogTitle>
              <DialogDescription>{reviewTarget?.account_name} - GHS {(reviewTarget?.amount || 0).toLocaleString()}</DialogDescription>
            </DialogHeader>
            <label htmlFor="correction-note" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Correction Note</label>
            <textarea
              id="correction-note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="Example: confirm amount with customer, wrong account selected, duplicate deposit..."
            />
            <DialogFooter className="mt-5 gap-2 sm:space-x-0">
              <button onClick={() => setReviewTarget(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
              <button onClick={submitCorrectionRequest} disabled={reviewSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                <AlertTriangle className="h-4 w-4" />
                {reviewSaving ? 'Sending...' : 'Send Correction'}
              </button>
              <button onClick={() => approveTransaction(reviewTarget)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
