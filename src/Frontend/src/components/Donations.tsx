import { useState, useEffect } from 'react';
import { Gift, TrendingUp, Calendar, DollarSign, Award, X } from 'lucide-react';
import {
  mockFetchDonations,
  mockFetchDonorProfiles,
  mockCreateDonation,
  calculateDonorTier,
  DONATION_TIERS,
  type Donation,
  type DonorProfile,
} from '../../utils/mockDonations';

export default function Donations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donorProfiles, setDonorProfiles] = useState<DonorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formData, setFormData] = useState({
    donor_name: '',
    donor_email: '',
    donor_phone: '',
    amount: '',
    type: 'monetary' as Donation['type'],
    scheduled_date: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [donationsData, profilesData] = await Promise.all([
      mockFetchDonations(),
      mockFetchDonorProfiles(),
    ]);
    setDonations(donationsData);
    setDonorProfiles(profilesData);
    setLoading(false);
  }

  async function handleScheduleDonation(e: React.FormEvent) {
    e.preventDefault();
    
    const newDonation = await mockCreateDonation({
      donor_name: formData.donor_name,
      donor_email: formData.donor_email,
      donor_phone: formData.donor_phone,
      amount: parseFloat(formData.amount),
      type: formData.type,
      scheduled_date: formData.scheduled_date,
      status: 'scheduled',
      notes: formData.notes,
    });

    setDonations([newDonation, ...donations]);
    setShowScheduleModal(false);
    setFormData({
      donor_name: '',
      donor_email: '',
      donor_phone: '',
      amount: '',
      type: 'monetary',
      scheduled_date: '',
      notes: '',
    });
  }

  const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
  const scheduledDonations = donations.filter(d => d.status === 'scheduled').length;
  const completedDonations = donations.filter(d => d.status === 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading donations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Donation Management</h2>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
        >
          <Calendar className="h-5 w-5" />
          Schedule Donation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Total Donations</p>
              <p className="text-3xl font-bold text-white mt-2">${totalDonations.toLocaleString()}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Scheduled</p>
              <p className="text-3xl font-bold text-white mt-2">{scheduledDonations}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">Completed</p>
              <p className="text-3xl font-bold text-white mt-2">{completedDonations}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Donors */}
        <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
          <div className="border-b border-white/10 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              Top Donors
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {donorProfiles
              .sort((a, b) => b.total_donations - a.total_donations)
              .slice(0, 5)
              .map((donor) => {
                const tierInfo = calculateDonorTier(donor.total_donations);
                const tierData = DONATION_TIERS[tierInfo.tier];
                
                return (
                  <div key={donor.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                        <span className="text-white font-bold">{donor.name.split(' ').map(n => n[0]).join('')}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{donor.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierData.color} text-white`}>
                            {tierData.name}
                          </span>
                        </div>
                        <p className="text-sm text-white/60">{donor.donation_count} donations</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">${donor.total_donations.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Recent Donations */}
        <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
          <div className="border-b border-white/10 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-400" />
              Recent Donations
            </h3>
          </div>
          <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
            {donations
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 10)
              .map((donation) => (
                <div key={donation.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{donation.donor_name}</h4>
                    <p className="text-sm text-white/60 capitalize">{donation.type}</p>
                    <p className="text-xs text-white/40">{new Date(donation.scheduled_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">${donation.amount.toLocaleString()}</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      donation.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      donation.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {donation.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* All Donations Table */}
      <div className="rounded-xl shadow-xl bg-white/10 dark:bg-gray-900/30 backdrop-blur-xl border border-white/20">
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">All Donations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Donor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {donations.map((donation) => (
                <tr key={donation.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{donation.donor_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                    <div>{donation.donor_email}</div>
                    <div className="text-xs">{donation.donor_phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80 capitalize">{donation.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">${donation.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                    {new Date(donation.scheduled_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      donation.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      donation.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {donation.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Donation Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)}></div>
            <div className="relative w-full max-w-md rounded-xl bg-white dark:bg-gray-900 border border-white/20 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Schedule Donation</h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleScheduleDonation} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donor Name</label>
                  <input
                    type="text"
                    required
                    value={formData.donor_name}
                    onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.donor_email}
                    onChange={(e) => setFormData({ ...formData, donor_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.donor_phone}
                    onChange={(e) => setFormData({ ...formData, donor_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Donation Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Donation['type'] })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="monetary">Monetary</option>
                    <option value="food">Food</option>
                    <option value="clothing">Clothing</option>
                    <option value="supplies">Supplies</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
                  >
                    Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}