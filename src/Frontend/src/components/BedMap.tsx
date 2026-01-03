import { useState, useEffect } from 'react';
import { Check, Clock, User, Activity, BedDouble, Search, UserCircle } from 'lucide-react';

type BedStatus = 'AVAILABLE' | 'HELD' | 'OCCUPIED';

interface Bed {
  bed_id: number;
  status: BedStatus;
  guest_name?: string;
  guest_photo?: string | null;
  reservation_id?: string;
}

interface Guest {
  id: number;
  bed_id: number;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  status: string;
  days_in_shelter: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function BedMap() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [bedToAssign, setBedToAssign] = useState<number | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [bedSearch, setBedSearch] = useState('');
  const [stats, setStats] = useState({ available: 0, held: 0, occupied: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | BedStatus>('all');

  useEffect(() => {
    fetchBeds();
    const interval = setInterval(fetchBeds, 2000);
    const handleFocus = () => fetchBeds();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchGuests = async () => {
    try {
      const response = await fetch(`${API_URL}/api/guests/`, { cache: 'no-store' });
      if (response.ok) {
        const data: Guest[] = await response.json();
        // Show all active guests (can reassign if needed)
        setGuests(data);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
  };

  const assignGuestToBed = async (guestId: number) => {
    if (!bedToAssign) return;
    
    try {
      const response = await fetch(`${API_URL}/api/beds/${bedToAssign}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guestId })
      });
      
      if (response.ok) {
        setShowAssignModal(false);
        setBedToAssign(null);
        setGuestSearch('');
        fetchBeds();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Assignment error:', errorData);
        alert(`Failed to assign guest to bed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error assigning guest:', error);
      alert('Error assigning guest to bed');
    }
  };

  const openAssignModal = (bedId: number) => {
    setBedToAssign(bedId);
    setShowAssignModal(true);
    fetchGuests();
  };

  const fetchBeds = async () => {
    if (isRefreshing && beds.length > 0) return;
    setIsRefreshing(true);
    try {
      const [bedsResponse, guestsResponse] = await Promise.all([
        fetch(`${API_URL}/api/beds/list`, { cache: 'no-store' }),
        fetch(`${API_URL}/api/guests/`, { cache: 'no-store' })
      ]);
      
      if (bedsResponse.ok) {
        const bedsData: Bed[] = await bedsResponse.json();
        
        // Get guests data to map names and photos to beds
        let guestMap: Map<number, { name: string; photo: string | null }> = new Map();
        if (guestsResponse.ok) {
          const guestsData: Guest[] = await guestsResponse.json();
          guestMap = new Map(
            guestsData.map(g => [
              g.bed_id, 
              { name: `${g.first_name} ${g.last_name}`, photo: g.photo_url }
            ])
          );
        }
        
        // Add guest names and photos to bed data
        const bedsWithGuests = bedsData.map(bed => {
          const guestInfo = guestMap.get(bed.bed_id);
          return {
            ...bed,
            guest_name: guestInfo?.name || undefined,
            guest_photo: guestInfo?.photo || undefined
          };
        });
        
        const sortedBeds = bedsWithGuests.sort((a, b) => a.bed_id - b.bed_id);
        setBeds(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(sortedBeds)) {
            calculateStats(sortedBeds);
            return sortedBeds;
          }
          return prev;
        });
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching beds:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const calculateStats = (bedList: Bed[]) => {
    const available = bedList.filter(b => b.status === 'AVAILABLE').length;
    const held = bedList.filter(b => b.status === 'HELD').length;
    const occupied = bedList.filter(b => b.status === 'OCCUPIED').length;
    setStats({ available, held, occupied });
  };

  const handleStatusChange = async (bedId: number, newStatus: BedStatus) => {
    setBeds(prev => prev.map(b => b.bed_id === bedId ? { ...b, status: newStatus } : b));
    setSelectedBed(null);
    try {
      let endpoint = '';
      if (newStatus === 'AVAILABLE') endpoint = `${API_URL}/api/beds/${bedId}/checkout`;
      else if (newStatus === 'HELD') endpoint = `${API_URL}/api/beds/${bedId}/hold`;
      else if (newStatus === 'OCCUPIED') endpoint = `${API_URL}/api/beds/${bedId}/checkin`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) {
        fetchBeds();
        alert("Failed to update status.");
      } else {
        setTimeout(fetchBeds, 500);
      }
    } catch (e) {
      console.error(e);
      fetchBeds();
    }
  };

  const getStatusBadge = (status: BedStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="inline-flex items-center rounded-md bg-green-500/20 backdrop-blur-md px-2 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-400/30">Available</span>;
      case 'HELD':
        return <span className="inline-flex items-center rounded-md bg-yellow-500/20 backdrop-blur-md px-2 py-1 text-xs font-medium text-yellow-300 ring-1 ring-inset ring-yellow-400/30">Reserved</span>;
      case 'OCCUPIED':
        return <span className="inline-flex items-center rounded-md bg-red-500/20 backdrop-blur-md px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-400/30">Occupied</span>;
    }
  };

  const filteredBeds = filter === 'all' 
    ? beds.filter(b => bedSearch ? b.bed_id.toString().includes(bedSearch) : true)
    : beds.filter(b => {
        const matchesStatus = b.status === filter.toUpperCase() as BedStatus;
        const matchesSearch = bedSearch ? b.bed_id.toString().includes(bedSearch) : true;
        return matchesStatus && matchesSearch;
      });

  if (loading && beds.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats - Glassmorphic Style */}
      <div className="border-b border-white/10 pb-5">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
            <dt className="truncate text-sm font-medium text-white/80">Available</dt>
            <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div className="flex items-baseline text-2xl font-semibold text-green-300">
                {stats.available}
                <span className="ml-2 text-sm font-medium text-white/60">beds</span>
              </div>
              <div className="inline-flex items-baseline rounded-full bg-green-500/20 backdrop-blur-md px-2.5 py-0.5 text-sm font-medium text-green-300 ring-1 ring-green-400/30 md:mt-2 lg:mt-0">
                <Check className="-ml-1 mr-0.5 h-4 w-4 flex-shrink-0 self-center text-green-300" />
                Ready
              </div>
            </dd>
          </div>

          <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
            <dt className="truncate text-sm font-medium text-white/80">Reserved</dt>
            <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div className="flex items-baseline text-2xl font-semibold text-yellow-300">
                {stats.held}
                <span className="ml-2 text-sm font-medium text-white/60">beds</span>
              </div>
              <div className="inline-flex items-baseline rounded-full bg-yellow-500/20 backdrop-blur-md px-2.5 py-0.5 text-sm font-medium text-yellow-300 ring-1 ring-yellow-400/30 md:mt-2 lg:mt-0">
                <Clock className="-ml-1 mr-0.5 h-4 w-4 flex-shrink-0 self-center text-yellow-300" />
                Pending
              </div>
            </dd>
          </div>

          <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
            <dt className="truncate text-sm font-medium text-white/80">Occupied</dt>
            <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div className="flex items-baseline text-2xl font-semibold text-red-300">
                {stats.occupied}
                <span className="ml-2 text-sm font-medium text-white/60">beds</span>
              </div>
              <div className="inline-flex items-baseline rounded-full bg-red-500/20 backdrop-blur-md px-2.5 py-0.5 text-sm font-medium text-red-300 ring-1 ring-red-400/30 md:mt-2 lg:mt-0">
                <User className="-ml-1 mr-0.5 h-4 w-4 flex-shrink-0 self-center text-red-300" />
                In Use
              </div>
            </dd>
          </div>

          <div className="overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-5 shadow-xl sm:p-6">
            <dt className="truncate text-sm font-medium text-white/80">Occupancy Rate</dt>
            <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
              <div className="flex items-baseline text-2xl font-semibold text-white">
                {beds.length > 0 ? Math.round((stats.occupied / beds.length) * 100) : 0}%
              </div>
              <div className="inline-flex items-baseline rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-sm font-medium text-white/80 ring-1 ring-white/30 md:mt-2 lg:mt-0">
                {beds.length} total
              </div>
            </dd>
          </div>
        </dl>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-white/10">
        <div className="flex items-center justify-between">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: 'All Beds', count: beds.length },
              { key: 'available', label: 'Available', count: stats.available },
              { key: 'held', label: 'Reserved', count: stats.held },
              { key: 'occupied', label: 'Occupied', count: stats.occupied },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as typeof filter)}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                  filter === tab.key
                    ? 'border-red-400 text-red-300'
                    : 'border-transparent text-white/60 hover:border-white/30 hover:text-white/80'
                }`}
              >
                {tab.label}
                <span className={`ml-2 rounded-full py-0.5 px-2.5 text-xs font-medium ${
                  filter === tab.key
                    ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/30 backdrop-blur-md'
                    : 'bg-white/10 text-white/70 backdrop-blur-md'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-xs text-white/60">
            {isRefreshing && <Activity className="w-3 h-3 animate-spin" />}
            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-4 sm:px-6 rounded-xl shadow-xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-white/60" />
          </div>
          <input
            type="text"
            value={bedSearch}
            onChange={(e) => setBedSearch(e.target.value)}
            placeholder="Search by bed number..."
            className="block w-full rounded-lg border-0 py-3 pl-10 pr-3 text-white bg-white/10 ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 backdrop-blur-md sm:text-sm sm:leading-6"
          />
          {bedSearch && (
            <button
              onClick={() => setBedSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/60 hover:text-white"
            >
              <span className="text-sm font-medium">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Bed Grid - Glassmorphic Cards */}
      <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredBeds.map((bed) => (
          <li
            key={bed.bed_id}
            className="col-span-1 flex flex-col divide-y divide-white/10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-center shadow-xl hover:shadow-2xl hover:bg-white/20 transition-all cursor-pointer"
            onClick={() => setSelectedBed(bed)}
          >
            <div className="flex flex-1 flex-col p-6">
              {/* Guest-centric layout for assigned beds */}
              {bed.guest_name ? (
                <>
                  {bed.guest_photo ? (
                    <img 
                      src={bed.guest_photo} 
                      alt={bed.guest_name} 
                      className="mx-auto h-16 w-16 rounded-full ring-2 ring-red-400" 
                    />
                  ) : (
                    <div className="mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                      <UserCircle className="h-10 w-10 text-white/60" />
                    </div>
                  )}
                  <h3 className="mt-4 text-lg font-semibold text-white">{bed.guest_name}</h3>
                  <dl className="mt-1 flex flex-grow flex-col justify-between">
                    <dt className="sr-only">Status</dt>
                    <dd className="mt-2">{getStatusBadge(bed.status)}</dd>
                    <dt className="sr-only">Bed Number</dt>
                    <dd className="mt-2 text-sm text-white/60">
                      Bed #{bed.bed_id}
                    </dd>
                  </dl>
                </>
              ) : (
                /* Original bed-centric layout for unassigned beds */
                <>
                  <div className={`mx-auto flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md ${
                    bed.status === 'AVAILABLE' ? 'bg-green-500/20 border border-green-400/30' :
                    bed.status === 'HELD' ? 'bg-yellow-500/20 border border-yellow-400/30' :
                    'bg-red-500/20 border border-red-400/30'
                  }`}>
                    <BedDouble className={`h-8 w-8 ${
                      bed.status === 'AVAILABLE' ? 'text-green-300' :
                      bed.status === 'HELD' ? 'text-yellow-300' :
                      'text-red-300'
                    }`} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">Bed #{bed.bed_id}</h3>
                  <dl className="mt-1 flex flex-grow flex-col justify-between">
                    <dt className="sr-only">Status</dt>
                    <dd className="mt-2">{getStatusBadge(bed.status)}</dd>
                    <dt className="sr-only">Guest</dt>
                    <dd className="mt-2 text-sm text-white/60">
                      {bed.status === 'HELD' ? 'Reserved' : 'No guest'}
                    </dd>
                  </dl>
                </>
              )}
            </div>
            <div>
              <div className="-mt-px flex divide-x divide-white/10">
                <div className="flex w-0 flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStatusChange(bed.bed_id, 'AVAILABLE'); }}
                    className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-2 rounded-bl-xl border border-transparent py-3 text-sm font-semibold text-green-300 hover:bg-green-500/20 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    Free
                  </button>
                </div>
                <div className="-ml-px flex w-0 flex-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openAssignModal(bed.bed_id); }}
                    className="relative inline-flex w-0 flex-1 items-center justify-center gap-x-2 rounded-br-xl border border-transparent py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal */}
      {selectedBed && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedBed(null)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
              <div>
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md ${
                  selectedBed.status === 'AVAILABLE' ? 'bg-green-500/20 border border-green-400/30' :
                  selectedBed.status === 'HELD' ? 'bg-yellow-500/20 border border-yellow-400/30' :
                  'bg-red-500/20 border border-red-400/30'
                }`}>
                  <BedDouble className={`h-6 w-6 ${
                    selectedBed.status === 'AVAILABLE' ? 'text-green-300' :
                    selectedBed.status === 'HELD' ? 'text-yellow-300' :
                    'text-red-300'
                  }`} />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg font-semibold leading-6 text-white">
                    Manage Bed #{selectedBed.bed_id}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-white/80">
                      Current status: {getStatusBadge(selectedBed.status)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 space-y-3">
                <button
                  onClick={() => handleStatusChange(selectedBed.bed_id, 'AVAILABLE')}
                  className="inline-flex w-full justify-center rounded-lg bg-green-500/30 backdrop-blur-md border border-green-400/30 px-3 py-2 text-sm font-semibold text-green-300 shadow-lg hover:bg-green-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
                >
                  <Check className="mr-2 h-4 w-4" /> Mark Available
                </button>
                <button
                  onClick={() => handleStatusChange(selectedBed.bed_id, 'HELD')}
                  className="inline-flex w-full justify-center rounded-lg bg-yellow-500/30 backdrop-blur-md border border-yellow-400/30 px-3 py-2 text-sm font-semibold text-yellow-300 shadow-lg hover:bg-yellow-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
                >
                  <Clock className="mr-2 h-4 w-4" /> Mark Reserved
                </button>
                <button
                  onClick={() => handleStatusChange(selectedBed.bed_id, 'OCCUPIED')}
                  className="inline-flex w-full justify-center rounded-lg bg-red-500/30 backdrop-blur-md border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-300 shadow-lg hover:bg-red-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                >
                  <User className="mr-2 h-4 w-4" /> Mark Occupied
                </button>
                <button
                  onClick={() => setSelectedBed(null)}
                  className="inline-flex w-full justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:bg-white/20 ring-1 ring-inset ring-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guest Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => { setShowAssignModal(false); setBedToAssign(null); setGuestSearch(''); }}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 backdrop-blur-md border border-red-400/30">
                  <UserCircle className="h-6 w-6 text-red-300" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg font-semibold leading-6 text-white">
                    Assign Guest to Bed #{bedToAssign}
                  </h3>
                  <p className="mt-2 text-sm text-white/80">
                    Search for a guest or select from recently added guests
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-4">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-5 w-5 text-white/60" />
                  </div>
                  <input
                    type="text"
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-white bg-white/10 backdrop-blur-md ring-1 ring-inset ring-white/20 placeholder:text-white/40 focus:ring-2 focus:ring-inset focus:ring-red-400 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>

              {/* Guest List */}
              <div className="mt-4 max-h-96 overflow-y-auto">
                {guests.length === 0 ? (
                  <div className="text-center py-8">
                    <UserCircle className="mx-auto h-12 w-12 text-white/40" />
                    <p className="mt-2 text-sm text-white/60">No available guests found</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {guests
                      .filter(g => 
                        guestSearch === '' || 
                        `${g.first_name} ${g.last_name}`.toLowerCase().includes(guestSearch.toLowerCase())
                      )
                      .sort((a, b) => b.id - a.id) // Most recent first
                      .slice(0, guestSearch ? 50 : 10) // Show 10 recent if no search, 50 if searching
                      .map((guest) => (
                        <li key={guest.id} className="py-3 hover:bg-white/10 rounded-lg px-3 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {guest.photo_url ? (
                                <img src={guest.photo_url} alt={guest.first_name} className="h-10 w-10 rounded-full ring-2 ring-red-400" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                  <UserCircle className="h-6 w-6 text-white/60" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {guest.first_name} {guest.last_name}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-white/60">
                                    {guest.days_in_shelter} days in shelter
                                  </p>
                                  {guest.bed_id && (
                                    <span className="inline-flex items-center rounded-md bg-blue-500/20 backdrop-blur-md px-2 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-400/30">
                                      Currently: Bed #{guest.bed_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => assignGuestToBed(guest.id)}
                              className="inline-flex items-center rounded-lg bg-red-500/30 backdrop-blur-md border border-red-400/30 px-3 py-1.5 text-sm font-semibold text-red-300 shadow-lg hover:bg-red-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                            >
                              {guest.bed_id && guest.bed_id !== bedToAssign ? 'Reassign' : 'Assign'}
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 sm:mt-6">
                <button
                  onClick={() => { setShowAssignModal(false); setBedToAssign(null); setGuestSearch(''); }}
                  className="inline-flex w-full justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-inset ring-white/20 hover:bg-white/20"
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
