import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(() => {
  document.body.innerHTML = '';
  const labStyle = document.getElementById('stock-tracker-lab-style');
  if (labStyle) labStyle.remove();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // storage may be unavailable in some test environments
  }
});
