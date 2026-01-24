import { useState } from 'react'
import { useTodos } from '../../hooks/useAdvancedFeatures'
import { Trash2, Plus, CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react'
import '../../styles/TodoList.css'

export default function TodoList() {
  const { todos, loading, error, addTodo, updateTodo, deleteTodo, toggleTodo, addSubtask, toggleSubtask } = useTodos()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created'>('dueDate')
  const [showForm, setShowForm] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    priority: 'medium' as const,
    category: 'General',
    estimatedHours: 0
  })

  const [expandedTodo, setExpandedTodo] = useState<string | null>(null)
  const [newSubtask, setNewSubtask] = useState<Record<string, string>>({})

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) return

    try {
      await addTodo({
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate || new Date().toISOString(),
        dueTime: formData.dueTime,
        priority: formData.priority,
        category: formData.category,
        estimatedHours: formData.estimatedHours || undefined
      })
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        priority: 'medium',
        category: 'General',
        estimatedHours: 0
      })
      setShowForm(false)
    } catch (err) {
      console.error('Error adding todo:', err)
    }
  }

  const handleAddSubtask = async (todoId: string) => {
    if (!newSubtask[todoId]) return
    try {
      await addSubtask(todoId, {
        title: newSubtask[todoId],
        completed: false
      })
      setNewSubtask({ ...newSubtask, [todoId]: '' })
    } catch (err) {
      console.error('Error adding subtask:', err)
    }
  }

  const handleUpdateTodo = async (id: string, updates: any) => {
    try {
      await updateTodo(id, updates)
    } catch (err) {
      console.error('Error updating todo:', err)
    }
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (sortBy === 'dueDate') return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef5350'
      case 'medium': return '#ffa726'
      case 'low': return '#66bb6a'
      default: return '#90caf9'
    }
  }

  const getProgressPercentage = (todo: any) => {
    if (!todo.subtasks || todo.subtasks.length === 0) return todo.completed ? 100 : 0
    const completed = todo.subtasks.filter((s: any) => s.completed).length
    return Math.round((completed / todo.subtasks.length) * 100)
  }

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && !todos.find(t => t.dueDate === dueDate)?.completed
  }

  if (loading) return <div className="todo-container"><p>Loading todos...</p></div>
  if (error) return <div className="todo-container"><p className="error">Error: {error}</p></div>

  return (
    <div className="todo-container">
      <div className="todo-header">
        <h2>📋 Task Manager & To-Do List</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddTodo} className="todo-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="Task title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <input
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
            <div className="form-group">
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="General">General</option>
                <option value="Work">Work</option>
                <option value="Personal">Personal</option>
                <option value="Financial">Financial</option>
                <option value="Health">Health</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <input
                type="number"
                placeholder="Est. hours"
                min="0"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary">Add Task</button>
        </form>
      )}

      <div className="todo-controls">
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({todos.length})
          </button>
          <button
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active ({todos.filter(t => !t.completed).length})
          </button>
          <button
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed ({todos.filter(t => t.completed).length})
          </button>
        </div>

        <div className="sort-controls">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="dueDate">Due Date</option>
            <option value="priority">Priority</option>
            <option value="created">Created</option>
          </select>
        </div>
      </div>

      <div className="todos-list">
        {sortedTodos.length === 0 ? (
          <div className="empty-state">
            <p>No tasks yet. Create one to get started!</p>
          </div>
        ) : (
          sortedTodos.map(todo => (
            <div
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''} ${isOverdue(todo.dueDate) ? 'overdue' : ''}`}
              onClick={() => setExpandedTodo(expandedTodo === todo.id ? null : todo.id)}
            >
              <div className="todo-header-row">
                <div className="todo-checkbox">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTodo(todo.id)
                    }}
                    className="checkbox-btn"
                  >
                    {todo.completed ? <CheckCircle size={24} /> : <Circle size={24} />}
                  </button>
                </div>

                <div className="todo-main-content">
                  <div className="todo-title-row">
                    <h3>{todo.title}</h3>
                    {isOverdue(todo.dueDate) && <AlertCircle size={16} className="overdue-icon" />}
                  </div>
                  {todo.description && <p className="todo-description">{todo.description}</p>}
                </div>

                <div className="todo-meta">
                  <div className="priority-badge" style={{ backgroundColor: getPriorityColor(todo.priority) }}>
                    {todo.priority}
                  </div>
                  {todo.dueDate && (
                    <div className="due-date">
                      <Clock size={14} />
                      {new Date(todo.dueDate).toLocaleDateString()}
                      {todo.dueTime && ` ${todo.dueTime}`}
                    </div>
                  )}
                  {todo.estimatedHours && (
                    <div className="estimated-time">⏱️ {todo.estimatedHours}h</div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteTodo(todo.id)
                  }}
                  className="btn-delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {expandedTodo === todo.id && (
                <div className="todo-details">
                  <div className="todo-category">
                    <strong>Category:</strong> {todo.category}
                  </div>

                  {todo.subtasks && todo.subtasks.length > 0 && (
                    <div className="subtasks-section">
                      <h4>Subtasks ({getProgressPercentage(todo)}%)</h4>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${getProgressPercentage(todo)}%` }}
                        />
                      </div>
                      <div className="subtasks-list">
                        {todo.subtasks.map(subtask => (
                          <div key={subtask.id} className="subtask-item">
                            <button
                              onClick={() => toggleSubtask(todo.id, subtask.id)}
                              className="subtask-checkbox"
                            >
                              {subtask.completed ? <CheckCircle size={18} /> : <Circle size={18} />}
                            </button>
                            <span className={subtask.completed ? 'completed' : ''}>
                              {subtask.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="add-subtask">
                    <div className="subtask-input-group">
                      <input
                        type="text"
                        placeholder="Add subtask..."
                        value={newSubtask[todo.id] || ''}
                        onChange={(e) => setNewSubtask({ ...newSubtask, [todo.id]: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddSubtask(todo.id)
                        }}
                        className="btn-small"
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  </div>

                  {todo.estimatedHours && (
                    <div className="time-tracking">
                      <label>
                        Actual Hours:
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={todo.actualHours || 0}
                          onChange={(e) => handleUpdateTodo(todo.id, { actualHours: parseFloat(e.target.value) })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                      {todo.actualHours && (
                        <div className="time-efficiency">
                          {todo.actualHours > todo.estimatedHours
                            ? `⚠️ Over by ${(todo.actualHours - todo.estimatedHours).toFixed(1)}h`
                            : `✅ ${(todo.estimatedHours - todo.actualHours).toFixed(1)}h under estimate`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="todos-stats">
        <div className="stat">
          <strong>Total Tasks:</strong> {todos.length}
        </div>
        <div className="stat">
          <strong>Completed:</strong> {todos.filter(t => t.completed).length}
        </div>
        <div className="stat">
          <strong>Progress:</strong> {todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0}%
        </div>
        <div className="stat">
          <strong>Overdue:</strong> {todos.filter(t => isOverdue(t.dueDate) && !t.completed).length}
        </div>
      </div>
    </div>
  )
}
