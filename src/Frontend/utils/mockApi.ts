// Mock API data to simulate FastAPI backend responses
// This allows the dashboard to work without the backend running

export const mockBedData = {
  total_beds: 120,
  occupied: 87,
  available: 33,
  reserved: 15,
  maintenance: 3,
  occupancy_rate: 72.5,
  beds_by_unit: {
    'Unit A': { total: 40, occupied: 32, available: 8 },
    'Unit B': { total: 40, occupied: 30, available: 10 },
    'Unit C': { total: 40, occupied: 25, available: 15 },
  },
  recent_changes: [
    { bed_id: 'A-12', action: 'check-in', timestamp: new Date().toISOString(), guest_name: 'John Smith' },
    { bed_id: 'B-05', action: 'check-out', timestamp: new Date(Date.now() - 3600000).toISOString(), guest_name: 'Sarah Johnson' },
    { bed_id: 'C-18', action: 'maintenance', timestamp: new Date(Date.now() - 7200000).toISOString() },
  ]
};

export const mockGuestData = [
  {
    id: 1,
    name: 'John Smith',
    bed_number: 'A-12',
    check_in: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'active',
    program: 'Emergency Shelter',
    case_manager: 'Maria Garcia'
  },
  {
    id: 2,
    name: 'Michael Brown',
    bed_number: 'A-15',
    check_in: new Date(Date.now() - 86400000 * 7).toISOString(),
    status: 'active',
    program: 'Transitional Housing',
    case_manager: 'James Wilson'
  },
  {
    id: 3,
    name: 'Robert Taylor',
    bed_number: 'B-08',
    check_in: new Date(Date.now() - 86400000 * 14).toISOString(),
    status: 'active',
    program: 'Recovery Program',
    case_manager: 'Maria Garcia'
  },
  {
    id: 4,
    name: 'David Martinez',
    bed_number: 'B-22',
    check_in: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'active',
    program: 'Emergency Shelter',
    case_manager: 'James Wilson'
  },
  {
    id: 5,
    name: 'William Anderson',
    bed_number: 'C-05',
    check_in: new Date(Date.now() - 86400000 * 21).toISOString(),
    status: 'active',
    program: 'Transitional Housing',
    case_manager: 'Maria Garcia'
  }
];

export const mockReservationData = [
  {
    id: 1,
    guest_name: 'James Wilson',
    phone: '(717) 555-0123',
    reserved_date: new Date(Date.now() + 86400000).toISOString(),
    bed_unit: 'Unit A',
    status: 'active',
    notes: 'Referred by county services',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    guest_name: 'Patricia Moore',
    phone: '(717) 555-0156',
    reserved_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    bed_unit: 'Unit B',
    status: 'active',
    notes: 'Family emergency',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    guest_name: 'Charles Davis',
    phone: '(717) 555-0189',
    reserved_date: new Date().toISOString(),
    bed_unit: 'Unit C',
    status: 'active',
    notes: 'Walk-in',
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

export const mockVolunteerData = [
  {
    id: 1,
    name: 'Maria Garcia',
    role: 'Case Manager',
    status: 'active',
    shift: 'Day (8am-4pm)',
    phone: '(717) 555-0201',
    email: 'maria.garcia@bethesdamission.org',
    checked_in: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 2,
    name: 'James Wilson',
    role: 'Case Manager',
    status: 'active',
    shift: 'Day (8am-4pm)',
    phone: '(717) 555-0202',
    email: 'james.wilson@bethesdamission.org',
    checked_in: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 3,
    name: 'Sarah Chen',
    role: 'Night Supervisor',
    status: 'off-duty',
    shift: 'Night (10pm-6am)',
    phone: '(717) 555-0203',
    email: 'sarah.chen@bethesdamission.org',
    checked_in: null
  },
  {
    id: 4,
    name: 'David Rodriguez',
    role: 'Volunteer Coordinator',
    status: 'active',
    shift: 'Day (10am-6pm)',
    phone: '(717) 555-0204',
    email: 'david.rodriguez@bethesdamission.org',
    checked_in: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 5,
    name: 'Emily Thompson',
    role: 'Kitchen Manager',
    status: 'active',
    shift: 'Day (6am-2pm)',
    phone: '(717) 555-0205',
    email: 'emily.thompson@bethesdamission.org',
    checked_in: new Date(Date.now() - 10800000).toISOString()
  }
];

export const mockChapelData = [
  {
    id: 1,
    title: 'Morning Prayer Service',
    date: new Date().toISOString(),
    time: '7:00 AM',
    location: 'Main Chapel',
    leader: 'Pastor Johnson',
    attendance_expected: 45,
    type: 'prayer'
  },
  {
    id: 2,
    title: 'Bible Study Group',
    date: new Date().toISOString(),
    time: '2:00 PM',
    location: 'Community Room',
    leader: 'Maria Garcia',
    attendance_expected: 20,
    type: 'study'
  },
  {
    id: 3,
    title: 'Evening Worship',
    date: new Date().toISOString(),
    time: '6:30 PM',
    location: 'Main Chapel',
    leader: 'Pastor Johnson',
    attendance_expected: 60,
    type: 'worship'
  },
  {
    id: 4,
    title: 'Recovery Support Meeting',
    date: new Date(Date.now() + 86400000).toISOString(),
    time: '10:00 AM',
    location: 'Room 203',
    leader: 'James Wilson',
    attendance_expected: 15,
    type: 'support'
  }
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock fetch function that returns the data
export async function mockFetch(url: string): Promise<Response> {
  await delay(300); // Simulate network delay
  
  let data: any;
  
  if (url.includes('/api/beds')) {
    data = mockBedData;
  } else if (url.includes('/api/guests')) {
    data = mockGuestData;
  } else if (url.includes('/api/reservations')) {
    data = mockReservationData;
  } else if (url.includes('/api/volunteers')) {
    data = mockVolunteerData;
  } else if (url.includes('/api/chapel')) {
    data = mockChapelData;
  } else {
    data = { error: 'Not found' };
  }
  
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
