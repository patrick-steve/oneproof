"use client";

// Shared Freighter wallet state. Three things state has to know:
//   1. is Freighter installed?
//   2. has the user previously allowed THIS origin?
//   3. what address are we connected as?
//
// On mount we probe (1) and (2). If (2) is yes we silently call
// getAddress() to populate — that's the 'auto-reconnect on return visit'
// path that was missing before. We only prompt (requestAccess) when the
// user explicitly clicks Connect.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as freighter from "@stellar/freighter-api";

interface WalletState {
  installed: boolean;
  allowed:   boolean;        // this site has been granted access
  address:   string | null;  // populated when allowed AND getAddress returned
  error:     string | null;
  connect:   () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [allowed,   setAllowed]   = useState(false);
  const [address,   setAddress]   = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // Mount-time probe — never prompts. Order matters: isConnected first,
  // then isAllowed, then (if allowed) getAddress silently.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const conn = await freighter.isConnected();
        if (!alive) return;
        const isInstalled = Boolean(conn?.isConnected);
        setInstalled(isInstalled);

        if (!isInstalled) {
          setError("Freighter not installed");
          return;
        }

        const a = await freighter.isAllowed();
        if (!alive) return;
        const isAllowed = Boolean(a?.isAllowed);
        setAllowed(isAllowed);

        if (isAllowed) {
          // Auto-reconnect: site already trusted, just read the address.
          // This does NOT prompt the user.
          const addr = await freighter.getAddress();
          if (!alive) return;
          if (addr?.address) {
            setAddress(addr.address);
          }
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  // Explicit user-initiated connect — DOES prompt. After approval we
  // also read the address.
  async function connect() {
    setError(null);
    try {
      const access = await freighter.requestAccess();
      if (access?.error) {
        setError(access.error);
        return;
      }
      // requestAccess returns the address in some versions; if not, fetch it.
      const addr = access?.address ?? (await freighter.getAddress())?.address;
      if (addr) {
        setAddress(addr);
        setAllowed(true);
      } else {
        setError("could not read address after access grant");
      }
    } catch (e) {
      setError(String(e));
    }
  }

  function disconnect() {
    // Freighter doesn't expose a programmatic 'revoke this site' API; the
    // user has to do that in the extension. We just forget locally.
    setAddress(null);
  }

  return (
    <WalletContext.Provider value={{ installed, allowed, address, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
