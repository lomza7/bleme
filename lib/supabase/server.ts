import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur (RSC, Server Actions, API routes),
 * authentifié comme l'utilisateur courant — la RLS s'applique.
 */
export async function createClient() {
  // cookies() d'abord : pendant le build, ça marque la route comme dynamique
  // au lieu de faire échouer l'export si les variables d'env manquent.
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture
            // seule ; le proxy se charge du rafraîchissement de session.
          }
        },
      },
    },
  );
}

/**
 * Client service-role : contourne la RLS. Réservé aux workers/webhooks
 * (jobs IA, email entrant, Stripe). Ne JAMAIS l'exposer à une requête
 * portée par un utilisateur sans vérification d'appartenance explicite.
 */
export function createServiceClient() {
  const env = serverEnv();
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}
