"use client";

import { createContext, useContext, useState } from "react";

type ToolbarSlot = { node: React.ReactNode; visible: boolean } | null;

const HeaderToolbarContext = createContext<{
  toolbar: ToolbarSlot;
  setToolbar: (slot: ToolbarSlot) => void;
} | null>(null);

// Lets a page (e.g. the binder view) hand the Header a compact, optional
// control it can fade in once the page's own toolbar has scrolled out of
// view, instead of the Header needing to know about any specific page.
export function HeaderToolbarProvider({ children }: { children: React.ReactNode }) {
  const [toolbar, setToolbar] = useState<ToolbarSlot>(null);
  return (
    <HeaderToolbarContext.Provider value={{ toolbar, setToolbar }}>
      {children}
    </HeaderToolbarContext.Provider>
  );
}

export function useHeaderToolbar() {
  const ctx = useContext(HeaderToolbarContext);
  if (!ctx) throw new Error("useHeaderToolbar must be used within a HeaderToolbarProvider");
  return ctx;
}
