import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { applyTheme } from '../utils/theme';
import type { ThemeKey } from '../utils/theme';

const THEME_OPTIONS: { key: ThemeKey; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'girly', label: 'Female' },
  { key: 'men', label: 'Male' },
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'White' },
  { key: 'moonlight', label: 'Moon Light' },
  { key: 'darknight', label: 'Dark Night' },
  { key: 'sunshine', label: 'Sunshine' }
];

export const ThemeQuickSwitch = () => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>(() => (localStorage.getItem('theme') as ThemeKey) || 'default');

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.theme-quick')) setOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const apply = (next: ThemeKey) => {
    setTheme(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
    setOpen(false);
  };

  return (
    <div className="theme-quick">
      <button
        className="theme-quick-btn"
        aria-label="Theme settings"
        onClick={() => setOpen((prev) => !prev)}
      >
        <SettingsIcon size={16} />
      </button>
      {open && (
        <div className="theme-quick-menu">
          <div className="theme-quick-title">Theme</div>
          <div className="theme-quick-grid">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.key}
                className={`theme-quick-item ${theme === opt.key ? 'active' : ''}`}
                onClick={() => apply(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
