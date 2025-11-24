"use client";

import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { useMemo } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  // No-op wrapper for potential future providers
  const content = useMemo(() => children, [children]);
  return <MetaMaskProvider>{content}</MetaMaskProvider>;
}


