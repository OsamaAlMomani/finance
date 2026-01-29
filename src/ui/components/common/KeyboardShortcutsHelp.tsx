import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { useKeyboardShortcuts, formatShortcut } from '../../contexts/KeyboardShortcutsContext';
import type { KeyboardShortcut } from '../../contexts/KeyboardShortcutsContext';
import './KeyboardShortcutsHelp.css';

/* ============================================
   FINANCE APP - KEYBOARD SHORTCUTS HELP MODAL
   ============================================ */

interface ShortcutsByCategory {
  [category: string]: KeyboardShortcut[];
}

export const KeyboardShortcutsHelp: React.FC = () => {
  const { shortcuts, isHelpOpen, closeHelp } = useKeyboardShortcuts();

  if (!isHelpOpen) return null;

  // Group shortcuts by category
  const shortcutsByCategory: ShortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as ShortcutsByCategory);

  // Sort categories
  const sortedCategories = Object.keys(shortcutsByCategory).sort((a, b) => {
    if (a === 'General') return -1;
    if (b === 'General') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="shortcuts-modal-overlay" onClick={closeHelp}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <div className="shortcuts-modal-title">
            <Keyboard size={20} />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button className="shortcuts-close-btn" onClick={closeHelp}>
            <X size={20} />
          </button>
        </div>

        <div className="shortcuts-modal-content">
          {sortedCategories.map(category => (
            <div key={category} className="shortcuts-category">
              <h3 className="shortcuts-category-title">{category}</h3>
              <div className="shortcuts-list">
                {shortcutsByCategory[category]
                  .filter(s => s.id !== 'close-help') // Don't show generic escape
                  .map(shortcut => (
                    <div key={shortcut.id} className="shortcut-item">
                      <span className="shortcut-description">{shortcut.description}</span>
                      <kbd className="shortcut-key">{formatShortcut(shortcut)}</kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-modal-footer">
          <p>Press <kbd>Esc</kbd> to close</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
