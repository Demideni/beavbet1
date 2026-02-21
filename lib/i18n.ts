export type Lang = "ru" | "en" | "es";

export const LANG_COOKIE = "bb_lang";
export const SUPPORTED_LANGS: Lang[] = ["ru", "en", "es"];
export const DEFAULT_LANG: Lang = "en";

// Simple dictionary-based i18n (URL structure unchanged).
// Fallback order: выбранный язык -> RU -> key
export const MESSAGES: Record<Lang, Record<string, string>> = {
  ru: {
    "nav.home": "Главная",
    "nav.account": "Кабинет",
    "nav.casino": "Казино",
    "nav.arena": "Arena",
    "nav.sport": "Спорт",
    "nav.tournaments": "Турниры",
    "nav.bonuses": "Бонусы",
    "nav.payments": "Касса",
    "nav.vip": "VIP",
    "nav.stats": "Статистика",
    "nav.community": "Комьюнити",
    "nav.security": "Безопасность",

    "topbar.bonuses": "Бонусы",
    "topbar.searchPlaceholder": "Поиск игр",
    "topbar.balance": "Баланс",
    "topbar.profile": "Профиль",
    "topbar.cabinet": "Кабинет",
    "topbar.login": "Войти",
    "topbar.register": "Регистрация",

    "lang.chooseTitle": "Выберите язык",
    "lang.chooseSubtitle": "Вы сможете поменять его в любой момент",
    "lang.russian": "Русский",
    "lang.english": "English",
    "lang.spanish": "Español",
  },
  en: {
    "nav.home": "Home",
    "nav.account": "Account",
    "nav.casino": "Casino",
    "nav.arena": "Arena",
    "nav.sport": "Sports",
    "nav.tournaments": "Tournaments",
    "nav.bonuses": "Bonuses",
    "nav.payments": "Cashier",
    "nav.vip": "VIP",
    "nav.stats": "Stats",
    "nav.community": "Community",
    "nav.security": "Security",

    "topbar.bonuses": "Bonuses",
    "topbar.searchPlaceholder": "Search games",
    "topbar.balance": "Balance",
    "topbar.profile": "Profile",
    "topbar.cabinet": "Account",
    "topbar.login": "Log in",
    "topbar.register": "Sign up",

    "lang.chooseTitle": "Choose your language",
    "lang.chooseSubtitle": "You can change it anytime",
    "lang.russian": "Русский",
    "lang.english": "English",
    "lang.spanish": "Español",
  },
  es: {
    "nav.home": "Inicio",
    "nav.account": "Cuenta",
    "nav.casino": "Casino",
    "nav.arena": "Arena",
    "nav.sport": "Deportes",
    "nav.tournaments": "Torneos",
    "nav.bonuses": "Bonos",
    "nav.payments": "Cajero",
    "nav.vip": "VIP",
    "nav.stats": "Estadísticas",
    "nav.community": "Comunidad",
    "nav.security": "Seguridad",

    "topbar.bonuses": "Bonos",
    "topbar.searchPlaceholder": "Buscar juegos",
    "topbar.balance": "Saldo",
    "topbar.profile": "Perfil",
    "topbar.cabinet": "Cuenta",
    "topbar.login": "Iniciar sesión",
    "topbar.register": "Registrarse",

    "lang.chooseTitle": "Elige tu idioma",
    "lang.chooseSubtitle": "Puedes cambiarlo cuando quieras",
    "lang.russian": "Русский",
    "lang.english": "English",
    "lang.spanish": "Español",
  },
};

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (SUPPORTED_LANGS as string[]).includes(v);
}
