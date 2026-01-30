const COLOR_CLASS_MAP: Record<string, string> = {
  '#10b981': 'category-color--green-500',
  '#34d399': 'category-color--green-400',
  '#ef4444': 'category-color--red-500',
  '#f59e0b': 'category-color--amber-500',
  '#3b82f6': 'category-color--blue-500',
  '#6366f1': 'category-color--indigo-500',
  '#ec4899': 'category-color--pink-500',
  '#8b5cf6': 'category-color--purple-500',
  '#14b8a6': 'category-color--teal-500'
};

export const getCategoryColorClass = (color?: string | null) => {
  if (!color) return 'category-color--default';
  const normalized = color.trim().toLowerCase();
  if (normalized.startsWith('category-color--')) {
    return normalized;
  }
  return COLOR_CLASS_MAP[normalized] ?? 'category-color--default';
};

export const CATEGORY_COLOR_OPTIONS = [
  { value: '#10B981', label: 'Green' },
  { value: '#34D399', label: 'Light Green' },
  { value: '#EF4444', label: 'Red' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#14B8A6', label: 'Teal' }
];
