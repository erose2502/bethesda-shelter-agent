import { useState, useEffect, useRef } from 'react';
import { Home, BedDouble, ClipboardList, Church, Users, Menu, X, BarChart3, Sun, Moon, ChevronDown, Bell } from 'lucide-react';
import BedMap from './components/BedMap';
import ActiveReservations from './components/ActiveReservations';
import ChapelSchedule from './components/ChapelSchedule';
import VolunteerManagement from './components/VolunteerManagement';
import GuestManagement from './components/GuestManagement';
import config from './config';
import './App.css';

type TabType = 'dashboard' | 'beds' | 'reservations' | 'chapel' | 'volunteers' | 'guests';

interface Supervisor {
  name: string;
  role: string;
  avatar: string;
  initials: string;
  bio?: string;
}

interface Notification {
  id: string;
  type: 'reservation' | 'chapel' | 'volunteer';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  tab?: TabType;
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'reservation' | 'chapel' | 'volunteer';
}

const navigation = [
  { name: 'Dashboard', value: 'dashboard' as TabType, icon: BarChart3 },
  { name: 'Bed Map', value: 'beds' as TabType, icon: BedDouble },
  { name: 'Reservations', value: 'reservations' as TabType, icon: ClipboardList },
  { name: 'Chapel Services', value: 'chapel' as TabType, icon: Church },
  { name: 'Volunteers', value: 'volunteers' as TabType, icon: Users },
  { name: 'Guests', value: 'guests' as TabType, icon: Users },
];

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const previousReservationCount = useRef(0);
  const notifiedReservationIds = useRef(new Set<string>()); // FIX: reservation_id is a string

  const [stats, setStats] = useState({
    totalBeds: 108,
    occupied: 0,
    available: 0,
    reserved: 0,
    activeReservations: 0,
    upcomingChapel: 0,
    activeVolunteers: 0,
  });

  // Editable supervisor data
  const [supervisor, setSupervisor] = useState<Supervisor>(() => {
    const saved = localStorage.getItem('supervisorProfile');
    return saved ? JSON.parse(saved) : {
      name: 'Elijah Rogito',
      role: 'Supervisor',
      avatar: 'https://ui-avatars.com/api/?name=Elijah+Rogito&background=ef4444&color=fff&bold=true&size=128',
      initials: 'ER',
      bio: 'Dedicated to serving our community and providing shelter to those in need.',
    };
  });
  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Save supervisor profile
  useEffect(() => {
    localStorage.setItem('supervisorProfile', JSON.stringify(supervisor));
  }, [supervisor]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [bedsRes, reservationsRes, chapelRes, volunteersRes] = await Promise.all([
          fetch(`${config.apiUrl}/api/beds/`, { cache: 'no-store' }),
          fetch(`${config.apiUrl}/api/reservations/`, { cache: 'no-store' }),
          fetch(`${config.apiUrl}/api/chapel/`, { cache: 'no-store' }),
          fetch(`${config.apiUrl}/api/volunteers/`, { cache: 'no-store' }),
        ]);

        const beds = await bedsRes.json();
        const reservations = await reservationsRes.json();
        const chapel = await chapelRes.json();
        const volunteers = await volunteersRes.json();

        const currentReservationCount = Array.isArray(reservations.reservations) ? reservations.reservations.length : 0;

        // Check for new reservations
        if (Array.isArray(reservations.reservations)) {
          const isInitialLoad = previousReservationCount.current === 0;
          
          reservations.reservations.forEach((reservation: any) => {
            const reservationId = reservation.reservation_id; // FIX: Use reservation_id not id
            
            // Only notify if we haven't seen this reservation ID before
            if (!notifiedReservationIds.current.has(reservationId)) {
              notifiedReservationIds.current.add(reservationId);
              
              // Only show notification if this isn't the initial load
              if (!isInitialLoad) {
                const notification: Notification = {
                  id: `reservation-${reservationId}`,
                  type: 'reservation',
                  title: 'New Bed Reservation',
                  message: `${reservation.caller_name} has reserved bed #${reservation.bed_id}`,
                  timestamp: new Date(),
                  read: false,
                  tab: 'reservations',
                };
                setNotifications(prev => [notification, ...prev]);
                
                // Add toast notification
                const toast: ToastNotification = {
                  id: `toast-${reservationId}-${Date.now()}`,
                  type: 'reservation',
                  title: 'New Bed Reservation',
                  message: `${reservation.caller_name} has reserved bed #${reservation.bed_id}`,
                };
                setToastNotifications(prev => [...prev, toast]);
                
                // Auto-remove toast after 5 seconds
                setTimeout(() => {
                  setToastNotifications(prev => prev.filter(t => t.id !== toast.id));
                }, 5000);
                
                // Play notification sound
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUA0PVa3l7alVFAhGnt/zv20cBTC/0POugzcIHmy+7+Wcug0PU6zj7q1WFQlHn+Lyvmwc');
                audio.volume = 0.3;
                audio.play().catch(() => {});
              }
            }
          });
        }

        previousReservationCount.current = currentReservationCount;

        setStats({
          totalBeds: 108,
          occupied: beds.occupied || 0,
          available: beds.available || 0,
          reserved: beds.held || 0,
          activeReservations: currentReservationCount,
          upcomingChapel: Array.isArray(chapel) ? chapel.filter((s: any) => s.status === 'pending' || s.status === 'confirmed').length : 0,
          activeVolunteers: Array.isArray(volunteers) ? volunteers.filter((v: any) => v.status === 'active').length : 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000); // Check every 2 seconds for faster notifications
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`} style={{
      background: darkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
    }}>
      {/* Mobile sidebar */}
      <div className={`relative z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`} role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        <div className="fixed inset-0 flex">
          <div className="relative mr-16 flex w-full max-w-xs flex-1">
            <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
              <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 pb-2 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border-r border-white/20 dark:border-gray-700/30">
              <div className="flex h-16 shrink-0 items-center">
                <Home className="h-8 w-8 text-red-500" />
                <span className="ml-3 text-xl font-bold text-white">Bethesda Mission</span>
              </div>
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                  <li>
                    <ul role="list" className="-mx-2 space-y-1">
                      {navigation.map((item) => (
                        <li key={item.name}>
                          <button
                            onClick={() => {
                              setActiveTab(item.value);
                              setSidebarOpen(false);
                            }}
                            className={`group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold w-full transition-all ${
                              activeTab === item.value
                                ? 'bg-white/20 dark:bg-white/10 text-white shadow-lg backdrop-blur-md'
                                : 'text-white/80 hover:text-white hover:bg-white/10 backdrop-blur-sm'
                            }`}
                          >
                            <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                            {item.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r px-6 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/30">
          <div className="flex h-16 shrink-0 items-center">
            <Home className="h-8 w-8 text-red-500" />
            <span className="ml-3 text-xl font-bold text-white">Bethesda Mission</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <button
                        onClick={() => setActiveTab(item.value)}
                        className={`group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold w-full transition-all ${
                          activeTab === item.value
                            ? 'bg-white/20 dark:bg-white/10 text-white shadow-lg backdrop-blur-md'
                            : 'text-white/80 hover:text-white hover:bg-white/10 backdrop-blur-sm'
                        }`}
                      >
                        <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/30">
          <button type="button" className="-m-2.5 p-2.5 lg:hidden text-white" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="h-6 w-px lg:hidden bg-white/20" aria-hidden="true"></div>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h1 className="text-lg font-semibold text-white">
                {navigation.find(n => n.value === activeTab)?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="rounded-full p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all"
              >
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
                  className="relative rounded-full p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {notificationMenuOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-white/20">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                          No notifications
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => {
                                if (notif.tab) {
                                  setActiveTab(notif.tab);
                                }
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                setNotificationMenuOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 transition-colors ${
                                !notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 h-2 w-2 rounded-full ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {notif.title}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {new Date(notif.timestamp).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => {
                              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            Mark all as read
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block lg:h-6 lg:w-px bg-white/20" aria-hidden="true"></div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-x-3 rounded-full p-1.5 hover:bg-white/10 backdrop-blur-md transition-all"
                >
                  <span className="sr-only">Open user menu</span>
                  {supervisor.avatar ? (
                    <img className="h-8 w-8 rounded-full ring-2 ring-white/30" src={supervisor.avatar} alt="" />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-pink-500 ring-2 ring-white/30">
                      <span className="text-sm font-medium leading-none text-white">{supervisor.initials}</span>
                    </span>
                  )}
                  <span className="hidden lg:flex lg:items-center text-white">
                    <span className="text-sm font-semibold leading-6" aria-hidden="true">
                      {supervisor.name}
                    </span>
                    <ChevronDown className="ml-2 h-5 w-5 text-white/60" aria-hidden="true" />
                  </span>
                </button>

                {/* Dropdown menu */}
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)}></div>
                    <div className="absolute right-0 z-20 mt-2.5 w-48 origin-top-right rounded-xl py-2 shadow-lg ring-1 ring-white/10 focus:outline-none bg-white/10 dark:bg-gray-900/50 backdrop-blur-xl">
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-medium text-white">{supervisor.name}</p>
                        <p className="text-xs text-white/60">{supervisor.role}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingProfile(true);
                          setProfileMenuOpen(false);
                        }}
                        className="w-full text-left block px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all"
                      >
                        Edit Profile
                      </button>
                      <a href="#" className="block px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all">
                        Settings
                      </a>
                      <a href="#" className="block px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all">
                        Sign out
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {activeTab === 'dashboard' && (
              <div>
                {/* Stats - Tailwind Stats Simple Style */}
                <div className="mb-8">
                  <h3 className="text-base font-semibold leading-6 text-white">Overview</h3>
                  
                  {/* Primary Stats Row */}
                  <dl className="mt-5 grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-xl shadow-xl md:grid-cols-4 md:divide-x md:divide-y-0 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-base font-normal text-white/80">Total Beds</dt>
                      <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
                        <div className="flex items-baseline text-2xl font-semibold text-white">
                          {stats.totalBeds}
                        </div>
                      </dd>
                    </div>
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-base font-normal text-white/80">Available</dt>
                      <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
                        <div className="flex items-baseline text-2xl font-semibold text-green-400">
                          {stats.available}
                          <span className="ml-2 text-sm font-medium text-white/60">beds</span>
                        </div>
                      </dd>
                    </div>
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-base font-normal text-white/80">Reserved</dt>
                      <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
                        <div className="flex items-baseline text-2xl font-semibold text-yellow-400">
                          {stats.reserved}
                          <span className="ml-2 text-sm font-medium text-white/60">pending</span>
                        </div>
                      </dd>
                    </div>
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-base font-normal text-white/80">Occupied</dt>
                      <dd className="mt-1 flex items-baseline justify-between md:block lg:flex">
                        <div className="flex items-baseline text-2xl font-semibold text-red-400">
                          {stats.occupied}
                          <span className="ml-2 text-sm font-medium text-white/60">
                            ({Math.round((stats.occupied / stats.totalBeds) * 100)}%)
                          </span>
                        </div>
                      </dd>
                    </div>
                  </dl>

                  {/* Secondary Stats Row */}
                  <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="overflow-hidden rounded-xl px-4 py-5 shadow-xl sm:p-6 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
                      <dt className="truncate text-sm font-medium text-white/80">Active Reservations</dt>
                      <dd className="mt-1 flex items-baseline justify-between">
                        <div className="text-3xl font-semibold tracking-tight text-white">{stats.activeReservations}</div>
                        <span className="inline-flex items-center rounded-full bg-blue-500/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-400/30">
                          Pending
                        </span>
                      </dd>
                    </div>
                    <div className="overflow-hidden rounded-xl px-4 py-5 shadow-xl sm:p-6 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
                      <dt className="truncate text-sm font-medium text-white/80">Chapel Services</dt>
                      <dd className="mt-1 flex items-baseline justify-between">
                        <div className="text-3xl font-semibold tracking-tight text-white">{stats.upcomingChapel}</div>
                        <span className="inline-flex items-center rounded-full bg-purple-500/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-medium text-purple-300 ring-1 ring-purple-400/30">
                          Upcoming
                        </span>
                      </dd>
                    </div>
                    <div className="overflow-hidden rounded-xl px-4 py-5 shadow-xl sm:p-6 bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
                      <dt className="truncate text-sm font-medium text-white/80">Active Volunteers</dt>
                      <dd className="mt-1 flex items-baseline justify-between">
                        <div className="text-3xl font-semibold tracking-tight text-white">{stats.activeVolunteers}</div>
                        <span className="inline-flex items-center rounded-full bg-green-500/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-medium text-green-300 ring-1 ring-green-400/30">
                          Active
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Quick Links */}
                <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
                  <div className="border-b px-4 py-5 sm:px-6 border-white/10">
                    <h3 className="text-base font-semibold leading-6 text-white">Quick Actions</h3>
                  </div>
                  <ul role="list" className="divide-y divide-white/10">
                    {navigation.filter(n => n.value !== 'dashboard').map((item) => (
                      <li key={item.value}>
                        <button
                          onClick={() => setActiveTab(item.value)}
                          className="block w-full transition-all hover:bg-white/10"
                        >
                          <div className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <item.icon className="h-5 w-5 mr-3 text-white/60" />
                                <p className="truncate text-sm font-medium text-white">{item.name}</p>
                              </div>
                              <div className="ml-2 flex flex-shrink-0">
                                <p className="inline-flex rounded-full bg-red-500/20 backdrop-blur-md px-2 text-xs font-semibold leading-5 text-red-300 ring-1 ring-red-400/30">
                                  View
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {activeTab === 'beds' && <BedMap />}
            {activeTab === 'reservations' && <ActiveReservations />}
            {activeTab === 'chapel' && <ChapelSchedule />}
            {activeTab === 'volunteers' && <VolunteerManagement />}
            {activeTab === 'guests' && <GuestManagement />}
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 left-4 z-50 space-y-3 pointer-events-none w-96">
        {toastNotifications.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto transform transition-all duration-500 ease-out"
            style={{
              animation: 'slideInLeft 0.5s ease-out',
              animationDelay: `${index * 100}ms`,
            }}
          >
            <div className="relative overflow-hidden rounded-xl bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl shadow-2xl border border-white/30 dark:border-gray-700/30 p-4">
              {/* Accent bar with glow */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 to-red-600 shadow-lg shadow-red-500/50"></div>
              
              <div className="flex items-start pl-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                    <BedDouble className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-semibold text-white drop-shadow-lg">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-100 dark:text-gray-200 drop-shadow">
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToastNotifications(prev => prev.filter(t => t.id !== toast.id))}
                  className="ml-4 flex-shrink-0 inline-flex rounded-md text-white/80 hover:text-white focus:outline-none transition-colors"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              
              {/* Progress bar for auto-dismiss with glassmorphism */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 dark:bg-gray-700/20 backdrop-blur-sm">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 shadow-sm shadow-red-500/50"
                  style={{
                    animation: 'shrink 5s linear forwards'
                  }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Profile Editor Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setEditingProfile(false)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button 
                  onClick={() => setEditingProfile(false)}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="sm:flex sm:items-start mb-4">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Edit Profile
                  </h3>
                  
                  {/* Photo Upload */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
                        {supervisor.avatar ? (
                          <img src={supervisor.avatar} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-500">
                            <span className="text-2xl font-bold text-white">{supervisor.initials}</span>
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 rounded-full bg-red-500 p-2 text-white shadow-lg hover:bg-red-600 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSupervisor(prev => ({ ...prev, avatar: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </label>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={supervisor.name}
                      onChange={(e) => setSupervisor(prev => ({ ...prev, name: e.target.value }))}
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-red-400 sm:text-sm"
                    />
                  </div>

                  {/* Role */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={supervisor.role}
                      onChange={(e) => setSupervisor(prev => ({ ...prev, role: e.target.value }))}
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-red-400 sm:text-sm"
                    />
                  </div>

                  {/* Bio */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      value={supervisor.bio || ''}
                      onChange={(e) => setSupervisor(prev => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-red-400 sm:text-sm resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  {/* Buttons */}
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
