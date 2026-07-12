import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCollections, getCustomers, getPortalSettings } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { CalendarDays, Pencil, Phone, Plus, RefreshCw, Search, UserX, Users } from 'lucide-react';
import { useWorkDate } from '@/lib/WorkDateContext';
import { useAgentScope } from '@/lib/AgentScopeContext';
import AddCustomerDialog from '@/components/customers/AddCustomerDialog';
import EditCustomerDialog from '@/components/customers/EditCustomerDialog';

const statusColors = {
  active: 'bg-emerald-500/10 text-emerald-500',
  inactive: 'bg-muted text-muted-foreground',
  suspended: 'bg-red-500/10 text-red-500',
};

export default function Customers() {
  const { selectedDate, selectedMonth, selectedScope, selectedLabel } = useWorkDate();
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const [customers, setCustomers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerData, collectionData, settings] = await Promise.all([
        getCustomers(),
        getCollections(),
        getPortalSettings(),
      ]);
      setCustomers(customerData || []);
      setCollections(collectionData || []);
      setBranches(settings?.branches || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = customers.filter((customer) => {
    if (canUseAgentScope && !selectedAgent) return false;
    if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(customer)) return false;
    if (customer.customer_status === 'inactive') return false;
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      customer.account_name?.toLowerCase().includes(q) ||
      customer.account_number?.toLowerCase().includes(q) ||
      customer.phone?.includes(q);
    const matchBranch = !branchFilter || customer.branch_name === branchFilter || customer.branch_id === branchFilter;
    const matchStatus = !statusFilter || customer.customer_status === statusFilter;
    return matchSearch && matchBranch && matchStatus;
  });

  const selectedCollections = collections.filter((item) => {
    if (canUseAgentScope && !selectedAgent) return false;
    if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(item)) return false;
    if (item.status === 'reversed') return false;
    if (selectedScope === 'month') {
      return String(item.transaction_date || '').startsWith(selectedMonth);
    }
    return item.transaction_date === selectedDate;
  });

  const customerDepositMap = selectedCollections.reduce((map, item) => {
    const key = String(item.customer_id || '');
    if (!key) return map;
    const current = map.get(key) || { total: 0, lastDate: '', count: 0 };
    current.total += Number(item.amount || 0);
    current.count += 1;
    if (!current.lastDate || String(item.transaction_date || '') > current.lastDate) {
      current.lastDate = String(item.transaction_date || '');
    }
    map.set(key, current);
    return map;
  }, new Map());

  const inputClass = "bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground lg:text-3xl">Customer Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canUseAgentScope && selectedAgent
              ? `Viewing customers created or managed by ${selectedAgent.fullname || selectedAgent.full_name}`
              : 'Manage active Susu customers and their account details'}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
            Showing deposits for {selectedLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/inactive-customers" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <UserX className="h-4 w-4" /> Inactive Customers
          </Link>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose an agent above to view that agent&apos;s customers.</p>
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, account number, or phone..." className={`w-full ${inputClass} pl-10`} />
          </div>
          <ControlledSelect value={branchFilter} onChange={setBranchFilter} options={branches} placeholder="All Branches" emptyLabel="All Branches" className={inputClass} />
          <ControlledSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} placeholder="All Active Status" emptyLabel="All Active Status" className={inputClass} />
          <button onClick={fetchData} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Account Name</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Account No.</th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Phone</th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Branch</th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {selectedScope === 'month' ? 'Month Deposits' : 'Day Deposits'}
                </th>
                <th className="hidden px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Lifetime Deposits</th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">
                  {selectedScope === 'month' ? 'Last In Month' : 'Deposit Date'}
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td colSpan={9} className="px-3 py-4"><div className="h-8 animate-pulse rounded bg-muted/40" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No active customers found</p>
                  </td>
                </tr>
              ) : filtered.map((customer) => {
                const selectedStats = customerDepositMap.get(customer.id) || { total: 0, lastDate: '', count: 0 };
                return (
                  <tr key={customer.id} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3 font-medium text-foreground">{customer.account_name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{customer.account_number}</td>
                    <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone || '-'}</span>
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">{customer.branch_name || '-'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[customer.customer_status] || statusColors.inactive}`}>
                        {customer.customer_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">
                      GHS {selectedStats.total.toLocaleString()}
                      <span className="block text-[10px] font-normal text-muted-foreground">{selectedStats.count} txns</span>
                    </td>
                    <td className="hidden px-3 py-3 text-right font-semibold text-muted-foreground lg:table-cell">
                      GHS {(customer.total_deposits || 0).toLocaleString()}
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">{selectedStats.lastDate || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setEditTarget(customer)} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/20">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-border bg-muted/30" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border p-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No active customers found</p>
            </div>
          ) : filtered.map((customer) => {
            const selectedStats = customerDepositMap.get(customer.id) || { total: 0, lastDate: '', count: 0 };
            return (
              <article key={customer.id} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{customer.account_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{customer.account_number}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{customer.phone || '-'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[customer.customer_status] || statusColors.inactive}`}>
                    {customer.customer_status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{selectedScope === 'month' ? 'Month Deposits' : 'Day Deposits'}</p>
                    <p className="font-semibold text-foreground">GHS {selectedStats.total.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Lifetime</p>
                    <p className="font-semibold text-foreground">GHS {(customer.total_deposits || 0).toLocaleString()}</p>
                  </div>
                  <p className="text-muted-foreground">{customer.branch_name || '-'}</p>
                  <p className="text-right text-muted-foreground">{selectedStats.lastDate || '-'}</p>
                </div>
                <button onClick={() => setEditTarget(customer)} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 hover:bg-blue-500/20">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              </article>
            );
          })}
        </div>
        {!loading && <p className="mt-3 px-3 text-xs text-muted-foreground">{filtered.length} active customer(s)</p>}
      </div>}

      <AddCustomerDialog open={showAdd} onClose={() => setShowAdd(false)} branches={branches} onSaved={() => { setShowAdd(false); fetchData(); }} />
      <EditCustomerDialog open={Boolean(editTarget)} customer={editTarget} branches={branches} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchData(); }} />
    </div>
  );
}
