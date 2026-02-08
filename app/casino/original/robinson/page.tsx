export default function Page() {
  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      <iframe
        title="Robinson"
        src="/games/robinson/index.html"
        className="w-full h-[100dvh]"
        allowFullScreen
      />
    </div>
  );
}
