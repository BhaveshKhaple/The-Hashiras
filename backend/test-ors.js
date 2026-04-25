import { config } from 'dotenv';
import path from 'path';

config({ path: '../.env' });

const orsKey = process.env.ORS_API_KEY;

async function testORS() {
  console.log('Testing ORS with key:', orsKey);
  const body = {
    coordinates: [[72.8777, 19.0760], [72.8295, 19.0596]],
    preference: 'fastest',
  };

  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': orsKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ORS Error:', response.status, errorText);
    } else {
      const data = await response.json();
      console.log('ORS OK:', JSON.stringify(data).substring(0, 100));
    }
  } catch (error) {
    console.error('Fetch Error:', error);
  }
}

testORS();
