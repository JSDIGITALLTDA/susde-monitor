const SUPABASE_URL = 'https://mqzrisneqrhyspapnqas.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xenJpc25lcXJoeXNwYXBucWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MzE2NTAsImV4cCI6MjA4NTIwNzY1MH0.A26NcCMXHImib7H9Kj_f75kPllqcL-1wHPSV_2h2CU4';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const days = parseInt(req.query.days) || 90;
    const limitedDays = Math.min(days, 365);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/term_spread_history?select=*&order=date.desc&limit=${limitedDays}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase error: ${error}`);
    }

    const data = await response.json();
    const chronological = data.reverse();

    return res.status(200).json({
      success: true,
      count: chronological.length,
      data: chronological
    });

  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ error: error.message });
  }
}
