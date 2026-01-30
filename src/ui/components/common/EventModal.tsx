import { useState, useEffect } from 'react'
import './EventModal.css'

interface TimelineEvent {
  id: string
  title: string
  date: string
  category: 'work' | 'personal' | 'education' | 'travel' | 'health' | 'finance'
  description: string
  tags: string[]
  icon: string
}

interface EventModalProps {
  isOpen: boolean
  event: TimelineEvent | null
  onClose: () => void
  onSave: (event: Omit<TimelineEvent, 'id'>) => void
  categories: readonly {readonly id: string; readonly label: string; readonly icon: string}[]
  iconOptions: { value: string; label: string }[]
}

export default function EventModal({
  isOpen,
  event,
  onClose,
  onSave,
  categories,
  iconOptions
}: EventModalProps) {
  const [formData, setFormData] = useState<Omit<TimelineEvent, 'id'>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    category: 'work',
    description: '',
    tags: [],
    icon: 'fa-star'
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        date: event.date,
        category: event.category,
        description: event.description,
        tags: event.tags,
        icon: event.icon
      })
    } else {
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        category: 'work',
        description: '',
        tags: [],
        icon: 'fa-star'
      })
    }
    setTagInput('')
  }, [event, isOpen])

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title.trim() && formData.date) {
      onSave(formData)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{event ? 'Edit Event' : 'Add New Event'}</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="eventTitle">Event Title *</label>
            <input
              id="eventTitle"
              type="text"
              placeholder="Enter event title"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="form-control"
              required
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eventDate">Date *</label>
              <input
                id="eventDate"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="form-control"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="eventCategory">Category *</label>
              <select
                id="eventCategory"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as 'work' | 'personal' | 'education' | 'travel' | 'health' | 'finance' })}
                className="form-control"
                required
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="eventDescription">Description</label>
            <textarea
              id="eventDescription"
              placeholder="Describe your event..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="form-control"
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="eventIcon">Icon</label>
            <select
              id="eventIcon"
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              className="form-control"
            >
              {iconOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="eventTags">Tags (comma separated)</label>
            <div className="tag-input-group">
              <input
                id="eventTags"
                type="text"
                placeholder="e.g. milestone, important, achievement"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="form-control"
              />
              <button type="button" className="btn-add-tag" onClick={handleAddTag}>Add</button>
            </div>
            {formData.tags.length > 0 && (
              <div className="tags-list">
                {formData.tags.map(tag => (
                  <span key={tag} className="tag-badge">
                    {tag}
                    <button
                      type="button"
                      className="tag-remove"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {event ? 'Update Event' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
