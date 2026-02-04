/**
 * ChronoLine Timeline Component
 * Matching Example.html design with React & TypeScript
 * 
 * Features:
 * - Centered timeline with alternating left/right events
 * - Theme selector dropdown panel with visual previews
 * - Category filtering with filter chips
 * - CRUD operations for timeline events
 * - Smooth scroll animations with Intersection Observer
 * - Keyboard shortcuts (Ctrl+K to add, Escape to close)
 * - Local storage persistence
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  category: EventCategory;
  description: string;
  tags: string[];
  icon: string;
}

type EventCategory = 'work' | 'personal' | 'education' | 'travel' | 'health' | 'finance';

interface Theme {
  id: string;
  name: string;
  colors: string[];
}

interface IconOption {
  value: string;
  label: string;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const THEMES: Theme[] = [
  { id: 'theme-default', name: 'Default', colors: ['#4f46e5', '#7c3aed', '#06b6d4'] },
  { id: 'theme-purple', name: 'Purple', colors: ['#8b5cf6', '#a78bfa', '#c4b5fd'] },
  { id: 'theme-green', name: 'Green', colors: ['#10b981', '#34d399', '#6ee7b7'] },
  { id: 'theme-orange', name: 'Orange', colors: ['#f59e0b', '#fbbf24', '#fcd34d'] },
  { id: 'theme-pink', name: 'Pink', colors: ['#ec4899', '#f472b6', '#f9a8d4'] },
  { id: 'theme-dark', name: 'Dark', colors: ['#111827', '#1f2937', '#374151'] },
  { id: 'theme-light', name: 'Light', colors: ['#f8fafc', '#f1f5f9', '#e2e8f0'] }
];

const CATEGORIES: { id: EventCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'fas fa-layer-group' },
  { id: 'work', label: 'Work', icon: 'fas fa-briefcase' },
  { id: 'personal', label: 'Personal', icon: 'fas fa-user' },
  { id: 'education', label: 'Education', icon: 'fas fa-graduation-cap' },
  { id: 'travel', label: 'Travel', icon: 'fas fa-plane' },
  { id: 'health', label: 'Health', icon: 'fas fa-heartbeat' },
  { id: 'finance', label: 'Finance', icon: 'fas fa-chart-line' }
];

const ICON_OPTIONS: IconOption[] = [
  { value: 'fa-star', label: 'Star' },
  { value: 'fa-briefcase', label: 'Briefcase' },
  { value: 'fa-graduation-cap', label: 'Graduation' },
  { value: 'fa-heart', label: 'Heart' },
  { value: 'fa-plane', label: 'Plane' },
  { value: 'fa-code', label: 'Code' },
  { value: 'fa-music', label: 'Music' },
  { value: 'fa-gamepad', label: 'Game' },
  { value: 'fa-home', label: 'Home' },
  { value: 'fa-car', label: 'Car' }
];

const SAMPLE_EVENTS: TimelineEvent[] = [
  {
    id: '1',
    title: 'Graduated University',
    date: '2020-06-15',
    category: 'education',
    description: 'Completed my Bachelor\'s degree in Computer Science with honors.',
    tags: ['achievement', 'milestone'],
    icon: 'fa-graduation-cap'
  },
  {
    id: '2',
    title: 'First Job at TechCorp',
    date: '2020-08-01',
    category: 'work',
    description: 'Started my career as a Junior Developer at a leading tech company.',
    tags: ['career', 'beginning'],
    icon: 'fa-briefcase'
  },
  {
    id: '3',
    title: 'Europe Backpacking Trip',
    date: '2021-07-10',
    category: 'travel',
    description: 'Two months exploring France, Italy, and Spain. An unforgettable experience!',
    tags: ['adventure', 'culture'],
    icon: 'fa-plane'
  },
  {
    id: '4',
    title: 'Promoted to Senior Developer',
    date: '2022-03-15',
    category: 'work',
    description: 'Recognized for contributions and promoted to a senior position.',
    tags: ['growth', 'achievement'],
    icon: 'fa-star'
  },
  {
    id: '5',
    title: 'Bought First Home',
    date: '2023-01-20',
    category: 'personal',
    description: 'Achieved the dream of home ownership. A cozy apartment in the city.',
    tags: ['milestone', 'adulting'],
    icon: 'fa-home'
  }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateId = (): string => Date.now().toString();

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatCategory = (category: string): string => {
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const getCategoryIcon = (category: EventCategory): string => {
  const icons: Record<EventCategory, string> = {
    work: 'fa-briefcase',
    personal: 'fa-user',
    education: 'fa-graduation-cap',
    travel: 'fa-plane',
    health: 'fa-heartbeat',
    finance: 'fa-chart-line'
  };
  return icons[category] || 'fa-star';
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ChronoLineTimeline: React.FC = () => {
  // State
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [currentTheme, setCurrentTheme] = useState('theme-default');
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    category: '' as EventCategory | '',
    description: '',
    tags: '',
    icon: 'fa-star'
  });

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const themePanelRef = useRef<HTMLDivElement>(null);
  const themeToggleRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load events and theme from localStorage
  useEffect(() => {
    const savedEvents = localStorage.getItem('chronoline-events');
    if (savedEvents) {
      try {
        setEvents(JSON.parse(savedEvents));
      } catch {
        setEvents(SAMPLE_EVENTS);
      }
    } else {
      setEvents(SAMPLE_EVENTS);
      localStorage.setItem('chronoline-events', JSON.stringify(SAMPLE_EVENTS));
    }

    const savedTheme = localStorage.getItem('chronoline-theme');
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      document.body.className = savedTheme;
    }

    // Welcome notification
    setTimeout(() => showNotification('Welcome to ChronoLine! Use Ctrl+K to add new events.'), 1000);
  }, []);

  // Save events to localStorage
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem('chronoline-events', JSON.stringify(events));
    }
  }, [events]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    const timelineEvents = timelineRef.current?.querySelectorAll('.timeline-event');
    timelineEvents?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [events, filter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openModal();
      }
      if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
        setThemePanelOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close theme panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        themePanelRef.current &&
        themeToggleRef.current &&
        !themePanelRef.current.contains(e.target as Node) &&
        !themeToggleRef.current.contains(e.target as Node)
      ) {
        setThemePanelOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const setTheme = useCallback((themeId: string, save = true) => {
    document.body.className = themeId;
    setCurrentTheme(themeId);
    if (save) {
      localStorage.setItem('chronoline-theme', themeId);
    }
  }, []);

  const resetTheme = useCallback(() => {
    setTheme('theme-default');
    showNotification('Theme reset to default');
  }, [setTheme, showNotification]);

  const openModal = useCallback((event?: TimelineEvent) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        date: event.date,
        category: event.category,
        description: event.description,
        tags: event.tags.join(', '),
        icon: event.icon
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
        tags: '',
        icon: 'fa-star'
      });
    }
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingEvent(null);
  }, []);

  const openDeleteModal = useCallback((eventId: string) => {
    setDeletingEventId(eventId);
    setDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setDeletingEventId(null);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const processedTags = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag);

    const eventData: Omit<TimelineEvent, 'id'> = {
      title: formData.title,
      date: formData.date,
      category: formData.category as EventCategory,
      description: formData.description,
      tags: processedTags,
      icon: formData.icon
    };

    if (editingEvent) {
      setEvents(prev =>
        prev.map(ev => (ev.id === editingEvent.id ? { ...ev, ...eventData } : ev))
      );
      showNotification('Event updated successfully!');
    } else {
      const newEvent: TimelineEvent = { ...eventData, id: generateId() };
      setEvents(prev => [...prev, newEvent].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      showNotification('Event added successfully!');
    }

    closeModal();
  }, [formData, editingEvent, showNotification, closeModal]);

  const handleDelete = useCallback(() => {
    if (deletingEventId) {
      setEvents(prev => prev.filter(ev => ev.id !== deletingEventId));
      showNotification('Event deleted successfully!');
      closeDeleteModal();
    }
  }, [deletingEventId, showNotification, closeDeleteModal]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredEvents = useMemo(() => {
    const filtered = filter === 'all'
      ? events
      : events.filter(ev => ev.category === filter);
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, filter]);

  const deletingEventTitle = useMemo(() => {
    return events.find(ev => ev.id === deletingEventId)?.title || '';
  }, [events, deletingEventId]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`timeline-section ${currentTheme}`}>
      {/* Section Header with Controls */}
      <div className="timeline-section-header">
        <div className="timeline-title-area">
          <h2>My Timeline</h2>
          <p>Track and visualize important moments in your journey</p>
        </div>

        <div className="timeline-controls">
          {/* Theme Selector */}
          <div className="theme-selector">
            <div
              className="theme-toggle"
              ref={themeToggleRef}
              onClick={() => setThemePanelOpen(!themePanelOpen)}
            >
              <i className="fas fa-palette"></i>
              <span>Themes</span>
              <i className="fas fa-chevron-down"></i>
            </div>

            <div
              className={`theme-panel ${themePanelOpen ? 'active' : ''}`}
              ref={themePanelRef}
            >
              <div className="theme-grid">
                {THEMES.map(theme => (
                  <div
                    key={theme.id}
                    className={`theme-card ${currentTheme === theme.id ? 'active' : ''} theme-preview-${theme.id.replace('theme-', '')}`}
                    onClick={() => setTheme(theme.id)}
                  >
                    <div className="theme-card-label">{theme.name}</div>
                  </div>
                ))}
              </div>
              <div className="theme-panel-actions">
                <button className="btn btn-secondary" onClick={resetTheme}>
                  Reset
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setThemePanelOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => openModal()}>
            <i className="fas fa-plus"></i>
            Add Event
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="timeline-filters">
        {CATEGORIES.map(cat => (
          <div
            key={cat.id}
            className={`filter-chip ${filter === cat.id ? 'active' : ''}`}
            onClick={() => setFilter(cat.id)}
          >
            <i className={cat.icon}></i>
            {cat.label}
          </div>
        ))}
      </div>

      {/* Timeline Content */}
      <div className="timeline-content">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fas fa-timeline"></i>
            </div>
            <h3>No events yet</h3>
            <p>Start by adding your first timeline event</p>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <i className="fas fa-plus"></i>
              Add Your First Event
            </button>
          </div>
        ) : (
          <div className="timeline" ref={timelineRef}>
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="timeline-event fade-in"
                data-event-id={event.id}
              >
                <div className="event-marker">
                  <i className={`fas ${event.icon || getCategoryIcon(event.category)}`}></i>
                </div>
                <div className="event-card">
                  <div className="event-header">
                    <div className="event-date">
                      <i className="far fa-calendar"></i>
                      {formatDate(event.date)}
                    </div>
                    <span className="event-category">
                      {formatCategory(event.category)}
                    </span>
                  </div>
                  <h3 className="event-title">{event.title}</h3>
                  <p className="event-description">{event.description}</p>

                  {event.tags.length > 0 && (
                    <div className="event-tags">
                      {event.tags.map(tag => (
                        <span key={tag} className="event-tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="event-actions">
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => openModal(event)}
                      title="Edit"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="btn btn-danger btn-icon"
                      onClick={() => openDeleteModal(event.id)}
                      title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Event Modal */}
      <div className={`modal-overlay ${modalOpen ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <h3>{editingEvent ? 'Edit Event' : 'Add New Event'}</h3>
            <button className="modal-close" onClick={closeModal} title="Close">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="eventTitle">Event Title</label>
                <input
                  type="text"
                  className="form-control"
                  id="eventTitle"
                  placeholder="Enter event title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="eventDate">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    id="eventDate"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="eventCategory">Category</label>
                  <select
                    className="form-control"
                    id="eventCategory"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as EventCategory })}
                    required
                  >
                    <option value="">Select category</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="education">Education</option>
                    <option value="travel">Travel</option>
                    <option value="health">Health</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eventDescription">Description</label>
                <textarea
                  className="form-control"
                  id="eventDescription"
                  rows={4}
                  placeholder="Describe your event..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eventTags">Tags (comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  id="eventTags"
                  placeholder="e.g. milestone, important, achievement"
                  value={formData.tags}
                  onChange={e => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eventIcon">Icon</label>
                <select
                  className="form-control"
                  id="eventIcon"
                  value={formData.icon}
                  onChange={e => setFormData({ ...formData, icon: e.target.value })}
                >
                  {ICON_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update Event' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div className={`modal-overlay ${deleteModalOpen ? 'active' : ''}`}>
        <div className="modal delete-modal">
          <div className="modal-header">
            <h3>Confirm Delete</h3>
            <button className="modal-close" onClick={closeDeleteModal} title="Close">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <p className="delete-message">
              Are you sure you want to delete "<strong>{deletingEventTitle}</strong>"? 
              This action cannot be undone.
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="timeline-notification">
          {notification}
        </div>
      )}
    </div>
  );
};

export default ChronoLineTimeline;
