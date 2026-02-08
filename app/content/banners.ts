export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  note?: string;
  cta: string;
  href: string;
  art: string; // image path
};

export const banners: Banner[] = [
  {
    id: "welcome",
    title: "ВЕЛКАМ БОНУС",
    subtitle: "ДО 590%",
    note: "+225 Фриспинов",
    cta: "Зарегистрируйся и играй",
    href: "/bonuses",
    art: "/banners/hero-1.png",
  },
  {
    id: "tournament",
    title: "24H TOURNAMENT RACE",
    subtitle: "Ежедневные призы до $150",
    note: "Каждый день",
    cta: "Принять участие",
    href: "/tournaments",
    art: "/banners/hero-2.png",
  },
  {
    id: "crypto",
    title: "BEAV LOVES CRYPTO",
    subtitle: "BTC • ETH • USDT",
    note: "Пополнение за минуту",
    cta: "Пополнить",
    href: "/payments",
    art: "/banners/hero-3.png",
  },
];
