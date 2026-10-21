"use client";

import { useCallback, useEffect, useState } from "react";
import type { Binder } from "./types";

export function useBinders() {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch("/api/binders");
    if (res.ok) setBinders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { binders, loading, reload };
}
