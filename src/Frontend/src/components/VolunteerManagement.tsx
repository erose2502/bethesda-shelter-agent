import { useState, useEffect } from 'react';
import { Users, Phone, Mail, Plus, Trash2, CheckCircle, Edit2, Save, X, AlertCircle, Heart } from 'lucide-react';
import config from '../config';

interface Volunteer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  availability: string[];
  interests: string[];
  background_check: boolean;
  notes: string | null;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  last_served: string | null;
}

const AVAILABILITY_OPTIONS = [
  'Weekday Mornings',
  'Weekday Afternoons', 
  'Weekday Evenings',
  'Saturday',
  'Sunday'
];

const INTEREST_OPTIONS = [
  'Meal Service',
  'Donation Sorting',
  'Mentoring',
  'Administrative',
  'Chapel Services',
  'Special Events',
  'Maintenance'
];

export default function VolunteerManagement() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    availability: string[];
    interests: string[];
    background_check: boolean;
    notes: string;
    status: Volunteer['status'];
  }>({
    name: '',
    phone: '',
    email: '',
    availability: [],
    interests: [],
    background_check: false,
    notes: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchVolunteers();
    const interval = setInterval(fetchVolunteers, 5000);
    const handleFocus = () => fetchVolunteers();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/volunteers/`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setVolunteers(data);
      } else {
        setApiError('Failed to load volunteers');
      }
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      setApiError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    try {
      if (editingId) {
        const response = await fetch(`${config.apiUrl}/api/volunteers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          setApiError(error.detail || 'Failed to update volunteer');
          return;
        }
        setEditingId(null);
      } else {
        const response = await fetch(`${config.apiUrl}/api/volunteers/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          setApiError(error.detail || 'Failed to create volunteer');
          return;
        }
      }
      resetForm();
      fetchVolunteers();
    } catch (error) {
      console.error('Error saving volunteer:', error);
      setApiError('Failed to connect to server');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      availability: [],
      interests: [],
      background_check: false,
      notes: '',
      status: 'pending'
    });
    setApiError(null);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (volunteer: Volunteer) => {
    setFormData({
      name: volunteer.name,
      phone: volunteer.phone,
      email: volunteer.email || '',
      availability: volunteer.availability,
      interests: volunteer.interests,
      background_check: volunteer.background_check,
      notes: volunteer.notes || '',
      status: volunteer.status
    });
    setEditingId(volunteer.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/volunteers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchVolunteers();
        setDeleteConfirm(null);
      } else {
        alert('Failed to delete volunteer');
      }
    } catch (error) {
      console.error('Error deleting volunteer:', error);
      alert('Failed to connect to server');
    }
  };

  const toggleCheckbox = (array: string[], value: string, setter: (val: string[]) => void) => {
    if (array.includes(value)) {
      setter(array.filter(v => v !== value));
    } else {
      setter([...array, value]);
    }
  };

  const filteredVolunteers = volunteers.filter(v => {
    if (filter === 'active') return v.status === 'active';
    if (filter === 'pending') return v.status === 'pending';
    return true;
  });

  const activeCount = volunteers.filter(v => v.status === 'active').length;
  const pendingCount = volunteers.filter(v => v.status === 'pending').length;
  const backgroundCheckCount = volunteers.filter(v => v.background_check).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Volunteer Management</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage volunteer information and availability
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
          >
            <Plus className="-ml-0.5 h-4 w-4" />
            Add Volunteer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Active Volunteers</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">{activeCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending Review</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">{pendingCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Background Checks</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-blue-600">{backgroundCheckCount}</dd>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['all', 'active', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === f
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                filter === f
                  ? 'bg-red-100 dark:bg-red-400/10 text-red-600 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {filteredVolunteers.length}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="rounded-md bg-red-50 dark:bg-red-400/10 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" onClick={resetForm}></div>
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button onClick={resetForm} className="rounded-md text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start mb-4">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-400/10 sm:mx-0 sm:h-10 sm:w-10">
                  <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {editingId ? 'Edit Volunteer' : 'Add New Volunteer'}
                  </h3>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Availability</label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABILITY_OPTIONS.map(opt => (
                        <label key={opt} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.availability.includes(opt)}
                            onChange={() => toggleCheckbox(formData.availability, opt, val => setFormData(prev => ({ ...prev, availability: val })))}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Interests</label>
                    <div className="grid grid-cols-2 gap-2">
                      {INTEREST_OPTIONS.map(opt => (
                        <label key={opt} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.interests.includes(opt)}
                            onChange={() => toggleCheckbox(formData.interests, opt, val => setFormData(prev => ({ ...prev, interests: val })))}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-gray-700 dark:text-gray-300">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.background_check}
                        onChange={e => setFormData(prev => ({ ...prev, background_check: e.target.checked }))}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Background Check Completed</span>
                    </label>
                  </div>
                  {editingId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as Volunteer['status'] }))}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {editingId ? 'Update' : 'Add'} Volunteer
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Volunteers Table */}
      {filteredVolunteers.length === 0 ? (
        <div className="text-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No volunteers</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new volunteer.</p>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-white/10 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Contact</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Availability</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Interests</th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {filteredVolunteers.map((volunteer) => {
                const statusColors = {
                  active: 'bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400 ring-green-600/20',
                  pending: 'bg-yellow-50 dark:bg-yellow-400/10 text-yellow-800 dark:text-yellow-400 ring-yellow-600/20',
                  inactive: 'bg-gray-50 dark:bg-gray-400/10 text-gray-600 dark:text-gray-400 ring-gray-500/20'
                };

                return (
                  <tr key={volunteer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                      {volunteer.name}
                      {volunteer.background_check && (
                        <span title="Background Check Complete">
                          <CheckCircle className="inline-block ml-2 h-4 w-4 text-green-500" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {volunteer.phone}
                        </span>
                        {volunteer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {volunteer.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-wrap gap-1">
                        {volunteer.availability.slice(0, 2).map(a => (
                          <span key={a} className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-400/10 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-400">
                            {a}
                          </span>
                        ))}
                        {volunteer.availability.length > 2 && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                            +{volunteer.availability.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-wrap gap-1">
                        {volunteer.interests.slice(0, 2).map(i => (
                          <span key={i} className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-400/10 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-400">
                            {i}
                          </span>
                        ))}
                        {volunteer.interests.length > 2 && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">
                            +{volunteer.interests.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[volunteer.status]}`}>
                        {volunteer.status}
                      </span>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(volunteer)}
                          className="rounded-md bg-white dark:bg-gray-700 p-1.5 text-gray-400 hover:text-gray-500"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(volunteer.id)}
                          className="rounded-md bg-white dark:bg-gray-700 p-1.5 text-red-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" onClick={() => setDeleteConfirm(null)}></div>
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-400/10 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Delete Volunteer</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this volunteer? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
