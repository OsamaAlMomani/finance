export const AVATARS: { id: string; label: string; data: string }[] = [
  {
    id: 'alien-1',
    label: 'Alien Mint',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#0f172a"/>
  <circle cx="64" cy="64" r="44" fill="#7c3aed"/>
  <ellipse cx="46" cy="58" rx="14" ry="10" fill="#0f172a"/>
  <ellipse cx="82" cy="58" rx="14" ry="10" fill="#0f172a"/>
  <circle cx="46" cy="58" r="5" fill="#c4b5fd"/>
  <circle cx="82" cy="58" r="5" fill="#c4b5fd"/>
  <path d="M46 78c6 8 30 8 36 0" stroke="#c4b5fd" stroke-width="6" stroke-linecap="round"/>
</svg>`)
  },
  {
    id: 'alien-2',
    label: 'Alien Lime',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#111827"/>
  <circle cx="64" cy="64" r="44" fill="#10b981"/>
  <ellipse cx="46" cy="58" rx="14" ry="10" fill="#111827"/>
  <ellipse cx="82" cy="58" rx="14" ry="10" fill="#111827"/>
  <circle cx="46" cy="58" r="5" fill="#d1fae5"/>
  <circle cx="82" cy="58" r="5" fill="#d1fae5"/>
  <path d="M46 78c6 8 30 8 36 0" stroke="#d1fae5" stroke-width="6" stroke-linecap="round"/>
</svg>`)
  },
  {
    id: 'cat-1',
    label: 'Cat Peach',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ed"/>
  <circle cx="64" cy="70" r="36" fill="#fb7185"/>
  <path d="M36 52l10-16 14 12" fill="#fb7185"/>
  <path d="M92 52l-10-16-14 12" fill="#fb7185"/>
  <circle cx="52" cy="70" r="6" fill="#fff1f2"/>
  <circle cx="76" cy="70" r="6" fill="#fff1f2"/>
  <path d="M58 84c4 4 8 4 12 0" stroke="#fff1f2" stroke-width="5" stroke-linecap="round"/>
</svg>`)
  },
  {
    id: 'cat-2',
    label: 'Cat Blue',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#e0f2fe"/>
  <circle cx="64" cy="70" r="36" fill="#38bdf8"/>
  <path d="M36 52l10-16 14 12" fill="#38bdf8"/>
  <path d="M92 52l-10-16-14 12" fill="#38bdf8"/>
  <circle cx="52" cy="70" r="6" fill="#ecfeff"/>
  <circle cx="76" cy="70" r="6" fill="#ecfeff"/>
  <path d="M58 84c4 4 8 4 12 0" stroke="#ecfeff" stroke-width="5" stroke-linecap="round"/>
</svg>`)
  },
  {
    id: 'robot',
    label: 'Robot',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#111827"/>
  <rect x="26" y="32" width="76" height="64" rx="12" fill="#9ca3af"/>
  <rect x="38" y="48" width="18" height="18" rx="6" fill="#111827"/>
  <rect x="72" y="48" width="18" height="18" rx="6" fill="#111827"/>
  <rect x="50" y="78" width="28" height="8" rx="4" fill="#111827"/>
  <rect x="60" y="20" width="8" height="10" rx="3" fill="#9ca3af"/>
  <circle cx="64" cy="18" r="6" fill="#6366f1"/>
</svg>`)
  },
  {
    id: 'fox',
    label: 'Fox',
    data:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ed"/>
  <path d="M64 24l28 24 8 34-36 30-36-30 8-34z" fill="#f97316"/>
  <path d="M64 52l18 14-18 22-18-22z" fill="#ffedd5"/>
  <circle cx="52" cy="60" r="5" fill="#0f172a"/>
  <circle cx="76" cy="60" r="5" fill="#0f172a"/>
</svg>`)
  }
];

export const getRandomAvatar = () => {
  const index = Math.floor(Math.random() * AVATARS.length);
  return AVATARS[index].data;
};

export const getDefaultAvatar = () => AVATARS[0].data;
