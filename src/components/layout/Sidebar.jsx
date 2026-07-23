import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, HandCoins, Users, Receipt, BarChart3,
  UserCog, Building2, ScrollText, UserCircle, Contact, SlidersHorizontal, UserX,
  ChevronLeft, PanelLeftClose, PanelLeftOpen, ShieldCheck, UserRoundCog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setStoredPortalAuthorization, unlockPortalControl } from '@/api/portalClient';
import { canManageCustomers as canManageCustomerRecords, isOwnerAdmin, isSusuAgent as isAgentUser } from '@/lib/roles';

export const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Field Collection', path: '/field-collection', icon: HandCoins, agentOnly: true },
  { label: 'Customers', path: '/customers', icon: Users, customerManagerOnly: true },
  { label: 'Directory', path: '/directory', icon: Contact },
  { label: 'Transactions', path: '/transactions', icon: Receipt },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'Agents', path: '/agents', icon: UserCog, agentManagerOnly: true },
  { label: 'Branches', path: '/branches', icon: Building2, managerOnly: true },
  { label: 'Past Staff', path: '/past-staff', icon: UserX, ownerOnly: true },
  { label: 'Portal Control', path: '/portal-control', icon: SlidersHorizontal, portalControl: true, ownerOnly: true },
  { label: 'Owner Operations', path: '/owner-operations', icon: ShieldCheck, ownerOnly: true },
  { label: 'Account Status', path: '/account-status', icon: UserRoundCog, ownerOnly: true },
  { label: 'Audit Log', path: '/audit-log', icon: ScrollText, managerOnly: true },
  { label: 'Profile', path: '/profile', icon: UserCircle },
];

export default function Sidebar({ isOpen, onClose, user, settings, collapsed = true, onToggleCollapsed, connectionStatus = 'checking' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const canManagePortal = isOwnerAdmin(user);
  const canOwnerControl = isOwnerAdmin(user);
  const canSupervise =
    canManagePortal ||
    (user?.role === 'Supervisor' && Array.isArray(user?.managedBranches) && user.managedBranches.length > 0);
  const isSusuAgent = isAgentUser(user);
  const canManageCustomers = canManageCustomerRecords(user);
  const canManageAgents = canManageCustomers;
  const connection = {
    online: { label: 'System Online', dot: 'bg-emerald-500' },
    reconnecting: { label: 'Reconnecting', dot: 'bg-amber-500 animate-pulse' },
    offline: { label: 'System Offline', dot: 'bg-red-500' },
    checking: { label: 'Checking System', dot: 'bg-slate-400 animate-pulse' },
  }[connectionStatus] || { label: 'Checking System', dot: 'bg-slate-400 animate-pulse' };

  const labelFor = (item) => {
    if (item.path === '/') return settings?.dashboardLabel || item.label;
    if (item.path === '/profile') return settings?.profileLabel || item.label;
    return item.label;
  };

  const handlePortalControl = (event) => {
    event.preventDefault();
    setPassword("");
    setUnlockError("");
    setUnlockOpen(true);
  };

  const handleUnlock = async () => {
    setUnlocking(true);
    setUnlockError("");
    try {
      const result = await unlockPortalControl(password);
      setStoredPortalAuthorization(result.authorizationToken);
      setUnlockOpen(false);
      onClose?.();
      navigate('/portal-control');
    } catch (err) {
      setUnlockError(err.message || 'Portal control password is incorrect.');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-300 ease-out lg:sticky ${collapsed ? 'lg:w-20' : 'lg:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute -right-4 top-[4.5rem] z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-foreground shadow-lg outline-none transition-[background-color,color,border-color,transform] hover:scale-105 hover:border-blue-500 hover:bg-blue-600 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <div className={`${collapsed ? 'lg:px-3' : 'lg:px-5'} flex items-center border-b border-sidebar-border p-5 transition-[padding] duration-300`}>
          <Link to="/" onClick={onClose} className={`flex items-center gap-3 ${collapsed ? 'lg:flex-1 lg:justify-center' : ''}`} title={collapsed ? (settings?.portalName || 'SUSU Collection Portal') : undefined}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <HandCoins className="w-5 h-5 text-white" />
            </div>
            <div className={collapsed ? 'lg:hidden' : ''}>
              <h1 className="font-heading font-bold text-foreground text-sm leading-tight">{settings?.shortBankName || 'Susu Collection'}</h1>
              <p className="text-[11px] text-muted-foreground">{settings?.portalName || 'SUSU Collection Portal'}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border text-foreground transition-colors hover:bg-sidebar-accent lg:hidden"
            aria-label="Close navigation"
            title="Close navigation"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.filter((item) => {
            if (item.managerOnly && !canManagePortal) return false;
            if (item.agentManagerOnly && !canManageAgents) return false;
            if (item.ownerOnly && !canOwnerControl) return false;
            if (item.customerManagerOnly && !canManageCustomers) return false;
            if (item.supervisorOnly && !canSupervise) return false;
            if (item.agentOnly && !isSusuAgent) return false;
            return true;
          }).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={item.portalControl ? handlePortalControl : onClose}
                title={collapsed ? labelFor(item) : undefined}
                aria-label={labelFor(item)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  }`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className={collapsed ? 'lg:hidden' : ''}>{labelFor(item)}</span>
              </Link>
            );
          })}
        </nav>
        <div className={`${collapsed ? 'lg:px-2' : ''} p-4 border-t border-sidebar-border`}>
          <div className={`flex items-center gap-2 px-2 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`} title={connection.label} aria-live="polite">
            <div className={`h-2 w-2 rounded-full ${connection.dot}`} />
            <span className={`text-xs text-muted-foreground ${collapsed ? 'lg:hidden' : ''}`}>{connection.label}</span>
          </div>
        </div>
      </aside>
      <Dialog open={unlockOpen} onOpenChange={(open) => {
        setUnlockOpen(open);
        if (!open) {
          setPassword("");
          setUnlockError("");
        }
      }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[360px] rounded-xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>Open Portal Control</DialogTitle>
            <DialogDescription>
              Enter the Portal Control password to open system-wide settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="portal-control-password">Portal Control Password</Label>
            <Input
              id="portal-control-password"
              type="password"
              autoComplete="off"
              placeholder="Enter Portal Control password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleUnlock();
              }}
              autoFocus
            />
            {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setUnlockOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleUnlock}
              disabled={unlocking || !password}
            >
              {unlocking ? "Opening..." : "Open Portal Control"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
