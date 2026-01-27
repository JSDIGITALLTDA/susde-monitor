import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

// Pendle API Configuration
const PENDLE_API_BASE = 'https://api-v2.pendle.finance/core/v1';
const CHAIN_ID = 1; // Ethereum Mainnet

export default function App() {
  const [termStructure, setTermStructure] = useState([]);
  const [termSpread, setTermSpread] = useState(0);
  const [underlyingYield, setUnderlyingYield] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [historicalSpread, setHistoricalSpread] = useState([]);

  // Fetch active markets from Pendle API
  const fetchPendleMarkets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${PENDLE_API_BASE}/${CHAIN_ID}/markets/active?order_by=name%3A1&skip=0&limit=100`
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // API returns { markets: [...] } not { results: [...] }
      const allMarkets = data.markets || data.results || [];
      
      if (!Array.isArray(allMarkets) || allMarkets.length === 0) {
        throw new Error('No markets data received from API');
      }
      
      // Filter for sUSDe markets only
      const susdeMarkets = allMarkets.filter(market => {
        const name = (market.name || market.proName || '').toLowerCase();
        const symbol = (market.underlyingAsset?.symbol || '').toLowerCase();
        return name.includes('susde') || symbol.includes('susde');
      });
      
      if (susdeMarkets.length === 0) {
        // Show available market names for debugging
        const availableNames = allMarkets.slice(0, 10).map(m => m.name).join(', ');
        setError(`No sUSDe markets found. Available: ${availableNames}...`);
        
        // Try to use Ethena-related markets as fallback
        const ethenaMarkets = allMarkets.filter(market => {
          const name = (market.name || '').toLowerCase();
          return name.includes('usde') || name.includes('ethena');
        });
        
        if (ethenaMarkets.length > 0) {
          processMarkets(ethenaMarkets);
        }
      } else {
        processMarkets(susdeMarkets);
      }
      
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Error fetching Pendle data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Process markets into term structure
  const processMarkets = (markets) => {
    // Sort by expiry date
    const sorted = markets
      .filter(m => m.expiry)
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    if (sorted.length === 0) return;
    
    // Create term structure data
    // Note: API has details.impliedApy not just impliedApy
    const structure = sorted.map(market => {
      const expiryDate = new Date(market.expiry);
      const today = new Date();
      const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      
      // Handle different API response structures
      const impliedApy = market.details?.impliedApy || market.impliedApy || 0;
      const underlyingApy = market.details?.underlyingApy || market.underlyingApy || market.details?.aggregatedApy || 0;
      const tvl = market.details?.liquidity || market.liquidity?.usd || 0;
      
      return {
        maturity: formatMaturity(daysToExpiry),
        days: daysToExpiry,
        impliedYield: impliedApy * 100,
        underlyingYield: underlyingApy * 100,
        expiry: expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        tvl: tvl,
        address: market.address,
        name: market.name || market.proName,
      };
    });
    
    // Filter out expired or invalid markets
    const validStructure = structure.filter(s => s.days > 0 && s.impliedYield > 0);
    
    if (validStructure.length === 0) {
      setError('No valid markets with positive days to expiry');
      return;
    }
    
    setTermStructure(validStructure);
    
    // Calculate term spread (back month - front month)
    if (validStructure.length >= 2) {
      const frontMonth = validStructure[0].impliedYield;
      const backMonth = validStructure[validStructure.length - 1].impliedYield;
      setTermSpread(parseFloat((backMonth - frontMonth).toFixed(2)));
    } else if (validStructure.length === 1) {
      setTermSpread(0);
    }
    
    // Get underlying yield from first market
    if (validStructure[0]?.underlyingYield) {
      setUnderlyingYield(validStructure[0].underlyingYield.toFixed(2));
    }
    
    // Generate simulated historical spread
    generateHistoricalSpread(validStructure.length >= 2 ? 
      validStructure[validStructure.length - 1].impliedYield - validStructure[0].impliedYield : 0);
  };

  const formatMaturity = (days) => {
    if (days <= 0) return 'Expired';
    if (days <= 30) return `${days}D`;
    if (days <= 90) return `${Math.round(days / 30)}M`;
    return `${Math.round(days / 30)}M`;
  };

  const generateHistoricalSpread = (currentSpread) => {
    const data = [];
    const today = new Date();
    
    for (let i = 90; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const baseSpread = currentSpread || -3;
      const variance = Math.sin(i / 15) * 2 + (Math.random() - 0.5) * 1.5;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        spread: parseFloat((baseSpread + variance).toFixed(2)),
      });
    }
    
    setHistoricalSpread(data);
  };

  useEffect(() => {
    fetchPendleMarkets();
    const interval = setInterval(fetchPendleMarkets, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPendleMarkets]);

  const getRegimeColor = () => {
    if (termSpread > 0) return '#10b981';
    if (termSpread < -5) return '#ef4444';
    return '#f59e0b';
  };

  const getRegimeLabel = () => {
    if (termSpread > 0) return 'CONTANGO';
    if (termSpread < -5) return 'STEEP BACKWARDATION';
    return 'BACKWARDATION';
  };

  const getSignal = () => {
    if (termSpread > 0) return { 
      text: 'BULLISH', 
      color: '#10b981', 
      probability: '80%+ prob. of positive returns (90d)'
    };
    if (termSpread < -7.5) return { 
      text: 'BEARISH', 
      color: '#ef4444', 
      probability: '<20% prob. of positive returns (90d)'
    };
    if (termSpread < -5) return { 
      text: 'CAUTIOUS', 
      color: '#f97316', 
      probability: '~40% prob. of positive returns (90d)'
    };
    return { 
      text: 'NEUTRAL', 
      color: '#f59e0b', 
      probability: '~50% prob. of positive returns (90d)'
    };
  };

  const signal = getSignal();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, fontSize: '14px', fontWeight: 600, margin: '4px 0 0' }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const returnSkewData = [
    { decile: '0-10%', meanSkew: -18.5, positiveProb: 12 },
    { decile: '10-20%', meanSkew: -12.3, positiveProb: 18 },
    { decile: '20-30%', meanSkew: -6.8, positiveProb: 32 },
    { decile: '30-40%', meanSkew: -2.1, positiveProb: 42 },
    { decile: '40-50%', meanSkew: 0.5, positiveProb: 51 },
    { decile: '50-60%', meanSkew: 2.8, positiveProb: 58 },
    { decile: '60-70%', meanSkew: 6.2, positiveProb: 72 },
    { decile: '70-80%', meanSkew: 10.5, positiveProb: 81 },
    { decile: '80-90%', meanSkew: 15.2, positiveProb: 85 },
    { decile: '90-100%', meanSkew: 22.8, positiveProb: 92 },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      color: '#e2e8f0',
      fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            margin: 0,
            background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            sUSDe Term Structure Monitor
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '8px 0 0' }}>
            Pendle Finance • Live Data • Forward-Looking Signal
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {lastUpdate && (
            <span style={{ color: '#64748b', fontSize: '12px' }}>
              {lastUpdate.toLocaleTimeString('en-US')}
            </span>
          )}
          <button
            onClick={fetchPendleMarkets}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(96, 165, 250, 0.5)',
              background: loading ? 'rgba(30, 41, 59, 0.5)' : 'rgba(96, 165, 250, 0.15)',
              color: '#60a5fa',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {loading ? '⟳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}>
          <p style={{ color: '#ef4444', margin: 0, fontSize: '14px' }}>
            ⚠️ {error}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && termStructure.length === 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <p style={{ color: '#64748b' }}>Fetching data from Pendle...</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {termStructure.length > 0 && (
        <>
          {/* Key Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}>
            {/* Term Spread */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${getRegimeColor()}33`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '3px',
                background: getRegimeColor(),
              }} />
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Term Spread
              </p>
              <p style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0', color: getRegimeColor() }}>
                {termSpread > 0 ? '+' : ''}{termSpread}%
              </p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                Back - Front Month
              </p>
            </div>

            {/* Regime */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Regime
              </p>
              <p style={{ fontSize: '20px', fontWeight: 700, margin: '12px 0 8px', color: getRegimeColor() }}>
                {getRegimeLabel()}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                {termSpread > 0 ? 'Upward sloping curve' : 'Downward sloping curve'}
              </p>
            </div>

            {/* Signal */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${signal.color}33`,
            }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Signal (90d)
              </p>
              <p style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: signal.color }}>
                {signal.text}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '11px', margin: 0 }}>
                {signal.probability}
              </p>
            </div>

            {/* Underlying Yield */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Underlying APY
              </p>
              <p style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0', color: '#a78bfa' }}>
                {underlyingYield}%
              </p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>sUSDe Yield</p>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '24px',
            marginBottom: '32px',
          }}>
            {/* Term Structure Chart */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                Term Structure (Live)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={termStructure}>
                  <defs>
                    <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="maturity" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="impliedYield" 
                    stroke="#60a5fa" 
                    strokeWidth={3}
                    fill="url(#yieldGradient)"
                    name="Implied Yield"
                    dot={{ fill: '#60a5fa', strokeWidth: 2, r: 6 }}
                  />
                  <ReferenceLine 
                    y={parseFloat(underlyingYield)} 
                    stroke="#a78bfa" 
                    strokeDasharray="5 5" 
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
                <span style={{ color: '#60a5fa', fontSize: '11px' }}>● Implied Yield</span>
                <span style={{ color: '#a78bfa', fontSize: '11px' }}>- - Underlying APY</span>
              </div>
            </div>

            {/* Historical Term Spread */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
                Term Spread (90d)
              </h3>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 12px' }}>
                *Simulated
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={historicalSpread}>
                  <defs>
                    <linearGradient id="negativeGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} interval={14} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[-12, 4]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={2} />
                  <ReferenceLine y={-7.5} stroke="#ef4444" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="spread" stroke="#60a5fa" strokeWidth={2} fill="url(#negativeGradient)" name="Term Spread" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px' }}>
                <span style={{ color: '#10b981', fontSize: '11px' }}>● {'>'}0%: Bullish</span>
                <span style={{ color: '#ef4444', fontSize: '11px' }}>● {'<'}-7.5%: Bearish</span>
              </div>
            </div>
          </div>

          {/* Market Details Table */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            marginBottom: '32px',
            overflowX: 'auto',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
              Active Markets ({termStructure.length})
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>Market</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>Expiry</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>Days</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>Implied APY</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>TVL</th>
                </tr>
              </thead>
              <tbody>
                {termStructure.map((market, index) => (
                  <tr 
                    key={index}
                    style={{ 
                      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                      background: index === 0 ? 'rgba(96, 165, 250, 0.05)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>
                      {market.name}
                      {index === 0 && <span style={{ color: '#60a5fa', marginLeft: '8px', fontSize: '10px' }}>FRONT</span>}
                      {index === termStructure.length - 1 && termStructure.length > 1 && <span style={{ color: '#a78bfa', marginLeft: '8px', fontSize: '10px' }}>BACK</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', textAlign: 'right' }}>{market.expiry}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', textAlign: 'right' }}>{market.days}d</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#60a5fa', fontWeight: 600 }}>
                      {market.impliedYield.toFixed(2)}%
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', textAlign: 'right' }}>
                      ${(market.tvl / 1e6).toFixed(2)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Return Skew Analysis */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            marginBottom: '32px',
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#e2e8f0' }}>
              Analysis: P(Positive Return) by Term Spread Decile
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={returnSkewData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="decile" stroke="#64748b" fontSize={10} tickLine={false} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', padding: '12px 16px' }}>
                          <p style={{ color: '#e2e8f0', fontSize: '12px', margin: 0 }}>Decile: {data.decile}</p>
                          <p style={{ color: '#60a5fa', fontSize: '14px', margin: '4px 0' }}>Mean Skew: {data.meanSkew}%</p>
                          <p style={{ color: '#10b981', fontSize: '14px', margin: 0 }}>P(Positive): {data.positiveProb}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="positiveProb" name="P(Positive Return)">
                  {returnSkewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.positiveProb > 60 ? '#10b981' : entry.positiveProb < 40 ? '#ef4444' : '#f59e0b'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}>Historical Mean</p>
              <p style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px', color: '#e2e8f0' }}>-2.63%</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>σ = 2.71%</p>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}>Contango</p>
              <p style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px', color: '#10b981' }}>11.18%</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>of observations</p>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}>Steep Backwardation</p>
              <p style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px', color: '#ef4444' }}>7.93%</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>({'<'}-7.5%)</p>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0, textTransform: 'uppercase' }}>Markets</p>
              <p style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 4px', color: '#60a5fa' }}>{termStructure.length}</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>active</p>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: '32px', padding: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '11px', margin: 0 }}>
          Data via Pendle API • Analysis based on @blocktower_ research • Auto-refresh: 5min
        </p>
      </div>
    </div>
  );
}
