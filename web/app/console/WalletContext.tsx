"use client";

// Shared Freighter wallet state for the /console surface. Lifted out of
// SubmitClient so connection persists across tab navigation and so the
// header pill can reflect the connected state.
//
// freighter-api is small (~5 KB) so we import it eagerly — only the
// heavy stellar-sdk is dynamically loaded inside SubmitClient when the
// user actually clicks simulate or submit.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as freighter from "@stellar/freighter-api";

interface WalletState {
  installed: boolean;
  address: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Detect Freighter on mount — never auto-connect (privacy).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await freighter.isConnected();
        if (!alive) return;
        setInstalled(Boolean(r?.isConnected));
        if (!r?.isConnected) setError("Freighter not installed");
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  async function connect() {
    setError(null);
    try {
      const access = await freighter.requestAccess();
      if (access?.error) {
        setError(access.error);
        return;
      }
      const addr = await freighter.getAddress();
      if (addr?.address) {
        setAddress(addr.address);
      } else {
        setError("could not read address");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  function disconnect() {
    setAddress(null);
    setError(null);
  }

  return (
    <WalletContext.Provider value={{ installed, address, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
