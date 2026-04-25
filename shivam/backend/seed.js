import { createClient } from '@supabase/supabase-js';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ambulances = [
  { name: 'AMB-001', type: 'ALS', status: 'available', location: 'POINT(72.8777 19.0760)', driver_name: 'Rajan Kumar' },
  { name: 'AMB-002', type: 'BLS', status: 'available', location: 'POINT(72.8850 19.0820)', driver_name: 'Priya Singh' },
  { name: 'AMB-003', type: 'ALS', status: 'available', location: 'POINT(72.8650 19.0690)', driver_name: 'Amit Patel' },
  { name: 'AMB-004', type: 'BLS', status: 'dispatched', location: 'POINT(72.8900 19.0900)', driver_name: 'Sunita Rao' },
];

const hospitals = [
  { name: 'City General Hospital', location: 'POINT(72.8800 19.0750)', available_beds: 12, capabilities: ['trauma_center', 'ICU', 'cardiac'] },
  { name: 'Apollo Emergency Center', location: 'POINT(72.8950 19.0800)', available_beds: 5, capabilities: ['ICU', 'burn_unit'] },
  { name: 'Government Medical College', location: 'POINT(72.8700 19.0650)', available_beds: 28, capabilities: ['trauma_center', 'ICU', 'pediatric'] },
];

async function seed() {
  console.log('Seeding database...');

  // Optional: Delete existing data for a clean slate
  await supabase.from('ambulances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('hospitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: ambError } = await supabase.from('ambulances').insert(ambulances);
  if (ambError) console.error('Error seeding ambulances:', ambError);
  else console.log('Ambulances seeded successfully.');

  const { error: hospError } = await supabase.from('hospitals').insert(hospitals);
  if (hospError) console.error('Error seeding hospitals:', hospError);
  else console.log('Hospitals seeded successfully.');

  console.log('Seeding complete.');
}

seed();
