import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  ArrowRight,
  Home,
  CreditCard,
  TrendingUp,
  PiggyBank,
  Calendar,
  Settings,
  FileText,
  DollarSign,
  Plus,
  Palette,
  AlertTriangle,
  Target,
  BarChart3,
  Download,
  Upload,
  Calculator,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';

interface Command {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'settings';
  keywords: string[];
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickAdd?: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onQuickAdd }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentTheme, setTheme } = useTheme();
  const { info, success } = useNotification();

  // Define all commands
  const commands: Command[] = [
    // Navigation
    {
      id: 'nav-overview',
      title: 'Go to Overview',
      description: 'View your financial overview',
      icon: <Home size={18} />,
      category: 'navigation',
      keywords: ['home', 'dashboard', 'overview', 'main'],
      action: () => { navigate('/'); onClose(); },
      shortcut: 'G O'
    },
    {
      id: 'nav-transactions',
      title: 'Go to Transactions',
      description: 'View and manage transactions',
      icon: <CreditCard size={18} />,
      category: 'navigation',
      keywords: ['transactions', 'payments', 'history', 'spending'],
      action: () => { navigate('/transactions'); onClose(); },
      shortcut: 'G T'
    },
    {
      id: 'nav-budgets',
      title: 'Go to Budgets',
      description: 'Manage your budgets',
      icon: <Target size={18} />,
      category: 'navigation',
      keywords: ['budgets', 'limits', 'categories'],
      action: () => { navigate('/budgets'); onClose(); },
      shortcut: 'G B'
    },
    {
      id: 'nav-savings',
      title: 'Go to Savings',
      description: 'Track your savings goals',
      icon: <PiggyBank size={18} />,
      category: 'navigation',
      keywords: ['savings', 'goals', 'piggy', 'save'],
      action: () => { navigate('/savings'); onClose(); },
      shortcut: 'G S'
    },
    {
      id: 'nav-forecast',
      title: 'Go to Forecast',
      description: 'View financial predictions',
      icon: <TrendingUp size={18} />,
      category: 'navigation',
      keywords: ['forecast', 'prediction', 'future', 'projection'],
      action: () => { navigate('/forecast'); onClose(); },
      shortcut: 'G F'
    },
    {
      id: 'nav-calendar',
      title: 'Go to Calendar',
      description: 'View financial calendar',
      icon: <Calendar size={18} />,
      category: 'navigation',
      keywords: ['calendar', 'schedule', 'dates', 'events'],
      action: () => { navigate('/calendar'); onClose(); },
      shortcut: 'G C'
    },
    {
      id: 'nav-risk',
      title: 'Go to Risk Analysis',
      description: 'Analyze financial risks',
      icon: <AlertTriangle size={18} />,
      category: 'navigation',
      keywords: ['risk', 'analysis', 'danger', 'safety'],
      action: () => { navigate('/risk'); onClose(); },
      shortcut: 'G R'
    },
    {
      id: 'nav-tax',
      title: 'Go to Tax',
      description: 'Tax planning and tracking',
      icon: <FileText size={18} />,
      category: 'navigation',
      keywords: ['tax', 'taxes', 'income', 'deductions'],
      action: () => { navigate('/tax'); onClose(); }
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      description: 'Configure app settings',
      icon: <Settings size={18} />,
      category: 'navigation',
      keywords: ['settings', 'preferences', 'config', 'options'],
      action: () => { navigate('/settings'); onClose(); },
      shortcut: 'G ,'
    },
    // Actions
    {
      id: 'action-add-transaction',
      title: 'Add Transaction',
      description: 'Quickly add a new transaction',
      icon: <Plus size={18} />,
      category: 'action',
      keywords: ['add', 'new', 'transaction', 'create', 'expense', 'income'],
      action: () => { onQuickAdd?.(); onClose(); },
      shortcut: 'N'
    },
    {
      id: 'action-add-income',
      title: 'Add Income',
      description: 'Record new income',
      icon: <DollarSign size={18} />,
      category: 'action',
      keywords: ['add', 'income', 'salary', 'payment', 'received'],
      action: () => { onQuickAdd?.(); onClose(); }
    },
    {
      id: 'action-export',
      title: 'Export Data',
      description: 'Export your financial data',
      icon: <Download size={18} />,
      category: 'action',
      keywords: ['export', 'download', 'backup', 'csv', 'json'],
      action: () => { 
        info('Export feature coming soon!');
        onClose();
      }
    },
    {
      id: 'action-import',
      title: 'Import Data',
      description: 'Import financial data',
      icon: <Upload size={18} />,
      category: 'action',
      keywords: ['import', 'upload', 'restore', 'csv', 'json'],
      action: () => { 
        info('Import feature coming soon!');
        onClose();
      }
    },
    {
      id: 'action-calculate',
      title: 'Open Calculator',
      description: 'Quick financial calculator',
      icon: <Calculator size={18} />,
      category: 'action',
      keywords: ['calculate', 'calculator', 'math', 'compute'],
      action: () => { 
        info('Calculator feature coming soon!');
        onClose();
      }
    },
    {
      id: 'action-reports',
      title: 'Generate Report',
      description: 'Create a financial report',
      icon: <BarChart3 size={18} />,
      category: 'action',
      keywords: ['report', 'generate', 'summary', 'pdf'],
      action: () => { 
        info('Report generation coming soon!');
        onClose();
      }
    },
    // Settings
    {
      id: 'settings-change-theme',
      title: 'Change Theme',
      description: `Current: ${currentTheme.replace('theme-', 'Theme ')}`,
      icon: <Palette size={18} />,
      category: 'settings',
      keywords: ['theme', 'color', 'palette', 'appearance', 'style'],
      action: () => { 
        const themes: Array<'theme-1' | 'theme-2' | 'theme-3' | 'theme-4' | 'theme-5' | 'theme-6' | 'theme-7'> = ['theme-1', 'theme-2', 'theme-3', 'theme-4', 'theme-5', 'theme-6', 'theme-7']
        const currentIndex = themes.indexOf(currentTheme as any)
        const nextTheme = themes[(currentIndex + 1) % themes.length]
        setTheme(nextTheme)
        success(`Switched to ${nextTheme.replace('theme-', 'Theme ')}`)
        onClose()
      },
      shortcut: 'T'
    }
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(cmd => {
        const searchLower = query.toLowerCase();
        return (
          cmd.title.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords.some(k => k.toLowerCase().includes(searchLower))
        );
      })
    : commands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  const categoryOrder: Array<'navigation' | 'action' | 'settings'> = ['navigation', 'action', 'settings'];
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    settings: 'Settings'
  };

  // Flatten filtered commands for keyboard navigation
  const flatCommands = categoryOrder.flatMap(cat => groupedCommands[cat] || []);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedItem = listRef.current?.querySelector('[data-selected="true"]');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatCommands[selectedIndex]) {
          flatCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flatCommands, selectedIndex, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={handleBackdropClick}>
      <div className="command-palette">
        <div className="command-palette-header">
          <Search size={20} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="command-palette-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button 
            className="command-palette-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="command-palette-list" ref={listRef}>
          {flatCommands.length === 0 ? (
            <div className="command-palette-empty">
              <p>No commands found</p>
              <span>Try a different search term</span>
            </div>
          ) : (
            categoryOrder.map(category => {
              const categoryCommands = groupedCommands[category];
              if (!categoryCommands?.length) return null;

              return (
                <div key={category} className="command-palette-group">
                  <div className="command-palette-group-label">
                    {categoryLabels[category]}
                  </div>
                  {categoryCommands.map(cmd => {
                    const index = flatCommands.findIndex(c => c.id === cmd.id);
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                        data-selected={isSelected}
                        onClick={cmd.action}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="command-palette-item-icon">
                          {cmd.icon}
                        </span>
                        <div className="command-palette-item-content">
                          <span className="command-palette-item-title">
                            {cmd.title}
                          </span>
                          {cmd.description && (
                            <span className="command-palette-item-description">
                              {cmd.description}
                            </span>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="command-palette-shortcut">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        <ArrowRight 
                          size={14} 
                          className="command-palette-item-arrow" 
                        />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;