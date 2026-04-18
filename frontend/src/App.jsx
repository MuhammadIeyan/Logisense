import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import './App.css'

function App() {
  // 1. State to hold user inputs
  const [formData, setFormData] = useState({
    scheduled_days: 2,
    shipping_mode: 'Standard Class',
    order_month: 6,
    order_type: 'DEBIT'
  })

  // 2. State to hold the AI's response
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // 3. Handle typing in the form
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // 4. Send data to our Python Backend!
  const predictRisk = async (e) => {
    e.preventDefault() // Prevent page refresh
    setLoading(true)
    
    try {
      const response = await fetch('https://logisense.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_days: parseInt(formData.scheduled_days),
          shipping_mode: formData.shipping_mode,
          order_month: parseInt(formData.order_month),
          order_type: formData.order_type
        })
      })
      
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("Error connecting to backend:", error)
      alert("Could not connect to the AI Backend. Is Uvicorn running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>📦 LogiSense AI Dashboard</h1>
      <p>Enter shipment details to predict delay risk.</p>

      <div className="card">
        <form onSubmit={predictRisk}>
          
          <label>Scheduled Days for Shipment</label>
          <input type="number" name="scheduled_days" value={formData.scheduled_days} onChange={handleChange} min="0" max="30" />

          <label>Shipping Mode</label>
          <select name="shipping_mode" value={formData.shipping_mode} onChange={handleChange}>
            <option value="Standard Class">Standard Class</option>
            <option value="First Class">First Class</option>
            <option value="Second Class">Second Class</option>
            <option value="Same Day">Same Day</option>
          </select>

          <label>Order Month (1-12)</label>
          <input type="number" name="order_month" value={formData.order_month} onChange={handleChange} min="1" max="12" />

          <label>Transaction Type</label>
          <select name="order_type" value={formData.order_type} onChange={handleChange}>
            <option value="DEBIT">DEBIT</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="PAYMENT">PAYMENT</option>
            <option value="CASH">CASH</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Analyzing Risk..." : "Predict Risk"}
          </button>
        </form>
      </div>

      {/* 5. Display the Results */}
      {result && (
        <div className={`result-card ${result.is_late ? 'late' : 'on-time'}`}>
          <h2>{result.is_late ? '⚠️ HIGH RISK OF DELAY' : '✅ ON TIME'}</h2>
          <p>AI Confidence: <strong>{(result.probability * 100).toFixed(1)}% chance of lateness</strong></p>
          
          <h3>Top Delay Factors (SHAP Analysis):</h3>
          
          {/* NEW RECHARTS VISUALIZATION */}
          <div style={{ height: '250px', width: '100%', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '15px 0', marginTop: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={result.top_reasons} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.8)' }} />
                <YAxis dataKey="feature" type="category" width={140} tick={{ fill: 'rgba(255,255,255,0.9)', fontSize: 13 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '8px', color: '#fff' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                  {/* Red bars for delay factors (+), Green bars for speeding factors (-) */}
                  {result.top_reasons.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.impact > 0 ? '#ff4d4f' : '#4ade80'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* NEW LLM INSIGHT SECTION */}
          <div className="llm-insight">
            <h3>🤖 Strategic LLM Insight</h3>
            <p>{result.llm_insight}</p>
          </div>

        </div>
      )}
    </div>
  )
}

export default App