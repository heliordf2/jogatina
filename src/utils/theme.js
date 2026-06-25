const STORAGE_KEY = 'jogatina_theme';

export function readTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function writeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme(current) {
  const next = current === 'dark' ? 'light' : 'dark';
  writeTheme(next);
  applyTheme(next);
  return next;
}
