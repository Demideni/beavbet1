import { HeroCarousel } from "@/app/components/HeroCarousel";
import { PromoTiles } from "@/app/components/PromoTiles";
import { TopLeagues } from "@/app/components/TopLeagues";
import { TopSports } from "@/app/components/TopSports"; // если TopSports тоже default — без {}
import EsportsPromoBanner from "@/app/components/EsportsPromoBanner";
import TopTournaments from "@/app/components/TopTournaments";

// These are named exports in their modules.
import { CryptoHeroBanner } from "@/app/components/CryptoHeroBanner";
import { BeavbetOriginal } from "@/app/components/BeavbetOriginal";



export default function HomePage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <HeroCarousel />
      <PromoTiles />
      <CryptoHeroBanner />
      <TopSports />
      <TopLeagues />
      <EsportsPromoBanner />
      <TopTournaments />
      <BeavbetOriginal />
    </div>
  );
}
