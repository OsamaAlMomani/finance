export type ThemeKey = 'light' | 'dark';

export const resolveTheme = (rawTheme: string | null): ThemeKey => {
  const normalizedTheme = String(rawTheme || '').trim().toLowerCase();
  return normalizedTheme === 'dark' ? 'dark' : 'light';
};

export const applyTheme = (themeInput: ThemeKey | string | null) => {
  const resolved = resolveTheme(themeInput);
  const classList = document.body.classList;
  classList.remove('light-theme', 'dark-theme');
  classList.remove(
    'default-theme',
    'female-theme',
    'girly-theme',
    'male-theme',
    'men-theme',
    'moonlight-theme',
    'darknight-theme',
    'sunshine-theme',
    'nature-theme',
    'royal-theme'
  );
  classList.add(`${resolved}-theme`);
};
