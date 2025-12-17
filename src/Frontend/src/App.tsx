import { useState, useEffect } from 'react';
import { Home, BedDouble, ClipboardList, MapPin, Clock } from 'lucide-react';
import BedMap from './components/BedMap';
import ActiveReservations from './components/ActiveReservations';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'beds' | 'reservations'>('beds');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen p-3 md:p-6 lg:p-8">
      {/* Header with Bethesda Branding */}
      <header className="glass-dark rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 mb-3 md:mb-4 relative overflow-hidden">
        {/* Decorative accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 brand-gradient"></div>
        
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 lg:gap-6">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-lg bg-gradient-to-br from-[#b8272f] to-[#8b1f25] flex items-center justify-center shadow-lg brand-shadow">
                <Home className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-0.5 tracking-tight">
                  Bethesda Mission
                </h1>
                <p className="text-sm md:text-base text-[#d4a017] font-semibold">
                  Shelter Management System
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center lg:text-right">
            <div className="bg-[#1a2332]/60 rounded-lg px-4 md:px-6 py-3 border border-[#b8272f]/20 flex items-center gap-2">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-[#d4a017]" />
              <div>
                <div className="text-xl md:text-2xl lg:text-3xl font-mono text-[#d4a017] font-bold tracking-wider">
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="glass-dark rounded-xl md:rounded-2xl p-2 md:p-3 mb-3 md:mb-4">
        <div className="flex gap-2 md:gap-3">
          <button
            onClick={() => setActiveTab('beds')}
            className={`flex-1 py-3 md:py-4 px-3 md:px-6 rounded-lg md:rounded-xl text-base md:text-lg font-semibold transition-all duration-300 ${
              activeTab === 'beds'
                ? 'brand-gradient text-white brand-shadow'
                : 'bg-[#2d3748]/50 text-slate-300 hover:bg-[#2d3748]/70 border border-[#4a5568]/30'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <BedDouble className="w-5 h-5 md:w-6 md:h-6" />
              <span className="hidden sm:inline">Bed Management</span>
              <span className="sm:hidden">Beds</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            className={`flex-1 py-3 md:py-4 px-3 md:px-6 rounded-lg md:rounded-xl text-base md:text-lg font-semibold transition-all duration-300 ${
              activeTab === 'reservations'
                ? 'brand-gradient text-white brand-shadow'
                : 'bg-[#2d3748]/50 text-slate-300 hover:bg-[#2d3748]/70 border border-[#4a5568]/30'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <ClipboardList className="w-5 h-5 md:w-6 md:h-6" />
              <span className="hidden sm:inline">Reservations</span>
              <span className="sm:hidden">List</span>
            </span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="glass-dark rounded-xl md:rounded-2xl p-3 md:p-5 lg:p-6 shadow-2xl">
        {activeTab === 'beds' ? <BedMap /> : <ActiveReservations />}
      </main>

      {/* Footer */}
      <footer className="text-center mt-4 md:mt-6 pb-3 md:pb-4">
        <div className="glass-dark rounded-lg px-4 py-3 inline-flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#d4a017]" />
          <div className="text-left">
            <p className="text-slate-300 text-xs md:text-sm font-medium">
              Bethesda Mission Men's Shelter
            </p>
            <p className="text-slate-400 text-xs">
              611 Reily Street, Harrisburg, PA 17102
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
