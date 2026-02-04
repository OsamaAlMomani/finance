export type ThemeKey = 'default' | 'girly' | 'men' | 'dark' | 'light' | 'moonlight' | 'darknight' | 'sunshine';

const THEME_CLASSES: Record<ThemeKey, string | null> = {
  default: null,
  girly: 'girly-theme',
  men: 'men-theme',
  dark: 'dark-theme',
  light: 'light-theme',
  moonlight: 'moonlight-theme',
  darknight: 'darknight-theme',
  sunshine: 'sunshine-theme'
};

export const applyTheme = (theme: ThemeKey) => {
  const classList = document.body.classList;
  classList.remove(
    'girly-theme',
    'men-theme',
    'dark-theme',
    'light-theme',
    'moonlight-theme',
    'darknight-theme',
    'sunshine-theme'
  );

  const cls = THEME_CLASSES[theme];
  if (cls) classList.add(cls);
};
