import React, { useState, useEffect } from 'react';
import { getCollections, getPortalSettings } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { useWorkDate } from '@/lib/WorkDateContext';
import { exportHtmlPdf } from '@/lib/pdfExport';
import { BarChart3, FileText, Download, Printer, FileSpreadsheet, FileType, Loader2, UserCheck } from 'lucide-react';

const reportTypes = [
  { id: 'daily_transaction', label: 'Daily Transaction Report', desc: 'Individual transactions for a specific date', icon: FileText, color: 'blue' },
  { id: 'agent_summary', label: 'Agent Daily Summary', desc: 'Per-agent collection summary', icon: BarChart3, color: 'emerald' },
  { id: 'branch_daily', label: 'Branch Daily Report', desc: 'All collections grouped by branch', icon: FileText, color: 'purple' },
  { id: 'customer_history', label: 'Customer Contribution History', desc: 'Deposit history per customer', icon: FileText, color: 'orange' },
  { id: 'exception', label: 'Exception Report', desc: 'Queried and rejected transactions', icon: FileText, color: 'red' },
  { id: 'audit_log', label: 'Audit Log Report', desc: 'All system activity logs', icon: FileText, color: 'cyan' },
];

const colorMap = {
  blue: 'bg-blue-500/10 text-blue-500', emerald: 'bg-emerald-500/10 text-emerald-500',
  purple: 'bg-purple-500/10 text-purple-500', orange: 'bg-orange-500/10 text-orange-500',
  red: 'bg-red-500/10 text-red-500', cyan: 'bg-cyan-500/10 text-cyan-500',
};

const escapeCell = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const normalizeLetters = (value) => String(value || '').replace(/[^a-z]/gi, '').toLowerCase();

const commonNameParts = [
  'JAMES', 'LINCOLN', 'AWUAH', 'KWAME', 'KOFI', 'KWEKU', 'KWASI', 'KWABENA', 'KOJO', 'KOBINA',
  'AMA', 'AKUA', 'ABENA', 'YAA', 'AFUA', 'EFUA', 'ADJOA', 'MENSAH', 'ASIEDU', 'ASARE',
  'BRUKU', 'NATHANIEL', 'DESMOND', 'TETTEY', 'QUARSHIE', 'YEENU', 'PRAH', 'ADU', 'OGIL',
];

function splitJoinedName(value, referenceNames = []) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return raw;

  const upper = raw.toUpperCase();
  const reference = referenceNames.find((name) => normalizeLetters(name) === normalizeLetters(raw));
  if (reference) return String(reference).trim().toUpperCase();

  const dictionary = Array.from(new Set([
    ...commonNameParts,
    ...referenceNames.flatMap((name) => String(name || '').toUpperCase().split(/\s+/)),
  ])).filter(Boolean).sort((a, b) => b.length - a.length);

  const memo = new Map();
  const solve = (index) => {
    if (index === upper.length) return [];
    if (memo.has(index)) return memo.get(index);
    for (const part of dictionary) {
      if (upper.startsWith(part, index)) {
        const rest = solve(index + part.length);
        if (rest) {
          const result = [part, ...rest];
          memo.set(index, result);
          return result;
        }
      }
    }
    memo.set(index, null);
    return null;
  };

  return solve(0)?.join(' ') || raw;
}

export default function Reports() {
  const { selectedDate, selectedMonth, selectedScope, selectedLabel } = useWorkDate();
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const [collections, setCollections] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [reportData, setReportData] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([getCollections(), getPortalSettings()])
      .then(([c, b]) => { setCollections(c || []); setBranches(b?.branches || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedScope === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      setDateFrom(`${selectedMonth}-01`);
      setDateTo(`${selectedMonth}-${String(lastDay).padStart(2, '0')}`);
      return;
    }
    setDateFrom(selectedDate);
    setDateTo(selectedDate);
  }, [selectedDate, selectedMonth, selectedScope]);

  const generateReport = () => {
    setGenerating(true);
    setTimeout(() => {
      let data = collections.filter(c => {
        if (canUseAgentScope && !selectedAgent) return false;
        if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(c)) return false;
        const matchFrom = !dateFrom || c.transaction_date >= dateFrom;
        const matchTo = !dateTo || c.transaction_date <= dateTo;
        const matchBranch = !branchFilter || c.branch_name === branchFilter || c.branch_id === branchFilter;
        return matchFrom && matchTo && matchBranch;
      });
      if (selectedType === 'exception') {
        data = data.filter(c => c.supervisor_review_status === 'queried' || c.supervisor_review_status === 'rejected' || c.status === 'reversed');
      }
      setReportData(data);
      setGenerating(false);
    }, 800);
  };

  const exportCSV = () => {
    if (!reportData.length) return;
    const headers = ['Reference', 'Customer', 'Account Number', 'Amount', 'Agent', 'Branch', 'Date', 'Time', 'Status', 'Review'];
    const rows = reportData.map(c => [c.transaction_reference, c.account_name, c.account_number, c.amount, c.agent_name, c.branch_name, c.transaction_date, c.transaction_time, c.status, c.supervisor_review_status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };
  const exportExcel = () => {
    if (!reportData.length) return;
    const isDailySubmission = selectedType === 'daily_transaction';
    const referenceNames = reportData.map((item) => item.agent_name).filter(Boolean);
    const headers = isDailySubmission
      ? ['Account Name', 'Account Number', 'Amount (GH₵)', 'Agent Code', 'Branch']
      : ['Reference', 'Customer', 'Account Number', 'Amount', 'Agent', 'Branch', 'Date', 'Time', 'Status', 'Review'];
    const rows = isDailySubmission
      ? reportData.map(c => [
          splitJoinedName(c.account_name, referenceNames),
          c.account_number,
          `GH₵ ${(c.amount || 0).toLocaleString()}`,
          c.agent_name,
          c.branch_name,
        ])
      : reportData.map(c => [c.transaction_reference, c.account_name, c.account_number, c.amount, c.agent_name, c.branch_name, c.transaction_date, c.transaction_time, c.status, c.supervisor_review_status]);
    const columnWidths = isDailySubmission
      ? ['230', '170', '130', '230', '150']
      : ['170', '220', '170', '120', '220', '150', '120', '110', '120', '130'];
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <style>
        table { border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; font-size: 12pt; }
        th { background: #d9eaf7; color: #000; font-weight: 700; text-align: center; }
        th, td { border: 1px solid #000; padding: 8px 10px; vertical-align: middle; mso-number-format: "\\@"; }
        td.amount { text-align: right; font-weight: 600; mso-number-format: "\\@"; }
        td.name { white-space: nowrap; }
      </style></head><body>
      <table>
        <colgroup>${columnWidths.map(width => `<col style="width:${width}px" />`).join('')}</colgroup>
        <tr>${headers.map(h => `<th>${escapeCell(h)}</th>`).join('')}</tr>
        ${rows.map(r => `<tr>${r.map((v, index) => `<td class="${index === 2 ? 'amount' : index === 0 || index === 3 ? 'name' : ''}">${escapeCell(v)}</td>`).join('')}</tr>`).join('')}
      </table>
      </body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = isDailySubmission
      ? `daily_susu_submission_${dateFrom || selectedDate}.xls`
      : `${selectedType}_report_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
  };
  const exportWord = () => {
    if (!reportData.length) return;
    const total = reportData.reduce((s, c) => s + (c.amount || 0), 0);
    const html = `<h1>Susu Collection - ${reportTypes.find(r => r.id === selectedType)?.label}</h1><p>Date: ${new Date().toLocaleString()}</p><p>Total: GH₵${total.toLocaleString()} | Transactions: ${reportData.length}</p><table border="1"><tr><th>Ref</th><th>Customer</th><th>Account</th><th>Amount</th><th>Agent</th><th>Branch</th><th>Date</th><th>Status</th></tr>${reportData.map(c => `<tr><td>${c.transaction_reference}</td><td>${c.account_name}</td><td>${c.account_number}</td><td>GH₵${c.amount}</td><td>${c.agent_name}</td><td>${c.branch_name}</td><td>${c.transaction_date}</td><td>${c.status}</td></tr>`).join('')}</table><br><p>Agent Signature: _______________ &nbsp;&nbsp; Supervisor Signature: _______________</p>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedType}_report_${new Date().toISOString().split('T')[0]}.doc`;
    a.click();
  };
  const exportPDF = () => {
    if (!reportData.length) return;
    const reportLabel = reportTypes.find(r => r.id === selectedType)?.label || 'Report';
    const isDailySubmission = selectedType === 'daily_transaction';
    const referenceNames = reportData.map((item) => item.agent_name).filter(Boolean);
    const columns = isDailySubmission
      ? ['Account Name', 'Account Number', 'Amount', 'Agent Code', 'Branch']
      : ['Reference', 'Customer', 'Account', 'Amount', 'Agent', 'Branch', 'Date', 'Status'];
    const rows = isDailySubmission
      ? reportData.map(c => [splitJoinedName(c.account_name, referenceNames), c.account_number, `GHS ${(c.amount || 0).toLocaleString()}`, c.agent_name, c.branch_name])
      : reportData.map(c => [c.transaction_reference, c.account_name, c.account_number, `GHS ${(c.amount || 0).toLocaleString()}`, c.agent_name, c.branch_name, c.transaction_date, c.status]);

    exportHtmlPdf({
      title: reportLabel,
      subtitle: `Generated for ${selectedAgent ? `${selectedAgent.fullname || selectedAgent.full_name}, ` : ''}${selectedLabel}. Date range ${dateFrom || '-'} to ${dateTo || '-'}${branchFilter ? `, branch ${branchFilter}` : ', all branches'}.`,
      filename: `${selectedType || 'report'}-${dateFrom || selectedDate}`,
      summary: [
        { label: 'Transactions', value: reportData.length },
        { label: 'Total Amount', value: `GHS ${totalAmount.toLocaleString()}` },
        { label: 'Average Deposit', value: `GHS ${reportData.length ? Math.round(totalAmount / reportData.length).toLocaleString() : 0}` },
        { label: 'Branch', value: branchFilter || 'All Branches' },
      ],
      columns,
      rows,
    });
  };

  const inputClass = "bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";
  const totalAmount = reportData.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="w-6 h-6 text-purple-500" /> Reports & Export Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canUseAgentScope && selectedAgent
            ? `Generate and export reports for ${selectedAgent.fullname || selectedAgent.full_name}, ${selectedLabel}`
            : `Generate and export reports for ${selectedLabel}`}
        </p>
      </div>

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose an agent above before generating reports.</p>
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map(r => {
          const Icon = r.icon;
          return (
            <button key={r.id} onClick={() => { setSelectedType(r.id); setReportData([]); }}
              className={`text-left bg-card rounded-xl border p-5 transition-all hover:shadow-lg ${selectedType === r.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-border hover:border-border/80'}`}>
              <div className={`w-10 h-10 rounded-lg ${colorMap[r.color]} flex items-center justify-center mb-3`}><Icon className="w-5 h-5" /></div>
              <h3 className="font-semibold text-foreground text-sm">{r.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Configure & Generate Report</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1"><label className="text-xs text-muted-foreground mb-1 block">From Date</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} /></div>
            <div className="flex-1"><label className="text-xs text-muted-foreground mb-1 block">To Date</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} /></div>
            <div className="flex-1"><label className="text-xs text-muted-foreground mb-1 block">Branch</label>
              <ControlledSelect value={branchFilter} onChange={setBranchFilter} options={branches} placeholder="All Branches" emptyLabel="All Branches" className={inputClass} />
            </div>
          </div>
          <button onClick={generateReport} disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg flex items-center gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />} Generate Report
          </button>

          {reportData.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg font-bold text-foreground">{reportData.length}</p></div>
                <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Total Amount</p><p className="text-lg font-bold text-emerald-500">GH₵{totalAmount.toLocaleString()}</p></div>
                <div className="bg-muted/30 rounded-lg p-3"><p className="text-xs text-muted-foreground">Avg Deposit</p><p className="text-lg font-bold text-blue-500">GH₵{Math.round(totalAmount / reportData.length).toLocaleString()}</p></div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={exportCSV} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-4 py-2 rounded-lg"><Download className="w-3.5 h-3.5" /> CSV</button>
                <button onClick={exportExcel} className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button>
                <button onClick={exportPDF} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-4 py-2 rounded-lg"><Printer className="w-3.5 h-3.5" /> PDF</button>
                <button onClick={exportWord} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg"><FileType className="w-3.5 h-3.5" /> Word</button>
                {selectedType === 'daily_transaction' && (
                  <p className="flex items-center text-xs text-muted-foreground">
                    Excel uses submission columns: Account Name, Account Number, Amount (GH₵), Agent Code, Branch.
                  </p>
                )}
              </div>

              <div className="mt-2 hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left">
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase">Reference</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase">Customer</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase text-right">Amount</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase hidden md:table-cell">Agent</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase hidden md:table-cell">Branch</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground text-xs uppercase">Date</th>
                  </tr></thead>
                  <tbody>
                    {reportData.slice(0, 50).map(c => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 px-2 font-mono text-xs text-blue-500">{c.transaction_reference}</td>
                        <td className="py-2 px-2 text-foreground">{c.account_name}</td>
                        <td className="py-2 px-2 text-right font-semibold text-emerald-500">GH₵{(c.amount || 0).toLocaleString()}</td>
                        <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{c.agent_name}</td>
                        <td className="py-2 px-2 text-muted-foreground hidden md:table-cell">{c.branch_name}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{c.transaction_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportData.length > 50 && <p className="text-xs text-muted-foreground mt-2 px-2">Showing 50 of {reportData.length} records. Export to see all.</p>}
              </div>
              <div className="mt-2 space-y-3 md:hidden">
                {reportData.slice(0, 50).map((c) => (
                  <article key={c.id} className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{c.account_name}</p>
                        <p className="font-mono text-[11px] text-blue-500">{c.transaction_reference}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{c.account_number}</p>
                      </div>
                      <p className="shrink-0 text-right text-base font-bold text-emerald-500">GHS {(c.amount || 0).toLocaleString()}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{c.transaction_date}</span>
                      <span className="text-right">{c.branch_name || '-'}</span>
                      <span>{c.agent_name || '-'}</span>
                      <span className="text-right">{c.status || '-'}</span>
                    </div>
                  </article>
                ))}
                {reportData.length > 50 && <p className="text-xs text-muted-foreground px-2">Showing 50 of {reportData.length} records. Export to see all.</p>}
              </div>
            </>
          )}
          {reportData.length === 0 && !generating && selectedType && (
            <p className="text-sm text-muted-foreground text-center py-6">Click "Generate Report" to view data.</p>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
