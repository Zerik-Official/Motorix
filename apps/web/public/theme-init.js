/**
 * @file Applies the saved theme before the first paint, so a dark theme never flashes light.
 *
 * It is a plain file instead of an inline script, so a Content-Security-Policy without
 * 'unsafe-inline' still allows it.
 */
(function applySavedTheme() {
  var theme = null;
  try {
    theme = window.localStorage.getItem("motorix-theme");
  } catch (error) {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
})();
