export type StreamerSocials = {
  kick?: string; // channel URL
  telegram?: string;
  youtube?: string;
  twitch?: string;
  x?: string;
  instagram?: string;
  website?: string;
};

export type Streamer = {
  slug: string;           // stable id
  name: string;           // display name (for badge)
  title: string;          // card title
  photo: string;          // public path
  socials: StreamerSocials;
  // Where to place the Kick link:
  // - If kickEmbedUrl is set, we use it as iframe src.
  // - Else if kickChannel is set, we build https://player.kick.com/{kickChannel}
  kickChannel?: string;
  kickEmbedUrl?: string;
  tagline?: string;
};

export const STREAMERS: Streamer[] = [
  {
    slug: "zava",
    name: "ZAVA",
    title: "Стример ZAVA",
    photo: "/banners/zava-avatar.png",
    socials: {
      telegram: "https://t.me/zavaditch",
      kick: "https://kick.com/zavaditch",
    },
    // ✅ ВСТАВЛЯЙ ССЫЛКУ ДЛЯ СТРИМА ВОТ СЮДА:
    // kickChannel: "zavaditch",
    // или если у Kick будет готовая embed-ссылка:
    // kickEmbedUrl: "https://player.kick.com/zavaditch",
    kickChannel: "zavaditch",
    tagline: "CS2 • 1v1 • турниры • кланы",
  },
];

export const PARTNERS: Streamer[] = [
  {
    slug: "beavbet",
    name: "BEAVBET",
    title: "Партнёр BeavBet",
    photo: "/brand/beavrank.png",
    socials: {
      website: "https://beavbet.com",
      telegram: "https://t.me/dendemi",
    },
    tagline: "Сотрудничество, промо, интеграции",
  },
];

export function kickIframeSrc(s: Streamer) {
  if (s.kickEmbedUrl) return s.kickEmbedUrl;
  if (s.kickChannel) return `https://player.kick.com/${s.kickChannel}`;
  return null;
}

export function badgeLabel(s: Streamer) {
  // rendered after nickname: [ZAVA]
  return s.name;
}
