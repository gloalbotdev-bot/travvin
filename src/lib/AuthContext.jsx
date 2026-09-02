import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, ownApiBase } from '@/api/client';
import { appParams } from '@/lib/app-params';
import { getStoredToken } from '@/api/own/http.js';
import { exchangeAuthCodeFromUrlOnce } from '@/lib/authCodeExchange.js';

const AuthContext = createContext();

async function fetchOwnPublicSettings(token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${ownApiBase}/api/app/public-settings`, { headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      await exchangeAuthCodeFromUrlOnce();
      const token = getStoredToken() || appParams.token;

      try {
        const publicSettings = await fetchOwnPublicSettings(token);
        setAppPublicSettings(publicSettings);
        if (token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        handleAppError(appError);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred',
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const handleAppError = (appError) => {
    console.error('App state check failed:', appError);

    if (appError.status === 403 && appError.data?.extra_data?.reason) {
      const reason = appError.data.extra_data.reason;
      if (reason === 'auth_required') {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      } else if (reason === 'user_not_registered') {
        setAuthError({
          type: 'user_not_registered',
          message: 'User not registered for this app',
        });
      } else {
        setAuthError({
          type: reason,
          message: appError.message,
        });
      }
    } else {
      setAuthError({
        type: 'unknown',
        message: appError.message || 'Failed to load app',
      });
    }
    setIsLoadingPublicSettings(false);
    setIsLoadingAuth(false);
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      api.auth.logout(window.location.href);
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
