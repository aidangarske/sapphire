import { prCachePath } from "./paths.ts";
import { readTextIfExists, writeText } from "./fs.ts";
import type { Pr, Account } from "../core/github/types.ts";

export interface PrCache {
  account?: Account | null;
  prs?: Pr[];
  fetchedAt?: number;
}

export function loadPrCache(): PrCache {
  const raw = readTextIfExists(prCachePath());
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    return { account: j?.account, prs: j?.prs, fetchedAt: j?.fetchedAt };
  } catch {
    return {};
  }
}

export function savePrCache(cache: PrCache): void {
  writeText(prCachePath(), JSON.stringify(cache, null, 2) + "\n");
}
