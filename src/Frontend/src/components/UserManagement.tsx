/**
 * User Management Component - Director Only
 */

import { useState, useEffect } from 'react';
import { 
  Users, Plus, Edit2, Trash2, Shield, X, Search, Check, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import type { User, UserRole } from '../types/auth';

const ROLE_LABELS: Record<UserRole, string> = {
  director: 'Director',
  life_coach: 'Life Coach',
  supervisor: 'Supervisor',
};

const ROLE_COLORS: Record<UserRole, string> = {
  director: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  life_coach: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  supervisor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  password?: string;
}

export default function UserManagement() {
  const { token, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'supervisor',
    password: '',
  });

  const canManageUsers = hasPermission('can_manage_users');

  // Fetch users
  const fetchUsers = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/users?include_inactive=true`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingUser) {
        // Update existing user
        const response = await fetch(`${config.apiUrl}/api/auth/users/${editingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            first_name: formData.first_name,
            last_name: formData.last_name,
            phone: formData.phone || null,
            role: formData.role,
          }),
        });

        if (response.ok) {
          setSuccess('User updated successfully');
          fetchUsers();
          resetForm();
        } else {
          const data = await response.json();
          setError(data.detail || 'Failed to update user');
        }
      } else {
        // Create new user
        if (!formData.password) {
          setError('Password is required for new users');
          return;
        }

        const response = await fetch(`${config.apiUrl}/api/auth/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          setSuccess('User created successfully');
          fetchUsers();
          resetForm();
        } else {
          const data = await response.json();
          setError(data.detail || 'Failed to create user');
        }
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setError('An error occurred while saving');
    }
  };

  // Handle user deletion
  const handleDelete = async (userId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setSuccess('User deactivated successfully');
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('An error occurred');
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      role: 'supervisor',
      password: '',
    });
    setEditingUser(null);
    setShowForm(false);
  };

  // Open edit form
  const openEditForm = (user: User) => {
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      role: user.role,
    });
    setEditingUser(user);
    setShowForm(true);
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-white/70">Manage staff accounts and permissions</p>
        </div>
        
        {canManageUsers && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
          >
            <Plus className="h-5 w-5" />
            Add User
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200">
          <Check className="h-5 w-5" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">All Roles</option>
          <option value="director">Directors</option>
          <option value="life_coach">Life Coaches</option>
          <option value="supervisor">Supervisors</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">User</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Email</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Role</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-white/80">Last Login</th>
                {canManageUsers && (
                  <th className="text-right px-6 py-4 text-sm font-semibold text-white/80">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-white/5 ${!user.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {user.first_name[0]}{user.last_name[0]}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">
                          {user.first_name} {user.last_name}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-white/60">{user.phone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/80">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/60">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(user)}
                          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {deleteConfirm === user.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(user.id)}
                            className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-white/30 mb-4" />
            <p className="text-white/60">No users found</p>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm}></div>
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="life_coach">Life Coach</option>
                    <option value="director">Director</option>
                  </select>
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={formData.password || ''}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    {editingUser ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
