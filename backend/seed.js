import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

// Load .env from root
config({ path: path.resolve(process.cwd(), '../.env') });

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to bypass RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// MAP-005: 6 ambulances spread across Mumbai — 3 ALS (Advanced) + 3 BLS (Standard)
// ALS = Advanced Life Support: ventilator, defibrillator, cardiac monitor
// BLS = Basic Life Support: standard emergency response
const ambulances = [
  // ALS — Advanced (will render as RED on map)
  {
    name: 'AMB-001',
    type: 'ALS',
    status: 'available',
    location: 'POINT(72.8479 19.1136)',  // Andheri West
    driver_name: 'Rajan Kumar',
  },
  {
    name: 'AMB-002',
    type: 'ALS',
    status: 'available',
    location: 'POINT(72.8295 19.0596)',  // Bandra
    driver_name: 'Amit Patel',
  },
  {
    name: 'AMB-003',
    type: 'ALS',
    status: 'available',
    location: 'POINT(72.8410 19.0178)',  // Dadar
    driver_name: 'Vikram Sharma',
  },
  // BLS — Standard (will render as GREEN on map)
  {
    name: 'AMB-004',
    type: 'BLS',
    status: 'available',
    location: 'POINT(72.8887 19.0730)',  // Kurla
    driver_name: 'Priya Singh',
  },
  {
    name: 'AMB-005',
    type: 'BLS',
    status: 'available',
    location: 'POINT(72.9781 19.2183)',  // Thane
    driver_name: 'Sunita Rao',
  },
  {
    name: 'AMB-006',
    type: 'BLS',
    status: 'available',
    location: 'POINT(72.8178 19.0050)',  // Worli
    driver_name: 'Deepak Nair',
  },
];

// MAP-005: 5 real Mumbai hospitals with accurate coordinates
const hospitals = [
  {
    name: 'Lilavati Hospital',
    location: 'POINT(72.8264 19.0523)',   // Bandra
    total_beds: 323,
    available_beds: 18,
    capabilities: ['trauma_center', 'ICU', 'cardiac', 'neuro'],
    contact_number: '+91-22-26568282',
  },
  {
    name: 'KEM Hospital',
    location: 'POINT(72.8410 19.0019)',   // Parel
    total_beds: 1800,
    available_beds: 45,
    capabilities: ['trauma_center', 'ICU', 'burn_unit', 'pediatric'],
    contact_number: '+91-22-24107000',
  },
  {
    name: 'Hinduja Hospital',
    location: 'POINT(72.8411 19.0549)',   // Mahim
    total_beds: 351,
    available_beds: 12,
    capabilities: ['trauma_center', 'ICU', 'cardiac', 'neuro'],
    contact_number: '+91-22-24452222',
  },
  {
    name: 'Nanavati Super Speciality',
    location: 'POINT(72.8341 19.0974)',   // Vile Parle
    total_beds: 351,
    available_beds: 22,
    capabilities: ['ICU', 'cardiac', 'oncology'],
    contact_number: '+91-22-26182222',
  },
  {
    name: 'Jaslok Hospital',
    location: 'POINT(72.8100 19.0257)',   // Pedder Road
    total_beds: 350,
    available_beds: 8,
    capabilities: ['ICU', 'cardiac', 'neuro', 'burn_unit'],
    contact_number: '+91-22-66573333',
  },
];

async function seed() {
  console.log('Seeding database...');

  // Clean slate
  await supabase.from('incidents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('ambulances').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('hospitals').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { error: ambError } = await supabase.from('ambulances').insert(ambulances);
  if (ambError) console.error('Error seeding ambulances:', ambError);
  else console.log(`Ambulances seeded successfully. (${ambulances.length} rows)`);

  const { error: hospError } = await supabase.from('hospitals').insert(hospitals);
  if (hospError) console.error('Error seeding hospitals:', hospError);
  else console.log(`Hospitals seeded successfully. (${hospitals.length} rows)`);

  console.log('Seeding complete.');
}

seed();
