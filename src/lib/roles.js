const AGENT_DEPARTMENTS = new Set(['SUSU', 'SUSU AGENT', 'SUSU SUPERVISOR']);
const MANAGEMENT_ROLES = new Set(['OwnerAdmin', 'SuperAdmin', 'Supervisor']);

export function isSusuAgent(user) {
  const department = String(user?.department || '').trim().toUpperCase();
  const role = String(user?.role || '').trim();
  return AGENT_DEPARTMENTS.has(department) && !MANAGEMENT_ROLES.has(role);
}

export function isSusuStaff(user) {
  return AGENT_DEPARTMENTS.has(String(user?.department || '').trim().toUpperCase());
}

export function canManageCustomers(user) {
  return user?.role === 'OwnerAdmin' || user?.role === 'Supervisor';
}

export function isOwnerAdmin(user) {
  return user?.role === 'OwnerAdmin';
}
