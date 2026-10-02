import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import PendingScreen from "@/components/PendingScreen";
import { needsVehicleInfo } from "@/lib/equipment";

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const approvedKey = (phone) => `probeton_was_approved_${phone}`;
const wasApprovedBefore = (phone) => {
  try {
    return !!localStorage.getItem(approvedKey(phone));
  } catch {
    return false;
  }
};

export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement,
  skipOnboardingCheck = false,
}) {
  const { isAuthenticated, isLoadingAuth, authChecked, checkUserAuth, user } =
    useAuth();
  const location = useLocation();

  // ВАЖНО: все хуки должны вызываться всегда, в одном и том же порядке,
  // до любых условных return — иначе React падает с ошибкой #310.
  // Поэтому и needsApproval, и оба useEffect стоят здесь, до проверок ниже.
  const needsApproval =
    !!user && user.role !== "admin" && user.approval_status !== "approved";

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  useEffect(() => {
    if (!needsApproval) return;
    const interval = setInterval(() => checkUserAuth(), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsApproval]);

  if (user?.phone && user.approval_status === "approved") {
    try {
      localStorage.setItem(approvedKey(user.phone), "1");
    } catch {
      // приватный режим — не страшно
    }
  }

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  const needsOnboarding =
    user &&
    (!user.full_name ||
      needsVehicleInfo(user) ||
      !user.terms_accepted ||
      user.terms_version !== CURRENT_TERMS_VERSION);

  if (needsOnboarding && !skipOnboardingCheck && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (needsApproval && !skipOnboardingCheck) {
    // «Повторное одобрение» — только если этот номер уже был одобрен
    // раньше на этом телефоне; новичку показываем обычный текст.
    return (
      <PendingScreen
        status={user.approval_status}
        reapproval={wasApprovedBefore(user.phone)}
      />
    );
  }

  return <Outlet />;
}
