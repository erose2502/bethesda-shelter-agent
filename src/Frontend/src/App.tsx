import { useState, useEffect } from 'react';
import { Home, BedDouble, ClipboardList, Church, Users, Menu, X, BarChart3, Sun, Moon, ChevronDown } from 'lucide-react';
import BedMap from './components/BedMap';
import ActiveReservations from './components/ActiveReservations';
import ChapelSchedule from './components/ChapelSchedule';
import VolunteerManagement from './components/VolunteerManagement';
import GuestManagement from './components/GuestManagement';
import config from './config';
import './App.css';

type TabType = 'dashboard' | 'beds' | 'reservations' | 'chapel' | 'volunteers' | 'guests';

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
  const [stats, setStats] = useState({
    totalBeds: 108,
    occupied: 0,
    available: 0,
    reserved: 0,
    activeReservations: 0,
    upcomingChapel: 0,
    activeVolunteers: 0,
  });

  // Mock supervisor data - in real app this would come from auth
  const supervisor = {
    name: 'Sarah Johnson',
    role: 'Supervisor',
    avatar: null, // Could be a URL to an image
    initials: 'SJ',
  };

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

        setStats({
          totalBeds: 108,
          occupied: beds.occupied || 0,
          available: beds.available || 0,
          reserved: beds.held || 0,
          activeReservations: Array.isArray(reservations.reservations) ? reservations.reservations.length : 0,
          upcomingChapel: Array.isArray(chapel) ? chapel.filter((s: any) => s.status === 'pending' || s.status === 'confirmed').length : 0,
          activeVolunteers: Array.isArray(volunteers) ? volunteers.filter((v: any) => v.status === 'active').length : 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
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
                      <a href="#" className="block px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-all">
                        Your profile
                      </a>
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
    </div>
  );
}

export default App;
