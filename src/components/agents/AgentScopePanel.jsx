import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Receipt, Users, UserCheck, X } from 'lucide-react';
import { useAgentScope } from '@/lib/AgentScopeContext';
import { useAuth } from '@/lib/AuthContext';

function groupBy(items, getter) {
  return items.reduce((map, item) => {
    const key = getter(item) || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

export default function AgentScopePanel() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    canUseAgentScope,
    loadingAgents,
    agents,
    supervisors,
    selectedAgent,
    selectedAgentId,
    selectAgent,
    clearAgent,
  } = useAgentScope();

  if (!canUseAgentScope) return null;

  const branchGroups = Array.from(groupBy(agents, (agent) => agent.branch || agent.branch_name).entries());
  const supervisorGroups = Array.from(groupBy(supervisors, (supervisor) => supervisor.branch || supervisor.branch_name).entries());

  const handleSelect = (agentId) => {
    selectAgent(agentId);
    if (location.pathname === '/') return;
    navigate('/');
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
            {user?.role === 'OwnerAdmin' ? 'Owner agent access' : 'Supervisor agent access'}
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <UserCheck className="h-5 w-5 text-blue-500" />
            Select SUSU Agent
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an agent to view that agent&apos;s dashboard, customers, transactions, and reports.
          </p>
        </div>
        {selectedAgent && (
          <div className="flex flex-wrap gap-2">
            <Link to="/" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
              <BarChart3 className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <Link to="/customers" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
              <Users className="h-3.5 w-3.5" /> Customers
            </Link>
            <Link to="/transactions" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
              <Receipt className="h-3.5 w-3.5" /> Transactions
            </Link>
            <Link to="/reports" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
              <BarChart3 className="h-3.5 w-3.5" /> Reports
            </Link>
            <button type="button" onClick={clearAgent} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}
      </div>

      {selectedAgent && (
        <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-600">
          Viewing records for <span className="font-semibold">{selectedAgent.fullname || selectedAgent.full_name}</span>
          <span className="text-blue-600/80"> - {selectedAgent.branch || selectedAgent.branch_name || 'No branch'}</span>
        </div>
      )}

      {loadingAgents ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/50" />)}
        </div>
      ) : agents.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-background/50 p-4 text-sm text-muted-foreground">
          No SUSU agents are available in your assigned branch scope.
        </div>
      ) : user?.role === 'OwnerAdmin' ? (
        <div className="mt-4 space-y-4">
          {branchGroups.map(([branch, branchAgents]) => {
            const branchSupervisors = supervisorGroups.find(([item]) => item === branch)?.[1] || [];
            return (
              <div key={branch} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{branch}</h3>
                  <p className="text-xs text-muted-foreground">
                    Supervisors: {branchSupervisors.length ? branchSupervisors.map((item) => item.fullname).join(', ') : 'None assigned'}
                  </p>
                </div>
                <AgentButtonGrid agents={branchAgents} selectedAgentId={selectedAgentId} onSelect={handleSelect} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <AgentButtonGrid agents={agents} selectedAgentId={selectedAgentId} onSelect={handleSelect} />
        </div>
      )}
    </section>
  );
}

function AgentButtonGrid({ agents, selectedAgentId, onSelect }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {agents.map((agent) => {
        const active = String(agent.id) === String(selectedAgentId);
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelect(agent.id)}
            className={`min-w-0 rounded-lg border px-3 py-2 text-left transition-colors ${
              active ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <span className="block truncate text-sm font-semibold">{agent.fullname || agent.full_name}</span>
            <span className={`block truncate text-xs ${active ? 'text-white/80' : 'text-muted-foreground'}`}>
              {agent.branch || agent.branch_name || 'No branch'} - {agent.email}
            </span>
          </button>
        );
      })}
    </div>
  );
}
