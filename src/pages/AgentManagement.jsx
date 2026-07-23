import React, { useState, useEffect } from 'react';
import { createAgentAccount, deleteStaff, downloadCustomerImportTemplate, exportBackup, getAgentsPage, getCollections, getCustomerImports, getPortalSettings, importCustomers, reopenDailyCollections, resetAgentPassword, updateStaff } from '@/api/portalClient';
import PageControls from '@/components/PageControls';
import ControlledSelect from '@/components/ui/controlled-select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/AuthContext';
import { useWorkDate } from '@/lib/WorkDateContext';
import { exportHtmlPdf } from '@/lib/pdfExport';
import { UserCog, Search, Building2, AlertCircle, Loader2, Trash2, FileText, Download, Plus, Upload, KeyRound, LockKeyhole } from 'lucide-react';

export default function AgentManagement() {
  const { user } = useAuth();
  const { selectedDate, selectedMonth, selectedScope } = useWorkDate();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [transferAgent, setTransferAgent] = useState(null);
  const [newBranch, setNewBranch] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBackupReady, setDeleteBackupReady] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showImportCustomers, setShowImportCustomers] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [agentForm, setAgentForm] = useState({ fullname: '', username: '', temporaryPassword: '', phone: '', branch: '' });
  const [resetUsername, setResetUsername] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [reopeningAgentId, setReopeningAgentId] = useState('');
  const [importBranch, setImportBranch] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importInvalidRows, setImportInvalidRows] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const isOwner = user?.role === 'OwnerAdmin';
  const supervisorBranches = Array.isArray(user?.managedBranches) && user.managedBranches.length
    ? user.managedBranches
    : [user?.branch].filter(Boolean);
  const scopedBranches = isOwner ? branches : branches.filter((branch) => supervisorBranches.includes(branch));
  const isSusuAgentStaff = (member) =>
    ['SUSU', 'SUSU AGENT', 'SUSU SUPERVISOR'].includes(String(member?.department || '').trim().toUpperCase()) &&
    String(member?.role || '').trim() !== 'Supervisor' &&
    !['OwnerAdmin', 'SuperAdmin'].includes(String(member?.role || '').trim());

  const refreshData = async () => {
    setLoading(true);
    try {
      const [s, b, c, imports] = await Promise.all([
      getAgentsPage(page, 25),
      getPortalSettings(),
      getCollections(),
      getCustomerImports().catch(() => []),
      ]);
      const nextBranches = b?.branches || [];
      setBranches(nextBranches);
      const allowed = isOwner
        ? nextBranches
        : nextBranches.filter((branch) => supervisorBranches.includes(branch));
      setImportBranch((current) => current || allowed[0] || '');
      setAgentForm((current) => ({ ...current, branch: current.branch || allowed[0] || '' }));
      setStaff((s.items || []).filter(x =>
        isSusuAgentStaff(x) &&
        (isOwner || supervisorBranches.includes(x.branch || x.branch_name))
      ));
      setPagination(s.pagination);
      setCollections(c || []);
      setImportHistory(imports || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData().catch(() => setLoading(false)); }, [user?.id, page]);

  const filtered = staff.filter(s => {
    const q = search.toLowerCase().trim();
    return !q ||
      s.fullname?.toLowerCase().includes(q) ||
      s.full_name?.toLowerCase().includes(q) ||
      s.agent_code?.toLowerCase().includes(q) ||
      s.branch_name?.toLowerCase().includes(q) ||
      s.branch?.toLowerCase().includes(q);
  });
  const filteredIds = filtered.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const getAgentStats = (agentName) => {
    const agentCols = collections.filter(c => c.agent_name === agentName);
    const selectedCols = agentCols.filter((c) => {
      if (String(c.status || '').toLowerCase() === 'reversed') return false;
      if (selectedScope === 'month') return String(c.transaction_date || '').startsWith(selectedMonth);
      return c.transaction_date === selectedDate;
    });
    return {
      total: agentCols.reduce((s, c) => s + (c.amount || 0), 0),
      selected: selectedCols.reduce((s, c) => s + (c.amount || 0), 0),
      count: agentCols.length,
      selectedCount: selectedCols.length,
    };
  };

  const handleTransfer = async () => {
    if (!newBranch || !reason) { setError('Please select a branch and provide a reason'); return; }
    setSaving(true); setError('');
    try {
      await updateStaff(transferAgent.id, {
        branch: newBranch,
      });
      setSuccess(`${transferAgent.fullname || transferAgent.full_name} transferred to ${newBranch}`);
      setTransferAgent(null); setNewBranch(''); setReason('');
      setTimeout(() => setSuccess(''), 4000);
      const refreshed = await getActiveStaff();
      setStaff((refreshed || []).filter(x =>
        isSusuAgentStaff(x) &&
        (isOwner || supervisorBranches.includes(x.branch || x.branch_name))
      ));
    } catch { setError('Failed to transfer agent. Please try again.'); }
    setSaving(false);
  };

  const toggleSelected = (agentId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
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

  const handleDeleteSelected = async () => {
    if (!deleteBackupReady) {
      setError('Export a backup before deleting agents.');
      return;
    }
    const selectedAgents = staff.filter((agent) => selectedIds.has(agent.id));
    if (selectedAgents.length === 0) return;
    setDeletingSelected(true);
    setError('');
    try {
      await Promise.all(selectedAgents.map((agent) => deleteStaff(agent.id, true)));
      setStaff((current) => current.filter((agent) => !selectedIds.has(agent.id)));
      setSelectedIds(new Set());
      setDeleteBackupReady(false);
      setSuccess(`${selectedAgents.length} agent(s) deleted from the system.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to delete selected agents.');
    }
    setDeletingSelected(false);
  };

  const exportAgentsPdf = () => {
    const selectedPeriodTotal = filtered.reduce((sum, agent) => sum + getAgentStats(agent.fullname || agent.full_name).selected, 0);
    const totalLifetime = filtered.reduce((sum, agent) => sum + getAgentStats(agent.fullname || agent.full_name).total, 0);
    exportHtmlPdf({
      title: 'Agent Management Report',
      subtitle: 'Agent branch assignments and collection performance from the local system.',
      filename: 'agent-management-report',
      summary: [
        { label: 'Agents', value: filtered.length },
        { label: 'Branches', value: new Set(filtered.map((agent) => agent.branch || agent.branch_name || 'Unassigned')).size },
        { label: selectedScope === 'month' ? 'Month Collected' : 'Day Collected', value: `GHS ${selectedPeriodTotal.toLocaleString()}` },
        { label: 'Lifetime Collected', value: `GHS ${totalLifetime.toLocaleString()}` },
      ],
      columns: ['Agent Name', 'Code', 'Branch', 'Supervisor', selectedScope === 'month' ? 'Selected Month' : 'Selected Day', 'Total'],
      rows: filtered.map((agent) => {
        const displayName = agent.fullname || agent.full_name;
        const stats = getAgentStats(displayName);
        return [
          displayName,
          agent.agent_code || '-',
          agent.branch || agent.branch_name || 'Unassigned',
          agent.supervisor_name || '-',
          `GHS ${stats.selected.toLocaleString()} (${stats.selectedCount} txns)`,
          `GHS ${stats.total.toLocaleString()} (${stats.count} total)`,
        ];
      }),
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
      setSuccess('Backup exported. You can now delete the selected agent(s).');
    } catch (err) {
      setError(err.message || 'Could not export backup before delete.');
    } finally {
      setExportingBackup(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentForm.username || !agentForm.temporaryPassword || !agentForm.phone || !agentForm.branch) {
      setError('Enter username, temporary password, phone, and branch.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createAgentAccount(agentForm);
      setSuccess(`Agent ${agentForm.username} added. They can now use Agent username login.`);
      setShowCreateAgent(false);
      setAgentForm({ fullname: '', username: '', temporaryPassword: '', phone: '', branch: scopedBranches[0] || '' });
      await refreshData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not add agent.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAgentPassword = async () => {
    if (!resetTarget || !resetUsername.trim() || !resetPassword.trim()) {
      setError('Enter the temporary username and temporary password.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await resetAgentPassword(resetTarget.id, resetPassword.trim(), resetUsername.trim());
      setSuccess(`Temporary login reset for ${resetTarget.fullname || resetTarget.full_name}.`);
      setResetTarget(null);
      setResetUsername('');
      setResetPassword('');
      await refreshData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setSaving(false);
    }
  };

  const handleReopenDay = async (agent) => {
    if (selectedScope !== 'day') {
      setError('Select a specific day before reopening collections.');
      return;
    }
    setReopeningAgentId(agent.id);
    setError('');
    try {
      const result = await reopenDailyCollections(selectedDate, agent.id);
      setSuccess(result.removedCount ? `Reopened ${selectedDate} for ${agent.fullname || agent.full_name}.` : `No closed day found for ${agent.fullname || agent.full_name} on ${selectedDate}.`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Could not reopen this agent day.');
    } finally {
      setReopeningAgentId('');
    }
  };

  const downloadCustomerTemplate = async () => {
    setDownloadingTemplate(true);
    setError('');
    try {
      const blob = await downloadCustomerImportTemplate(importBranch);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'susu_customer_import_template.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Could not download the customer template.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportFileName(file.name);
    setImportSummary(null);
    setError('');
    try {
      const preview = await importCustomers({ branch: importBranch, file, preview: true });
      setImportRows(preview.validRows || []);
      setImportInvalidRows((preview.skipped || []).map((row) => ({ rowNumber: row.row, errors: [row.reason] })));
      if (!(preview.validRows || []).length) setError('No valid rows found. Download the latest template and keep account numbers as 13-digit text.');
    } catch (err) {
      setError(err.message || 'Could not read the upload file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportCustomers = async () => {
    if (!importBranch) { setError('Select the branch for this import.'); return; }
    if (!importFile || !importRows.length) { setError('Choose a CSV or Excel file first.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await importCustomers({ branch: importBranch, file: importFile });
      setImportSummary(result);
      setSuccess(`${result.createdCount || 0} customer(s) imported.`);
      setImportRows([]);
      setImportInvalidRows([]);
      setImportFile(null);
      setImportFileName('');
      await refreshData();
    } catch (err) {
      setError(err.message || 'Could not import customers.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2"><UserCog className="w-6 h-6 text-blue-500" /> Agent Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage SUSU agents, transfer branches, and monitor field performance</p>
      </div>

      {success && <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-500">{success}</div>}
      {error && !transferAgent && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-500">{error}</div>}

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agent name, code, or branch..."
              className={`w-full ${inputClass} pl-10`} />
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto lg:flex-wrap">
            <button onClick={() => { setShowCreateAgent(true); setError(''); }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Add Agent
            </button>
            <button onClick={() => { setShowImportCustomers(true); setError(''); }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
              <Upload className="h-4 w-4" />
              Import Customers
            </button>
            <button onClick={exportDeleteBackup} disabled={exportingBackup}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
              {exportingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Backup
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => { setDeleteBackupReady(false); setConfirmDelete(true); }} disabled={deletingSelected}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deletingSelected ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Selected ({selectedIds.size})
              </button>
            )}
            <button onClick={exportAgentsPdf}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-border accent-blue-600" />
              </th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Agent Name</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase">Code</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase hidden md:table-cell">Branch</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase hidden lg:table-cell">Supervisor</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase text-right">{selectedScope === 'month' ? 'Month' : 'Day'}</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase text-right hidden md:table-cell">Total</th>
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase text-center">Action</th>
            </tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_, i) => <tr key={i} className="border-b border-border/50"><td colSpan={8} className="py-4 px-3"><div className="h-8 rounded bg-muted/40 animate-pulse" /></td></tr>)
              : filtered.length === 0 ? <tr><td colSpan={8} className="py-12 text-center"><UserCog className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No agents found</p></td></tr>
              : filtered.map(a => {
                const displayName = a.fullname || a.full_name;
                const displayBranch = a.branch || a.branch_name || 'Unassigned';
                const stats = getAgentStats(displayName);
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelected(a.id)} className="h-4 w-4 rounded border-border accent-blue-600" />
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">{displayName}</td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{a.agent_code || '-'}</td>
                    <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">{displayBranch}</td>
                    <td className="py-3 px-3 text-muted-foreground hidden lg:table-cell">{a.supervisor_name || '-'}</td>
                    <td className="py-3 px-3 text-right"><span className="text-emerald-500 font-semibold">GHS {stats.selected.toLocaleString()}</span><br /><span className="text-xs text-muted-foreground">{stats.selectedCount} txns</span></td>
                    <td className="py-3 px-3 text-right hidden md:table-cell"><span className="text-foreground font-semibold">GHS {stats.total.toLocaleString()}</span><br /><span className="text-xs text-muted-foreground">{stats.count} total</span></td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={() => { setResetTarget(a); setResetUsername(a.loginUsername || ''); setResetPassword(''); setError(''); }}
                          className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">
                          <KeyRound className="w-3 h-3" /> Reset Login
                        </button>
                        <button onClick={() => { setTransferAgent(a); setNewBranch(''); setReason(''); setError(''); }}
                          className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <Building2 className="w-3 h-3" /> Transfer Branch
                        </button>
                        <button onClick={() => handleReopenDay(a)} disabled={reopeningAgentId === a.id}
                          className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                          <LockKeyhole className="w-3 h-3" /> {reopeningAgentId === a.id ? 'Reopening...' : 'Reopen Day'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-border bg-muted/30" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <UserCog className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No agents found</p>
            </div>
          ) : filtered.map((a) => {
            const displayName = a.fullname || a.full_name;
            const displayBranch = a.branch || a.branch_name || 'Unassigned';
            const stats = getAgentStats(displayName);
            return (
              <article key={a.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelected(a.id)} className="mt-1 h-4 w-4 rounded border-border accent-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{a.agent_code || '-'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{displayBranch}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button onClick={() => { setResetTarget(a); setResetUsername(a.loginUsername || ''); setResetPassword(''); setError(''); }}
                      className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500">
                      Reset Login
                    </button>
                    <button onClick={() => { setTransferAgent(a); setNewBranch(''); setReason(''); setError(''); }}
                      className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500">
                      Transfer Branch
                    </button>
                    <button onClick={() => handleReopenDay(a)} disabled={reopeningAgentId === a.id}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 disabled:opacity-50">
                      {reopeningAgentId === a.id ? 'Reopening...' : 'Reopen Day'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{selectedScope === 'month' ? 'Month' : 'Day'}</p>
                    <p className="font-semibold text-emerald-500">GHS {stats.selected.toLocaleString()}</p>
                    <p className="text-muted-foreground">{stats.selectedCount} txns</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-foreground">GHS {stats.total.toLocaleString()}</p>
                    <p className="text-muted-foreground">{stats.count} total</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <PageControls pagination={pagination} onPageChange={setPage} />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">Recent Customer Imports</h2>
            <p className="text-xs text-muted-foreground">Shows uploaded customer batches for the branches you manage.</p>
          </div>
          <button onClick={refreshData} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
            Refresh
          </button>
        </div>
        {importHistory.length === 0 ? (
          <div className="rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
            No customer import batches recorded yet.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {importHistory.slice(0, 6).map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.branch || 'Branch'}</p>
                    <p className="text-xs text-muted-foreground">{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : '-'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">By {item.uploadedBy || 'Unknown'}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">
                    {item.createdCount || 0} added
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.skippedCount || 0} skipped row(s)</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-md">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete selected agents?</DialogTitle>
                <DialogDescription className="mt-1">This clears their login so they can sign up again.</DialogDescription>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              {selectedIds.size} agent(s) selected. This action cannot be undone.
            </div>
            <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
              Export a backup before deleting so staff, customers, collections, and audit records can be restored if needed.
              {deleteBackupReady && <span className="mt-1 block font-medium text-emerald-500">Backup exported for this delete action.</span>}
            </div>
            <DialogFooter className="mt-5 gap-2 sm:space-x-0">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">Cancel</button>
              <button type="button" onClick={exportDeleteBackup} disabled={exportingBackup}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 px-4 py-2 text-sm font-medium text-blue-500 hover:bg-blue-500/10 disabled:opacity-50">
                {exportingBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Backup
              </button>
              <button type="button" onClick={async () => { setConfirmDelete(false); await handleDeleteSelected(); }} disabled={!deleteBackupReady || deletingSelected}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deletingSelected ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={showCreateAgent} onOpenChange={setShowCreateAgent}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Agent Login</DialogTitle>
              <DialogDescription>Create a simple username login for a SUSU agent.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Full Name</span>
                <input autoComplete="off" className={inputClass} value={agentForm.fullname} onChange={(e) => setAgentForm({ ...agentForm, fullname: e.target.value })} placeholder="Agent full name" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Username</span>
                <input autoComplete="off" className={inputClass} value={agentForm.username} onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })} placeholder="Username e.g. gabriel01" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Phone</span>
                <input type="tel" autoComplete="off" inputMode="tel" className={inputClass} value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} placeholder="Phone number used for verification" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Temporary Password</span>
                <input type="password" autoComplete="new-password" className={inputClass} value={agentForm.temporaryPassword} onChange={(e) => setAgentForm({ ...agentForm, temporaryPassword: e.target.value })} placeholder="Temporary password" />
              </label>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Branch</span>
                <ControlledSelect value={agentForm.branch} onChange={(branch) => setAgentForm({ ...agentForm, branch })} options={scopedBranches} placeholder="Select branch" className={inputClass} />
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                <input type="checkbox" checked readOnly aria-label="Force reset on first login" className="mt-0.5 h-4 w-4 accent-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-foreground">Force reset on first login</p>
                  <p className="text-xs text-muted-foreground">Required for every new agent account.</p>
                </div>
              </div>
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-muted-foreground">
                First login will ask the agent for this phone number, then generate a one-time setup token before their permanent password.
              </div>
              <DialogFooter className="flex-row gap-3 pt-2 sm:space-x-0">
                <button onClick={() => setShowCreateAgent(false)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Cancel</button>
                <button onClick={handleCreateAgent} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Agent
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
      </Dialog>

      <Dialog open={showImportCustomers} onOpenChange={setShowImportCustomers}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Import Customers</DialogTitle>
              <DialogDescription>Upload CSV or Excel using the column titles configured in Portal Control.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <ControlledSelect value={importBranch} onChange={setImportBranch} options={scopedBranches} placeholder="Import branch" className={inputClass} />
              <button type="button" onClick={downloadCustomerTemplate} disabled={downloadingTemplate} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
                {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloadingTemplate ? 'Preparing Excel...' : 'Download Excel Template'}
              </button>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center hover:bg-muted/50">
                <Upload className="mb-2 h-6 w-6 text-blue-500" />
                <span className="text-sm font-medium text-foreground">{importFileName || 'Choose CSV / Excel file'}</span>
                <span className="mt-1 text-xs text-muted-foreground">{importRows.length || importInvalidRows.length ? `${importRows.length} valid, ${importInvalidRows.length} skipped` : 'Accepted: .csv, .xlsx'}</span>
                <input type="file" accept=".csv,.xlsx" onChange={handleImportFile} className="hidden" />
              </label>
              {importRows.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs">
                  <p className="mb-1 font-semibold text-emerald-600">Valid rows preview</p>
                  {importRows.slice(0, 5).map((row, index) => (
                    <p key={index} className="truncate text-muted-foreground">{row.account_number} - {row.account_name} - {row.branch || importBranch}</p>
                  ))}
                  {importRows.length > 5 && <p className="mt-1 text-muted-foreground">+ {importRows.length - 5} more valid row(s)</p>}
                </div>
              )}
              {importInvalidRows.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                  <p className="mb-1 font-semibold text-amber-600">Skipped rows</p>
                  {importInvalidRows.slice(0, 6).map((row) => (
                    <p key={row.rowNumber} className="truncate text-muted-foreground">Row {row.rowNumber}: {row.errors.join(', ')}</p>
                  ))}
                  {importInvalidRows.length > 6 && <p className="mt-1 text-muted-foreground">+ {importInvalidRows.length - 6} more skipped row(s)</p>}
                </div>
              )}
              {importSummary && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600">
                  Imported {importSummary.createdCount || 0}. Skipped {(importSummary.skipped || []).length}.
                </div>
              )}
              <DialogFooter className="flex-row gap-3 pt-2 sm:space-x-0">
                <button onClick={() => setShowImportCustomers(false)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Close</button>
                <button onClick={handleImportCustomers} disabled={saving || !importRows.length} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-700 py-2.5 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(nextOpen) => !nextOpen && setResetTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Agent Login</DialogTitle>
              <DialogDescription>{resetTarget?.fullname || resetTarget?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input autoComplete="off" className={inputClass} value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} placeholder="Temporary username" />
              <input type="password" autoComplete="new-password" className={inputClass} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New temporary password" />
              <p className="text-xs text-muted-foreground">The agent logs in with this temporary username/password, verifies phone, enters the generated setup token, then sets their permanent username and password.</p>
              <DialogFooter className="flex-row gap-3 pt-2 sm:space-x-0">
                <button onClick={() => setResetTarget(null)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Cancel</button>
                <button onClick={handleResetAgentPassword} disabled={saving || !resetUsername || !resetPassword} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-700 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset Login
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={Boolean(transferAgent)} onOpenChange={(nextOpen) => !nextOpen && setTransferAgent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer Branch</DialogTitle>
              <DialogDescription>{transferAgent?.fullname || transferAgent?.full_name} - {transferAgent?.branch || transferAgent?.branch_name || 'Unassigned'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Branch</label>
                <ControlledSelect
                  value={newBranch}
                  onChange={setNewBranch}
                  options={branches}
                  placeholder="Select new branch"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason for Transfer</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Agent relocated to new branch territory"
                  className={`${inputClass} resize-none`} />
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">This action will be logged in the audit trail with old branch, new branch, and reason.</p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <DialogFooter className="flex-row gap-3 sm:space-x-0">
                <button onClick={() => setTransferAgent(null)} className="flex-1 bg-muted hover:bg-muted/70 text-foreground text-sm font-medium py-2.5 rounded-lg">Cancel</button>
                <button onClick={handleTransfer} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Transfer
                </button>
              </DialogFooter>
            </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}

