import { BeavbetOriginal } from "@/app/components/BeavbetOriginal";

export default function Page() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="rounded-3xl card-glass p-6 lg:p-8">
        <div className="text-3xl font-extrabold">Казино</div>
        <div className="mt-2 text-white/60">
          Наши собственные игры и лучшие слоты. Сейчас доступна первая оригинальная игра.
        </div>
      </div>

      <BeavbetOriginal />
    </div>
  );
}
