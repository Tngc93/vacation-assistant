export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "va-theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Applies a preference to <html>. "system" removes the attribute so the
 * prefers-color-scheme media query in globals.css takes over.
 */
export function applyThemePreference(preference: ThemePreference, root: HTMLElement = document.documentElement) {
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
}

/** Runs before first paint (inlined in <head>) so a stored theme never flashes. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;
