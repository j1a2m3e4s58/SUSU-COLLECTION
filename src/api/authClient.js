const API_ROOT = (import.meta.env.VITE_MAIL_API_URL || "/mail-api/api").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "susu_auth_user";

async function request(path, payload) {
  const token = getSessionToken();
  const response = await fetch(`${API_ROOT}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuthUser(user, sessionToken) {
  const value = { ...user, sessionToken };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearStoredAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getSessionToken() {
  return getStoredAuthUser()?.sessionToken || null;
}

export async function loginWithEmail(email, password) {
  const data = await request("/auth/login", { email, passwordHash: password });
  return storeAuthUser(data.user, data.sessionToken);
}

export async function registerWithEmail(payload) {
  return request("/auth/register", {
    ...payload,
    passwordHash: payload.password,
  });
}

export async function verifyEmail(email, code) {
  return request("/auth/verify-email", { email, code });
}

export async function resendVerification(email) {
  return request("/auth/resend-verification", { email });
}

export async function requestPasswordReset(email) {
  const resetPageUrl = `${window.location.origin}/reset-password`;
  return request("/auth/request-password-reset", { email, resetPageUrl });
}

export async function resetPassword(token, newPassword) {
  return request("/auth/password-reset", {
    token,
    newPasswordHash: newPassword,
  });
}

export async function logoutFromServer() {
  try {
    await request("/auth/logout", {});
  } finally {
    clearStoredAuthUser();
  }
}
