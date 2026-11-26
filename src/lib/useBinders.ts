"use client";

import { useCallback, useEffect, useState } from "react";
import type { Binder } from "./types";

// Several parts of a page ask for the binders as it opens (both bells, the dashboard): one request answers them all.
// Later reloads always ask again, since something may have just changed.
let opening: Promise<Binder[] | null> | null = null;
const request = async (): Promise<Binder[] | null> => {
  const res = await fetch("/api/binders");
  return res.ok ? res.json() : null;
};

export function useBinders() {
  const [binders, setBinders] = useState<Binder[]>([]);
  const [loading, setLoading] = useState(true);

  const show = useCallback((list: Binder[] | null) => {
    if (list) setBinders(list);
    setLoading(false);
  }, []);
  const reload = useCallback(async () => show(await request()), [show]);

  useEffect(() => {
    opening ??= request().finally(() => (opening = null));
    opening.then(show, () => show(null));
  }, [show]);

  return { binders, loading, reload };
}
