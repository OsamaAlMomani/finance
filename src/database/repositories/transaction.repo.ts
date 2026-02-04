/**
 * Transaction Repository
 * 
 * Handles all CRUD operations for transactions
 * Extracted and refactored from: src/services/database.ts
 */

import type { Database } from 'better-sqlite3';
import type { Transaction, QueryResult, QueryOptions } from '../types';

export class TransactionRepository {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Create a new transaction
   */
  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const id = this.generateId();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO transactions (
          id, date, type, amount, accountId, categoryId, merchant, description,
          tags, taxFlag, isRecurring, recurringPattern, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.date,
        data.type,
        data.amount,
        data.accountId,
        data.categoryId,
        data.merchant || null,
        data.description || null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.taxFlag,
        data.isRecurring ? 1 : 0,
        data.recurringPattern || null,
        now,
        now
      );

      return this.read(id) as Promise<Transaction>;
    } catch (error) {
      throw new Error(`Failed to create transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Read a single transaction by ID
   */
  async read(id: string): Promise<Transaction | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM transactions WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) return null;

      return this.mapRowToTransaction(row);
    } catch (error) {
      throw new Error(`Failed to read transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Read all transactions with filtering and pagination
   */
  async readAll(options?: QueryOptions): Promise<QueryResult<Transaction>> {
    try {
      let query = 'SELECT * FROM transactions';
      const params: unknown[] = [];

      if (options?.filters) {
        const where = this.buildWhereClause(options.filters);
        if (where.query) {
          query += ' WHERE ' + where.query;
          params.push(...where.params);
        }
      }

      if (options?.orderBy) {
        const direction = options.orderDirection || 'DESC';
        query += ` ORDER BY ${options.orderBy} ${direction}`;
      } else {
        query += ' ORDER BY date DESC';
      }

      // Get total count
      const countStmt = this.db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as count'));
      const countResult = countStmt.get(...params) as any;
      const total = countResult.count;

      // Apply pagination
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return {
        data: rows.map(row => this.mapRowToTransaction(row)),
        total,
        limit,
        offset,
      };
    } catch (error) {
      throw new Error(`Failed to read transactions: ${(error as Error).message}`);
    }
  }

  /**
   * Update a transaction
   */
  async update(id: string, changes: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<Transaction> {
    try {
      const now = new Date().toISOString();
      const updates: string[] = [];
      const values: unknown[] = [];

      Object.entries(changes).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'tags' && Array.isArray(value)) {
            updates.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }
      });

      updates.push('updatedAt = ?');
      values.push(now);
      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE transactions SET ${updates.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);

      return this.read(id) as Promise<Transaction>;
    } catch (error) {
      throw new Error(`Failed to update transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<boolean> {
    try {
      const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?');
      const result = stmt.run(id);
      return (result.changes ?? 0) > 0;
    } catch (error) {
      throw new Error(`Failed to delete transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Find recurring transactions
   */
  async findRecurring(): Promise<Transaction[]> {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM transactions WHERE isRecurring = 1 ORDER BY date DESC'
      );
      const rows = stmt.all() as any[];
      return rows.map(row => this.mapRowToTransaction(row));
    } catch (error) {
      throw new Error(`Failed to find recurring transactions: ${(error as Error).message}`);
    }
  }

  /**
   * Find transactions by date range
   */
  async findByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transactions 
        WHERE date BETWEEN ? AND ? 
        ORDER BY date DESC
      `);
      const rows = stmt.all(startDate, endDate) as any[];
      return rows.map(row => this.mapRowToTransaction(row));
    } catch (error) {
      throw new Error(`Failed to find transactions by date range: ${(error as Error).message}`);
    }
  }

  /**
   * Find transactions by account
   */
  async findByAccount(accountId: string): Promise<Transaction[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transactions 
        WHERE accountId = ? 
        ORDER BY date DESC
      `);
      const rows = stmt.all(accountId) as any[];
      return rows.map(row => this.mapRowToTransaction(row));
    } catch (error) {
      throw new Error(`Failed to find transactions by account: ${(error as Error).message}`);
    }
  }

  /**
   * Find transactions by category
   */
  async findByCategory(categoryId: string): Promise<Transaction[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM transactions 
        WHERE categoryId = ? 
        ORDER BY date DESC
      `);
      const rows = stmt.all(categoryId) as any[];
      return rows.map(row => this.mapRowToTransaction(row));
    } catch (error) {
      throw new Error(`Failed to find transactions by category: ${(error as Error).message}`);
    }
  }

  /**
   * Get summary by category
   */
  async getSummaryByCategory(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    try {
      let query = `
        SELECT categoryId, SUM(amount) as total 
        FROM transactions 
        WHERE type = 'expense'
      `;
      const params: unknown[] = [];

      if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
      }

      query += ` GROUP BY categoryId`;

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.reduce((acc, row) => {
        acc[row.categoryId] = row.total;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      throw new Error(`Failed to get summary by category: ${(error as Error).message}`);
    }
  }

  /**
   * Helper: Map database row to Transaction object
   */
  private mapRowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      date: row.date,
      type: row.type,
      amount: row.amount,
      accountId: row.accountId,
      categoryId: row.categoryId,
      merchant: row.merchant || undefined,
      description: row.description || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      taxFlag: row.taxFlag,
      isRecurring: Boolean(row.isRecurring),
      recurringPattern: row.recurringPattern || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Helper: Build WHERE clause from filters
   */
  private buildWhereClause(filters: Record<string, unknown>): { query: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else if (typeof value === 'object') {
          // Handle range queries
          const obj = value as any;
          if (obj.$gte) {
            conditions.push(`${key} >= ?`);
            params.push(obj.$gte);
          }
          if (obj.$lte) {
            conditions.push(`${key} <= ?`);
            params.push(obj.$lte);
          }
        } else {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
      }
    });

    return {
      query: conditions.join(' AND '),
      params,
    };
  }

  /**
   * Helper: Generate UUID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
