import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { supabase } from './supabaseClient'
import './App.css'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

function App() {
  const [session, setSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isLoginView, setIsLoginView] = useState(true)
  const [activeTab, setActiveTab] = useState('predict')

  const [formData, setFormData] = useState({
    scheduled_days: 2, shipping_mode: 'Standard Class', order_month: 6,
    order_day_of_week: 1, order_type: 'DEBIT', order_region: 'Western Europe', market: 'Europe'
  })
  const [wizardStep, setWizardStep] = useState(1);
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  
  const [historyData, setHistoryData] = useState([])
  const [fetchingHistory, setFetchingHistory] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  useEffect(() => {
    if (activeTab === 'dashboard' && session) {
      fetchHistory()
    }
  }, [activeTab, session])

  const handleAuth = async (e) => {
    e.preventDefault()
    if (isLoginView) {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
      if (error) alert(error.message)
      else alert('Success! Check your email to verify your account.')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setResult(null)
    setHistoryData([])
  }

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const predictRisk = async (e) => {
    e.preventDefault()
    setWizardStep(4) 
    setLoading(true) 
    setResult(null)  
    setSaveStatus('')
    
    try {
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_days: parseInt(formData.scheduled_days),
          shipping_mode: formData.shipping_mode,
          order_month: parseInt(formData.order_month),
          order_day_of_week: parseInt(formData.order_day_of_week),
          order_type: formData.order_type,
          order_region: formData.order_region,
          market: formData.market
        })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      alert("Error connecting to the AI Backend. Is your local server running?")
      setWizardStep(3) 
    } finally {
      setLoading(false)
    }
  }

  const savePrediction = async () => {
    if (!session || !result) return
    setSaveStatus('Saving...')

    const { error } = await supabase.from('logistics_predictions').insert([{
      user_id: session.user.id,
      scheduled_days: formData.scheduled_days,
      shipping_mode: formData.shipping_mode,
      order_month: formData.order_month,
      order_day_of_week: formData.order_day_of_week,
      order_type: formData.order_type,
      order_region: formData.order_region,
      market: formData.market,
      probability: result.probability,
      is_late: result.is_late,
      top_reasons: result.top_reasons,
      llm_insight: result.llm_insight
    }])

    if (error) {
      console.error(error)
      setSaveStatus('Error saving.')
    } else {
      setSaveStatus('✅ Saved to Database')
    }
  }

  const fetchHistory = async () => {
    setFetchingHistory(true)
    const { data, error } = await supabase
      .from('logistics_predictions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })

    if (error) console.error("Error fetching history:", error)
    else {
      const formattedData = data.map((item, index) => ({
        ...item,
        run_number: `Run ${index + 1}`,
        risk_percentage: parseFloat((item.probability * 100).toFixed(1))
      }))
      setHistoryData(formattedData)
    }
    setFetchingHistory(false)
  }

  if (!session) {
    return (
      <div className="container auth-container">
        <div className="card">
          <h2>{isLoginView ? 'System Login' : 'Register Operator'}</h2>
          <form onSubmit={handleAuth}>
            <div className="input-group">
              <label>Email</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
            </div>
            <button type="submit" className="primary-btn">{isLoginView ? 'Access System' : 'Create Account'}</button>
          </form>
          <button className="text-btn" onClick={() => setIsLoginView(!isLoginView)}>
            {isLoginView ? 'Need an account? Register' : 'Have an account? Log In'}
          </button>
        </div>
      </div>
    )
  }

  const totalRuns = historyData.length;
  const highRiskRuns = historyData.filter(d => d.is_late).length;
  const avgRisk = totalRuns > 0 ? (historyData.reduce((acc, curr) => acc + curr.risk_percentage, 0) / totalRuns).toFixed(1) : 0;

  return (
    <div className="container" style={{ maxWidth: '95%' }}>
      <div className="header-section">
        <div>
          <h1 style={{ margin: 0 }}>🌍 LogiSense AI Core</h1>
          <p style={{ margin: '5px 0 15px 0' }}>Operator: {session.user.email}</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setActiveTab('predict')} 
              style={{ padding: '8px 16px', background: activeTab === 'predict' ? 'var(--bg-input)' : 'transparent', color: activeTab === 'predict' ? 'var(--text-main)' : 'var(--text-muted)', border: activeTab === 'predict' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
            >
              Simulation Engine
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              style={{ padding: '8px 16px', background: activeTab === 'dashboard' ? 'var(--bg-input)' : 'transparent', color: activeTab === 'dashboard' ? 'var(--text-main)' : 'var(--text-muted)', border: activeTab === 'dashboard' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
            >
              Historical Analytics
            </button>
          </div>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>

      {activeTab === 'predict' && (
        <div className="wizard-container" style={{ maxWidth: '100%', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', color: 'var(--text-muted)' }}>
            <span style={{ color: wizardStep >= 1 ? 'var(--brand-primary)' : '' }}>1. Origin</span>
            <span style={{ color: wizardStep >= 2 ? 'var(--brand-primary)' : '' }}>2. Destination</span>
            <span style={{ color: wizardStep >= 3 ? 'var(--brand-primary)' : '' }}>3. Operations</span>
            <span style={{ color: wizardStep === 4 ? 'var(--brand-primary)' : '' }}>4. Analysis</span>
          </div>

          <div className="card" style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            
            {/* STEP 1: FULL SCREEN ORIGIN MAP */}
            {wizardStep === 1 && (
              <div className="step-content" style={{ flex: 1, animation: 'slideIn 0.3s ease-out', display: 'flex', flexDirection: 'column' }}>
                <h2>🌍 Select Target Market (Origin)</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Click on a major continental zone to set the origin market.</p>
                
                <div style={{ background: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', height: '65vh', minHeight: '400px', width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                  <ComposableMap 
                    width={1200} 
                    height={600} 
                    projectionConfig={{ scale: 190, center: [0, 15] }}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => {
                              setFormData({ ...formData, market: 'Europe' });
                              setWizardStep(2);
                            }}
                            style={{
                              default: { fill: "var(--border-focus)", outline: "none" },
                              hover: { fill: "var(--brand-primary)", outline: "none", cursor: "pointer", transition: "all 0.2s" },
                              pressed: { fill: "var(--brand-hover)", outline: "none" },
                            }}
                          />
                        ))
                      }
                    </Geographies>
                  </ComposableMap>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <select name="market" value={formData.market} onChange={handleChange} style={{ flex: 1 }}>
                    <option value="Europe">Europe</option>
                    <option value="LATAM">Latin America</option>
                    <option value="Pacific Asia">Pacific Asia</option>
                    <option value="USCA">US & Canada</option>
                    <option value="Africa">Africa</option>
                  </select>
                  <button className="primary-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => setWizardStep(2)}>Next Step ➔</button>
                </div>
              </div>
            )}

            {/* STEP 2: FULL SCREEN DESTINATION MAP */}
            {wizardStep === 2 && (
              <div className="step-content" style={{ flex: 1, animation: 'slideIn 0.3s ease-out', display: 'flex', flexDirection: 'column' }}>
                <h2>📍 Select Destination Region</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Select the specific regional zone for delivery.</p>
                
                <div style={{ background: 'var(--bg-input)', borderRadius: '12px', overflow: 'hidden', opacity: 0.9, height: '65vh', minHeight: '400px', width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                  <ComposableMap 
                    width={1200} 
                    height={600} 
                    projectionConfig={{ scale: 190, center: [0, 15] }}
                    style={{ width: "100%", height: "100%" }}
                  >
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onClick={() => {
                              setFormData({ ...formData, order_region: 'Western Europe' });
                              setWizardStep(3);
                            }}
                            style={{
                              default: { fill: "var(--border-subtle)", outline: "none" },
                              hover: { fill: "var(--brand-primary)", outline: "none", cursor: "pointer", transition: "all 0.2s" },
                              pressed: { fill: "var(--brand-hover)", outline: "none" },
                            }}
                          />
                        ))
                      }
                    </Geographies>
                  </ComposableMap>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <select name="order_region" value={formData.order_region} onChange={handleChange} style={{ flex: 1 }}>
                    <option value="Western Europe">Western Europe</option>
                    <option value="Northern Europe">Northern Europe</option>
                    <option value="Central America">Central America</option>
                    <option value="South America">South America</option>
                    <option value="Eastern Asia">Eastern Asia</option>
                    <option value="Oceania">Oceania</option>
                    <option value="US Center">US Center</option>
                    <option value="West of USA">West of USA</option>
                    <option value="East Africa">East Africa</option>
                  </select>
                  <button className="text-btn" style={{ width: 'auto', margin: 0, padding: '0 20px' }} onClick={() => setWizardStep(1)}>Back</button>
                  <button className="primary-btn" style={{ width: 'auto', marginTop: 0 }} onClick={() => setWizardStep(3)}>Next Step ➔</button>
                </div>
              </div>
            )}

            {/* STEP 3: OPERATIONAL DETAILS */}
            {wizardStep === 3 && (
              <div className="step-content" style={{ flex: 1, animation: 'slideIn 0.3s ease-out' }}>
                <h2>⚙️ Operational Parameters</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Define the logistics and scheduling parameters for this route.</p>
                
                <form onSubmit={predictRisk}>
                  <div className="input-groups-row">
                    <div className="input-group">
                      <label>Lead Time (Days)</label>
                      <input type="number" name="scheduled_days" value={formData.scheduled_days} onChange={handleChange} min="0" max="30" />
                    </div>
                    <div className="input-group">
                      <label>Shipping Protocol</label>
                      <select name="shipping_mode" value={formData.shipping_mode} onChange={handleChange}>
                        <option value="Standard Class">Standard Class</option>
                        <option value="First Class">First Class</option>
                        <option value="Second Class">Second Class</option>
                        <option value="Same Day">Same Day</option>
                      </select>
                    </div>
                  </div>

                  <div className="input-groups-row">
                    <div className="input-group">
                      <label>Month (1-12)</label>
                      <input type="number" name="order_month" value={formData.order_month} onChange={handleChange} min="1" max="12" />
                    </div>
                    <div className="input-group">
                      <label>Day of Week (0=Mon, 6=Sun)</label>
                      <input type="number" name="order_day_of_week" value={formData.order_day_of_week} onChange={handleChange} min="0" max="6" />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Transaction Type</label>
                    <select name="order_type" value={formData.order_type} onChange={handleChange}>
                      <option value="DEBIT">DEBIT</option>
                      <option value="TRANSFER">TRANSFER</option>
                      <option value="PAYMENT">PAYMENT</option>
                      <option value="CASH">CASH</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                    <button type="button" className="text-btn" style={{ width: 'auto', margin: 0, padding: '0 20px' }} onClick={() => setWizardStep(2)}>Back</button>
                    <button type="submit" className="primary-btn" style={{ marginTop: 0 }}>
                      Execute AI Risk Analysis
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 4: AI RESULTS & LOADING SCREEN */}
            {wizardStep === 4 && (
              <div className="step-content" style={{ animation: 'slideIn 0.3s ease-out' }}>
                
                {loading && (
                  <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                    <div className="spinner" style={{ margin: '0 auto 30px', width: '60px', height: '60px' }}></div>
                    <h2>⚙️ Processing Spatial Logistics...</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Running counterfactual simulation and XGBoost delay estimation.</p>
                  </div>
                )}

                {!loading && result && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <button className="text-btn" style={{ width: 'auto', margin: 0 }} onClick={() => setWizardStep(1)}>↺ New Scan</button>
                    </div>
                    
                    <div className={`result-card ${result.is_late ? 'late' : 'on-time'}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h2>{result.is_late ? '⚠️ CRITICAL DELAY RISK' : '✅ SLA PROTECTED'}</h2>
                        <button onClick={savePrediction} disabled={saveStatus !== ''} style={{ padding: '8px 16px', background: 'var(--brand-primary)', color: 'var(--text-on-brand)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                          {saveStatus || '💾 Log to Database'}
                        </button>
                      </div>
                      
                      <p>AI Confidence: <strong>{(result.probability * 100).toFixed(1)}% chance of lateness</strong></p>
                      
                      <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Top Delay Factors (SHAP):</h3>
                      <div style={{ height: '220px', width: '100%', backgroundColor: 'var(--bg-input)', borderRadius: '8px', padding: '10px 0', marginTop: '10px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={result.top_reasons} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <XAxis type="number" tick={{ fill: 'var(--text-muted)' }} />
                            <YAxis dataKey="feature" type="category" width={140} tick={{ fill: 'var(--text-muted)', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                              {result.top_reasons.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.impact > 0 ? 'var(--status-critical)' : 'var(--status-safe)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="llm-insight">
                        <h3>Strategic Directive</h3>
                        <p>{result.llm_insight}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="dashboard-view">
          {fetchingHistory ? (
            <p>Loading historical analytics from PostgreSQL database...</p>
          ) : historyData.length === 0 ? (
            <div className="card">
              <h2>No Data Available</h2>
              <p style={{color: 'var(--text-muted)'}}>You haven't saved any predictions yet. Go to the Simulation Engine, run an analysis, and click 'Log to Database'.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0', color: 'var(--brand-primary)' }}>{totalRuns}</h3>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>Total Interventions Logged</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0', color: 'var(--status-critical)' }}>{highRiskRuns}</h3>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>High-Risk Shipments</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0', color: 'var(--status-safe)' }}>{avgRisk}%</h3>
                  <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>Average System Risk</p>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '20px' }}>
                <h2>📈 Delay Risk Probability Over Time</h2>
                <div style={{ height: '400px', width: '100%', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="run_number" tick={{ fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }} />
                      <Line type="monotone" dataKey="risk_percentage" name="Delay Risk %" stroke="var(--brand-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--brand-primary)' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App