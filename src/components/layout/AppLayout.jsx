import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { WorkDateProvider } from '@/lib/WorkDateContext';
import { AgentScopeProvider } from '@/lib/AgentScopeContext';
import Sidebar, { navItems } from './Sidebar';
import Header from './Header';
import AgentScopePanel from '@/components/agents/AgentScopePanel';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, portalSettings } = useAuth();
  const location = useLocation();
  const isSusuAgent = String(user?.department || '').trim().toUpperCase() === 'SUSU AGENT';
  const mobileNavPaths = isSusuAgent
    ? ['/', '/field-collection', '/customers', '/transactions', '/directory', '/reports']
    : ['/', '/customers', '/transactions', '/directory', '/reports'];
  const bottomItems = navItems.filter((item) =>
    mobileNavPaths.includes(item.path) && (!item.agentOnly || isSusuAgent)
  );
  const mobileGridClass = bottomItems.length === 6 ? 'grid-cols-6' : 'grid-cols-5';
  const shortMobileLabel = (label) =>
    label
      .replace('Field Collection', 'Collect')
      .replace('Transactions', 'Trans')
      .replace('Dashboard', 'Home');

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} settings={portalSettings} />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkDateProvider>
          <AgentScopeProvider>
            <Header onMenuClick={() => setSidebarOpen(true)} user={user} />
            <main className="flex-1 p-4 pb-24 lg:p-6 max-w-full overflow-x-hidden">
              <div className="space-y-5">
                <AgentScopePanel />
                <Outlet />
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
