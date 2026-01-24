import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar } from 'recharts'



const INFLATION_DATA = [
  { month: 'Jan', Housing: 310, Food: 310, Transportation: 260, Healthcare: 480 },
  { month: 'Feb', Housing: 312, Food: 312, Transportation: 261, Healthcare: 481 },
  { month: 'Mar', Housing: 314, Food: 314, Transportation: 263, Healthcare: 483 },
  { month: 'Apr', Housing: 316, Food: 315, Transportation: 264, Healthcare: 484 },
  { month: 'May', Housing: 318, Food: 317, Transportation: 266, Healthcare: 486 },
]

const CATEGORIES = ['Housing', 'Food', 'Transportation', 'Healthcare']

export default function CostOfLiving() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Housing')
  const [userSpending, setUserSpending] = useState<Record<string, number>>({
    Housing: 1500,
    Food: 600,
    Transportation: 400,
    Healthcare: 150,
  })

  const updateSpending = (category: string, value: string) => {
    setUserSpending({
      ...userSpending,
      [category]: parseFloat(value) || 0,
    })
  }

  // Prepare chart data combining inflation and user spending
  const chartData = INFLATION_DATA.map((row) => ({
    month: row.month,
    Housing_Index: row.Housing,
    Food_Index: row.Food,
    Transportation_Index: row.Transportation,
    Healthcare_Index: row.Healthcare,
    Housing_Spending: userSpending.Housing,
    Food_Spending: userSpending.Food,
    Transportation_Spending: userSpending.Transportation,
    Healthcare_Spending: userSpending.Healthcare,
  }))

  const selectedCategoryData = chartData.map(d => ({
    month: d.month,
    index: d[`${selectedCategory}_Index` as keyof typeof d] as number,
    spending: d[`${selectedCategory}_Spending` as keyof typeof d] as number,
  }))

  // Calculate inflation impact
  const baseIndex = INFLATION_DATA[0][selectedCategory as keyof typeof INFLATION_DATA[0]] as number
  const currentIndex = INFLATION_DATA[INFLATION_DATA.length - 1][selectedCategory as keyof typeof INFLATION_DATA[0]] as number
  const inflationRate = ((currentIndex - baseIndex) / baseIndex * 100).toFixed(2)

  const baseSpending = userSpending[selectedCategory]
  const inflationAdjustedSpending = (baseSpending * currentIndex / baseIndex).toFixed(2)
  const additionalCost = (Number(inflationAdjustedSpending) - baseSpending).toFixed(2)

  const monthlyImpact = Number(additionalCost) * 1
  const annualImpact = monthlyImpact * 12

  return (
    <div className="tool-container">
      <h2>💰 Cost of Living & Inflation Context</h2>

      <div className="tool-stats">
        <div className="stat-card">
          <div className="stat-label">Inflation Rate ({selectedCategory})</div>
          <div className="stat-value">{inflationRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Spending</div>
          <div className="stat-value">${baseSpending.toLocaleString()}</div>
        </div>
        <div className="stat-card negative">
          <div className="stat-label">Inflation-Adjusted Cost</div>
          <div className="stat-value">${Number(inflationAdjustedSpending).toLocaleString()}</div>
        </div>
        <div className="stat-card negative">
          <div className="stat-label">Additional Cost/Year</div>
          <div className="stat-value">${(annualImpact).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div className="chart-container">
        <h3>Inflation Index Trend - {selectedCategory}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={selectedCategoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="index" stroke="#4ECDC4" strokeWidth={2} name="Inflation Index" />
            <Line yAxisId="right" type="monotone" dataKey="spending" stroke="#FF6B6B" strokeWidth={2} name="Your Spending" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>All Categories Comparison</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Housing_Index" fill="#4ECDC4" name="Housing Index" />
            <Bar dataKey="Food_Index" fill="#45B7D1" name="Food Index" />
            <Bar dataKey="Transportation_Index" fill="#96CEB4" name="Transportation Index" />
            <Bar dataKey="Healthcare_Index" fill="#FFEAA7" name="Healthcare Index" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="input-section">
        <h3>Update Your Spending by Category</h3>
        <div className="form-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {CATEGORIES.map(category => (
            <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>{category}</label>
              <input
                type="number"
                value={userSpending[category]}
                onChange={(e) => updateSpending(category, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="data-table">
        <h3>Category Analysis - {selectedCategory}</h3>
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Selected Category:</strong>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ marginLeft: '0.5rem' }}>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <table style={{ width: '100%', marginTop: '1rem' }}>
            <tbody>
              <tr>
                <td><strong>Base Inflation Index:</strong></td>
                <td>${baseIndex}</td>
              </tr>
              <tr>
                <td><strong>Current Inflation Index:</strong></td>
                <td>${currentIndex}</td>
              </tr>
              <tr>
                <td><strong>Inflation Change:</strong></td>
                <td>{inflationRate}%</td>
              </tr>
              <tr style={{ backgroundColor: '#fff' }}>
                <td><strong>Your Current Spending:</strong></td>
                <td>${baseSpending.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>Inflation-Adjusted Spending (to maintain same lifestyle):</strong></td>
                <td>${Number(inflationAdjustedSpending).toLocaleString()}</td>
              </tr>
              <tr style={{ backgroundColor: '#ffeaea' }}>
                <td><strong>Additional Monthly Cost:</strong></td>
                <td>${monthlyImpact.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
              </tr>
              <tr style={{ backgroundColor: '#ffeaea' }}>
                <td><strong>Additional Annual Cost:</strong></td>
                <td>${annualImpact.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-table">
        <h3>All Categories Inflation Index (CPI)</h3>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Housing</th>
              <th>Food</th>
              <th>Transportation</th>
              <th>Healthcare</th>
            </tr>
          </thead>
          <tbody>
            {INFLATION_DATA.map((row, idx) => (
              <tr key={idx}>
                <td>{row.month}</td>
                <td>${row.Housing}</td>
                <td>${row.Food}</td>
                <td>${row.Transportation}</td>
                <td>${row.Healthcare}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="note">
        <strong>Note:</strong> Inflation index data is read-only reference data (external indexed data). Update your spending amounts to see how inflation affects your actual costs.
      </div>
    </div>
  )
}
