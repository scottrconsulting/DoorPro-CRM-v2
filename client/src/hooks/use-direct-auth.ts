import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Token is stored in localStorage to persist across browser sessions
const TOKEN_KEY = 'doorpro_auth_token';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export function useDirectAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for token on component mount
  useEffect(() => {
    // Check if we have a token in localStorage
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Verify the token with the server
    const verifyToken = async () => {
      try {
        const response = await apiRequest('POST', '/api/direct-auth/verify-token', { token });
        const data = await response.json();
        if (data.valid) {
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          // Token is invalid, remove it
          localStorage.removeItem(TOKEN_KEY);
        }
      } catch (error) {
        console.error('Token verification error:', error);
        // If there's an error, remove the token
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      // Use our direct auth endpoint for reliable login across browsers
      const response = await apiRequest('POST', '/api/direct-auth/direct-login', credentials);
      const data = await response.json();
      
      if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setUser(data.user);
        setIsAuthenticated(true);
        
        toast({
          title: 'Login successful',
          description: `Welcome back, ${data.user.username}!`,
        });
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
        toast({
          title: 'Login failed',
          description: data.message || 'Please check your credentials and try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
      toast({
        title: 'Login error',
        description: 'An error occurred during login. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        // Notify the server to invalidate the token
        await apiRequest('POST', '/api/direct-auth/logout-token', { token });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage and state, even if server request fails
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout
  };
}