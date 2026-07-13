import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createAgentAccount, createAuditLog, deleteStaff, exportBackup, getActiveStaff, getCollections, getPortalSettings, importCustomers, reopenDailyCollections, resetAgentPassword, updateStaff } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { useAuth } from '@/lib/AuthContext';
import { useWorkDate } from '@/lib/WorkDateContext';
import { exportHtmlPdf } from '@/lib/pdfExport';
import { UserCog, Search, Building2, X, AlertCircle, Loader2, Trash2, FileText, Download, Plus, Upload, KeyRound, LockKeyhole } from 'lucide-react';

export default function AgentManagement() {
  const { user } = useAuth();
  const { selectedDate, selectedScope } = useWorkDate();
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
  const [importFileName, setImportFileName] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const isOwner = user?.role === 'OwnerAdmin';
  const supervisorBranches = Array.isArray(user?.managedBranches) && user.managedBranches.length
    ? user.managedBranches
    : [user?.branch].filter(Boolean);
  const scopedBranches = isOwner ? branches : branches.filter((branch) => supervisorBranches.includes(branch));

  const refreshData = async () => {
    setLoading(true);
    try {
      const [s, b, c] = await Promise.all([
      getActiveStaff(),
      getPortalSettings(),
      getCollections(),
      ]);
      const nextBranches = b?.branches || [];
      setBranches(nextBranches);
      const allowed = isOwner
        ? nextBranches
        : nextBranches.filter((branch) => supervisorBranches.includes(branch));
      setImportBranch((current) => current || allowed[0] || '');
      setAgentForm((current) => ({ ...current, branch: current.branch || allowed[0] || '' }));
      setStaff((s || []).filter(x =>
        String(x.department || '').trim().toUpperCase() === 'SUSU AGENT' &&
        (isOwner || supervisorBranches.includes(x.branch || x.branch_name))
      ));
      setCollections(c || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData().catch(() => setLoading(false)); }, [user?.id]);

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
    const today = new Date().toISOString().split('T')[0];
    const todayCols = agentCols.filter(c => c.transaction_date === today);
    return {
      total: agentCols.reduce((s, c) => s + (c.amount || 0), 0),
      today: todayCols.reduce((s, c) => s + (c.amount || 0), 0),
      count: agentCols.length,
      todayCount: todayCols.length,
    };
  };

  const handleTransfer = async () => {
    if (!newBranch || !reason) { setError('Please select a branch and provide a reason'); return; }
    setSaving(true); setError('');
    const oldBranch = transferAgent.branch || transferAgent.branch_name || 'Unassigned';
    try {
      await updateStaff(transferAgent.id, {
        branch: newBranch,
      });
      await createAuditLog({
        action: 'branch_switch',
        target: `Agent ${transferAgent.fullname || transferAgent.full_name} transferred from ${oldBranch} to ${newBranch}. Reason: ${reason}`,
      });
      setSuccess(`${transferAgent.fullname || transferAgent.full_name} transferred to ${newBranch}`);
      setTransferAgent(null); setNewBranch(''); setReason('');
      setTimeout(() => setSuccess(''), 4000);
      const refreshed = await getActiveStaff();
      setStaff((refreshed || []).filter(x =>
        String(x.department || '').trim().toUpperCase() === 'SUSU AGENT' &&
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
      await Promise.all(selectedAgents.map((agent) => deleteStaff(agent.id)));
      await createAuditLog({
        action: 'agent_bulk_delete',
        target: `Deleted agents: ${selectedAgents.map((agent) => agent.fullname || agent.full_name).join(', ')}`,
      });
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
    const totalToday = filtered.reduce((sum, agent) => sum + getAgentStats(agent.fullname || agent.full_name).today, 0);
    const totalLifetime = filtered.reduce((sum, agent) => sum + getAgentStats(agent.fullname || agent.full_name).total, 0);
    exportHtmlPdf({
      title: 'Agent Management Report',
      subtitle: 'Agent branch assignments and collection performance from the local system.',
      filename: 'agent-management-report',
      summary: [
        { label: 'Agents', value: filtered.length },
        { label: 'Branches', value: new Set(filtered.map((agent) => agent.branch || agent.branch_name || 'Unassigned')).size },
        { label: 'Today Collected', value: `GHS ${totalToday.toLocaleString()}` },
        { label: 'Lifetime Collected', value: `GHS ${totalLifetime.toLocaleString()}` },
      ],
      columns: ['Agent Name', 'Code', 'Branch', 'Supervisor', 'Today', 'Total'],
      rows: filtered.map((agent) => {
        const displayName = agent.fullname || agent.full_name;
        const stats = getAgentStats(displayName);
        return [
          displayName,
          agent.agent_code || '-',
          agent.branch || agent.branch_name || 'Unassigned',
          agent.supervisor_name || '-',
          `GHS ${stats.today.toLocaleString()} (${stats.todayCount} txns)`,
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

  const normalizeImportRow = (row, rowNumber) => {
    const find = (...keys) => {
      const entries = Object.entries(row || {});
      const match = entries.find(([key]) => keys.includes(String(key).trim().toLowerCase()));
      return match ? String(match[1] ?? '').trim().replace(/\.0$/, '') : '';
    };
    const normalized = {
      rowNumber,
      account_name: find('account name', 'account_name', 'name', 'customer name'),
      account_number: find('account number', 'account_number', 'account no', 'account no.', 'account'),
      branch: find('branch', 'branch name') || importBranch,
    };
    const errors = [];
    if (!normalized.account_name) errors.push('Account name missing');
    if (!/^\d{13}$/.test(normalized.account_number)) errors.push('Account number must be exactly 13 digits');
    if (!normalized.branch) errors.push('Branch missing');
    return { ...normalized, errors };
  };

  const downloadCustomerTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { 'Account Name': 'TEST AMA MENSAH', 'Account Number': '131000100001', Branch: scopedBranches[0] || 'BAWJIASE' },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Template');
    XLSX.writeFile(workbook, 'susu_customer_import_template.xlsx');
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportSummary(null);
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        .map((row, index) => normalizeImportRow(row, index + 2));
      const validRows = parsedRows.filter((row) => row.errors.length === 0);
      const invalidRows = parsedRows.filter((row) => row.errors.length > 0);
      setImportRows(validRows);
      setImportInvalidRows(invalidRows);
      if (!validRows.length) setError('No valid rows found. Use columns: Account Name, Account Number, Branch.');
    } catch (err) {
      setError(err.message || 'Could not read the upload file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportCustomers = async () => {
    if (!importBranch) { setError('Select the branch for this import.'); return; }
    if (!importRows.length) { setError('Choose a CSV or Excel file first.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await importCustomers({ branch: importBranch, customers: importRows });
      setImportSummary(result);
      setSuccess(`${result.createdCount || 0} customer(s) imported.`);
      setImportRows([]);
      setImportInvalidRows([]);
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
        <p className="text-sm text-muted-foreground mt-1">Manage staff registered as SUSU AGENT, reassign branches, and monitor field performance</p>
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
              <th className="py-3 px-3 font-medium text-muted-foreground text-xs uppercase text-right">Today</th>
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
                    <td className="py-3 px-3 text-right"><span className="text-emerald-500 font-semibold">GHS {stats.today.toLocaleString()}</span><br /><span className="text-xs text-muted-foreground">{stats.todayCount} txns</span></td>
                    <td className="py-3 px-3 text-right hidden md:table-cell"><span className="text-foreground font-semibold">GHS {stats.total.toLocaleString()}</span><br /><span className="text-xs text-muted-foreground">{stats.count} total</span></td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={() => { setResetTarget(a); setResetUsername(a.loginUsername || ''); setResetPassword(''); setError(''); }}
                          className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">
                          <KeyRound className="w-3 h-3" /> Reset Login
                        </button>
                        <button onClick={() => { setTransferAgent(a); setNewBranch(''); setReason(''); setError(''); }}
                          className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">
                          <Building2 className="w-3 h-3" /> Reassign
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
                      Reassign
                    </button>
                    <button onClick={() => handleReopenDay(a)} disabled={reopeningAgentId === a.id}
                      className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 disabled:opacity-50">
                      {reopeningAgentId === a.id ? 'Reopening...' : 'Reopen Day'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Today</p>
                    <p className="font-semibold text-emerald-500">GHS {stats.today.toLocaleString()}</p>
                    <p className="text-muted-foreground">{stats.todayCount} txns</p>
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
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Delete selected agents?</h2>
                <p className="mt-1 text-sm text-muted-foreground">This clears their login so they can sign up again.</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
              {selectedIds.size} agent(s) selected. This action cannot be undone.
            </div>
            <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-muted-foreground">
              Export a backup before deleting so staff, customers, collections, and audit records can be restored if needed.
              {deleteBackupReady && <span className="mt-1 block font-medium text-emerald-500">Backup exported for this delete action.</span>}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            </div>
          </div>
        </div>
      )}

      {showCreateAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateAgent(false)} />
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Add Agent Login</h2>
                <p className="text-sm text-muted-foreground">Create a simple username login for a SUSU agent.</p>
              </div>
              <button onClick={() => setShowCreateAgent(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} value={agentForm.fullname} onChange={(e) => setAgentForm({ ...agentForm, fullname: e.target.value })} placeholder="Agent full name" />
              <input className={inputClass} value={agentForm.username} onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })} placeholder="Username e.g. gabriel01" />
              <input className={inputClass} value={agentForm.phone} onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })} placeholder="Phone number used for verification" />
              <input className={inputClass} value={agentForm.temporaryPassword} onChange={(e) => setAgentForm({ ...agentForm, temporaryPassword: e.target.value })} placeholder="Temporary password" />
              <ControlledSelect value={agentForm.branch} onChange={(branch) => setAgentForm({ ...agentForm, branch })} options={scopedBranches} placeholder="Select branch" className={inputClass} />
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-muted-foreground">
                First login will ask the agent for this phone number, token 1234, then their permanent password.
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateAgent(false)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Cancel</button>
                <button onClick={handleCreateAgent} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportCustomers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowImportCustomers(false)} />
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Import Customers</h2>
                <p className="text-sm text-muted-foreground">Upload CSV or Excel with Account Name, Account Number, Branch.</p>
              </div>
              <button onClick={() => setShowImportCustomers(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <ControlledSelect value={importBranch} onChange={setImportBranch} options={scopedBranches} placeholder="Import branch" className={inputClass} />
              <button type="button" onClick={downloadCustomerTemplate} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/70 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                <Download className="h-4 w-4" />
                Download Customer Template
              </button>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center hover:bg-muted/50">
                <Upload className="mb-2 h-6 w-6 text-blue-500" />
                <span className="text-sm font-medium text-foreground">{importFileName || 'Choose CSV / Excel file'}</span>
                <span className="mt-1 text-xs text-muted-foreground">{importRows.length || importInvalidRows.length ? `${importRows.length} valid, ${importInvalidRows.length} skipped` : 'Accepted: .csv, .xlsx, .xls'}</span>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} className="hidden" />
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
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowImportCustomers(false)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Close</button>
                <button onClick={handleImportCustomers} disabled={saving || !importRows.length} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetTarget(null)} />
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Reset Agent Login</h2>
                <p className="text-sm text-muted-foreground">{resetTarget.fullname || resetTarget.full_name}</p>
              </div>
              <button onClick={() => setResetTarget(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} placeholder="Temporary username" />
              <input className={inputClass} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New temporary password" />
              <p className="text-xs text-muted-foreground">The agent logs in with this temporary username/password, verifies phone + token 1234, then sets their permanent username and password.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setResetTarget(null)} className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-muted/70">Cancel</button>
                <button onClick={handleResetAgentPassword} disabled={saving || !resetUsername || !resetPassword} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Dialog */}
      {transferAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTransferAgent(null)} />
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">Branch Transfer</h2>
                <p className="text-sm text-muted-foreground">{transferAgent.fullname || transferAgent.full_name} - {transferAgent.branch || transferAgent.branch_name || 'Unassigned'}</p>
              </div>
              <button onClick={() => setTransferAgent(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
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
              <div className="flex gap-3">
                <button onClick={() => setTransferAgent(null)} className="flex-1 bg-muted hover:bg-muted/70 text-foreground text-sm font-medium py-2.5 rounded-lg">Cancel</button>
                <button onClick={handleTransfer} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
