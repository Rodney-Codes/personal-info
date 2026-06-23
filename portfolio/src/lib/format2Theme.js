const STORAGE_KEY = "pi-format2-theme";

export function readStoredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") {
      return value;
    }
  } catch (_error) {
    /* ignore */
  }
  return "light";
}

export function applyFormat2Theme(theme) {
  if (typeof document === "undefined") {
    return;
  }
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.setAttribute("data-color-mode", theme);
  document.body.setAttribute("data-color-mode", theme);
  const app = document.querySelector(".format2-app");
  if (app) {
    app.setAttribute("data-color-mode", theme);
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", isDark ? "#0b1220" : "#fafafa");
  }
}

export function storeFormat2Theme(theme) {
  applyFormat2Theme(theme);
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch (_error) {
    /* ignore */
  }
}
