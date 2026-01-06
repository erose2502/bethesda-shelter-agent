// Mock donation data for the donations system

export interface Donation {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_phone: string;
  amount: number;
  type: 'monetary' | 'food' | 'clothing' | 'supplies' | 'other';
  scheduled_date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface DonorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  total_donations: number;
  donation_count: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  tier_progress: number; // Percentage to next tier
  joined_date: string;
  avatar?: string;
}

// Tier thresholds
export const DONATION_TIERS = {
  bronze: { min: 0, max: 500, name: 'Bronze Supporter', color: 'bg-orange-600' },
  silver: { min: 500, max: 1500, name: 'Silver Supporter', color: 'bg-gray-400' },
  gold: { min: 1500, max: 5000, name: 'Gold Supporter', color: 'bg-yellow-500' },
  platinum: { min: 5000, max: 10000, name: 'Platinum Supporter', color: 'bg-blue-400' },
  diamond: { min: 10000, max: Infinity, name: 'Diamond Supporter', color: 'bg-purple-500' },
};

export function calculateDonorTier(totalDonations: number): {
  tier: keyof typeof DONATION_TIERS;
  progress: number;
  nextTier: string | null;
  amountToNext: number;
} {
  let tier: keyof typeof DONATION_TIERS = 'bronze';
  
  if (totalDonations >= DONATION_TIERS.diamond.min) tier = 'diamond';
  else if (totalDonations >= DONATION_TIERS.platinum.min) tier = 'platinum';
  else if (totalDonations >= DONATION_TIERS.gold.min) tier = 'gold';
  else if (totalDonations >= DONATION_TIERS.silver.min) tier = 'silver';
  else tier = 'bronze';
  
  const currentTier = DONATION_TIERS[tier];
  const nextTierKey = tier === 'diamond' ? null : 
    tier === 'platinum' ? 'diamond' :
    tier === 'gold' ? 'platinum' :
    tier === 'silver' ? 'gold' : 'silver';
  
  const nextTier = nextTierKey ? DONATION_TIERS[nextTierKey] : null;
  const progress = nextTier 
    ? ((totalDonations - currentTier.min) / (nextTier.min - currentTier.min)) * 100
    : 100;
  const amountToNext = nextTier ? nextTier.min - totalDonations : 0;
  
  return {
    tier,
    progress: Math.min(progress, 100),
    nextTier: nextTier?.name || null,
    amountToNext,
  };
}

export const mockDonations: Donation[] = [
  {
    id: '1',
    donor_name: 'John Smith',
    donor_email: 'john.smith@email.com',
    donor_phone: '(717) 555-0101',
    amount: 500,
    type: 'monetary',
    scheduled_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: 'scheduled',
    notes: 'Monthly donation',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: '2',
    donor_name: 'Sarah Johnson',
    donor_email: 'sarah.j@email.com',
    donor_phone: '(717) 555-0102',
    amount: 1000,
    type: 'food',
    scheduled_date: new Date(Date.now() + 86400000).toISOString(),
    status: 'scheduled',
    notes: 'Thanksgiving food drive',
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: '3',
    donor_name: 'Michael Brown',
    donor_email: 'mbrown@email.com',
    donor_phone: '(717) 555-0103',
    amount: 250,
    type: 'clothing',
    scheduled_date: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'completed',
    notes: 'Winter coats and blankets',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: '4',
    donor_name: 'Emily Davis',
    donor_email: 'emily.davis@email.com',
    donor_phone: '(717) 555-0104',
    amount: 750,
    type: 'monetary',
    scheduled_date: new Date(Date.now() - 86400000 * 7).toISOString(),
    status: 'completed',
    notes: 'In memory of loved one',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: '5',
    donor_name: 'David Martinez',
    donor_email: 'dmartinez@email.com',
    donor_phone: '(717) 555-0105',
    amount: 2000,
    type: 'supplies',
    scheduled_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'scheduled',
    notes: 'Toiletries and hygiene products',
    created_at: new Date().toISOString(),
  },
];

export const mockDonorProfiles: DonorProfile[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '(717) 555-0101',
    total_donations: 6500,
    donation_count: 13,
    tier: 'platinum',
    tier_progress: 65,
    joined_date: new Date(Date.now() - 86400000 * 365).toISOString(),
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '(717) 555-0102',
    total_donations: 12500,
    donation_count: 25,
    tier: 'diamond',
    tier_progress: 100,
    joined_date: new Date(Date.now() - 86400000 * 730).toISOString(),
  },
  {
    id: '3',
    name: 'Michael Brown',
    email: 'mbrown@email.com',
    phone: '(717) 555-0103',
    total_donations: 1250,
    donation_count: 5,
    tier: 'silver',
    tier_progress: 50,
    joined_date: new Date(Date.now() - 86400000 * 180).toISOString(),
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.davis@email.com',
    phone: '(717) 555-0104',
    total_donations: 3500,
    donation_count: 7,
    tier: 'gold',
    tier_progress: 46,
    joined_date: new Date(Date.now() - 86400000 * 540).toISOString(),
  },
  {
    id: '5',
    name: 'David Martinez',
    email: 'dmartinez@email.com',
    phone: '(717) 555-0105',
    total_donations: 450,
    donation_count: 3,
    tier: 'bronze',
    tier_progress: 90,
    joined_date: new Date(Date.now() - 86400000 * 90).toISOString(),
  },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function mockFetchDonations(): Promise<Donation[]> {
  await delay(300);
  return mockDonations;
}

export async function mockFetchDonorProfiles(): Promise<DonorProfile[]> {
  await delay(300);
  return mockDonorProfiles;
}

export async function mockCreateDonation(donation: Omit<Donation, 'id' | 'created_at'>): Promise<Donation> {
  await delay(300);
  const newDonation: Donation = {
    ...donation,
    id: `${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  mockDonations.push(newDonation);
  return newDonation;
}