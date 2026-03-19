export type ThemeKey = 'dark';

export const resolveTheme = (_rawTheme: string | null): ThemeKey => 'dark';

export const applyTheme = (_themeInput: ThemeKey | string | null) => {
  const classList = document.body.classList;
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
  classList.add('dark-theme');
};
