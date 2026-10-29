/**
 * Light or dark look, chosen in Configurações and kept in a cookie on the phone
 * (no database: it is a choice of this device). "auto" follows the iPhone.
 * The script runs in the <head> before anything is drawn, so the page never
 * flashes light at night; the login and PIN pages use it too.
 */

export const THEME_COOKIE = "sendero_tema";
export const THEMES = [
  { value: "claro", label: "Claro" },
  { value: "escuro", label: "Escuro" },
  { value: "auto", label: "Automático" },
] as const;
export type ThemeChoice = (typeof THEMES)[number]["value"];

/** Color of the iPhone's top bar in each look (the page background). */
export const THEME_BAR = { light: "#f7f4ed", dark: "#161411" } as const;

/** Sets data-theme on <html> from the cookie; window.senderoTema() applies a new choice at once. */
export const THEME_SCRIPT = `(function(){
var d=document.documentElement,m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)");
function choice(){var c=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);return c?c[1]:"claro";}
function apply(){var c=choice(),dark=c==="escuro"||(c==="auto"&&m&&m.matches);d.setAttribute("data-theme",dark?"dark":"light");
var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",dark?"${THEME_BAR.dark}":"${THEME_BAR.light}");}
window.senderoTema=function(c){if(c)document.cookie="${THEME_COOKIE}="+c+"; path=/; max-age=157680000; samesite=lax";apply();};
apply();if(m&&m.addEventListener)m.addEventListener("change",apply);
document.addEventListener("DOMContentLoaded",apply);
})();`;

export function readThemeChoice(cookie: string): ThemeChoice {
  const match = cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return THEMES.some((theme) => theme.value === match?.[1]) ? (match![1] as ThemeChoice) : "claro";
}
