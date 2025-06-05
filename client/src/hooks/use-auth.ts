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
    retry: (failureCount, error) => {
      // Don't retry 401 errors, but retry network errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: false, // Disable to prevent auth loops
    refetchInterval: false, // Disable auto-refresh to prevent conflicts
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
  });

  const isAuthenticated = data?.authenticated || false;
  const user = data?.user || null;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Clear any existing tokens that might conflict
      localStorage.removeItem('doorpro_auth_token');
      // Invalidate and refetch auth state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Small delay to ensure session is established before redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    },
    onError: (error) => {
      console.error('Login error:', error);
    }
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

  // Simplified logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      return res.json();
    },
    onSuccess: () => {
      // Clear all token-based auth
      localStorage.removeItem('doorpro_auth_token');
      // Reset query cache
      queryClient.clear();
      // Redirect to login page
      window.location.href = '/login';
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