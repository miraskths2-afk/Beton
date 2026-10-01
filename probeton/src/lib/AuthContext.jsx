// Этот файл заменяет src/lib/AuthContext.jsx.
// Логика упрощена под вход по номеру телефона (без email/пароля/Google).

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { base44 } from "@/api/base44Client";

const AuthContext = createContext();

const VIEW_MODE_KEY = "admin_view_mode";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [viewMode, setViewModeState] = useState(
    () => localStorage.getItem(VIEW_MODE_KEY) || "admin"
  );

  const setViewMode = (mode) => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    setViewModeState(mode);
  };

  // Полноэкранная «загрузка» нужна только при самой первой проверке.
  // Повторные проверки (после сохранения профиля, опрос экрана ожидания)
  // идут тихо: раньше они на секунду убирали весь сайт со страницы, из-за
  // чего водитель на линии «выпадал» с карты, а экран ожидания мигал.
  const firstCheckDone = useRef(false);

  const checkUserAuth = useCallback(async () => {
    if (!firstCheckDone.current) setIsLoadingAuth(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      firstCheckDone.current = true;
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = async () => {
    await base44.auth.logout();
    localStorage.removeItem("probeton_role");
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/choose-role";
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError: null,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
