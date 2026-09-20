// Этот файл заменяет src/App.jsx.
// Убраны страницы Register / ForgotPassword / ResetPassword — они
// использовали email+пароль+Google, что нам больше не нужно.
// Добавлены /onboarding (имя + согласие с офертой при первом входе)
// и /profile (личный профиль, куда переехала юридическая информация).
// Админ-панель разделена на /  (Главная) и /orders (Заявки).
//
// ВАЖНО (производительность на слабых телефонах): все "тяжёлые" страницы
// подключены через React.lazy — их код скачивается и разбирается браузером
// только в момент реального перехода на эту страницу, а не сразу при входе
// на сайт. Login/RoleSelect/Onboarding оставлены обычными импортами —
// они маленькие и нужны сразу.

import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import RoleSelect from "@/pages/RoleSelect";
import Onboarding from "@/pages/Onboarding";
import Login from "@/pages/Login";

const RoleHome = lazy(() => import("@/pages/RoleHome"));
const MapPage = lazy(() => import("@/pages/MapPage"));
const AdminOrders = lazy(() => import("@/pages/AdminOrders"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const LeftoverDetail = lazy(() => import("@/pages/LeftoverDetail"));
const DriverBalance = lazy(() => import("@/pages/DriverBalance"));
const Kubovik = lazy(() => import("@/pages/Kubovik"));
const Profile = lazy(() => import("@/pages/Profile"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-4 border-neutral-200 border-t-neutral-800 rounded-full animate-spin"></div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/choose-role" element={<RoleSelect />} />
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute
              unauthenticatedElement={<Navigate to="/choose-role" replace />}
              skipOnboardingCheck
            />
          }
        >
          <Route path="/onboarding" element={<Onboarding />} />
        </Route>

        <Route
          element={
            <ProtectedRoute
              unauthenticatedElement={<Navigate to="/choose-role" replace />}
            />
          }
        >
          <Route element={<Layout />}>
            <Route path="/" element={<RoleHome />} />
            <Route path="/mapa" element={<MapPage />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/order/:id" element={<OrderDetail />} />
            <Route path="/leftover/:id" element={<LeftoverDetail />} />
            <Route path="/balance" element={<DriverBalance />} />
            <Route path="/kubovik" element={<Kubovik />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
