import React, { useState, useEffect } from 'react';
import { closeDailyCollections, createCollection, getCollections, getCustomers, getDailyCloseStatus } from '@/api/portalClient';
import { useAuth } from '@/lib/AuthContext';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { useWorkDate } from '@/lib/WorkDateContext';
import { Search, HandCoins, User, AlertCircle, ChevronRight, X, Check, UserCheck, LockKeyhole } from 'lucide-react';
import ReceiptCard from '@/components/collection/ReceiptCard';

export default function FieldCollection() {
  const { user } = useAuth();
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const { selectedDate, selectedScope, selectedLabel } = useWorkDate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [now, setNow] = useState(new Date());
  const [dailyClose, setDailyClose] = useState(null);
  const [closingDay, setClosingDay] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const canRecordDeposit = String(user?.department || '').trim().toUpperCase() === 'SUSU AGENT';

  useEffect(() => {
    if (!canRecordDeposit || selectedScope !== 'day') {
      setDailyClose(null);
      return;
    }
    getDailyCloseStatus(selectedDate)
      .then((data) => setDailyClose(data?.close || null))
      .catch(() => setDailyClose(null));
  }, [canRecordDeposit, selectedDate, selectedScope]);

  useEffect(() => {
    getCustomers()
      .then((data) => setCustomers((data || []).filter((customer) => {
        if (customer.customer_status !== 'active') return false;
        if (canUseAgentScope && !selectedAgent) return false;
        if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(customer)) return false;
        return true;
      })))
      .catch(() => setCustomers([]));
  }, [canUseAgentScope, matchesSelectedAgent, selectedAgent]);

  useEffect(() => {
    const raw = searchQuery.trim();
    const digits = raw.replace(/\D/g, '');
    setDuplicateWarning(null);
    setError('');
    if (!raw) {
      setSearchResults([]);
      return;
    }
    if (/\D/.test(raw)) {
      setSearchResults([]);
      setError('Use the customer account number only. Name search is not allowed for deposits.');
      return;
    }
    if (digits.length !== 13) {
      setSearchResults([]);
      setError('Enter the full 13-digit account number before searching.');
      return;
    }
    const match = customers.find(c => String(c.account_number || '').trim() === digits);
    setSearchResults(match ? [match] : []);
    if (!match) setError('Account number not found.');
  }, [searchQuery, customers]);

  const handleSearch = async () => {
    const raw = searchQuery.trim();
    const digits = raw.replace(/\D/g, '');
    if (!raw) return;
    if (/\D/.test(raw)) {
      setSearchResults([]);
      setError('Use the customer account number only. Name search is not allowed for deposits.');
      return;
    }
    if (digits.length !== 13) {
      setSearchResults([]);
      setError('Enter exactly 13 digits. The system will not search partial account numbers.');
      return;
    }
    setSearching(true);
    setError('');
    setSelectedCustomer(null);
    setDuplicateWarning(null);
    try {
      const all = (await getCustomers()).filter((customer) => {
        if (customer.customer_status !== 'active') return false;
        if (canUseAgentScope && !selectedAgent) return false;
        if (canUseAgentScope && selectedAgent && !matchesSelectedAgent(customer)) return false;
        return true;
      });
      setCustomers(all);
      const match = all.find(c => String(c.account_number || '').trim() === digits);
      setSearchResults(match ? [match] : []);
      if (!match) setError('Account number not found.');
    } catch (err) { setError(err.message || 'Search failed. Please try again.'); }
    setSearching(false);
  };

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchQuery('');
    setDuplicateWarning(null);
    try {
      const existing = (await getCollections()).filter((item) =>
        item.customer_id === customer.id &&
        item.transaction_date === selectedDate &&
        item.status === 'completed'
      );
      if (existing.length > 0) setDuplicateWarning(existing[0]);
    } catch {}
  };

  const handleDeposit = async () => {
    if (!canRecordDeposit) { setError('Only SUSU AGENT users can record deposits.'); return; }
    if (dailyClose) { setError('This collection day has been closed.'); return; }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { setError('Please enter a valid positive amount'); return; }
    if (!confirmed) { setError('Please confirm the deposit was collected from the customer'); return; }
    if (selectedScope !== 'day') { setError('Select a specific day before recording a deposit.'); return; }

    setSaving(true);
    setError('');
    try {
      const idempotencyKey = `${user?.id || 'agent'}:${selectedCustomer.id}:${selectedDate}:${numAmount.toFixed(2)}`;
      const record = await createCollection({
        idempotency_key: idempotencyKey,
        customer_id: selectedCustomer.id,
        amount: numAmount,
      });
      setReceipt(record);
      setSelectedCustomer(null);
      setAmount('');
      setConfirmed(false);
      setDuplicateWarning(null);
    } catch (err) { setError(err.message || 'Failed to record deposit. Please try again.'); }
    setSaving(false);
  };

  const handleCloseDay = async () => {
    if (!canRecordDeposit) return;
    if (selectedScope !== 'day') { setError('Select a specific day before closing collections.'); return; }
    setClosingDay(true);
    setError('');
    try {
      const close = await closeDailyCollections(selectedDate);
      setDailyClose(close);
    } catch (err) {
      setError(err.message || 'Could not close this collection day.');
    } finally {
      setClosingDay(false);
    }
  };

  if (receipt) return <ReceiptCard receipt={receipt} onClose={() => setReceipt(null)} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl lg:text-3xl font-bold text-foreground">Field Collection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canUseAgentScope && selectedAgent
            ? `Viewing collection customers for ${selectedAgent.fullname || selectedAgent.full_name}. Deposit recording remains limited to SUSU AGENT logins.`
            : 'Search for a customer and record their daily deposit'}
        </p>
          </div>
          {canRecordDeposit && selectedScope === 'day' && (
            <button
              type="button"
              onClick={handleCloseDay}
              disabled={closingDay || Boolean(dailyClose)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              <LockKeyhole className="h-4 w-4" />
              {dailyClose ? 'Day Closed' : closingDay ? 'Closing...' : 'Close Day'}
            </button>
          )}
        </div>
      </div>

      {dailyClose && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600">
          Daily collections closed for {selectedLabel}: GHS {Number(dailyClose.totalAmount || 0).toLocaleString()} across {dailyClose.transactionCount || 0} transaction(s).
        </div>
      )}

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose an agent above to inspect that agent&apos;s collection customers.</p>
        </div>
      )}

      {!canRecordDeposit && selectedAgent && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600">
          You can review this agent&apos;s customers here, but deposit entry is locked to the SUSU AGENT&apos;s own login.
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && (
        <>
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              inputMode="numeric"
              maxLength={13}
              placeholder="Enter exact 13-digit account number"
              className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2">
            {searching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground mb-2">Exact account match found</p>
            {searchResults.map(c => (
              <button key={c.id} onClick={() => handleSelectCustomer(c)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.account_name}</p>
                    <p className="text-xs text-muted-foreground">{c.account_number} - {c.phone} - {c.branch_name}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {error && !selectedCustomer && (
          <p className="text-sm text-red-500 mt-4 text-center py-4">{error}</p>
        )}
        {searchResults.length === 0 && !searching && searchQuery && !error && (
          <p className="text-sm text-muted-foreground mt-4 text-center py-4">Account number not found.</p>
        )}
      </div>

      {selectedCustomer && (
        <div className="bg-card rounded-xl border border-border p-5 space-y-5">
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{selectedCustomer.account_name}</p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.account_number} - {selectedCustomer.phone}</p>
              </div>
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {duplicateWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="text-amber-500 font-medium">Duplicate deposit detected</p>
                <p className="text-muted-foreground">This customer already has a deposit of GHS {duplicateWarning.amount} recorded for {selectedLabel} at {duplicateWarning.transaction_time}. Please verify before proceeding.</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Deposit Amount (GHS)</label>
            <div className="relative">
              <HandCoins className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-3 text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Recorded By - Auto-Generated</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Agent Name</p><p className="text-foreground font-medium">{user?.full_name || 'N/A'}</p></div>
              <div><p className="text-muted-foreground text-xs">Agent Code</p><p className="text-foreground font-medium">{user?.agent_code || 'N/A'}</p></div>
              <div><p className="text-muted-foreground text-xs">Branch</p><p className="text-foreground font-medium">{selectedCustomer.branch_name}</p></div>
              <div><p className="text-muted-foreground text-xs">Work Date & Time</p><p className="text-foreground font-medium tabular-nums">{selectedLabel} - {now.toLocaleTimeString('en', { hour12: false })}</p></div>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border accent-blue-600" />
            <span className="text-sm text-muted-foreground">
              I confirm that this deposit of <span className="text-foreground font-medium">GHS {amount || '0.00'}</span> was collected from <span className="text-foreground font-medium">{selectedCustomer.account_name}</span> for <span className="text-foreground font-medium">{selectedLabel}</span>. This action will be logged in the audit trail.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <button onClick={handleDeposit} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25">
            {saving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Recording Deposit...</>)
            : (<><Check className="w-4 h-4" /> Confirm & Record Deposit</>)}
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
