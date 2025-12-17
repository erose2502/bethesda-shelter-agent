import { useState, useEffect } from 'react';
import { BedDouble, Check, Clock, User, Activity } from 'lucide-react';

type BedStatus = 'available' | 'held' | 'occupied';

interface Bed {
  bed_id: number;
  status: BedStatus;
  guest_name?: string;
  reservation_id?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://bethesda-shelter-agent-production.up.railway.app';

export default function BedMap() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [stats, setStats] = useState({ available: 0, held: 0, occupied: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchBeds();
    const interval = setInterval(fetchBeds, 10000); // Refresh every 10 seconds for real-time updates
    return () => clearInterval(interval);
  }, []);

  const fetchBeds = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/beds/`);
      if (response.ok) {
        const data = await response.json();
        setBeds(data.available !== undefined ? generateMockBeds(data.available) : generateMockBeds(42));
        calculateStats(data.available !== undefined ? generateMockBeds(data.available) : generateMockBeds(42));
      } else {
        // Mock data for development
        const mockBeds = generateMockBeds(42);
        setBeds(mockBeds);
        calculateStats(mockBeds);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching beds:', error);
      // Mock data fallback
      const mockBeds = generateMockBeds(42);
      setBeds(mockBeds);
      calculateStats(mockBeds);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateMockBeds = (availableCount: number): Bed[] => {
    const allBeds: Bed[] = [];
    for (let i = 1; i <= 108; i++) {
      if (i <= availableCount) {
        allBeds.push({ bed_id: i, status: 'available' });
      } else if (i <= availableCount + 15) {
        allBeds.push({ bed_id: i, status: 'held', reservation_id: `BM-${1000 + i}` });
      } else {
        allBeds.push({ bed_id: i, status: 'occupied', guest_name: `Guest ${i}` });
      }
    }
    return allBeds;
  };

  const calculateStats = (bedList: Bed[]) => {
    const available = bedList.filter(b => b.status === 'available').length;
    const held = bedList.filter(b => b.status === 'held').length;
    const occupied = bedList.filter(b => b.status === 'occupied').length;
    setStats({ available, held, occupied });
  };

  const getBedColor = (status: BedStatus): string => {
    switch (status) {
      case 'available':
        return 'bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-900/50 border-emerald-400/30';
      case 'held':
        return 'bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-lg shadow-amber-900/50 border-amber-400/30';
      case 'occupied':
        return 'bg-gradient-to-br from-[#b8272f] to-[#8b1f25] hover:from-[#c02f37] hover:to-[#9a2329] shadow-lg shadow-red-900/50 border-[#b8272f]/30';
    }
  };

  const handleBedClick = (bed: Bed) => {
    setSelectedBed(bed);
  };

  const handleStatusChange = async (bedId: number, newStatus: BedStatus) => {
    // Update locally for immediate feedback
    setBeds(beds.map(b => b.bed_id === bedId ? { ...b, status: newStatus } : b));
    calculateStats(beds.map(b => b.bed_id === bedId ? { ...b, status: newStatus } : b));
    setSelectedBed(null);
    
    // TODO: Send update to backend
    console.log(`Bed ${bedId} status changed to ${newStatus}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-2xl text-purple-300">Loading bed data...</div>
      </div>
    );
  }

  const availableBeds = beds.filter(b => b.status === 'available');
  const heldBeds = beds.filter(b => b.status === 'held');
  const occupiedBeds = beds.filter(b => b.status === 'occupied');

  return (
    <div>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="glass rounded-xl p-4 border-l-4 border-emerald-500 hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-xs font-semibold mb-1 uppercase tracking-wide">Available</p>
              <p className="text-4xl md:text-5xl font-bold text-emerald-400">{stats.available}</p>
              <p className="text-xs text-slate-400 mt-1">Ready for check-in</p>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <Check className="w-7 h-7 md:w-8 md:h-8 text-emerald-400" />
            </div>
          </div>
        </div>
        
        <div className="glass rounded-xl p-4 border-l-4 border-amber-500 hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-xs font-semibold mb-1 uppercase tracking-wide">Reserved</p>
              <p className="text-4xl md:text-5xl font-bold text-amber-400">{stats.held}</p>
              <p className="text-xs text-slate-400 mt-1">3-hour hold</p>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Clock className="w-7 h-7 md:w-8 md:h-8 text-amber-400" />
            </div>
          </div>
        </div>
        
        <div className="glass rounded-xl p-4 border-l-4 border-[#b8272f] hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-xs font-semibold mb-1 uppercase tracking-wide">Occupied</p>
              <p className="text-4xl md:text-5xl font-bold text-[#d4a017]">{stats.occupied}</p>
              <p className="text-xs text-slate-400 mt-1">Currently in use</p>
            </div>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-[#b8272f]/20 to-[#8b1f25]/10 rounded-xl flex items-center justify-center border border-[#b8272f]/30">
              <User className="w-7 h-7 md:w-8 md:h-8 text-[#d4a017]" />
            </div>
          </div>
        </div>
      </div>

      {/* Bed Categories */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3 md:mb-4 flex-wrap gap-2">
          <h2 className="text-xl md:text-2xl font-bold text-white">Bed Status by Category</h2>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <span className="text-sm font-semibold text-[#d4a017] bg-[#1a2332]/80 px-3 py-1.5 rounded-lg border border-[#d4a017]/30">
              108 Total
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#1a2332]/80 px-2.5 py-1.5 rounded-lg border border-[#4a5568]/30">
              {isRefreshing ? (
                <>
                  <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="hidden sm:inline">Live • </span>
                  <span>{lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Available Beds */}
        {availableBeds.length > 0 && (
          <div className="mb-4 md:mb-5">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <Check className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base md:text-lg font-semibold text-white">
                Available Beds ({availableBeds.length})
              </h3>
            </div>
            <div className="bg-[#0a0f1a]/40 rounded-xl p-3 md:p-4 border border-emerald-500/20">
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2">
                {availableBeds.map((bed) => (
                  <button
                    key={bed.bed_id}
                    onClick={() => handleBedClick(bed)}
                    className={`
                      ${getBedColor(bed.status)}
                      w-10 h-10 md:w-12 md:h-12
                      rounded-lg
                      flex items-center justify-center
                      text-white font-semibold text-xs md:text-sm
                      transition-all duration-300
                      hover:scale-110 hover:z-10
                      border-2
                    `}
                    title={`Bed ${bed.bed_id} - Available`}
                  >
                    {bed.bed_id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reserved Beds */}
        {heldBeds.length > 0 && (
          <div className="mb-4 md:mb-5">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="text-base md:text-lg font-semibold text-white">
                Reserved Beds ({heldBeds.length})
              </h3>
            </div>
            <div className="bg-[#0a0f1a]/40 rounded-xl p-3 md:p-4 border border-amber-500/20">
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2">
                {heldBeds.map((bed) => (
                  <button
                    key={bed.bed_id}
                    onClick={() => handleBedClick(bed)}
                    className={`
                      ${getBedColor(bed.status)}
                      w-10 h-10 md:w-12 md:h-12
                      rounded-lg
                      flex items-center justify-center
                      text-white font-semibold text-xs md:text-sm
                      transition-all duration-300
                      hover:scale-110 hover:z-10
                      border-2
                    `}
                    title={`Bed ${bed.bed_id} - Reserved`}
                  >
                    {bed.bed_id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Occupied Beds */}
        {occupiedBeds.length > 0 && (
          <div className="mb-4 md:mb-5">
            <div className="flex items-center gap-2 mb-2 md:mb-3">
              <User className="w-5 h-5 text-[#d4a017]" />
              <h3 className="text-base md:text-lg font-semibold text-white">
                Occupied Beds ({occupiedBeds.length})
              </h3>
            </div>
            <div className="bg-[#0a0f1a]/40 rounded-xl p-3 md:p-4 border border-[#b8272f]/20">
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-2">
                {occupiedBeds.map((bed) => (
                  <button
                    key={bed.bed_id}
                    onClick={() => handleBedClick(bed)}
                    className={`
                      ${getBedColor(bed.status)}
                      w-10 h-10 md:w-12 md:h-12
                      rounded-lg
                      flex items-center justify-center
                      text-white font-semibold text-xs md:text-sm
                      transition-all duration-300
                      hover:scale-110 hover:z-10
                      border-2
                    `}
                    title={`Bed ${bed.bed_id} - Occupied`}
                  >
                    {bed.bed_id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Bed Details Modal */}
      {selectedBed && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
          <div className="glass-dark rounded-2xl p-5 md:p-8 max-w-md w-full border border-[#4a5568]/50 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-[#b8272f] to-[#8b1f25] rounded-xl flex items-center justify-center">
                <BedDouble className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-white">
                  Bed #{selectedBed.bed_id}
                </h3>
                <p className="text-slate-400 text-xs md:text-sm">Update bed status</p>
              </div>
            </div>
            
            <div className="bg-[#0a0f1a]/60 rounded-xl p-4 mb-5 border border-[#4a5568]/30">
              <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wide">Current Status</p>
              <p className="text-xl md:text-2xl font-bold text-[#d4a017] capitalize">{selectedBed.status}</p>
              {selectedBed.guest_name && (
                <div className="flex items-center gap-2 mt-3 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">Guest: <span className="font-semibold">{selectedBed.guest_name}</span></span>
                </div>
              )}
              {selectedBed.reservation_id && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300">Reservation: <span className="font-mono font-semibold">{selectedBed.reservation_id}</span></span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 mb-5">
              <p className="text-slate-300 text-xs font-semibold mb-2 uppercase tracking-wide">Update Status:</p>
              <button
                onClick={() => handleStatusChange(selectedBed.bed_id, 'available')}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-lg text-white text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-emerald-900/50 border border-emerald-400/30"
              >
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Mark Available
                </span>
              </button>
              <button
                onClick={() => handleStatusChange(selectedBed.bed_id, 'held')}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-lg text-white text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-amber-900/50 border border-amber-400/30"
              >
                <span className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" /> Mark Reserved
                </span>
              </button>
              <button
                onClick={() => handleStatusChange(selectedBed.bed_id, 'occupied')}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#b8272f] to-[#8b1f25] hover:from-[#c02f37] hover:to-[#9a2329] rounded-lg text-white text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-red-900/50 border border-[#b8272f]/30"
              >
                <span className="flex items-center justify-center gap-2">
                  <User className="w-4 h-4" /> Mark Occupied
                </span>
              </button>
            </div>

            <button
              onClick={() => setSelectedBed(null)}
              className="w-full py-3 px-4 bg-[#2d3748]/80 hover:bg-[#4a5568]/80 rounded-lg text-white text-base font-semibold transition-all duration-300 border border-[#4a5568]/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
