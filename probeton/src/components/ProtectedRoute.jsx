import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement,
  skipOnboardingCheck = false,
}) {
  const { isAuthenticated, isLoadingAuth, authChecked, checkUserAuth, user } =
    useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  const needsOnboarding =
    user &&
    (!user.full_name ||
      !user.terms_accepted ||
      user.terms_version !== CURRENT_TERMS_VERSION);

  if (needsOnboarding && !skipOnboardingCheck && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
