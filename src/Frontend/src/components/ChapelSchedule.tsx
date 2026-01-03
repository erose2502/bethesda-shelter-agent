import { useState, useEffect } from 'react';
import { Church, Calendar, Clock, Users, Phone, Mail, Plus, Trash2, CheckCircle, Edit2, Save, X, AlertCircle } from 'lucide-react';
import config from '../config';

interface ChapelService {
  id: number;
  date: string;
  time: string;
  group_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}

export default function ChapelSchedule() {
  const [services, setServices] = useState<ChapelService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'upcoming'>('upcoming');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<{
    date: string;
    time: string;
    group_name: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    notes: string;
    status: ChapelService['status'];
  }>({
    date: '',
    time: '10:00',
    group_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
    status: 'pending'
  });

  const [dateError, setDateError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 5000);
    const handleFocus = () => fetchServices();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/chapel/`);
      if (response.ok) {
        const data = await response.json();
        setServices(data);
      } else {
        setApiError('Failed to load chapel services');
      }
    } catch (error) {
      console.error('Error fetching chapel services:', error);
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
        const response = await fetch(`${config.apiUrl}/api/chapel/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          setApiError(error.detail || 'Failed to update service');
          return;
        }
        setEditingId(null);
      } else {
        const response = await fetch(`${config.apiUrl}/api/chapel/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: formData.date,
            time: formData.time,
            group_name: formData.group_name,
            contact_name: formData.contact_name,
            contact_phone: formData.contact_phone,
            contact_email: formData.contact_email || null,
            notes: formData.notes || null,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          setApiError(error.detail || 'Failed to create service');
          return;
        }
      }
      resetForm();
      fetchServices();
    } catch (error) {
      console.error('Error saving chapel service:', error);
      setApiError('Failed to connect to server');
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      time: '10:00',
      group_name: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      notes: '',
      status: 'pending'
    });
    setDateError(null);
    setApiError(null);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (service: ChapelService) => {
    setFormData({
      date: service.date,
      time: service.time,
      group_name: service.group_name,
      contact_name: service.contact_name,
      contact_phone: service.contact_phone,
      contact_email: service.contact_email || '',
      notes: service.notes || '',
      status: service.status
    });
    setEditingId(service.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/chapel/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchServices();
        setDeleteConfirm(null);
      } else {
        alert('Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to connect to server');
    }
  };

  const handleStatusChange = async (id: number, newStatus: ChapelService['status']) => {
    try {
      let endpoint = '';
      if (newStatus === 'confirmed') {
        endpoint = `${config.apiUrl}/api/chapel/${id}/confirm`;
      } else if (newStatus === 'completed') {
        endpoint = `${config.apiUrl}/api/chapel/${id}/complete`;
      } else {
        endpoint = `${config.apiUrl}/api/chapel/${id}`;
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (response.ok) fetchServices();
        return;
      }
      const response = await fetch(endpoint, { method: 'POST' });
      if (response.ok) fetchServices();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getFilteredServices = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return services
      .filter(s => {
        if (filter === 'all') return true;
        if (filter === 'pending') return s.status === 'pending';
        if (filter === 'confirmed') return s.status === 'confirmed';
        if (filter === 'upcoming') {
          const serviceDate = new Date(s.date);
          return serviceDate >= now && s.status !== 'cancelled' && s.status !== 'completed';
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const formatTime = (time: string) => {
    switch (time) {
      case '10:00': return '10:00 AM';
      case '13:00': return '1:00 PM';
      case '19:00': return '7:00 PM';
      default: return time;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const filteredServices = getFilteredServices();
  const pendingCount = services.filter(s => s.status === 'pending').length;
  const confirmedCount = services.filter(s => s.status === 'confirmed').length;
  const thisWeekCount = services.filter(s => {
    const serviceDate = new Date(s.date);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return serviceDate >= now && serviceDate <= weekFromNow && s.status !== 'cancelled';
  }).length;

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chapel Schedule</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage chapel services and volunteer groups
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <Plus className="-ml-0.5 h-4 w-4" />
            Schedule Service
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">{pendingCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Confirmed</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">{confirmedCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">This Week</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-blue-600">{thisWeekCount}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Services</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{services.length}</dd>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['upcoming', 'pending', 'confirmed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium ${
                filter === f
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                filter === f
                  ? 'bg-red-100 dark:bg-red-400/10 text-red-600 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {getFilteredServices().length}
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
                <button onClick={resetForm} className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-400/10 sm:mx-0 sm:h-10 sm:w-10">
                  <Church className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                    {editingId ? 'Edit Chapel Service' : 'Schedule New Chapel Service'}
                  </h3>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date (Weekdays Only)</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => {
                        const selectedDate = new Date(e.target.value + 'T00:00:00');
                        const day = selectedDate.getDay();
                        if (day === 0 || day === 6) {
                          setDateError('Chapel services are only available on weekdays (Monday-Friday)');
                          return;
                        }
                        setDateError(null);
                        setFormData(prev => ({ ...prev, date: e.target.value }));
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                    {dateError && <p className="mt-1 text-sm text-red-600">{dateError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
                    <select
                      value={formData.time}
                      onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    >
                      <option value="10:00">10:00 AM</option>
                      <option value="13:00">1:00 PM</option>
                      <option value="19:00">7:00 PM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Church/Group Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., First Baptist Church"
                      value={formData.group_name}
                      onChange={e => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contact Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Pastor John Smith"
                      value={formData.contact_name}
                      onChange={e => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="(717) 555-0123"
                      value={formData.contact_phone}
                      onChange={e => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="pastor@church.org"
                      value={formData.contact_email}
                      onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                    />
                  </div>
                  {editingId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ChapelService['status'] }))}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
                    <textarea
                      placeholder="e.g., Bringing worship team, need projector setup..."
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
                    disabled={!!dateError}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {editingId ? 'Update Service' : 'Schedule Service'}
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

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <div className="text-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12">
          <Church className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No chapel services</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {filter === 'upcoming' ? 'No upcoming services scheduled.' : `No ${filter} services found.`}
          </p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow sm:rounded-lg">
          {filteredServices.map((service) => {
            const statusColors = {
              pending: 'bg-yellow-50 dark:bg-yellow-400/10 text-yellow-800 dark:text-yellow-400 ring-yellow-600/20 dark:ring-yellow-400/20',
              confirmed: 'bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400 ring-green-600/20 dark:ring-green-400/20',
              completed: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400 ring-blue-700/10 dark:ring-blue-400/20',
              cancelled: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-400 ring-red-600/10 dark:ring-red-400/20'
            };

            return (
              <li key={service.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[service.status]}`}>
                        {service.status.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">{formatDate(service.date)}</span>
                        <Clock className="h-4 w-4 ml-2" />
                        <span>{formatTime(service.time)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{service.group_name}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {service.contact_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {service.contact_phone}
                      </span>
                      {service.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {service.contact_email}
                        </span>
                      )}
                    </div>
                    {service.notes && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">"{service.notes}"</p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-shrink-0 gap-2">
                    {service.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(service.id, 'confirmed')}
                        className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-400/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-400/20"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirm
                      </button>
                    )}
                    {service.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusChange(service.id, 'completed')}
                        className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-400/20"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(service)}
                      className="rounded-md bg-white dark:bg-gray-700 p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(service.id)}
                      className="rounded-md bg-white dark:bg-gray-700 p-2 text-red-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Delete Chapel Service</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to delete this chapel service? This action cannot be undone.
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
