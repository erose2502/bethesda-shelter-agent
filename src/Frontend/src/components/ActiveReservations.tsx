import { useState, useEffect } from 'react';
import { User, BedDouble, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw, Phone, Activity } from 'lucide-react';
import config from '../config';

interface Reservation {
  reservation_id: string;
  bed_id: number;
  caller_name: string;
  situation: string;
  needs: string;
  created_at: string;
  expires_at?: string;
  status: string;
}

export default function ActiveReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchReservations();
    // Poll every 1 second
    const interval = setInterval(fetchReservations, 1000);
    
    const handleFocus = () => fetchReservations();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchReservations = async () => {
    // Avoid double-fetching
    if (isRefreshing && reservations.length > 0) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/reservations/`, {
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        const newReservations = data.reservations || [];

        setReservations(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newReservations)) {
            return newReservations;
          }
          return prev;
        });
      } else {
        // Try to log and display the error response body
        let errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          errorText = errorJson.detail || errorText;
        } catch {}
        console.error('Error fetching reservations:', errorText);
        alert('Error fetching reservations: ' + errorText);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching reservations:', error);
      alert('Error fetching reservations: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt: string): string => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) return 'EXPIRED';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const handleCheckIn = async (reservationId: string, bedId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/beds/${bedId}/checkin?reservation_id=${reservationId}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Refresh list to remove the checked-in reservation
        fetchReservations();
      } else {
        const err = await response.json();
        alert(`Check-in failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Error connecting to server');
    }
  };

  const handleCancel = async (reservationId: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    
    try {
      const response = await fetch(`${config.apiUrl}/api/reservations/${reservationId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchReservations();
      } else {
        alert('Failed to cancel reservation');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('Error connecting to server');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-2xl text-purple-300">Loading reservations...</div>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12 md:py-20">
        <div className="w-24 h-24 md:w-32 md:h-32 mx-auto bg-gradient-to-br from-[#b8272f]/20 to-[#8b1f25]/10 rounded-2xl flex items-center justify-center mb-4 md:mb-6 border border-[#b8272f]/30">
          <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-[#b8272f]" />
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">No Active Reservations</h3>
        <p className="text-base md:text-xl text-slate-400 mb-4 md:mb-6">All reservations have been processed or expired.</p>
        <button
          onClick={fetchReservations}
          className="py-2.5 px-6 md:py-3 md:px-8 bg-gradient-to-r from-[#b8272f] to-[#8b1f25] hover:from-[#c02f37] hover:to-[#9a2329] rounded-lg text-white text-base font-semibold transition-all duration-300 shadow-lg border border-[#b8272f]/30 inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              Active Reservations
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-[#1a2332]/80 px-2.5 py-1 rounded-lg border border-[#4a5568]/30">
              {isRefreshing ? (
                <>
                  <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="hidden sm:inline">Live •</span>
                  <span>{lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            <span className="text-[#d4a017] font-bold">{reservations.length}</span> pending check-in{reservations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchReservations}
          disabled={isRefreshing}
          className="py-2.5 px-4 md:px-6 bg-gradient-to-r from-[#b8272f] to-[#8b1f25] hover:from-[#c02f37] hover:to-[#9a2329] rounded-lg text-white text-sm md:text-base font-semibold transition-all duration-300 shadow-lg border border-[#b8272f]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="space-y-3 md:space-y-4">
        {reservations.map((reservation) => {
          const timeRemaining = reservation.expires_at ? getTimeRemaining(reservation.expires_at) : 'N/A';
          const isExpiringSoon = reservation.expires_at && 
            new Date(reservation.expires_at).getTime() - new Date().getTime() < 60 * 60 * 1000; // Less than 1 hour

          return (
            <div
              key={reservation.reservation_id}
              className={`glass rounded-xl p-4 md:p-5 border-l-4 hover:scale-[1.005] transition-transform ${
                isExpiringSoon ? 'border-[#b8272f]' : 'border-emerald-500'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
                {/* Guest Info */}
                <div className="lg:col-span-2">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#d4a017] to-[#b8272f] rounded-lg flex items-center justify-center">
                        <User className="w-5 h-5 md:w-6 md:h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                          {reservation.caller_name}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-slate-300 text-xs md:text-sm">
                          <span className="flex items-center gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            Bed <span className="font-bold text-[#d4a017]">#{reservation.bed_id}</span>
                          </span>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <span className="font-mono font-bold text-[#d4a017]">{reservation.reservation_id}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold mb-4 border ${
                    isExpiringSoon 
                      ? 'bg-[#b8272f]/20 text-[#ff6b6b] border-[#b8272f]/40' 
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}>
                    <Clock className="w-4 h-4" />
                    {timeRemaining} remaining
                  </div>

                  <div className="bg-[#0a0f1a]/40 rounded-lg p-3 md:p-4 space-y-2.5 border border-[#4a5568]/20">
                    <div>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide block mb-1">Situation</span>
                      <p className="text-white text-sm md:text-base">{reservation.situation}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide block mb-1">Needs</span>
                      <p className="text-white text-sm md:text-base">{reservation.needs}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs font-semibold uppercase tracking-wide block mb-1">Reserved At</span>
                      <p className="text-white text-sm font-mono">
                        {new Date(reservation.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 md:gap-2.5 justify-center">
                  <button
                    onClick={() => handleCheckIn(reservation.reservation_id, reservation.bed_id)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-lg text-white text-sm md:text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-emerald-900/50 hover:scale-[1.02] border border-emerald-400/30"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Check In Guest
                    </span>
                  </button>
                  <button
                    onClick={() => handleCancel(reservation.reservation_id)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-[#b8272f] to-[#8b1f25] hover:from-[#c02f37] hover:to-[#9a2329] rounded-lg text-white text-sm md:text-base font-semibold transition-all duration-300 shadow-lg hover:shadow-red-900/50 hover:scale-[1.02] border border-[#b8272f]/30"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" /> Cancel
                    </span>
                  </button>
                  <button
                    className="w-full py-2.5 px-4 bg-[#2d3748]/60 hover:bg-[#4a5568]/60 rounded-lg text-slate-300 text-xs md:text-sm font-semibold transition-all duration-300 border border-[#4a5568]/40"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Contact
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}