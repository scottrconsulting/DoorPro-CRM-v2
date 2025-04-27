import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  email: string;
  fullName: string;
  isAdmin?: boolean;
}

export function useAuth() {
  const [_, setLocation] = useLocation();

  // Fetch the current authenticated user
  const { data, isLoading, error } = useQuery<{authenticated: boolean; user?: User}>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // refresh session every 5 minutes
  });

  const isAuthenticated = data?.authenticated || false;
  const user = data?.user || null;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Force reload after redirect to ensure clean state
      window.location.href = '/';
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/auth/register", userData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setLocation("/login");
    },
  });

  // Upgrade to Pro mutation
  const upgradeToProMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users/upgrade", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const login = (credentials: LoginCredentials) => {
    loginMutation.mutate(credentials);
  };

  const register = (userData: RegisterData) => {
    registerMutation.mutate(userData);
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const upgradeToPro = () => {
    upgradeToProMutation.mutate();
  };

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    register,
    logout,
    upgradeToPro,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isUpgradePending: upgradeToProMutation.isPending,
  };
}