import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActiveStaff, getCollections, getCustomers } from '@/api/portalClient';
import ControlledSelect from '@/components/ui/controlled-select';
import { useAuth } from '@/lib/AuthContext';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { formatDateKey, parseDateKey, useWorkDate } from '@/lib/WorkDateContext';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  HandCoins,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import MetricCard from '@/components/dashboard/MetricCard';
import WelcomeHero from '@/components/dashboard/WelcomeHero';

function displayDate(value) {
  return parseDateKey(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { canUseAgentScope, selectedAgent, matchesSelectedAgent } = useAgentScope();
  const {
    selectedDate,
    selectedMonth,
    selectedScope,
    selectedLabel,
    selectDay,
    selectMonth,
  } = useWorkDate();
  const [collections, setCollections] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendMode, setTrendMode] = useState('week');

  useEffect(() => {
    Promise.all([getCollections(), getActiveStaff(), getCustomers()])
      .then(([data, users, customerData]) => {
        setCollections(data || []);
        setStaff(users || []);
        setCustomers(customerData || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const today = formatDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatDateKey(yesterdayDate);
  const selectedBaseDate = parseDateKey(selectedDate);
  const scopedCollections = canUseAgentScope && selectedAgent
    ? collections.filter((item) => matchesSelectedAgent(item))
    : collections;

  const selectedCollections = scopedCollections.filter((item) => {
    if (item.status === 'reversed') return false;
    if (selectedScope === 'month') {
      return String(item.transaction_date || '').startsWith(selectedMonth);
    }
    return item.transaction_date === selectedDate;
  });

  const selectedTotal = selectedCollections.reduce((sum, item) => sum + (item.amount || 0), 0);
  const selectedCustomers = new Set(selectedCollections.map((item) => item.customer_id)).size;
  const selectedTransactions = selectedCollections.length;
  const highestDeposit = selectedCollections.length
    ? Math.max(...selectedCollections.map((item) => item.amount || 0))
    : 0;
  const pendingCorrections = selectedCollections.filter((item) =>
    ["queried", "rejected"].includes(String(item.supervisor_review_status || "").toLowerCase())
  ).length;
  const scopedCustomers = canUseAgentScope && selectedAgent
    ? customers.filter((item) => matchesSelectedAgent(item))
    : customers;
  const collectedCustomerIds = new Set(selectedCollections.map((item) => item.customer_id));
  const missingCollections = selectedScope === 'day'
    ? scopedCustomers
        .filter((customer) => String(customer.customer_status || 'active').toLowerCase() === 'active')
        .filter((customer) => !collectedCustomerIds.has(customer.id))
        .slice(0, 8)
    : [];

  const chartData = (() => {
    if (trendMode === 'year') {
      const year = selectedBaseDate.getFullYear();
      return [...Array(12)].map((_, index) => {
        const monthDate = new Date(year, index, 1);
        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthCollections = scopedCollections.filter(
          (item) => String(item.transaction_date || '').startsWith(monthKey) && item.status !== 'reversed'
        );
        return {
          date: monthDate.toLocaleDateString('en', { month: 'short' }),
          fullDate: monthKey,
          scope: 'month',
          amount: monthCollections.reduce((sum, item) => sum + (item.amount || 0), 0),
          transactions: monthCollections.length,
        };
      });
    }

    const start = trendMode === 'month'
      ? new Date(selectedBaseDate.getFullYear(), selectedBaseDate.getMonth(), 1)
      : startOfWeek(selectedBaseDate);
    const count = trendMode === 'month'
      ? new Date(selectedBaseDate.getFullYear(), selectedBaseDate.getMonth() + 1, 0).getDate()
      : 7;

    return [...Array(count)].map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = formatDateKey(date);
      const dayCollections = scopedCollections.filter(
        (item) => item.transaction_date === dateKey && item.status !== 'reversed'
      );
      return {
        date: date.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        fullDate: dateKey,
        scope: 'day',
        amount: dayCollections.reduce((sum, item) => sum + (item.amount || 0), 0),
        transactions: dayCollections.length,
      };
    });
  })();

  const handleChartClick = (event) => {
    const point = event?.activePayload?.[0]?.payload;
    if (!point?.fullDate) return;
    if (point.scope === 'month') {
      selectMonth(point.fullDate);
    } else {
      selectDay(point.fullDate);
    }
  };

  const scopeLabel = selectedScope === 'month' ? 'Selected Month' : 'Selected Day';

  const metrics = [
    {
      label: `${scopeLabel} Total`,
      value: `GHS ${selectedTotal.toLocaleString()}`,
      icon: HandCoins,
      color: 'blue',
      sublabel: `${selectedTransactions} transactions`,
    },
    { label: 'Customers Visited', value: selectedCustomers, icon: Users, color: 'emerald' },
    { label: `${scopeLabel} Transactions`, value: selectedTransactions, icon: Receipt, color: 'purple' },
    { label: 'Highest Deposit', value: `GHS ${highestDeposit.toLocaleString()}`, icon: TrendingUp, color: 'orange' },
    { label: 'Pending Corrections', value: pendingCorrections, icon: AlertCircle, color: 'amber' },
    { label: canUseAgentScope && selectedAgent ? 'Selected Agent' : 'Active Agents', value: canUseAgentScope && selectedAgent ? 1 : staff.length, icon: UserCheck, color: 'cyan' },
  ];

  const recentTransactions = [...selectedCollections]
    .sort((a, b) => Number(b.created_date || 0) - Number(a.created_date || 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {(!canUseAgentScope || selectedAgent) && <WelcomeHero user={selectedAgent || user} />}

      {canUseAgentScope && !selectedAgent && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-blue-500" />
          <h2 className="font-heading text-xl font-bold text-foreground">Select a SUSU agent to begin</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your dashboard totals, customers, transactions, and reports will appear after choosing an agent above.
          </p>
        </div>
      )}

      {(!canUseAgentScope || selectedAgent) && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">Viewing records for</p>
                <h2 className="mt-2 flex min-w-0 items-start gap-2 font-heading text-[1.6rem] font-bold leading-tight text-foreground sm:items-center sm:text-2xl">
                  <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-blue-500 sm:mt-0" />
                  <span className="break-words">{selectedLabel}</span>
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-xs">
                  Switch to yesterday, a past day, or a whole month using your existing data permissions.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
                <button type="button" onClick={() => selectDay(today)} className="rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted sm:py-2">
                  Today
                </button>
                <button type="button" onClick={() => selectDay(yesterday)} className="rounded-lg border border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted sm:py-2">
                  Yesterday
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => selectDay(event.target.value || today)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:py-2"
                />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => selectMonth(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:py-2"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            {metrics.map((metric, index) => (
              <MetricCard key={index} {...metric} loading={loading} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Daily Collection Trends</h3>
              <p className="text-xs text-muted-foreground">Click a day or month to switch dashboard records.</p>
            </div>
            <ControlledSelect
              value={trendMode}
              onChange={setTrendMode}
              options={[
                { value: 'week', label: 'Selected week' },
                { value: 'month', label: 'Selected month' },
                { value: 'year', label: 'Selected year' },
              ]}
              className="rounded-lg border-border bg-background text-sm"
            />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} onClick={handleChartClick} className="cursor-pointer">
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                formatter={(value, _name, item) => [
                  `GHS ${Number(value || 0).toLocaleString()}`,
                  item?.payload?.scope === 'month' ? 'Monthly collected' : 'Collected',
                ]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload;
                  if (!point) return '';
                  if (point.scope === 'month') {
                    return parseDateKey(`${point.fullDate}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                  }
                  return displayDate(point.fullDate);
                }}
              />
              <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorAmount)" activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Recent Transactions</h3>
              <p className="text-xs text-muted-foreground">{selectedLabel}</p>
            </div>
            <Link to={`/transactions?date=${selectedDate}`} className="flex items-center gap-0.5 text-xs text-blue-500 hover:underline">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {loading ? (
              [...Array(5)].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/40" />
              ))
            ) : recentTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No transactions for this selection</p>
              </div>
            ) : (
              recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{transaction.account_name}</p>
                    <p className="text-xs text-muted-foreground">{transaction.transaction_time || '-'} - {transaction.branch_name || '-'}</p>
                  </div>
                  <span className="ml-2 shrink-0 text-sm font-semibold text-emerald-500">
                    GHS {(transaction.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
            </div>
          </div>

          {selectedScope === 'day' && missingCollections.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="font-semibold text-foreground">Missing Collection Alert</h3>
                  <p className="text-xs text-muted-foreground">Active customers without a recorded deposit for {selectedLabel}.</p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {missingCollections.map((customer) => (
                  <div key={customer.id} className="rounded-lg border border-border bg-card/70 p-3">
                    <p className="truncate text-sm font-semibold text-foreground">{customer.account_name}</p>
                    <p className="text-xs text-muted-foreground">{customer.account_number}</p>
                    <p className="text-xs text-muted-foreground">{customer.branch_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
