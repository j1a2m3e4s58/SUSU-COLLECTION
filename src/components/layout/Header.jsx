import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon, Bell, LogOut, UserCircle, Users, Receipt, Contact, LayoutDashboard, UserX, CalendarDays } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { formatDateKey, useWorkDate } from '@/lib/WorkDateContext';
import { getActiveStaff, getCollections, getCustomers, getUnreadNotificationCount, resolveAssetUrl } from '@/api/portalClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Header({ onMenuClick, user }) {
  const { theme, toggleTheme } = useTheme();
  const { logout, portalSettings } = useAuth();
  const { selectedDate, selectedMonth, selectedScope, selectedLabel, selectDay, selectMonth } = useWorkDate();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchIndex, setSearchIndex] = useState({ customers: [], staff: [], collections: [] });
  const [indexLoaded, setIndexLoaded] = useState(false);

  const displayName = user?.full_name || user?.fullname || 'User';
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';
  const profileImage = resolveAssetUrl(user?.imageFile);
  const canAdmin = user?.role === 'OwnerAdmin';
  const canOwnerControl = user?.role === 'OwnerAdmin';
  const canManageCustomers = user?.role === 'OwnerAdmin' || user?.role === 'Supervisor';
  const isSusuAgent = String(user?.department || '').trim().toUpperCase() === 'SUSU AGENT';
  const managedBranches = Array.isArray(user?.managedBranches) && user.managedBranches.length
    ? user.managedBranches
    : [user?.branch].filter(Boolean);
  const branchAllowed = (branch) => {
    if (canOwnerControl) return true;
    if (user?.role === 'Supervisor') return managedBranches.includes(branch);
    return branch === user?.branch;
  };
  const recordBelongsToUser = (record) => {
    if (!isSusuAgent) return true;
    const userId = String(user?.id || '');
    const userEmail = String(user?.email || '').trim().toLowerCase();
    const userName = String(user?.fullname || user?.full_name || '').trim().toLowerCase();
    return (
      String(record.agent_id || record.created_by || record.staff_id || '') === userId ||
      String(record.agent_email || '').trim().toLowerCase() === userEmail ||
      String(record.agent_name || '').trim().toLowerCase() === userName
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    let mounted = true;

    const loadUnread = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (mounted) setUnreadCount(count);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };

    loadUnread();
    const intervalId = window.setInterval(loadUnread, 15000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id]);

  const loadSearchIndex = async (force = false) => {
    if (indexLoaded && !force) return;
    try {
      const [customers, staff, collections] = await Promise.all([
        getCustomers(),
        getActiveStaff(),
        getCollections(),
      ]);
      setSearchIndex({
        customers: customers || [],
        staff: staff || [],
        collections: collections || [],
      });
      setIndexLoaded(true);
    } catch {
      setIndexLoaded(true);
    }
  };

  const staticPages = [
    { title: 'Dashboard', subtitle: 'Overview and daily totals', path: '/', type: 'Page', icon: LayoutDashboard },
    ...(isSusuAgent ? [{ title: 'Field Collection', subtitle: 'Record customer deposits', path: '/field-collection', type: 'Page', icon: Receipt }] : []),
    ...(canManageCustomers ? [
      { title: 'Customers', subtitle: 'Active customer management', path: '/customers', type: 'Page', icon: Users },
      { title: 'Inactive Customers', subtitle: 'Restore inactive customers', path: '/inactive-customers', type: 'Page', icon: UserX },
    ] : []),
    { title: 'Directory', subtitle: 'Staff directory and presence', path: '/directory', type: 'Page', icon: Contact },
    { title: 'Transactions', subtitle: 'Collection transaction history', path: '/transactions', type: 'Page', icon: Receipt },
    { title: 'Reports', subtitle: 'Reports and exports', path: '/reports', type: 'Page', icon: Search },
    ...(canAdmin ? [
      { title: 'Branches', subtitle: 'Branch management', path: '/branches', type: 'Page', icon: LayoutDashboard },
      { title: 'Supervisor Management', subtitle: 'Assign supervisor scopes', path: '/supervisor-management', type: 'Page', icon: Contact },
      { title: 'Audit Log', subtitle: 'System audit trail', path: '/audit-log', type: 'Page', icon: Receipt },
    ] : []),
    ...(canManageCustomers ? [
      { title: 'Agent Management', subtitle: 'Add agents, import customers, and reset agent logins', path: '/agents', type: 'Page', icon: Contact },
    ] : []),
    ...(canOwnerControl ? [
      { title: 'Portal Control', subtitle: 'Owner system settings', path: '/portal-control', type: 'Page', icon: LayoutDashboard },
      { title: 'Past Staff', subtitle: 'Archived staff records', path: '/past-staff', type: 'Page', icon: UserX },
    ] : []),
  ];

  const query = globalSearch.trim().toLowerCase();
  const suggestions = query
    ? [
        ...staticPages
          .filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(query))
          .map((item) => ({ ...item, key: `page-${item.path}` })),
        ...(canManageCustomers ? searchIndex.customers
          .filter((customer) => branchAllowed(customer.branch_name || customer.branch_id))
          .filter((customer) => [customer.account_name, customer.account_number, customer.phone, customer.branch_name, customer.customer_status].join(' ').toLowerCase().includes(query))
          .slice(0, 5)
          .map((customer) => ({
            key: `customer-${customer.id}`,
            title: customer.account_name,
            subtitle: `${customer.account_number} - ${customer.phone || '-'} - ${customer.customer_status}`,
            path: customer.customer_status === 'inactive' ? '/inactive-customers' : '/customers',
            type: 'Customer',
            icon: customer.customer_status === 'inactive' ? UserX : Users,
          })) : []),
        ...searchIndex.staff
          .filter((member) => member.role !== 'OwnerAdmin')
          .filter((member) => canOwnerControl || user?.role !== 'Supervisor' || branchAllowed(member.branch))
          .filter((member) => [member.fullname, member.email, member.phone, member.department, member.branch, member.role].join(' ').toLowerCase().includes(query))
          .slice(0, 5)
          .map((member) => ({
            key: `staff-${member.id}`,
            title: member.fullname,
            subtitle: `${member.department || '-'} - ${member.branch || '-'} - ${member.role || '-'}`,
            path: '/directory',
            type: 'Staff',
            icon: Contact,
          })),
        ...searchIndex.collections
          .filter(recordBelongsToUser)
          .filter((item) => branchAllowed(item.branch_name || item.branch_id))
          .filter((item) => [item.transaction_reference, item.account_name, item.account_number, item.branch_name, item.agent_name].join(' ').toLowerCase().includes(query))
          .slice(0, 5)
          .map((item) => ({
            key: `collection-${item.id}`,
            title: item.transaction_reference,
            subtitle: `${item.account_name} - GHS ${(item.amount || 0).toLocaleString()} - ${item.transaction_date || '-'}`,
            path: '/transactions',
            type: 'Transaction',
            icon: Receipt,
          })),
      ].slice(0, 10)
    : [];

  const goToSuggestion = (item) => {
    setSearchOpen(false);
    setGlobalSearch('');
    navigate(item.path);
  };

  const selectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    selectDay(formatDateKey(yesterday));
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-3 lg:gap-4 px-4 lg:px-6 h-16">
        <button onClick={onMenuClick} className="lg:hidden text-foreground p-1.5 -ml-1">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={globalSearch}
              onFocus={() => {
                setSearchOpen(true);
                loadSearchIndex(true);
              }}
              onChange={(event) => {
                setGlobalSearch(event.target.value);
                setSearchOpen(true);
                loadSearchIndex();
              }}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && suggestions[0]) goToSuggestion(suggestions[0]);
                if (event.key === 'Escape') setSearchOpen(false);
              }}
              placeholder="Search customers, accounts, transactions..."
              className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
            />
            {searchOpen && globalSearch.trim() && (
              <div className="absolute left-0 top-full z-50 mt-2 max-h-96 w-[min(calc(100vw-2rem),26rem)] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl sm:right-0 sm:w-auto">
                {suggestions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No matching options found
                  </div>
                ) : (
                  suggestions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToSuggestion(item)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted sm:gap-3 sm:px-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 sm:h-9 sm:w-9">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {item.type}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 lg:gap-2 ml-auto">
          <span className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide sm:inline-flex ${
            portalSettings?.appMode === 'live'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
          }`}>
            {portalSettings?.appMode === 'live' ? 'Live Mode' : 'Test Mode'}
          </span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-muted text-foreground transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <Link
            to="/notifications"
            className="relative p-2 rounded-lg hover:bg-muted text-foreground transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 pl-2 lg:pl-3 ml-1 border-l border-border rounded-lg pr-2 py-1 transition-colors hover:bg-muted">
                <div className="w-9 h-9 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {profileImage ? (
                    <img src={profileImage} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-semibold text-foreground leading-tight">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{user?.role || 'viewer'}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <UserCircle className="h-4 w-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="border-t border-border/60 px-4 py-2 lg:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
            Viewing {selectedScope === 'month' ? 'month' : 'day'}:
            <span className="text-foreground">{selectedLabel}</span>
          </p>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={() => selectDay(formatDateKey(new Date()))}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Today
            </button>
            <button
              type="button"
              onClick={selectYesterday}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Yesterday
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => event.target.value && selectDay(event.target.value)}
              className="h-9 min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => selectMonth(event.target.value)}
              className="h-9 min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
