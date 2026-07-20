import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getActiveStaff } from '@/api/portalClient';
import { useAuth } from '@/lib/AuthContext';
import { isSusuAgent } from '@/lib/roles';

const AgentScopeContext = createContext(null);
const STORAGE_KEY = 'susu.selectedAgentId';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function isBranchAllowed(user, branch) {
  if (user?.role === 'OwnerAdmin') return true;
  if (user?.role !== 'Supervisor') return false;
  const assigned = Array.isArray(user.managedBranches) && user.managedBranches.length
    ? user.managedBranches
    : [user.branch].filter(Boolean);
  const branches = assigned.map(normalize);
  return branches.includes('ALL') || branches.includes(normalize(branch));
}

export function AgentScopeProvider({ children }) {
  const { user } = useAuth();
  const canUseAgentScope = user?.role === 'OwnerAdmin' || user?.role === 'Supervisor';
  const [staff, setStaff] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(STORAGE_KEY) || '';
  });
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    if (!canUseAgentScope) {
      setStaff([]);
      return;
    }
    let mounted = true;
    setLoadingAgents(true);
    getActiveStaff()
      .then((items) => {
        if (mounted) setStaff(items || []);
      })
      .catch(() => {
        if (mounted) setStaff([]);
      })
      .finally(() => {
        if (mounted) setLoadingAgents(false);
      });
    return () => {
      mounted = false;
    };
  }, [canUseAgentScope]);

  const agents = useMemo(
    () => staff.filter((member) => isSusuAgent(member) && isBranchAllowed(user, member.branch || member.branch_name)),
    [staff, user],
  );

  const supervisors = useMemo(
    () => staff.filter((member) => member.role === 'Supervisor' && isBranchAllowed(user, member.branch || member.branch_name)),
    [staff, user],
  );

  const selectedAgent = useMemo(
    () => agents.find((agent) => String(agent.id) === String(selectedAgentId)) || null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    if (!selectedAgentId) return;
    if (!agents.length) return;
    if (!selectedAgent) {
      setSelectedAgentId('');
      if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [agents, selectedAgent, selectedAgentId]);

  const selectAgent = useCallback((agentId) => {
    setSelectedAgentId(agentId);
    if (typeof window !== 'undefined') {
      if (agentId) window.localStorage.setItem(STORAGE_KEY, agentId);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const matchesSelectedAgent = useCallback((record) => {
    if (!canUseAgentScope || !selectedAgent) return true;
    const id = String(selectedAgent.id || '');
    const email = String(selectedAgent.email || '').trim().toLowerCase();
    const name = String(selectedAgent.fullname || selectedAgent.full_name || '').trim().toLowerCase();
    return (
      String(record?.agent_id || '') === id ||
      String(record?.createdById || '') === id ||
      String(record?.recordedById || '') === id ||
      String(record?.agent_email || '').trim().toLowerCase() === email ||
      String(record?.createdByEmail || '').trim().toLowerCase() === email ||
      String(record?.recordedByEmail || '').trim().toLowerCase() === email ||
      String(record?.agent_name || '').trim().toLowerCase() === name ||
      String(record?.createdBy || '').trim().toLowerCase() === name ||
      String(record?.recorded_by || '').trim().toLowerCase() === name
    );
  }, [canUseAgentScope, selectedAgent]);

  const value = useMemo(
    () => ({
      canUseAgentScope,
      loadingAgents,
      agents,
      supervisors,
      selectedAgent,
      selectedAgentId,
      selectAgent,
      clearAgent: () => selectAgent(''),
      matchesSelectedAgent,
    }),
    [agents, canUseAgentScope, loadingAgents, matchesSelectedAgent, selectAgent, selectedAgent, selectedAgentId, supervisors],
  );

  return <AgentScopeContext.Provider value={value}>{children}</AgentScopeContext.Provider>;
}

export function useAgentScope() {
  const value = useContext(AgentScopeContext);
  if (!value) {
    throw new Error('useAgentScope must be used within AgentScopeProvider');
  }
  return value;
}
