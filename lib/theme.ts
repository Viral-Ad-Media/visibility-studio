// Shared by the root layout (server) and components/ThemeToggle.tsx (client).
// Kept out of the "use client" file: exports from a client module become
// client references on the server, so the layout couldn't read this string.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "vs-theme";

// Runs inline in <head> (app/layout.tsx) before first paint, so a light-mode
// user never sees a flash of the dark theme. Dark is the default — it's the
// app's original look — so only an explicit "light" choice changes anything.
export const themeInitScript = `(function(){var t;try{t=localStorage.getItem("${THEME_STORAGE_KEY}");}catch(e){}document.documentElement.classList.add(t==="light"?"light":"dark");})();`;
