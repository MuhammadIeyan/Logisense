import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  // --- AUTHENTICATION STATE ---
  const [session, setSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isLoginView, setIsLoginView] = useState(true)

  // --- APP STATE ---
  const [formData, setFormData] = useState({
    scheduled_days: 2, shipping_mode: 'Standard Class', order_month: 6,
    order_day_of_week: 1, order_type: 'DEBIT', order_region: 'Western Europe', market: 'Europe'
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  // Check for active user session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  // --- AUTHENTICATION FUNCTIONS ---
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
    setResult(null) // Clear screen on logout
  }

  // --- APP FUNCTIONS ---
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const predictRisk = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSaveStatus('') // Reset save status
    
    try {
      // NOTE: Change to your Render URL for production!
      const response = await fetch('http://localhost:8000/predict', {
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
      alert("Error connecting to the AI Backend.")
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

  // --- IF NOT LOGGED IN, SHOW LOGIN SCREEN ---
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

  // --- MAIN APP (IF LOGGED IN) ---
  return (
    <div className="container">
      {/* HEADER WITH LOGOUT */}
      <div className="header-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>🌍 LogiSense AI Core</h1>
          <p style={{ margin: 0 }}>Operator: {session.user.email}</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </div>

      <div className="dashboard-grid">
        {/* LEFT COLUMN: SINGLE ORDER */}
        <div className="card">
          <h2>🔍 Spatial Order Inspection</h2>
          <form onSubmit={predictRisk}>
            
            <div className="input-groups-row">
              <div className="input-group">
                <label>Target Market</label>
                <select name="market" value={formData.market} onChange={handleChange}>
                  <option value="Europe">Europe</option>
                  <option value="LATAM">Latin America</option>
                  <option value="Pacific Asia">Pacific Asia</option>
                  <option value="USCA">US & Canada</option>
                  <option value="Africa">Africa</option>
                </select>
              </div>
              <div className="input-group">
                <label>Destination Region</label>
                <select name="order_region" value={formData.order_region} onChange={handleChange}>
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
              </div>
            </div>

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

            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? "Running Spatial Analysis..." : "Run Risk Analysis"}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: AI RESULTS */}
        <div>
          {result ? (
            <div className={`result-card ${result.is_late ? 'late' : 'on-time'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2>{result.is_late ? '⚠️ HIGH RISK OF DELAY' : '✅ ON TIME'}</h2>
                <button onClick={savePrediction} disabled={saveStatus !== ''} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {saveStatus || '💾 Save Record'}
                </button>
              </div>
              
              <p>AI Confidence: <strong>{(result.probability * 100).toFixed(1)}% chance of lateness</strong></p>
              
              <h3>Top Delay Factors (SHAP):</h3>
              <div style={{ height: '220px', width: '100%', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '10px 0', marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={result.top_reasons} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                    <YAxis dataKey="feature" type="category" width={140} tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 13 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '8px', color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                      {result.top_reasons.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.impact > 0 ? '#ff4d4f' : '#4ade80'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="llm-insight">
                <h3>🤖 Strategic LLM Insight</h3>
                <p>{result.llm_insight}</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <p>Run a prediction to view AI insights.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App