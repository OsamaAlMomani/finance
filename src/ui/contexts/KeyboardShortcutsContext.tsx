import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';

/* ============================================
   FINANCE APP - KEYBOARD SHORTCUTS SYSTEM
   ============================================ */

export interface KeyboardShortcut {
  id: string;
  key: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  description: string;
  category: string;
  action: () => void;
  enabled?: boolean;
}

interface KeyboardShortcutsContextType {
  shortcuts: KeyboardShortcut[];
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  enableShortcut: (id: string) => void;
  disableShortcut: (id: string) => void;
  isHelpOpen: boolean;
  toggleHelp: () => void;
  closeHelp: () => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

// Format keyboard shortcut for display
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
  if (shortcut.modifiers?.alt) parts.push('Alt');
  if (shortcut.modifiers?.shift) parts.push('Shift');
  if (shortcut.modifiers?.meta) parts.push('⌘');
  
  // Format key nicely
  let keyDisplay = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
  if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
  if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
  if (keyDisplay === 'ArrowRight') keyDisplay = '→';
  if (keyDisplay === 'Escape') keyDisplay = 'Esc';
  if (keyDisplay === ' ') keyDisplay = 'Space';
  
  parts.push(keyDisplay);
  return parts.join(' + ');
};

export const KeyboardShortcutsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts(prev => {
      // Remove existing shortcut with same id if exists
      const filtered = prev.filter(s => s.id !== shortcut.id);
      return [...filtered, { ...shortcut, enabled: shortcut.enabled ?? true }];
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);

  const enableShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: true } : s
    ));
  }, []);

  const disableShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: false } : s
    ));
  }, []);

  const toggleHelp = useCallback(() => {
    setIsHelpOpen(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Only allow Escape to work in inputs
        if (event.key !== 'Escape') return;
      }

      // Check for matching shortcuts
      for (const shortcut of shortcutsRef.current) {
        if (!shortcut.enabled) continue;

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!shortcut.modifiers?.ctrl === event.ctrlKey;
        const altMatches = !!shortcut.modifiers?.alt === event.altKey;
        const shiftMatches = !!shortcut.modifiers?.shift === event.shiftKey;
        const metaMatches = !!shortcut.modifiers?.meta === event.metaKey;

        if (keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Register default shortcuts
  useEffect(() => {
    // Help shortcut
    registerShortcut({
      id: 'show-help',
      key: '?',
      modifiers: { shift: true },
      description: 'Show keyboard shortcuts',
      category: 'General',
      action: toggleHelp,
    });

    // Close help with Escape
    registerShortcut({
      id: 'close-help',
      key: 'Escape',
      description: 'Close dialog / modal',
      category: 'General',
      action: closeHelp,
    });

    return () => {
      unregisterShortcut('show-help');
      unregisterShortcut('close-help');
    };
  }, [registerShortcut, unregisterShortcut, toggleHelp, closeHelp]);

  return (
    <KeyboardShortcutsContext.Provider value={{
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      enableShortcut,
      disableShortcut,
      isHelpOpen,
      toggleHelp,
      closeHelp,
    }}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
};

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutsContext);
  if (context === undefined) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutsProvider');
  }
  return context;
};

// Hook to register shortcuts for a component
export const useRegisterShortcut = (shortcut: Omit<KeyboardShortcut, 'action'> & { action: () => void }) => {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    registerShortcut(shortcut);
    return () => unregisterShortcut(shortcut.id);
  }, [shortcut.id]); // Only re-register if ID changes
};

export default KeyboardShortcutsContext;
