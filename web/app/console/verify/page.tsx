import VerifyClient from "./VerifyClient";

export const dynamic = "force-dynamic";

// Server component shell; live event polling happens in the client child.
// The committed-fallback events from results.json are passed in as the
// initial paint so the page is never empty.

export default function VerifyPage() {
  return <VerifyClient />;
}
