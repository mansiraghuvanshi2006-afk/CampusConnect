/**
 * Apply theme preference without rewriting the design system.
 * Dark remains the default CampusConnect look.
 */
export const applyTheme = (theme = "dark") => {
  const root = document.documentElement;
  let resolved = theme;

  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  root.dataset.theme = resolved;
  root.classList.toggle("theme-light", resolved === "light");
  root.classList.toggle("theme-dark", resolved !== "light");
};

export const getStoredTheme = () => {
  try {
    return localStorage.getItem("campus_connect_theme") || "dark";
  } catch {
    return "dark";
  }
};

export const storeTheme = (theme) => {
  try {
    localStorage.setItem("campus_connect_theme", theme);
  } catch {
    // ignore
  }
};
