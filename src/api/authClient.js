import { emitNetworkState, isRetryableFailure, retryDelay, wait } from "@/api/requestUtils";

// @ts-ignore Vite injects import.meta.env at build time.
const API_ROOT = (import.meta.env.VITE_MAIL_API_URL || "/mail-api/api").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "susu_auth_user";

async function request(path, payload, { retries = 0 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_ROOT}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (attempt > 0) emitNetworkState("recovered");
        return data;
      }
      const error = new Error(data.error || "Request failed");
      error.status = response.status;
      error.code = data.code;
      if (attempt < retries && isRetryableFailure(error)) {
        emitNetworkState("retrying", { attempt: attempt + 1 });
        await wait(retryDelay(attempt));
        continue;
      }
      if (isRetryableFailure(error)) emitNetworkState("unavailable");
      error.networkStateEmitted = true;
      throw error;
    } catch (error) {
      if (error?.networkStateEmitted) throw error;
      if (attempt < retries && isRetryableFailure(error)) {
        emitNetworkState("retrying", { attempt: attempt + 1 });
        await wait(retryDelay(attempt));
        continue;
      }
      if (isRetryableFailure(error)) emitNetworkState("unavailable");
      throw error;
    }
  }
  throw new Error("Request failed");
}

export function getStoredAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuthUser(user) {
  const value = { ...user };
  delete value.sessionToken;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function clearStoredAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getSessionToken() {
  return null;
}

export async function loginWithEmail(email, password) {
  const data = await request("/auth/login", { email, passwordHash: password });
  if (data.requiresMfa) return data;
  return storeAuthUser(data.user);
}

export async function verifyPrivilegedMfa(challengeId, code, trustDevice = true) {
  const data = await request("/auth/privileged-mfa/verify", { challengeId, code, trustDevice });
  return storeAuthUser(data.user);
}

export async function loginAgentWithUsername(username, password) {
  const data = await request("/auth/agent-login", { username, passwordHash: password });
  if (data.requiresSetup) return data;
  return storeAuthUser(data.user);
}

export async function verifyAgentSetupPhone(payload) {
  return request("/auth/agent-verify-phone", {
    username: payload.username,
    temporaryPassword: payload.temporaryPassword,
    phone: payload.phone,
  });
}

export async function verifyAgentSetupToken(payload) {
  return request("/auth/agent-verify-token", {
    username: payload.username,
    phone: payload.phone,
    token: payload.token,
  });
}

export async function completeAgentSetup(payload) {
  const data = await request("/auth/agent-complete-setup", {
    username: payload.username,
    temporaryPassword: payload.temporaryPassword,
    newUsername: payload.newUsername,
    phone: payload.phone,
    token: payload.token,
    newPasswordHash: payload.newPassword,
  });
  return storeAuthUser(data.user);
}

export async function getCurrentUser() {
  const data = await request("/auth/me", {}, { retries: 2 });
  return storeAuthUser(data.user);
}

export async function reauthenticate(password) {
  return request("/auth/reauthenticate", { password });
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
  return request("/auth/request-password-reset", { email });
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

export async function forgetTrustedDevice() {
  return request("/auth/trusted-device/forget", {});
}

export async function revokeAllSessions() {
  try {
    return await request("/auth/sessions/revoke-all", {});
  } finally {
    clearStoredAuthUser();
  }
}

