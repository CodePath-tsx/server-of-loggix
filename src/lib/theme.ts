/** Theme: light | dark | auto. Persisted in localStorage; syncs on system change. */
export type Theme = "light" | "dark" | "auto";
const KEY = "managbyte-theme";

export function getStoredTheme(): Theme {
  const v = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as Theme | null;
  return v ?? "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  localStorage.setItem(KEY, theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "auto") applyTheme("auto");
  });
}
