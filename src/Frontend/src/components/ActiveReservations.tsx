import { useState, useEffect } from 'react';
import { BedDouble, Clock, AlertCircle, CheckCircle, XCircle, Activity } from 'lucide-react';
import config from '../config';

interface Reservation {
  reservation_id: string;
  bed_id: number;
  caller_name: string;
  situation: string;
  needs: string;
  preferred_language?: string;
  created_at: string;
  expires_at?: string;
  status: string;
}

export default function ActiveReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    fetchReservations();
    const interval = setInterval(fetchReservations, 1000);
    const handleFocus = () => fetchReservations();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchReservations = async () => {
    if (isRefreshing && reservations.length > 0) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/reservations/`, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        const newReservations = data.reservations || [];
        setReservations(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newReservations)) {
            return newReservations;
          }
          return prev;
        });
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching reservations:', error);
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
      const response = await fetch(`${config.apiUrl}/api/beds/${bedId}/checkin?reservation_id=${reservationId}`, { method: 'POST' });
      if (response.ok) {
        fetchReservations();
      } else {
        const err = await response.json();
        alert(`Check-in failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Check-in failed');
    }
  };

  const handleCancelReservation = async (reservationId: string) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/reservations/${reservationId}/cancel`, { method: 'POST' });
      if (response.ok) {
        fetchReservations();
        setSelectedReservation(null);
      } else {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        alert(`Failed to cancel reservation: ${err.detail}`);
      }
    } catch (error) {
      console.error('Error canceling reservation:', error);
      alert('Failed to cancel reservation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Reservations</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage bed reservations and check-ins
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {isRefreshing && <Activity className="w-3 h-3 animate-spin" />}
            <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Reservations</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{reservations.length}</dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Expiring Soon</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-yellow-600">
            {reservations.filter(r => r.expires_at && getTimeRemaining(r.expires_at) !== 'EXPIRED' && new Date(r.expires_at).getTime() - new Date().getTime() < 30 * 60 * 1000).length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 py-5 shadow sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Ready for Check-in</dt>
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-600">{reservations.filter(r => r.status === 'active').length}</dd>
        </div>
      </div>

      {/* Reservations List */}
      {reservations.length === 0 ? (
        <div className="text-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12">
          <BedDouble className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No reservations</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">All beds are either available or occupied.</p>
        </div>
      ) : (
        <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg">
          <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
            {reservations.map((reservation) => {
              const timeRemaining = reservation.expires_at ? getTimeRemaining(reservation.expires_at) : null;
              const isExpiringSoon = timeRemaining && timeRemaining !== 'EXPIRED' && reservation.expires_at && 
                new Date(reservation.expires_at).getTime() - new Date().getTime() < 30 * 60 * 1000;
              const isExpired = timeRemaining === 'EXPIRED';

              return (
                <li key={reservation.reservation_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`flex-shrink-0 rounded-full p-3 ${
                          isExpired ? 'bg-red-100 dark:bg-red-400/10' :
                          isExpiringSoon ? 'bg-yellow-100 dark:bg-yellow-400/10' :
                          'bg-green-100 dark:bg-green-400/10'
                        }`}>
                          <BedDouble className={`h-6 w-6 ${
                            isExpired ? 'text-red-600 dark:text-red-400' :
                            isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {reservation.caller_name}
                            </p>
                            <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-400/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
                              Bed #{reservation.bed_id}
                            </span>
                            {reservation.preferred_language && reservation.preferred_language !== 'English' && (
                              <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-400/10 px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-400 ring-1 ring-inset ring-purple-700/10 dark:ring-purple-400/20">
                                🌍 {reservation.preferred_language}
                              </span>
                            )}
                            {timeRemaining && (
                              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                                isExpired ? 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-400 ring-red-600/10 dark:ring-red-400/20' :
                                isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-400/10 text-yellow-800 dark:text-yellow-400 ring-yellow-600/20 dark:ring-yellow-400/20' :
                                'bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400 ring-green-600/20 dark:ring-green-400/20'
                              }`}>
                                <Clock className="mr-1 h-3 w-3" />
                                {timeRemaining}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-col gap-1">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Situation:</span> {reservation.situation}
                            </p>
                            {reservation.needs && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-medium">Needs:</span> {reservation.needs}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              Reserved: {new Date(reservation.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-shrink-0 gap-2">
                        <button
                          onClick={() => handleCheckIn(reservation.reservation_id, reservation.bed_id)}
                          className="inline-flex items-center gap-x-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                        >
                          <CheckCircle className="-ml-0.5 h-4 w-4" />
                          Check In
                        </button>
                        <button
                          onClick={() => setSelectedReservation(reservation)}
                          className="inline-flex items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                          <XCircle className="-ml-0.5 h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {selectedReservation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" onClick={() => setSelectedReservation(null)}></div>
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-400/10 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">Cancel Reservation</h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to cancel the reservation for <span className="font-semibold">{selectedReservation.caller_name}</span> (Bed #{selectedReservation.bed_id})?
                      This action cannot be undone and the bed will become available.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={() => handleCancelReservation(selectedReservation.reservation_id)}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:w-auto"
                >
                  Cancel Reservation
                </button>
                <button
                  onClick={() => setSelectedReservation(null)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
                >
                  Keep Reservation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
