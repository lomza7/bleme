import "server-only";
import type { ComptaAdapter } from "@/lib/integrations/types";
import { pennylaneAdapter } from "@/lib/integrations/adapters/pennylane";
import { axonautAdapter } from "@/lib/integrations/adapters/axonaut";
import { sellsyAdapter } from "@/lib/integrations/adapters/sellsy";

/** Registre des adaptateurs comptables par fournisseur. */
const ADAPTERS: Record<string, ComptaAdapter> = {
  pennylane: pennylaneAdapter,
  axonaut: axonautAdapter,
  sellsy: sellsyAdapter,
};

export function getAdapter(provider: string): ComptaAdapter | null {
  return ADAPTERS[provider] ?? null;
}
