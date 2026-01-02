import { useState, useEffect } from 'react';
import { Check, Clock, User, Activity } from 'lucide-react';

type BedStatus = 'available' | 'held' | 'occupied';

interface Bed {
  bed_id: number;
  status: BedStatus;
  guest_name?: string;
  reservation_id?: string;
}

// IMPORTANT: Ensure this points to your running backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function BedMap() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [stats, setStats] = useState({ available: 0, held: 0, occupied: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

 useEffect(() => {
    fetchBeds();
    
  // Poll every 2 seconds for near real-time updates when phone calls come in
  const interval = setInterval(fetchBeds, 2000); 

    // Update immediately when user clicks back to this tab
    const handleFocus = () => fetchBeds();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchBeds = async () => {
    // Prevent multiple fetches running at the same time
    if (isRefreshing && beds.length > 0) return;
    
    setIsRefreshing(true);
    try {
      // 3. Add 'cache: no-store' to prevent browser from showing old data
      const response = await fetch(`${API_URL}/api/beds/list`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data: Bed[] = await response.json();
        const sortedBeds = data.sort((a, b) => a.bed_id - b.bed_id);
        
        // Only update state if data actually changed to prevent UI flickering
        // (JSON.stringify is a quick way to compare simple arrays)
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
    const available = bedList.filter(b => b.status === 'available').length;
    const held = bedList.filter(b => b.status === 'held').length;
    const occupied = bedList.filter(b => b.status === 'occupied').length;
    setStats({ available, held, occupied });
  };

  const handleStatusChange = async (bedId: number, newStatus: BedStatus) => {
    // 1. Optimistic Update (Immediate UI feedback)
    setBeds(prev => prev.map(b => b.bed_id === bedId ? { ...b, status: newStatus } : b));
    setSelectedBed(null);

    // 2. Send to Backend
    try {
      let endpoint = '';
      if (newStatus === 'available') endpoint = `${API_URL}/api/beds/${bedId}/checkout`;
      else if (newStatus === 'held') endpoint = `${API_URL}/api/beds/${bedId}/hold`;
      else if (newStatus === 'occupied') endpoint = `${API_URL}/api/beds/${bedId}/checkin`;

      const res = await fetch(endpoint, { method: 'POST' });
      
      // 3. If failed, revert (fetch real data again)
      if (!res.ok) {
        console.error("Update failed");
        fetchBeds(); 
        alert("Failed to update status. Server might be offline.");
      } else {
        // Success: Trigger a refresh just to be sure we are in sync
        setTimeout(fetchBeds, 500);
      }
    } catch (e) {
      console.error(e);
      fetchBeds();
    }
  };

  const getBedColor = (status: BedStatus) => {
    switch (status) {
      case 'available': return 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30';
      case 'held': return 'bg-amber-600 hover:bg-amber-500 border-amber-400/30';
      case 'occupied': return 'bg-red-700 hover:bg-red-600 border-red-500/30';
      default: return 'bg-slate-600';
    }
  };

  if (loading && beds.length === 0) return <div className="p-10 text-center text-white">Loading Real Data...</div>;

  return (
    <div>
      {/* HEADER STATS */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Available" value={stats.available} icon={<Check className="text-emerald-400" />} color="emerald" />
        <StatCard label="Reserved" value={stats.held} icon={<Clock className="text-amber-400" />} color="amber" />
        <StatCard label="Occupied" value={stats.occupied} icon={<User className="text-red-400" />} color="red" />
      </div>

      {/* BED GRID */}
      <div className="bg-[#0a0f1a]/40 p-4 rounded-xl border border-slate-700/50">
         <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Live Bed Map</h2>
            <div className="text-xs text-slate-400 flex items-center gap-2">
                {isRefreshing && <Activity className="w-3 h-3 animate-spin" />}
                Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
         </div>
         
         <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
            {beds.map(bed => (
              <button
                key={bed.bed_id}
                onClick={() => setSelectedBed(bed)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm transition-all border-2 shadow-lg ${getBedColor(bed.status)}`}
              >
                {bed.bed_id}
              </button>
            ))}
         </div>
      </div>

      {/* MODAL */}
      {selectedBed && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-xl w-96 max-w-full border border-slate-600">
            <h3 className="text-2xl font-bold text-white mb-4">Manage Bed #{selectedBed.bed_id}</h3>
            <div className="space-y-3">
              <button onClick={() => handleStatusChange(selectedBed.bed_id, 'available')} className="w-full p-3 bg-emerald-600 rounded text-white font-bold">Mark Available</button>
              <button onClick={() => handleStatusChange(selectedBed.bed_id, 'held')} className="w-full p-3 bg-amber-600 rounded text-white font-bold">Mark Reserved</button>
              <button onClick={() => handleStatusChange(selectedBed.bed_id, 'occupied')} className="w-full p-3 bg-red-700 rounded text-white font-bold">Mark Occupied</button>
              <button onClick={() => setSelectedBed(null)} className="w-full p-3 bg-slate-600 rounded text-white mt-4">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <div className={`p-4 rounded-xl border-l-4 bg-slate-800/50 border-${color}-500`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-slate-400 text-xs uppercase">{label}</p>
          <p className={`text-3xl font-bold text-${color}-400`}>{value}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-lg">{icon}</div>
      </div>
    </div>
  )
}