import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneProof — constant-cost ZK on Stellar",
  description:
    "Aggregate N proofs into one the chain verifies once. Constant on-chain cost regardless of how many private operations are inside.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-paper antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
