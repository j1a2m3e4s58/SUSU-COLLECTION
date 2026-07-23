import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { WorkDateProvider } from '@/lib/WorkDateContext';
import { AgentScopeProvider } from '@/lib/AgentScopeContext';
import Sidebar, { navItems } from './Sidebar';
import Header from './Header';
import AgentScopePanel from '@/components/agents/AgentScopePanel';
import { canManageCustomers as canManageCustomerRecords, isSusuAgent as isAgentUser } from '@/lib/roles';
import { getHealthStatus } from '@/api/portalClient';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('susu_sidebar_collapsed');
    return stored === null ? true : stored === 'true';
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const { user, portalSettings } = useAuth();
  const location = useLocation();
  const isSusuAgent = isAgentUser(user);
  const canManageCustomers = canManageCustomerRecords(user);
  const mobileNavPaths = isSusuAgent
    ? ['/', '/field-collection', '/transactions', '/directory', '/reports']
    : ['/', '/customers', '/agents', '/transactions', '/directory', '/reports'];
  const bottomItems = navItems.filter((item) =>
    mobileNavPaths.includes(item.path) &&
    (!item.agentOnly || isSusuAgent) &&
    (!item.customerManagerOnly || canManageCustomers)
  );
  const mobileGridClass = bottomItems.length === 6 ? 'grid-cols-6' : 'grid-cols-5';
  const shortMobileLabel = (label) =>
    label
      .replace('Field Collection', 'Collect')
      .replace('Transactions', 'Trans')
      .replace('Dashboard', 'Home')
      .replace('Agents', 'Agents');

  useEffect(() => {
    window.localStorage.setItem('susu_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let mounted = true;
    let failedChecks = 0;

    const checkConnection = async () => {
      if (!navigator.onLine) {
        failedChecks += 1;
        if (mounted) setConnectionStatus('offline');
        return;
      }
      try {
        await getHealthStatus();
        failedChecks = 0;
        if (mounted) setConnectionStatus('online');
      } catch {
        failedChecks += 1;
        if (mounted) setConnectionStatus(failedChecks >= 2 ? 'offline' : 'reconnecting');
      }
    };

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 15000);
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        settings={portalSettings}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        connectionStatus={connectionStatus}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkDateProvider>
          <AgentScopeProvider>
            <Header onMenuClick={() => setSidebarOpen(true)} user={user} />
            <main className="flex-1 p-4 pb-24 lg:p-6 max-w-full overflow-x-hidden">
              <div className="space-y-5">
                <AgentScopePanel />
                <Outlet />
                <footer
                  className="border-t border-border/70 pt-4 text-center text-xs text-muted-foreground lg:text-right"
                  aria-label="Site creator"
                >
                  Site created by <span className="font-semibold text-foreground">James Lincoln Awuah</span>
                </footer>
              </div>
            </main>
          </AgentScopeProvider>
        </WorkDateProvider>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 py-2 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className={`grid ${mobileGridClass} gap-1`}>
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-medium transition-colors ${
                    active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="max-w-full truncate">{shortMobileLabel(item.label)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
