// Generated reference data: what the Maintenance page last saved, or the files
// bundled with the app when nothing has been saved yet.

import { getAppData } from "./appData";
import type { FinishData } from "./cardFinish";
import bundledDomains from "./cardDomainFixes.json";
import bundledFinishes from "./cardFinishes.json";
import bundledMap from "./cardmarketMap.json";

export async function getFinishData(): Promise<FinishData> {
  return (await getAppData<FinishData>("finishes"))?.value ?? (bundledFinishes as FinishData);
}

export async function getDomainFixes(): Promise<Record<string, string[]>> {
  return (await getAppData<Record<string, string[]>>("domainFixes"))?.value ?? (bundledDomains as Record<string, string[]>);
}

export async function getCardmarketMap(): Promise<Record<string, number>> {
  return (await getAppData<Record<string, number>>("cardmarketMap"))?.value ?? (bundledMap as Record<string, number>);
}

export async function getUpdatedAt(): Promise<Record<string, string | null>> {
  const keys = ["cardmarketMap", "finishes", "domainFixes"] as const;
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = (await getAppData(k))?.updatedAt ?? null;
  return out;
}
