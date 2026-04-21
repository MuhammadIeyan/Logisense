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
  const [batchResult, setBatchResult] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)

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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setBatchLoading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch('https://logisense.onrender.com/predict_batch', {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      setBatchResult(data)
    } catch (error) {
      alert("Error processing batch file.")
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header-section">
        <h1>📦 LogiSense AI Core</h1>
        <p>Advanced predictive analytics for global supply chain routing.</p>
      </div>

      <div className="dashboard-grid">
        {/* LEFT COLUMN: SINGLE ORDER */}
        <div className="card">
          <h2>🔍 Single Order Inspection</h2>
          <form onSubmit={predictRisk}>
            <div className="input-group">
              <label>Scheduled Lead Time (Days)</label>
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

            <div className="input-groups-row">
              <div className="input-group">
                <label>Operational Month (1-12)</label>
                <input type="number" name="order_month" value={formData.order_month} onChange={handleChange} min="1" max="12" />
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
            </div>

            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? "Initializing AI Engine..." : "Run Risk Analysis"}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: BATCH PROCESSING */}
        <div className="card batch-card">
          <h2>📊 System-Wide Batch Processing</h2>
          <p>Upload routing logs (.csv) for multi-node delay forecasting.</p>
          
          <div className="upload-zone">
            <input type="file" accept=".csv" onChange={handleFileUpload} disabled={batchLoading} />
            {batchLoading && <p className="loading-text">Processing system data...</p>}
          </div>

          {batchResult && (
            <div className="batch-stats">
              <div className="stat-box">
                <h3>{batchResult.total_processed}</h3>
                <span>Orders Analyzed</span>
              </div>
              <div className="stat-box danger">
                <h3>{batchResult.high_risk_count}</h3>
                <span>High Risk Orders</span>
              </div>
              <div className="stat-box warning">
                <h3>{batchResult.average_risk_percentage.toFixed(1)}%</h3>
                <span>System Average Risk</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KEEP YOUR EXISTING RESULTS SECTION HERE */}
      {/* ... {result && ( ... )} ... */}

    </div>
  )
}

export default App