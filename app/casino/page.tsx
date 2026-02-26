import { redirect } from "next/navigation";

// Temporary: Casino is hidden while we focus on Arena.
export default function CasinoPage() {
  redirect("/arena");
}
