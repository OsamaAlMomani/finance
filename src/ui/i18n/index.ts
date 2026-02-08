import en from './en';
import ar from './ar';

export type Language = 'en' | 'ar';

export const translations: Record<Language, Record<string, string>> = {
  en,
  ar
};
