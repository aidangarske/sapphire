import { prCachePath } from "./paths.ts";
import { readTextIfExists, writeText } from "./fs.ts";
import type { CiCache } from "../core/watcher.ts";
import type { Pr, Account } from "../core/github/types.ts";

export interface PrCache {
  account?: Account | null;
  prs?: Pr[];
  ciCache: CiCache;
  fetchedAt?: number;
}

export function loadPrCache(): PrCache {
  const raw = readTextIfExists(prCachePath());
  if (!raw) return { ciCache: {} };
  try {
    const j = JSON.parse(raw);
    return { ciCache: j?.ciCache ?? {}, account: j?.account, prs: j?.prs, fetchedAt: j?.fetchedAt };
  } catch {
    return { ciCache: {} };
  }
}

export function savePrCache(cache: PrCache): void {
  writeText(prCachePath(), JSON.stringify(cache, null, 2) + "\n");
}
