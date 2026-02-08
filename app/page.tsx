import { HeroCarousel } from "@/app/components/HeroCarousel";
import { PromoTiles } from "@/app/components/PromoTiles";
import { TopLeagues } from "@/app/components/TopLeagues";
import { EsportsHeroBanner } from "@/app/components/EsportsHeroBanner";
import { RobinsonTournaments } from "@/app/components/RobinsonTournaments";
import { CryptoHeroBanner } from "@/app/components/CryptoHeroBanner";
import { TopSports } from "@/app/components/TopSports";
import { BeavbetOriginal } from "@/app/components/BeavbetOriginal";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <HeroCarousel />
      <PromoTiles />
      <CryptoHeroBanner />
      <TopSports />
      <BeavbetOriginal />
      <TopLeagues />
      <EsportsHeroBanner />
      <RobinsonTournaments />
    </div>
  );
}
