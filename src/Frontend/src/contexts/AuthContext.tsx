/**
 * Authentication Context for role-based access control
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import config from '../config';
import type { User, LoginResponse, PermissionSet, UserRole } from '../types/auth';

// Default permissions (most restrictive)
const DEFAULT_PERMISSIONS: PermissionSet = {
  can_view_beds: true,
  can_assign_beds: false,
  can_unassign_beds: false,
  can_view_reservations: true,
  can_create_reservations: false,
  can_accept_reservations: false,
  can_check_in_reservations: false,
  can_cancel_reservations: false,
  can_view_guests: true,
  can_create_guests: false,
  can_edit_guest_basic: false,
  can_edit_guest_case: false,
  can_delete_guests: false,
  can_view_volunteers: true,
  can_manage_volunteers: false,
  can_view_chapel: true,
  can_manage_chapel: false,
  can_view_tasks: true,
  can_create_tasks: false,
  can_assign_tasks: false,
  can_update_own_tasks: true,
  can_view_users: false,
  can_manage_users: false,
  can_use_chat: true,
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: PermissionSet;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  hasPermission: (permission: keyof PermissionSet) => boolean;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [permissions, setPermissions] = useState<PermissionSet>(DEFAULT_PERMISSIONS);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch permissions when user changes
  const fetchPermissions = useCallback(async () => {
    if (!token) {
      setPermissions(DEFAULT_PERMISSIONS);
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/auth/me/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const perms = await response.json();
        setPermissions(perms);
      } else {
        setPermissions(DEFAULT_PERMISSIONS);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions(DEFAULT_PERMISSIONS);
    }
  }, [token]);

  // Validate token and load user on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${config.apiUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          await fetchPermissions();
        } else {
          // Token is invalid
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
          setPermissions(DEFAULT_PERMISSIONS);
        }
      } catch (error) {
        console.error('Error validating token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token, fetchPermissions]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data: LoginResponse = await response.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        await fetchPermissions();
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${config.apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      setPermissions(DEFAULT_PERMISSIONS);
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${config.apiUrl}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const hasPermission = (permission: keyof PermissionSet): boolean => {
    return permissions[permission] === true;
  };

  const isRole = (...roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        updateProfile,
        hasPermission,
        isRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook for checking permissions
export function usePermission(permission: keyof PermissionSet): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

// Helper hook for checking roles
export function useRole(...roles: UserRole[]): boolean {
  const { isRole } = useAuth();
  return isRole(...roles);
}

export default AuthContext;
