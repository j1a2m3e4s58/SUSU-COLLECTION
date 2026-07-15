import React, { useEffect, useMemo, useState } from 'react';
import { deleteAuditLog, deleteAuditLogs, exportBackup, getAuditLogs } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { useAuth } from '@/lib/AuthContext';
import { exportHtmlPdf } from '@/lib/pdfExport';
import { Download, FileText, Loader2, ScrollText, Search, Trash2 } from 'lucide-react';

export default function AuditLog() {
  const { user } = useAuth();
  const canDeleteAudit = user?.role === 'OwnerAdmin';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [deleteBackupReady, setDeleteBackupReady] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      setLogs(await getAuditLogs());
    } catch (err) {
      setError(err.message || 'Could not load audit logs.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const actions = useMemo(() => [...new Set(logs.map((item) => item.action))].filter(Boolean), [logs]);
  const summarizeTarget = (target) => {
    const text = String(target || '-');
    if (text.length <= 120) return text;
    return `${text.slice(0, 120)}...`;
  };
  const filtered = logs.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || [item.actorName, item.action, item.target, item.ipAddress].join(' ').toLowerCase().includes(q);
    const matchAction = !actionFilter || item.action === actionFilter;
    return matchSearch && matchAction;
  });
  const filteredIds = filtered.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelected = (itemId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const deleteSingleLog = async (item) => {
    setDeletingId(item.id);
    setError('');
    setSuccess('');
    try {
      await deleteAuditLog(item.id);
      setLogs((current) => current.filter((log) => log.id !== item.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      setSuccess('Audit log entry archived from the active view.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not archive this audit log entry.');
    }
    setDeletingId(null);
  };

  const deleteSelectedLogs = async () => {
    const idsToDelete = Array.from(selectedIds);
    const idsToDeleteSet = new Set(idsToDelete.map(String));
    const selectedLogs = logs.filter((item) => idsToDeleteSet.has(String(item.id)));
    if (selectedLogs.length === 0) return;
    setDeletingSelected(true);
    setError('');
    setSuccess('');
    try {
      await deleteAuditLogs(idsToDelete);
      setLogs((current) => current.filter((item) => !idsToDeleteSet.has(String(item.id))));
      setSelectedIds(new Set());
      setSuccess(`${selectedLogs.length} audit log entr${selectedLogs.length === 1 ? 'y' : 'ies'} archived from the active view.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Could not archive selected audit logs.');
    }
    setDeletingSelected(false);
  };

  const requestDelete = (item) => {
    setDeleteBackupReady(false);
    setConfirmDelete({
      mode: 'single',
      title: 'Archive audit log entry?',
      message: 'This audit trail record will be hidden from the active log view while kept in the raw audit store.',
      count: 1,
      item,
    });
  };

  const requestDeleteSelected = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    setDeleteBackupReady(false);
    setConfirmDelete({
      mode: 'bulk',
      title: `Archive ${count} selected audit log entr${count === 1 ? 'y' : 'ies'}?`,
      message: 'Selected audit trail records will be hidden from the active log view.',
      count,
    });
  };

  const confirmDeleteAction = async () => {
    const target = confirmDelete;
    if (!target) return;
    if (!deleteBackupReady) {
      setError('Export a backup before archiving audit log records.');
      return;
    }
    setConfirmDelete(null);
    if (target.mode === 'single') {
      await deleteSingleLog(target.item);
      return;
    }
    await deleteSelectedLogs();
  };

  const exportAuditPdf = () => {
    if (filtered.length === 0) {
      setError('There are no audit logs to export.');
      return;
    }
    setError('');
    exportHtmlPdf({
      title: 'Audit Log Report',
      subtitle: 'Local trail of staff, portal, customer, and collection changes.',
      filename: 'audit-log-report',
      summary: [
        { label: 'Visible Entries', value: filtered.length },
        { label: 'Total Entries', value: logs.length },
        { label: 'Actions', value: actions.length },
        { label: 'Filter', value: actionFilter ? actionFilter.replace(/_/g, ' ') : 'All Actions' },
      ],
      columns: ['Timestamp', 'Actor', 'Action', 'Target', 'IP Address'],
      rows: filtered.map((item) => [
        item.timestamp ? new Date(item.timestamp).toLocaleString() : '-',
        item.actorName || 'System',
        (item.action || '-').replace(/_/g, ' '),
        item.target || '-',
        item.ipAddress || '-',
      ]),
    });
  };

  const exportDeleteBackup = async () => {
    setExportingBackup(true);
    setError('');
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.filename || `bawjiase-portal-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDeleteBackupReady(true);
      setSuccess('Backup exported. You can now archive the selected audit log record(s).');
    } catch (err) {
      setError(err.message || 'Could not export backup before archiving.');
    } finally {
      setExportingBackup(false);
    }
  };

  const inputClass = "bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-blue-500" />
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Local trail of staff, portal, customer, and collection changes.</p>
      </div>

      {success && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">{success}</div>}
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actor, action, target, or IP..." className={`w-full ${inputClass} pl-10`} />
          </div>
          <ControlledSelect value={actionFilter} onChange={setActionFilter} options={actions.map((action) => ({ value: action, label: action.replace(/_/g, ' ') }))} placeholder="All Actions" emptyLabel="All Actions" className={inputClass} />
          <div className="flex flex-wrap gap-2">
            {canDeleteAudit && selectedIds.size > 0 && (
              <button onClick={requestDeleteSelected} disabled={deletingSelected}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deletingSelected ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Archive Selected ({selectedIds.size})
              </button>
            )}
            <button onClick={exportAuditPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {canDeleteAudit && (
                  <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-border accent-blue-600" />
                  </th>
                )}
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Timestamp</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Actor</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Action</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Target</th>
                <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase hidden md:table-cell">IP</th>
                {canDeleteAudit && <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-border/50"><td colSpan={canDeleteAudit ? 7 : 5} className="py-4 px-3"><div className="h-8 rounded bg-muted/40 animate-pulse" /></td></tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={canDeleteAudit ? 7 : 5} className="py-12 text-center"><ScrollText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No audit logs found</p></td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  {canDeleteAudit && (
                    <td className="py-3 px-3">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4 rounded border-border accent-blue-600" />
                    </td>
                  )}
                  <td className="py-3 px-3 text-xs text-muted-foreground tabular-nums">{item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</td>
                  <td className="py-3 px-3 font-medium text-foreground">{item.actorName || 'System'}</td>
                  <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">{(item.action || '-').replace(/_/g, ' ')}</span></td>
                  <td className="py-3 px-3 text-muted-foreground text-xs max-w-xl">
                    <span className="break-words">{summarizeTarget(item.target)}</span>
                    {String(item.target || '').length > 120 && (
                      <button onClick={() => setDetailTarget(item)} className="ml-2 text-blue-500 hover:underline">View</button>
                    )}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs hidden md:table-cell">{item.ipAddress || '-'}</td>
                  {canDeleteAudit && (
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => requestDelete(item)} disabled={deletingId === item.id} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === item.id ? 'Archiving...' : 'Archive'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-muted/30" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No audit logs found</p>
            </div>
          ) : filtered.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-start gap-3">
                {canDeleteAudit && <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} className="mt-1 h-4 w-4 rounded border-border accent-blue-600" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}</p>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">{(item.action || '-').replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.actorName || 'System'}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{summarizeTarget(item.target)}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{item.ipAddress || '-'}</span>
                    <div className="flex gap-2">
                      {String(item.target || '').length > 120 && <button onClick={() => setDetailTarget(item)} className="text-xs text-blue-500">View Details</button>}
                      {canDeleteAudit && <button onClick={() => requestDelete(item)} className="text-xs text-destructive">Archive</button>}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!loading && <p className="text-xs text-muted-foreground mt-3 px-3">{filtered.length} of {logs.length} log entries</p>}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-bold text-foreground">{confirmDelete.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{confirmDelete.message}</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              {confirmDelete.count} entr{confirmDelete.count === 1 ? 'y' : 'ies'} selected. This action cannot be undone.
            </div>
            <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
              Export a backup before archiving so the local system can be restored if needed.
              {deleteBackupReady && <span className="mt-1 block font-medium text-emerald-500">Backup exported for this archive action.</span>}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportDeleteBackup}
                disabled={exportingBackup}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2 text-sm font-medium text-blue-500 hover:bg-blue-500/10 disabled:opacity-50"
              >
                {exportingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Backup
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                disabled={!deleteBackupReady || deletingSelected || Boolean(deletingId)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingSelected || deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Audit Details</h2>
                <p className="text-sm text-muted-foreground">{detailTarget.actorName || 'System'} - {(detailTarget.action || '-').replace(/_/g, ' ')}</p>
              </div>
              <button onClick={() => setDetailTarget(null)} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted">Close</button>
            </div>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-3 text-xs text-foreground">
              {String(detailTarget.target || '-')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}



