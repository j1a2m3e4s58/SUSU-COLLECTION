import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuthUser,
  completeAgentSetup,
  getStoredAuthUser,
  loginAgentWithUsername,
  loginWithEmail,
  logoutFromServer,
  storeAuthUser,
} from "@/api/authClient";
import { getPortalSettings, logoutPresence, normalizeUser, pingPresence } from "@/api/portalClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [portalSettings, setPortalSettings] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);

  useEffect(() => {
    setUser(normalizeUser(getStoredAuthUser()));
    setIsLoadingAuth(false);
  }, []);

  const refreshPortalSettings = async () => {
    const settings = await getPortalSettings();
    setPortalSettings(settings);
    return settings;
  };

  useEffect(() => {
    refreshPortalSettings()
      .catch(() => {})
      .finally(() => setIsLoadingPublicSettings(false));
  }, []);

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
    const authUser = normalizeUser(await loginWithEmail(email, password));
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

  const updateUser = (nextUser) => {
    const normalized = normalizeUser(nextUser);
    setUser((current) => {
      const sessionToken = current?.sessionToken || normalized?.sessionToken;
      return sessionToken ? storeAuthUser(normalized, sessionToken) : normalized;
    });
  };

  const value = useMemo(
    () => ({
      user,
      portalSettings,
      isAuthenticated: !!user,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError: null,
      appPublicSettings: portalSettings,
      authChecked: !isLoadingAuth,
      refreshPortalSettings,
      login,
      loginAgent,
      completeAgentFirstLogin,
      logout,
      setUser,
      updateUser,
      checkUserAuth: async () => {},
      checkAppState: async () => {},
      navigateToLogin: () => {
        window.location.href = "/login";
      },
    }),
    [user, portalSettings, isLoadingAuth, isLoadingPublicSettings],
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
