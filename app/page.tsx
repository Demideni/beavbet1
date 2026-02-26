import { redirect } from "next/navigation";

// Temporary: show only Arena as the main entry of the site.
// Casino + Sportsbook can be re-enabled later by restoring the old homepage.
export default function HomePage() {
  redirect("/arena");
}
