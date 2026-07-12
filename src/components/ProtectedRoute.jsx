import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function ProtectedRoute({ unauthenticatedElement = null }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return null;
  }

  return isAuthenticated ? <Outlet /> : unauthenticatedElement;
}
