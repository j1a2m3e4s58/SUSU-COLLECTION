import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, HandCoins, Users, Receipt, BarChart3,
  UserCog, Building2, ScrollText, UserCircle, Contact, SlidersHorizontal, UserX
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
  { label: 'Audit Log', path: '/audit-log', icon: ScrollText, managerOnly: true },
  { label: 'Profile', path: '/profile', icon: UserCircle },
];

export default function Sidebar({ isOpen, onClose, user, settings }) {
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
      const result = await unlockPortalControl(password.trim());
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
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 z-50 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/" onClick={onClose} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <HandCoins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-foreground text-sm leading-tight">{settings?.shortBankName || 'Susu Collection'}</h1>
              <p className="text-[11px] text-muted-foreground">{settings?.portalName || 'SUSU Collection Portal'}</p>
            </div>
          </Link>
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  }`}>
                <Icon className="w-4 h-4 shrink-0" />
                {labelFor(item)}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">System Online</span>
          </div>
        </div>
      </aside>
      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[360px] rounded-xl p-5 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>Enter Portal Control Password</DialogTitle>
            <DialogDescription>
              Unlock SUSU system settings before making system-wide changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="portal-control-password">Password</Label>
            <Input
              id="portal-control-password"
              type="password"
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
            <Button type="button" className="w-full sm:w-auto" onClick={handleUnlock} disabled={unlocking || !password.trim()}>
              {unlocking ? "Unlocking..." : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
