// api/snapshot.js - Cron job to save daily term spread
// Runs daily at 12:00 UTC via Vercel Cron

const SUPABASE_URL = 'https://mqzrisneqrhyspapnqas.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xenJpc25lcXJoeXNwYXBucWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MzE2NTAsImV4cCI6MjA4NTIwNzY1MH0.A26NcCMXHImib7H9Kj_f75kPllqcL-1wHPSV_2h2CU4';

const CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 9745, name: 'Plasma' },
];

const PENDLE_API_BASE = 'https://api-v2.pendle.finance/core/v1';

export default async function handler(req, res) {
  // Verify cron secret (optional but recommended)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    // Fetch sUSDe markets from all chains
    const responses = await Promise.all(
      CHAINS.map(chain =>
        fetch(`${PENDLE_API_BASE}/${chain.id}/markets/active?limit=200`)
          .then(r => r.json())
          .then(data => ({
            chain: chain.name,
            chainId: chain.id,
            markets: data.markets || []
          }))
          .catch(e => ({ chain: chain.name, chainId: chain.id, markets: [], error: e.message }))
      )
    );

    // Combine all markets
    const allMarkets = responses.flatMap(r =>
      r.markets.map(m => ({ ...m, chain: r.chain, chainId: r.chainId }))
    );

    // Filter for sUSDe only
    const susdeMarkets = allMarkets.filter(market => {
      const name = (market.name || '').toLowerCase();
      return name === 'susde';
    });

    if (susdeMarkets.length < 2) {
      return res.status(200).json({ 
        message: 'Not enough sUSDe markets to calculate spread',
        marketsFound: susdeMarkets.length
      });
    }

    // Sort by expiry
    const sorted = susdeMarkets
      .filter(m => m.expiry)
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
      .filter(m => {
        const days = Math.ceil((new Date(m.expiry) - new Date()) / (1000 * 60 * 60 * 24));
        return days > 0;
      });

    if (sorted.length < 2) {
      return res.status(200).json({ 
        message: 'Not enough valid sUSDe markets',
        validMarkets: sorted.length
      });
    }

    // Calculate term spread
    const frontMonth = sorted[0];
    const backMonth = sorted[sorted.length - 1];
    
    const frontApy = (frontMonth.details?.impliedApy || frontMonth.impliedApy || 0) * 100;
    const backApy = (backMonth.details?.impliedApy || backMonth.impliedApy || 0) * 100;
    const termSpread = backApy - frontApy;
    const underlyingApy = (frontMonth.details?.underlyingApy || frontMonth.underlyingApy || 0) * 100;

    // Prepare record
    const today = new Date().toISOString().split('T')[0];
    const record = {
      date: today,
      term_spread: parseFloat(termSpread.toFixed(4)),
      front_month_apy: parseFloat(frontApy.toFixed(4)),
      back_month_apy: parseFloat(backApy.toFixed(4)),
      front_expiry: frontMonth.expiry.split('T')[0],
      back_expiry: backMonth.expiry.split('T')[0],
      underlying_apy: parseFloat(underlyingApy.toFixed(4)),
      markets_count: sorted.length
    };

    // Save to Supabase (upsert to handle re-runs)
    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/term_spread_history`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(record)
    });

    if (!supabaseResponse.ok) {
      const error = await supabaseResponse.text();
      throw new Error(`Supabase error: ${error}`);
    }

    return res.status(200).json({
      success: true,
      date: today,
      term_spread: record.term_spread,
      front_apy: record.front_month_apy,
      back_apy: record.back_month_apy,
      markets: sorted.length
    });

  } catch (error) {
    console.error('Snapshot error:', error);
    return res.status(500).json({ error: error.message });
  }
}
