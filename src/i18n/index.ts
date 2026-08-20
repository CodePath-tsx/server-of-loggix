import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";

/** Application en français uniquement. */
export const SUPPORTED = [{ code: "fr", label: "Français", dir: "ltr" }] as const;

export type LangCode = "fr";

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

/** Conservé pour compatibilité : la langue est toujours le français. */
export function setLanguage(_code?: string) {
  void i18n.changeLanguage("fr");
  if (typeof localStorage !== "undefined") localStorage.setItem("managbyte-lang", "fr");
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", "fr");
  }
}

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("dir", "ltr");
  document.documentElement.setAttribute("lang", "fr");
}

export default i18n;
