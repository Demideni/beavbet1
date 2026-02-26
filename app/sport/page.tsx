import { redirect } from "next/navigation";

// Temporary: Sportsbook is hidden while we focus on Arena.
export default function SportPage() {
  redirect("/arena");
}
