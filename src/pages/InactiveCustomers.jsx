import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomers, getPortalSettings } from '@/api/portalClient';
import EditCustomerDialog from '@/components/customers/EditCustomerDialog';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { ArrowLeft, Pencil, Phone, RefreshCw, Search, UserCheck, UserX } from 'lucide-react';

export default function InactiveCustomers() {
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerData, settings] = await Promise.all([getCustomers(), getPortalSettings()]);
      setCustomers(customerData || []);
      setBranches(settings?.branches || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = customers.filter((customer) => {
    if (canUseAgentScope && !selectedAgent) return false;
    if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(customer)) return false;
    if (customer.customer_status !== 'inactive') return false;
    const q = search.toLowerCase().trim();
    return !q ||
      customer.account_name?.toLowerCase().includes(q) ||
      customer.account_number?.toLowerCase().includes(q) ||
      customer.phone?.includes(q) ||
      customer.branch_name?.toLowerCase().includes(q);
  });

  const inputClass = "bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Customer records</p>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-bold text-foreground lg:text-3xl">
            <UserX className="h-7 w-7 text-blue-500" />
            Inactive Customers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canUseAgentScope && selectedAgent
              ? `Inactive customers for ${selectedAgent.fullname || selectedAgent.full_name}.`
              : 'Edit a customer and choose Active to move them back to Customer Management and Field Collection search.'}
          </p>
        </div>
        <Link to="/customers" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          <ArrowLeft className="h-4 w-4" /> Active Customers
        </Link>
      </div>

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose an agent above to review inactive customers.</p>
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inactive customers..." className={`w-full ${inputClass} pl-10`} />
          </div>
          <button onClick={fetchData} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-3 text-xs font-medium uppercase text-muted-foreground">Account Name</th>
                <th className="px-3 py-3 text-xs font-medium uppercase text-muted-foreground">Account No.</th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase text-muted-foreground md:table-cell">Phone</th>
                <th className="hidden px-3 py-3 text-xs font-medium uppercase text-muted-foreground lg:table-cell">Branch</th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-b border-border/50"><td colSpan={5} className="px-3 py-4"><div className="h-8 animate-pulse rounded bg-muted/40" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-12 text-center"><UserX className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No inactive customers found</p></td></tr>
              ) : filtered.map((customer) => (
                <tr key={customer.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-3 font-medium text-foreground">{customer.account_name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{customer.account_number}</td>
                  <td className="hidden px-3 py-3 text-muted-foreground md:table-cell"><span className="flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone || '-'}</span></td>
                  <td className="hidden px-3 py-3 text-muted-foreground lg:table-cell">{customer.branch_name || '-'}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => setEditTarget(customer)} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/20">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="space-y-3 md:hidden">
            {filtered.map((customer) => (
              <div key={customer.id} className="rounded-xl border border-border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{customer.account_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{customer.account_number}</p>
                  </div>
                  <button onClick={() => setEditTarget(customer)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-500/20">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>Phone</p>
                    <p className="flex items-center gap-1 text-foreground"><Phone className="h-3 w-3" />{customer.phone || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p>Branch</p>
                    <p className="truncate text-foreground">{customer.branch_name || '-'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && <p className="mt-3 px-3 text-xs text-muted-foreground">{filtered.length} inactive customer(s)</p>}
      </div>}

      <EditCustomerDialog open={Boolean(editTarget)} customer={editTarget} branches={branches} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); fetchData(); }} />
    </div>
  );
}
