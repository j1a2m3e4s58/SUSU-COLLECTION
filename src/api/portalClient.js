
// @ts-ignore Vite injects import.meta.env at build time.
const API_ROOT = (import.meta.env.VITE_MAIL_API_URL || "/mail-api/api").replace(/\/$/, "");
export const PORTAL_CONTROL_AUTHORIZATION_KEY = "susu.portalAuthorization";

export function getStoredPortalAuthorization() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(PORTAL_CONTROL_AUTHORIZATION_KEY) || "";
}

export function setStoredPortalAuthorization(token) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(PORTAL_CONTROL_AUTHORIZATION_KEY, token);
  else window.sessionStorage.removeItem(PORTAL_CONTROL_AUTHORIZATION_KEY);
}

/**
 * @param {string} path
 * @param {{method?: string, body?: any}} [options]
 */
async function apiRequest(path, options = {}) {
  const { method = "GET", body } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 428 && data.code === "REAUTHENTICATION_REQUIRED" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("portal-reauth-required"));
    }
    if (response.status === 403 && /Portal Control authorization expired/i.test(data.error || "")) {
      setStoredPortalAuthorization("");
    }
    if (response.status === 401 && /session|unauthorized/i.test(data.error || "")) {
      localStorage.removeItem("susu_auth_user");
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    full_name: user.full_name || user.fullname || "User",
    fullname: user.fullname || user.full_name || "User",
    branch_name: user.branch_name || user.branch || "",
    branch: user.branch || user.branch_name || "",
    department: user.department || "",
    role: user.role || "GeneralStaff",
    managedBranches: user.managedBranches || [],
    managedDepartmentsByBranch: user.managedDepartmentsByBranch || {},
    permissions: user.permissions || {},
  };
}

export function resolveAssetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const value = String(path).replace(/^\/+/, "");
  if (value.startsWith("LOCAL:")) {
    const filename = value.replace(/^LOCAL:/, "").trim();
    return filename ? `${API_ROOT.replace(/\/api$/, "")}/uploads/${filename}` : "";
  }
  if (value.startsWith("profile_pics/") || value.startsWith("assets/")) {
    return `/${value}`;
  }
  return `${API_ROOT.replace(/\/api$/, "")}/uploads/${value}`;
}

export function staffInManagerScope(manager, staffMember) {
  if (!manager || !staffMember) return false;
  if (manager.role === "OwnerAdmin") return true;
  if (manager.role !== "Supervisor") return manager.id === staffMember.id;
  const branch = staffMember.branch || staffMember.branch_name || "";
  const managedBranches = manager.managedBranches || [];
  return managedBranches.includes("ALL") || managedBranches.includes(branch);
}

export async function getPortalSettings() {
  const data = await apiRequest("/portal-settings");
  return data.settings;
}

export async function updatePortalSettings(settings, portalAuthorization = getStoredPortalAuthorization()) {
  const data = await apiRequest("/portal-settings", {
    method: "POST",
    body: {
      ...settings,
      portalAuthorization,
    },
  });
  return data.settings;
}

export async function normalizeLegacySusuDepartments(backupConfirmed = false, portalAuthorization = getStoredPortalAuthorization()) {
  return apiRequest("/maintenance/normalize-susu-departments", {
    method: "POST",
    body: { backupConfirmed, portalAuthorization },
  });
}

export async function unlockPortalControl(password) {
  return apiRequest("/portal-settings/unlock", {
    method: "POST",
    body: { password },
  });
}

export async function getProductionStatus() {
  return apiRequest("/production-status");
}

export async function getActiveStaff() {
  const data = await apiRequest("/staff/active");
  return (data.users || []).map(normalizeUser);
}

export async function getArchivedStaff() {
  const data = await apiRequest("/staff/archived");
  return (data.users || []).map(normalizeUser);
}

export async function getStaffStats() {
  const data = await apiRequest("/staff/stats");
  return data.stats || data;
}

export async function getUserProfile(userId) {
  const data = await apiRequest(`/users/${userId}`);
  return normalizeUser(data.user);
}

export async function updateUserProfile(userId, payload) {
  const data = await apiRequest(`/users/${userId}/profile`, {
    method: "POST",
    body: payload,
  });
  return normalizeUser(data.user || data.ok);
}

export async function updateStaff(userId, payload) {
  const data = await apiRequest(`/staff/${userId}/update`, {
    method: "POST",
    body: payload,
  });
  return normalizeUser(data.user || data.ok);
}

export async function createAgentAccount(payload) {
  const data = await apiRequest("/agents/create", {
    method: "POST",
    body: payload,
  });
  return normalizeUser(data.user);
}

export async function resetAgentPassword(userId, temporaryPassword, temporaryUsername = "") {
  const data = await apiRequest(`/agents/${userId}/reset-password`, {
    method: "POST",
    body: { temporaryPassword, temporaryUsername },
  });
  return normalizeUser(data.user);
}

export async function resetStaffEmailLogin(userId, newPassword) {
  const data = await apiRequest(`/staff/${userId}/reset-email-login`, {
    method: "POST",
    body: { newPassword },
  });
  return normalizeUser(data.user);
}

export async function deleteStaff(userId, backupConfirmed = false) {
  return apiRequest(`/staff/${userId}/delete`, {
    method: "POST",
    body: { backupConfirmed },
  });
}

export async function archiveStaff(userId) {
  return apiRequest(`/staff/${userId}/archive`, {
    method: "POST",
    body: {},
  });
}

export async function restoreStaff(userId) {
  return apiRequest(`/staff/${userId}/restore`, {
    method: "POST",
    body: {},
  });
}

export async function getCustomers() {
  const data = await apiRequest("/customers");
  return data.customers || [];
}

export async function createCustomer(payload) {
  const data = await apiRequest("/customers", {
    method: "POST",
    body: payload,
  });
  return data.customer;
}

export async function importCustomers(payload) {
  if (payload?.file) {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("branch", payload.branch || "");
    form.append("preview", payload.preview ? "true" : "false");
    return apiRequest("/customers/import", { method: "POST", body: form });
  }
  return apiRequest("/customers/import", {
    method: "POST",
    body: payload,
  });
}

export async function getCustomerImports() {
  const data = await apiRequest("/customers/imports");
  return data.imports || [];
}

export async function updateCustomer(customerId, payload) {
  const data = await apiRequest(`/customers/${customerId}`, {
    method: "POST",
    body: payload,
  });
  return data.customer;
}

export async function getCollections() {
  const data = await apiRequest("/collections");
  return data.collections || [];
}

export async function createCollection(payload) {
  const data = await apiRequest("/collections", {
    method: "POST",
    body: payload,
  });
  return data.collection;
}

export async function updateCollectionReview(collectionId, payload) {
  const data = await apiRequest(`/collections/${collectionId}/review`, {
    method: "POST",
    body: payload,
  });
  return data.collection;
}

export async function getAuditLogs() {
  const data = await apiRequest("/audit-logs");
  return data.logs || [];
}

export async function createAuditLog(payload) {
  const data = await apiRequest("/audit-logs", {
    method: "POST",
    body: payload,
  });
  return data.log;
}

export async function deleteAuditLog(itemId, backupConfirmed = false) {
  return apiRequest(`/audit-logs/${itemId}/delete`, {
    method: "POST",
    body: { backupConfirmed },
  });
}

export async function deleteAuditLogs(itemIds, backupConfirmed = false) {
  return apiRequest("/audit-logs/delete", {
    method: "POST",
    body: { ids: itemIds, backupConfirmed },
  });
}

export async function exportBackup() {
  const response = await fetch(`${API_ROOT}/backup/export`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Backup export failed");
  }
  return {
    data,
    filename: response.headers.get("X-Backup-Filename") || "bawjiase-portal-backup.json",
  };
}

export async function importBackup(payload, portalAuthorization = getStoredPortalAuthorization()) {
  return apiRequest("/backup/import", {
    method: "POST",
    body: {
      ...payload,
      portalAuthorization,
    },
  });
}

export async function clearTestData() {
  return apiRequest("/maintenance/clear-test-data", {
    method: "POST",
    body: { backupConfirmed: true },
  });
}

export async function seedTestCustomers() {
  return apiRequest("/maintenance/seed-test-customers", {
    method: "POST",
    body: {},
  });
}

export async function removeTestCustomers() {
  return apiRequest("/maintenance/remove-test-customers", {
    method: "POST",
    body: {},
  });
}

export async function getDailyCloseStatus(date, agentId) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (agentId) params.set("agentId", agentId);
  const data = await apiRequest(`/daily-close?${params.toString()}`);
  return data;
}

export async function closeDailyCollections(date) {
  const data = await apiRequest("/daily-close", {
    method: "POST",
    body: { date },
  });
  return data.close;
}

export async function reopenDailyCollections(date, agentId) {
  return apiRequest("/daily-close/reopen", {
    method: "POST",
    body: { date, agentId },
  });
}

export async function getNotifications() {
  const data = await apiRequest("/notifications");
  return data.notifications || [];
}

export async function getUnreadNotificationCount() {
  const data = await apiRequest("/notifications/unread-count");
  return Number(data.count || 0);
}

export async function markNotificationRead(itemId) {
  return apiRequest(`/notifications/${itemId}/read`, {
    method: "POST",
    body: {},
  });
}

export async function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", {
    method: "POST",
    body: {},
  });
}

export async function deleteNotification(itemId) {
  return apiRequest(`/notifications/${itemId}/delete`, {
    method: "POST",
    body: {},
  });
}

export async function pingPresence(userId) {
  if (!userId) return null;
  return apiRequest("/presence/ping", {
    method: "POST",
    body: { userId },
  });
}

export async function logoutPresence(userId) {
  if (!userId) return null;
  return apiRequest("/presence/logout", {
    method: "POST",
    body: { userId },
  });
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_ROOT}/uploads/profile-photo`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Upload failed");
  }
  return data;
}
