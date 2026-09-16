import React from "react";
import { useAuth } from "@/lib/AuthContext";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import DriverHome from "@/pages/DriverHome";

export default function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "admin") return <Admin />;
  if (user?.account_type === "driver") return <DriverHome />;
  return <Home />;
}
