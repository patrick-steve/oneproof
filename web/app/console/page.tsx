import { redirect } from "next/navigation";

// /console redirects to /console/verify so there's a single canonical
// "entered the console" landing. The Verify tab is the highest-traffic
// surface (live event feed) and serves as the implicit default.
export default function ConsoleIndex() {
  redirect("/console/verify");
}
