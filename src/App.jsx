// Этот файл заменяет src/App.jsx.
// Убраны страницы Register / ForgotPassword / ResetPassword — они
// использовали email+пароль+Google, что нам больше не нужно.

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
import Home from "@/pages/Home";
import MapPage from "@/pages/MapPage";
import Admin from "@/pages/Admin";
import Plant from "@/pages/Plant";
import RoleSelect from "@/pages/RoleSelect";
import RoleHome from "@/pages/RoleHome";
import DriverBalance from "@/pages/DriverBalance";
import Kubovik from "@/pages/Kubovik";
import Legal from "@/pages/Legal";
import BlacklistPage from "@/pages/BlacklistPage";
import Login from "@/pages/Login";

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
    <Routes>
      <Route path="/choose-role" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
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
          <Route path="/admin" element={<Admin />} />
          <Route path="/zavod" element={<Plant />} />
          <Route path="/balance" element={<DriverBalance />} />
          <Route path="/kubovik" element={<Kubovik />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/blacklist" element={<BlacklistPage />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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
