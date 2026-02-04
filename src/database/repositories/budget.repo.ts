/**
 * Budget Repository - CRUD operations for budgets
 * 
 * Example of the new modular database pattern
 * All repositories follow this same structure
 */

import type { Database } from 'better-sqlite3'
import type { Budget, QueryResult, QueryOptions } from '../types'

export class BudgetRepository {
  private db: Database

  constructor(database: Database) {
    this.db = database
  }

  /**
   * Create a new budget
   */
  async create(data: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const id = this.generateId()
    const now = new Date().toISOString()

    try {
      const stmt = this.db.prepare(`
        INSERT INTO budgets (
          id, categoryId, accountId, amount, period, startDate, endDate, 
          alertThreshold, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        id,
        data.categoryId,
        data.accountId || null,
        data.amount,
        data.period,
        data.startDate,
        data.endDate || null,
        data.alertThreshold,
        now,
        now
      )

      return this.read(id) as Promise<Budget>
    } catch (error) {
      throw new Error(`Failed to create budget: ${(error as Error).message}`)
    }
  }

  /**
   * Read a single budget by ID
   */
  async read(id: string): Promise<Budget | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
      const row = stmt.get(id) as Budget | undefined

      if (!row) return null

      return this.mapRowToBudget(row)
    } catch (error) {
      throw new Error(`Failed to read budget: ${(error as Error).message}`)
    }
  }

  /**
   * Read all budgets with filtering and pagination
   */
  async readAll(options?: QueryOptions): Promise<QueryResult<Budget>> {
    try {
      let query = 'SELECT * FROM budgets'
      const params: unknown[] = []

      if (options?.orderBy) {
        query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'DESC'}`
      } else {
        query += ' ORDER BY startDate DESC'
      }

      const limit = options?.limit || 50
      const offset = options?.offset || 0
      query += ` LIMIT ? OFFSET ?`
      params.push(limit, offset)

      const stmt = this.db.prepare(query)
      const rows = stmt.all(...params) as Budget[]

      return {
        data: rows.map(row => this.mapRowToBudget(row)),
        total: rows.length,
        limit,
        offset,
      }
    } catch (error) {
      throw new Error(`Failed to read budgets: ${(error as Error).message}`)
    }
  }

  /**
   * Update a budget
   */
  async update(id: string, changes: Partial<Omit<Budget, 'id' | 'createdAt'>>): Promise<Budget> {
    try {
      const now = new Date().toISOString()
      const updates: string[] = []
      const values: unknown[] = []

      Object.entries(changes).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`)
          values.push(value)
        }
      })

      updates.push('updatedAt = ?')
      values.push(now)
      values.push(id)

      const stmt = this.db.prepare(`
        UPDATE budgets SET ${updates.join(', ')} WHERE id = ?
      `)

      stmt.run(...values)

      return this.read(id) as Promise<Budget>
    } catch (error) {
      throw new Error(`Failed to update budget: ${(error as Error).message}`)
    }
  }

  /**
   * Delete a budget
   */
  async delete(id: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM budgets WHERE id = ?')
      const result = stmt.run(id)
      return (result.changes ?? 0) > 0
    } catch (error) {
      throw new Error(`Failed to delete budget: ${(error as Error).message}`)
    }
  }

  /**
   * Find budgets for current period
   */
  async findForCurrentPeriod(period: 'monthly' | 'quarterly' | 'yearly'): Promise<Budget[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM budgets 
        WHERE period = ? 
        AND startDate <= date('now')
        AND (endDate IS NULL OR endDate >= date('now'))
        ORDER BY startDate DESC
      `)
      const rows = stmt.all(period) as Budget[]
      return rows.map(row => this.mapRowToBudget(row))
    } catch (error) {
      throw new Error(`Failed to find period budgets: ${(error as Error).message}`)
    }
  }

  /**
   * Helper: Map database row to Budget object
   */
  private mapRowToBudget(row: Budget): Budget {
    return {
      id: row.id,
      categoryId: row.categoryId,
      accountId: row.accountId || undefined,
      amount: row.amount,
      period: row.period,
      startDate: row.startDate,
      endDate: row.endDate || undefined,
      alertThreshold: row.alertThreshold,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  /**
   * Helper: Generate UUID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
