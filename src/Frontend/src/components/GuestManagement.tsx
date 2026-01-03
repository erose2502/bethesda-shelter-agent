import { useState, useEffect, useRef } from 'react';
import { 
  Users, Phone, Plus, Edit2, Save, X, 
  UserCircle, Calendar, Briefcase, AlertTriangle, Search, Trash2, AlertCircle, Camera
} from 'lucide-react';
import config from '../config';

interface Guest {
  id: number;
  bed_id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  phone: string | null;
  check_in_date: string;
  expected_discharge_date: string | null;
  days_in_shelter: number;
  status: 'active' | 'on_penalty' | 'discharged' | 'graduated';
  on_penalty: boolean;
  penalty_reason: string | null;
  employment_status: 'employed' | 'seeking' | 'not_seeking' | 'disabled';
  employer: string | null;
  life_coach: string | null;
  programs: string[];
  notes: string | null;
}

const PROGRAM_OPTIONS = [
  'Life Change Program',
  'GED Classes',
  'Job Training',
  'Recovery Program',
  'Financial Literacy',
  'Bible Study',
  'Counseling',
  'Case Management'
];

const LIFE_COACHES = [
  'Hal Griffith',
  'Lloyd Sterrette',
  'Art Miles',
  'Larry Runk',
  'Keith Hunter'
];

export default function GuestManagement() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'penalty' | 'employed'>('all');
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    bed_id: 1,
    first_name: '',
    last_name: '',
    photo_url: '',
    phone: '',
    expected_discharge_date: '',
    employment_status: 'seeking' as Guest['employment_status'],
    employer: '',
    life_coach: '',
    programs: [] as string[],
    notes: ''
  });

  useEffect(() => {
    fetchGuests();
    const interval = setInterval(fetchGuests, 5000);
    const handleFocus = () => fetchGuests();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchGuests = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/guests/`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        // Ensure programs is always an array
        const processedData = data.map((guest: any) => ({
          ...guest,
          programs: Array.isArray(guest.programs) ? guest.programs : 
                    (typeof guest.programs === 'string' ? JSON.parse(guest.programs || '[]') : [])
        }));
        setGuests(processedData);
      } else {
        setApiError('Failed to load guests');
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
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
        // When updating, exclude bed_id and only send photo_url if it's new (starts with data:)
        const { bed_id, photo_url, ...updateData } = formData;
        const dataToSend = {
          ...updateData,
          // Only include photo_url if it's a new upload (base64 data URL)
          ...(photo_url && photo_url.startsWith('data:') ? { photo_url } : {})
        };
        
        const response = await fetch(`${config.apiUrl}/api/guests/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSend),
        });
        if (!response.ok) {
          const error = await response.json();
          // Handle Pydantic validation errors
          if (Array.isArray(error.detail)) {
            const errorMessages = error.detail.map((err: any) => 
              `${err.loc?.join('.') || 'Field'}: ${err.msg}`
            ).join(', ');
            setApiError(errorMessages);
          } else {
            setApiError(typeof error.detail === 'string' ? error.detail : 'Failed to update guest');
          }
          return;
        }
        setEditingId(null);
      } else {
        const response = await fetch(`${config.apiUrl}/api/guests/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) {
          const error = await response.json();
          // Handle Pydantic validation errors
          if (Array.isArray(error.detail)) {
            const errorMessages = error.detail.map((err: any) => 
              `${err.loc?.join('.') || 'Field'}: ${err.msg}`
            ).join(', ');
            setApiError(errorMessages);
          } else {
            setApiError(typeof error.detail === 'string' ? error.detail : 'Failed to create guest');
          }
          return;
        }
      }
      resetForm();
      fetchGuests();
    } catch (error) {
      console.error('Error saving guest:', error);
      setApiError('Failed to connect to server');
    }
  };

  const resetForm = () => {
    setFormData({
      bed_id: 1,
      first_name: '',
      last_name: '',
      photo_url: '',
      phone: '',
      expected_discharge_date: '',
      employment_status: 'seeking',
      employer: '',
      life_coach: '',
      programs: [],
      notes: ''
    });
    setApiError(null);
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleEdit = (guest: Guest) => {
    setFormData({
      bed_id: guest.bed_id,
      first_name: guest.first_name,
      last_name: guest.last_name,
      photo_url: guest.photo_url || '',
      phone: guest.phone || '',
      expected_discharge_date: guest.expected_discharge_date || '',
      employment_status: guest.employment_status,
      employer: guest.employer || '',
      life_coach: guest.life_coach || '',
      programs: Array.isArray(guest.programs) ? guest.programs : [],
      notes: guest.notes || ''
    });
    setEditingId(guest.id);
    setShowAddForm(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/guests/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchGuests();
        setDeleteConfirm(null);
      } else {
        alert('Failed to delete guest');
      }
    } catch (error) {
      console.error('Error deleting guest:', error);
      alert('Failed to connect to server');
    }
  };

  const toggleProgram = (program: string) => {
    if (formData.programs.includes(program)) {
      setFormData(prev => ({ ...prev, programs: prev.programs.filter(p => p !== program) }));
    } else {
      setFormData(prev => ({ ...prev, programs: [...prev.programs, program] }));
    }
  };

  const filteredGuests = guests
    .filter(g => {
      if (filter === 'active') return g.status === 'active';
      if (filter === 'penalty') return g.on_penalty;
      if (filter === 'employed') return g.employment_status === 'employed';
      return true;
    })
    .filter(g => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        g.first_name.toLowerCase().includes(search) ||
        g.last_name.toLowerCase().includes(search) ||
        g.bed_id.toString().includes(search)
      );
    });

  const activeCount = guests.filter(g => g.status === 'active').length;
  const penaltyCount = guests.filter(g => g.on_penalty).length;
  const employedCount = guests.filter(g => g.employment_status === 'employed').length;
  const avgDays = guests.length > 0 ? Math.round(guests.reduce((sum, g) => sum + g.days_in_shelter, 0) / guests.length) : 0;

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
          <h2 className="text-lg font-semibold text-white">Guest Management</h2>
          <p className="mt-1 text-sm text-white/80">
            Manage shelter guests and their information
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-x-1.5 rounded-lg bg-red-500/30 backdrop-blur-md border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-300 shadow-lg hover:bg-red-500/40"
          >
            <Plus className="-ml-0.5 h-4 w-4" />
            Add Guest
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
          <dt className="truncate text-sm font-medium text-white/80">Active Guests</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-300">{activeCount}</dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
          <dt className="truncate text-sm font-medium text-white/80">On Penalty</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-300">{penaltyCount}</dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
          <dt className="truncate text-sm font-medium text-white/80">Employed</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-blue-300">{employedCount}</dd>
        </div>
        <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
          <dt className="truncate text-sm font-medium text-white/80">Avg Days</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-white">{avgDays}</dd>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-white/60" />
            </div>
            <input
              type="text"
              placeholder="Search by name or bed number..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="block w-full rounded-lg border-0 bg-white/10 backdrop-blur-md text-white pl-10 ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-red-400 sm:text-sm"
            />
          </div>
        </div>
        <div className="border-b border-white/10 sm:border-0">
          <nav className="-mb-px flex space-x-4">
            {(['all', 'active', 'penalty', 'employed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium ${
                  filter === f
                    ? 'border-red-400 text-red-300'
                    : 'border-transparent text-white/60 hover:border-white/30 hover:text-white/80'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="rounded-xl bg-red-500/20 backdrop-blur-md border border-red-400/30 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-300" />
            <div className="ml-3">
              <p className="text-sm text-red-300">{apiError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={resetForm}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button onClick={resetForm} className="rounded-md text-white/60 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start mb-4">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30 sm:mx-0 sm:h-10 sm:w-10">
                  <UserCircle className="h-6 w-6 text-red-300" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold text-white">
                    {editingId ? 'Edit Guest' : 'Add New Guest'}
                  </h3>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo Upload */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full overflow-hidden bg-white/10 backdrop-blur-md border-2 border-white/20">
                      {formData.photo_url ? (
                        <img src={formData.photo_url} alt="Guest" className="h-full w-full object-cover" />
                      ) : (
                        <UserCircle className="h-full w-full text-white/60" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 rounded-full bg-red-500/30 backdrop-blur-md border border-red-400/30 p-2 text-red-300 shadow-lg hover:bg-red-500/40"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={e => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="John"
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={e => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Doe"
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Bed Number</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="108"
                      value={formData.bed_id}
                      onChange={e => setFormData(prev => ({ ...prev, bed_id: parseInt(e.target.value) }))}
                      placeholder="1"
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(123) 456-7890"
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Expected Discharge Date</label>
                    <input
                      type="date"
                      value={formData.expected_discharge_date}
                      onChange={e => setFormData(prev => ({ ...prev, expected_discharge_date: e.target.value }))}
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Employment Status</label>
                    <select
                      value={formData.employment_status}
                      onChange={e => setFormData(prev => ({ ...prev, employment_status: e.target.value as Guest['employment_status'] }))}
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    >
                      <option value="seeking">Seeking Employment</option>
                      <option value="employed">Employed</option>
                      <option value="not_seeking">Not Seeking</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                  {formData.employment_status === 'employed' && (
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-white mb-2">Employer</label>
                      <input
                        type="text"
                        value={formData.employer}
                        onChange={e => setFormData(prev => ({ ...prev, employer: e.target.value }))}
                        placeholder="Company Name"
                        className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-white mb-2">
                      Life Coach <span className="text-red-300">*</span>
                    </label>
                    <select
                      required
                      value={formData.life_coach}
                      onChange={e => setFormData(prev => ({ ...prev, life_coach: e.target.value }))}
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                    >
                      <option value="">Select a life coach...</option>
                      {LIFE_COACHES.map(coach => (
                        <option key={coach} value={coach}>{coach}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-white mb-3">Programs</label>
                    <div className="grid grid-cols-2 gap-3">
                      {PROGRAM_OPTIONS.map(program => (
                        <label key={program} className="relative flex items-start">
                          <div className="flex h-6 items-center">
                            <input
                              type="checkbox"
                              checked={formData.programs.includes(program)}
                              onChange={() => toggleProgram(program)}
                              className="h-4 w-4 rounded border-white/20 bg-white/10 text-red-400 focus:ring-red-400"
                            />
                          </div>
                          <div className="ml-3 text-sm leading-6">
                            <span className="text-white/80">{program}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-white mb-2">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      placeholder="Additional notes about the guest..."
                      className="block w-full rounded-lg border-0 px-4 py-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6 resize-none"
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-lg bg-red-500/30 backdrop-blur-md border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-300 shadow-lg hover:bg-red-500/40 sm:w-auto"
                  >
                    <Save className="mr-1 h-4 w-4" />
                    {editingId ? 'Update' : 'Add'} Guest
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="mt-3 inline-flex w-full justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-inset ring-white/20 hover:bg-white/20 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Guests List */}
      {filteredGuests.length === 0 ? (
        <div className="text-center rounded-xl border-2 border-dashed border-white/20 backdrop-blur-md bg-white/5 p-12">
          <Users className="mx-auto h-12 w-12 text-white/40" />
          <h3 className="mt-2 text-sm font-semibold text-white">No guests found</h3>
          <p className="mt-1 text-sm text-white/60">
            {searchTerm ? 'Try adjusting your search.' : 'Get started by adding a new guest.'}
          </p>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-white/10 bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl sm:rounded-xl">
          {filteredGuests.map((guest) => {
            const statusColors = {
              active: 'bg-green-500/20 text-green-300 ring-green-400/30',
              on_penalty: 'bg-red-500/20 text-red-300 ring-red-400/30',
              discharged: 'bg-gray-500/20 text-gray-300 ring-gray-400/30',
              graduated: 'bg-blue-500/20 text-blue-300 ring-blue-400/30'
            };

            const employmentColors = {
              employed: 'bg-green-500/20 text-green-300',
              seeking: 'bg-yellow-500/20 text-yellow-300',
              not_seeking: 'bg-gray-500/20 text-gray-300',
              disabled: 'bg-purple-500/20 text-purple-300'
            };

            return (
              <li key={guest.id} className="px-4 py-4 sm:px-6 hover:bg-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-shrink-0">
                        {guest.photo_url ? (
                          <img 
                            src={guest.photo_url} 
                            alt={`${guest.first_name} ${guest.last_name}`}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-red-400"
                          />
                        ) : (
                          <div className="rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30 p-2">
                            <UserCircle className="h-8 w-8 text-red-300" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {guest.first_name} {guest.last_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center rounded-md bg-blue-500/20 backdrop-blur-md px-2 py-0.5 text-xs font-medium text-blue-300">
                            Bed #{guest.bed_id}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset backdrop-blur-md ${statusColors[guest.status]}`}>
                            {guest.status.replace('_', ' ')}
                          </span>
                          {guest.on_penalty && (
                            <span className="inline-flex items-center rounded-md bg-red-500/20 backdrop-blur-md px-2 py-0.5 text-xs font-medium text-red-300">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Penalty
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/60">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Day {guest.days_in_shelter}</span>
                      </div>
                      {guest.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{guest.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        <span className={`px-1.5 py-0.5 rounded text-xs backdrop-blur-md ${employmentColors[guest.employment_status]}`}>
                          {guest.employment_status === 'employed' && guest.employer ? guest.employer : guest.employment_status.replace('_', ' ')}
                        </span>
                      </div>
                      {guest.programs.length > 0 && (
                        <div className="col-span-2">
                          <div className="flex flex-wrap gap-1">
                            {guest.programs.slice(0, 3).map(p => (
                              <span key={p} className="inline-flex items-center rounded-md bg-purple-500/20 backdrop-blur-md px-2 py-0.5 text-xs text-purple-300">
                                {p}
                              </span>
                            ))}
                            {guest.programs.length > 3 && (
                              <span className="inline-flex items-center rounded-md bg-gray-500/20 backdrop-blur-md px-2 py-0.5 text-xs text-gray-300">
                                +{guest.programs.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {guest.penalty_reason && (
                      <p className="mt-2 text-xs text-red-300 italic">
                        Penalty: {guest.penalty_reason}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-shrink-0 gap-2">
                    <button
                      onClick={() => handleEdit(guest)}
                      className="rounded-lg bg-white/10 backdrop-blur-md border border-white/20 p-2 text-white/60 hover:text-white hover:bg-white/20"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(guest.id)}
                      className="rounded-lg bg-red-500/20 backdrop-blur-md border border-red-400/30 p-2 text-red-300 hover:bg-red-500/30"
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDeleteConfirm(null)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertCircle className="h-6 w-6 text-red-300" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold text-white">Delete Guest</h3>
                  <div className="mt-2">
                    <p className="text-sm text-white/80">
                      Are you sure you want to delete this guest record? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="inline-flex w-full justify-center rounded-lg bg-red-500/30 backdrop-blur-md border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-300 shadow-lg hover:bg-red-500/40 sm:w-auto"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="mt-3 inline-flex w-full justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-inset ring-white/20 hover:bg-white/20 sm:mt-0 sm:w-auto"
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
