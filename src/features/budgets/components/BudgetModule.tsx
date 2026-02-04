import { useState, useEffect } from 'react'
import type { Budget } from '../../../database/types'
// import type { BudgetRepository } from '../../../database/repositories/budget.repo'

/**
 * Budget Module - Example Feature Implementation
 * 
 * This shows how to use the new modular structure:
 * 1. Import types from database/types
 * 2. Use repositories for CRUD operations
 * 3. Build React components
 * 4. Connect to UI routing
 */

export function BudgetList() {
  const [budgets, _setbudgets] = useState<Budget[]>([])
  const [loading, _setLoading] = useState(false)

  useEffect(() => {
    // TODO: Initialize repository with database connection
    // const repo: BudgetRepository = new BudgetRepository(database);
    // const data = await repo.readAll();
    // _setbudgets(data.data);
  }, [])

  if (loading) {
    return <div>Loading budgets...</div>
  }

  return (
    <div className="budget-list">
      <h1>Budgets</h1>
      {budgets.length === 0 ? (
        <p>No budgets yet. Create one to get started!</p>
      ) : (
        <ul>
          {budgets.map(budget => (
            <li key={budget.id}>
              <h3>{budget.id}</h3>
              <p>Amount: ${budget.amount}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BudgetList
