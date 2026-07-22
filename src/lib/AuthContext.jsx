import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthUser,
  completeAgentSetup,
  getCurrentUser,
  getStoredAuthUser,
  loginAgentWithUsername,
  loginWithEmail,
  logoutFromServer,
  revokeAllSessions,
  storeAuthUser,
  verifyPrivilegedMfa,
} from "@/api/authClient";
import { getPortalSettings, logoutPresence, normalizeUser, pingPresence } from "@/api/portalClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [portalSettings, setPortalSettings] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [bootstrapError, setBootstrapError] = useState(null);

  const loadBootstrap = useCallback(async () => {
    setIsLoadingAuth(true);
    setIsLoadingPublicSettings(true);
    setBootstrapError(null);
    const cached = normalizeUser(getStoredAuthUser());
    if (cached) setUser(cached);
    const [authResult, settingsResult] = await Promise.allSettled([
      getCurrentUser(),
      getPortalSettings(),
    ]);
    if (authResult.status === "fulfilled") {
      setUser(normalizeUser(authResult.value));
    } else if (authResult.reason?.status === 401) {
      clearStoredAuthUser();
      setUser(null);
    }
    if (settingsResult.status === "fulfilled") setPortalSettings(settingsResult.value);
    const transientFailure = [authResult, settingsResult].find((result) => result.status === "rejected" && result.reason?.status !== 401);
    if (transientFailure) setBootstrapError(transientFailure.reason);
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
  }, []);

  useEffect(() => { loadBootstrap(); }, [loadBootstrap]);

  const refreshPortalSettings = async () => {
    const settings = await getPortalSettings();
    setPortalSettings(settings);
    return settings;
  };

  useEffect(() => {
    if (!user?.id) return undefined;

    const ping = () => {
      if (document.visibilityState === "visible") {
        pingPresence(user.id).catch(() => {});
      }
    };

    ping();
    const intervalId = window.setInterval(ping, 10000);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [user?.id]);

  const login = async (email, password) => {
    const result = await loginWithEmail(email, password);
    if (result?.requiresMfa) return result;
    const authUser = normalizeUser(result);
    setUser(authUser);
    pingPresence(authUser.id).catch(() => {});
    return authUser;
  };

  const completePrivilegedLogin = async (challengeId, code, trustDevice = true) => {
    const authUser = normalizeUser(await verifyPrivilegedMfa(challengeId, code, trustDevice));
    setUser(authUser);
    pingPresence(authUser.id).catch(() => {});
    return authUser;
  };

  const loginAgent = async (username, password) => {
    const result = await loginAgentWithUsername(username, password);
    if (result?.requiresSetup) return result;
    const authUser = normalizeUser(result);
    setUser(authUser);
    pingPresence(authUser.id).catch(() => {});
    return authUser;
  };

  const completeAgentFirstLogin = async (payload) => {
    const authUser = normalizeUser(await completeAgentSetup(payload));
    setUser(authUser);
    pingPresence(authUser.id).catch(() => {});
    return authUser;
  };

  const logout = async () => {
    await logoutPresence(user?.id).catch(() => {});
    await logoutFromServer();
    clearStoredAuthUser();
    setUser(null);
  };

  const signOutEverywhere = async () => {
    await logoutPresence(user?.id).catch(() => {});
    await revokeAllSessions();
    clearStoredAuthUser();
    setUser(null);
  };

  const updateUser = (nextUser) => {
    const normalized = normalizeUser(nextUser);
    storeAuthUser(normalized);
    setUser(normalized);
  };

  const value = useMemo(
    () => ({
      user,
      portalSettings,
      isAuthenticated: !!user,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError: null,
      bootstrapError,
      retryBootstrap: loadBootstrap,
      appPublicSettings: portalSettings,
      authChecked: !isLoadingAuth,
      refreshPortalSettings,
      login,
      loginAgent,
      completeAgentFirstLogin,
      completePrivilegedLogin,
      logout,
      signOutEverywhere,
      setUser,
      updateUser,
      checkUserAuth: async () => {},
      checkAppState: async () => {},
      navigateToLogin: () => {
        window.location.href = "/login";
      },
    }),
    [user, portalSettings, isLoadingAuth, isLoadingPublicSettings, bootstrapError, loadBootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
