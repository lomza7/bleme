import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, KeyRound, ShieldCheck, Webhook, Zap } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { CodeBlock } from "@/components/developers/code-block";

const TITLE = "API BLEME — Documentation développeurs";
const DESCRIPTION =
  "Connectez BLEME à vos outils : lisez et créez des dossiers, poussez vos factures impayées, recevez les événements en temps réel par webhooks signés. API REST, authentifiée par clé, scopée à votre organisation.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/developpeurs" },
  openGraph: { title: TITLE, description: DESCRIPTION },
};

const NAV = [
  { id: "intro", label: "Introduction" },
  { id: "demarrage", label: "Démarrage rapide" },
  { id: "auth", label: "Authentification" },
  { id: "conventions", label: "Conventions" },
  { id: "dossiers", label: "Dossiers" },
  { id: "courriers", label: "Courriers & suivi" },
  { id: "factures", label: "Factures" },
  { id: "webhooks", label: "Webhooks" },
];

const SCOPES = [
  { cap: "cases.view", label: "Lire les dossiers, leurs courriers et le suivi" },
  { cap: "cases.create", label: "Créer des dossiers" },
  { cap: "compta.view", label: "Lire les factures importées" },
  { cap: "compta.manage", label: "Pousser des factures (et créer le dossier lié)" },
];

const ERRORS = [
  ["401", "unauthorized", "Clé absente, invalide, expirée ou révoquée."],
  ["403", "forbidden", "La clé n’a pas le droit (scope) requis pour cet appel."],
  ["404", "not_found", "Ressource introuvable (ou hors de votre organisation)."],
  ["413", "payload_too_large", "Corps de requête trop volumineux."],
  ["422", "invalid_request", "Corps invalide (détails dans error.details)."],
  ["429", "rate_limited", "Trop de requêtes — voir l’en-tête Retry-After."],
  ["500", "internal", "Erreur interne. Réessayez."],
];

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  const tint = method === "GET" ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1 ${tint}`}>{method}</span>;
}

function Scope({ cap }: { cap: string }) {
  return <code className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand-strong">{cap}</code>;
}

function Endpoint({
  method,
  path,
  scope,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  scope: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <MethodBadge method={method} />
        <code className="font-mono text-sm font-medium">{path}</code>
        <span className="ml-auto text-xs text-muted-foreground">
          droit <Scope cap={scope} />
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export default function DeveloppeursPage() {
  const base = publicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const api = `${base}/api/v1`;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            BLEME<span className="text-brand">.</span>
          </Link>
          <Link
            href="/app/parametres/api"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
          >
            <KeyRound className="size-4" />
            Mes clés API
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-6 pb-24">
        {/* Sommaire */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 flex flex-col gap-1 py-12">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Documentation
            </p>
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Contenu */}
        <main className="min-w-0 flex-1 py-12">
          {/* Hero */}
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-strong">
              <Zap className="size-3.5" />
              API REST · v1
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Connectez BLEME à vos outils</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Lisez et créez des dossiers, poussez vos factures impayées, et recevez les événements en temps réel.
              Une API REST simple, authentifiée par clé, strictement limitée à votre organisation.
            </p>
          </div>

          <div className="mt-14 flex flex-col gap-16">
            {/* Introduction */}
            <Section id="intro" title="Introduction">
              <p className="text-muted-foreground">
                Toutes les requêtes se font en HTTPS vers la base ci-dessous. Les réponses sont en JSON (UTF-8). Les
                montants sont toujours en <strong className="text-foreground">centimes</strong> (entiers), les dates en{" "}
                <strong className="text-foreground">ISO 8601</strong>.
              </p>
              <CodeBlock lang="Base URL" code={`${api}`} />
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <p>
                  <strong>L’envoi de courrier n’est jamais accessible par l’API.</strong> Valider et expédier une
                  relance ou une mise en demeure exige une validation humaine tracée (pilier juridique de BLEME).
                  L’API permet de <em>lire</em> les courriers et leur suivi, et de <em>créer</em> des dossiers en
                  brouillon — jamais de déclencher un envoi.
                </p>
              </div>
            </Section>

            {/* Démarrage */}
            <Section id="demarrage" title="Démarrage rapide">
              <ol className="flex flex-col gap-3 text-muted-foreground">
                <li>
                  <strong className="text-foreground">1.</strong> Dans BLEME, ouvrez{" "}
                  <Link href="/app/parametres/api" className="font-medium text-brand-strong underline-offset-4 hover:underline">
                    Paramètres → Clés API
                  </Link>{" "}
                  et créez une clé en cochant les droits voulus.
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Copiez la clé{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">blm_live_…</code> — elle n’est affichée
                  qu’une seule fois.
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> Passez-la dans l’en-tête{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">Authorization</code> de chaque requête.
                </li>
              </ol>
              <CodeBlock
                lang="cURL"
                code={`curl ${api}/cases \\\n  -H "Authorization: Bearer $BLEME_KEY"`}
              />
              <p className="text-sm text-muted-foreground">
                L’API et les webhooks font partie du{" "}
                <Link href="/tarifs" className="font-medium text-brand-strong underline-offset-4 hover:underline">
                  forfait Pro
                </Link>
                .
              </p>
            </Section>

            {/* Auth */}
            <Section id="auth" title="Authentification">
              <p className="text-muted-foreground">
                Chaque requête porte l’en-tête <code className="rounded bg-muted px-1 font-mono text-xs">Authorization: Bearer VOTRE_CLÉ</code>.
                La clé est liée à une organisation et à un jeu de droits (scopes) figé à sa création — elle ne peut
                rien faire de plus que ces droits, même si vous êtes propriétaire.
              </p>
              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Droit</th>
                      <th className="px-4 py-2.5 font-medium">Permet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {SCOPES.map((s) => (
                      <tr key={s.cap}>
                        <td className="px-4 py-2.5">
                          <Scope cap={s.cap} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                Une clé se révoque à tout moment depuis le même écran ; elle est aussi révoquée automatiquement si son
                créateur perd l’accès à l’organisation.
              </p>
            </Section>

            {/* Conventions */}
            <Section id="conventions" title="Conventions">
              <h3 className="text-base font-semibold">Pagination</h3>
              <p className="text-muted-foreground">
                Les listes sont paginées par curseur. Chaque réponse renvoie{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">data</code> et{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">next_cursor</code> (ou{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">null</code> en fin de liste). Passez ce curseur
                au paramètre <code className="rounded bg-muted px-1 font-mono text-xs">cursor</code> de la requête
                suivante. <code className="rounded bg-muted px-1 font-mono text-xs">limit</code> : 25 par défaut, 100
                maximum.
              </p>
              <CodeBlock lang="JSON" code={`{\n  "data": [ /* … */ ],\n  "next_cursor": "eyJ…"\n}`} />

              <h3 className="text-base font-semibold">Erreurs</h3>
              <p className="text-muted-foreground">
                Les erreurs renvoient un statut HTTP et un corps normalisé{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{`{ "error": { "code", "message" } }`}</code>.
              </p>
              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">HTTP</th>
                      <th className="px-4 py-2.5 font-medium">code</th>
                      <th className="px-4 py-2.5 font-medium">Signification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ERRORS.map(([http, code, desc]) => (
                      <tr key={code}>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{http}</td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs">{code}</code>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-semibold">Limites</h3>
              <p className="text-muted-foreground">
                120 requêtes par minute et par clé. Au-delà, réponse{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">429</code> avec l’en-tête{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">Retry-After</code> (secondes).
              </p>
            </Section>

            {/* Dossiers */}
            <Section id="dossiers" title="Dossiers">
              <Endpoint method="GET" path="/v1/cases" scope="cases.view">
                <p className="text-muted-foreground">
                  Liste des dossiers. Filtres :{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">status</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">case_type</code> (unpaid_invoice,
                  client_dispute, admin_request). Pagination par{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">cursor</code>.
                </p>
                <CodeBlock lang="cURL" code={`curl "${api}/cases?status=active&limit=50" \\\n  -H "Authorization: Bearer $BLEME_KEY"`} />
              </Endpoint>

              <Endpoint method="GET" path="/v1/cases/{id}" scope="cases.view">
                <p className="text-muted-foreground">
                  Détail d’un dossier : ses informations, ses courriers, ses pièces (métadonnées) et sa chronologie.
                  Renvoie <code className="rounded bg-muted px-1 font-mono text-xs">404</code> si le dossier
                  n’appartient pas à votre organisation.
                </p>
              </Endpoint>

              <Endpoint method="POST" path="/v1/cases" scope="cases.create">
                <p className="text-muted-foreground">
                  Crée un dossier en brouillon (aucun courrier, aucun envoi). Champs :{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">case_type</code> et{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">debtor_name</code> requis ;{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">amount_claimed_cents</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">title</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">summary</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">debtor_siren</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">debtor_email</code> optionnels.
                </p>
                <CodeBlock
                  lang="cURL"
                  code={`curl -X POST ${api}/cases \\\n  -H "Authorization: Bearer $BLEME_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "case_type": "unpaid_invoice",\n    "debtor_name": "SARL Dupont",\n    "amount_claimed_cents": 240000,\n    "debtor_email": "compta@dupont.fr"\n  }'`}
                />
              </Endpoint>
            </Section>

            {/* Courriers */}
            <Section id="courriers" title="Courriers & suivi">
              <Endpoint method="GET" path="/v1/cases/{id}/letters" scope="cases.view">
                <p className="text-muted-foreground">
                  Les courriers d’un dossier (relances, mise en demeure…) et, pour chacun, son suivi d’acheminement
                  (<code className="rounded bg-muted px-1 font-mono text-xs">tracking</code> : remis, distribué, ouvert,
                  réponse reçue…). <strong className="text-foreground">Lecture seule</strong> : l’envoi n’est pas
                  disponible par l’API.
                </p>
              </Endpoint>
            </Section>

            {/* Factures */}
            <Section id="factures" title="Factures">
              <Endpoint method="GET" path="/v1/invoices" scope="compta.view">
                <p className="text-muted-foreground">
                  Liste des factures importées. Filtres :{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">paid</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">archived</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">provider</code>.
                </p>
              </Endpoint>

              <Endpoint method="POST" path="/v1/invoices" scope="compta.manage">
                <p className="text-muted-foreground">
                  Pousse une facture dans BLEME. <strong className="text-foreground">Idempotent</strong> sur{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">external_id</code> : rejouer le même
                  identifiant met à jour la facture, sans doublon. Avec{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">create_case: true</code> (et le droit{" "}
                  <Scope cap="cases.create" />
                  ), un dossier est créé et lié en un clic ; un{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">pdf_base64</code> optionnel est joint comme
                  pièce. La réponse renvoie <code className="rounded bg-muted px-1 font-mono text-xs">case_id</code> et,
                  le cas échéant, <code className="rounded bg-muted px-1 font-mono text-xs">pdf_attached</code>.
                </p>
                <CodeBlock
                  lang="cURL"
                  code={`curl -X POST ${api}/invoices \\\n  -H "Authorization: Bearer $BLEME_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "external_id": "F-2026-042",\n    "customer_name": "SARL Dupont",\n    "customer_email": "compta@dupont.fr",\n    "remaining_cents": 240000,\n    "deadline_on": "2026-05-30",\n    "create_case": true\n  }'`}
                />
              </Endpoint>
            </Section>

            {/* Webhooks */}
            <Section id="webhooks" title="Webhooks">
              <p className="text-muted-foreground">
                Plutôt que d’interroger l’API en boucle, laissez BLEME notifier votre outil quand un événement se
                produit. Créez un endpoint dans{" "}
                <Link href="/app/parametres/webhooks" className="font-medium text-brand-strong underline-offset-4 hover:underline">
                  Paramètres → Webhooks
                </Link>{" "}
                (URL en https), choisissez les événements, et copiez le <em>secret de signature</em> (affiché une fois).
              </p>

              <h3 className="text-base font-semibold">Événements</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ["case.created", "Un dossier a été créé"],
                  ["case.resolved", "Un dossier a été soldé (payé)"],
                  ["invoice.payment_detected", "Paiement détecté sur une facture"],
                  ["letter.sent", "Un courrier a été validé / envoyé"],
                  ["letter.tracking_updated", "Le suivi d’un courrier a évolué"],
                  ["reply.received", "Une réponse a été reçue"],
                ].map(([type, desc]) => (
                  <li key={type} className="rounded-xl border bg-card px-3.5 py-2.5">
                    <code className="text-xs font-medium text-brand-strong">{type}</code>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                  </li>
                ))}
              </ul>

              <h3 className="text-base font-semibold">Format d’un événement</h3>
              <p className="text-muted-foreground">
                Le corps ne contient que des <strong className="text-foreground">références</strong> (identifiants) —
                jamais de donnée personnelle du débiteur. Rappelez l’API avec votre clé pour obtenir le détail.
              </p>
              <CodeBlock
                lang="JSON"
                code={`{\n  "id": "d1f2…",            // identifiant de livraison (X-Bleme-Id)\n  "type": "invoice.payment_detected",\n  "occurred_at": "2026-07-12T09:30:00.000Z",\n  "organization_id": "org_…",\n  "data": { "case_id": "c_…" }\n}`}
              />

              <h3 className="text-base font-semibold">Vérifier la signature</h3>
              <p className="text-muted-foreground">
                Chaque requête porte les en-têtes{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">X-Bleme-Signature: t=…,v1=…</code>,{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">X-Bleme-Id</code> et{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">X-Bleme-Event</code>. Recalculez le HMAC-SHA256
                de la chaîne <code className="rounded bg-muted px-1 font-mono text-xs">t + &quot;.&quot; + corps_brut</code>{" "}
                avec votre secret, comparez en temps constant, et rejetez au-delà de 5 minutes d’écart.
              </p>
              <CodeBlock
                lang="Node.js"
                code={`import { createHmac, timingSafeEqual } from "node:crypto";\n\nexport function verifyBleme(rawBody, header, secret) {\n  const parts = Object.fromEntries(\n    header.split(",").map((p) => p.split("=")),\n  );\n  const t = Number(parts.t);\n  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false; // rejeu\n  const expected = createHmac("sha256", secret)\n    .update(\`\${t}.\${rawBody}\`)\n    .digest("hex");\n  const a = Buffer.from(parts.v1 ?? "", "hex");\n  const b = Buffer.from(expected, "hex");\n  return a.length === b.length && timingSafeEqual(a, b);\n}`}
              />

              <h3 className="text-base font-semibold">Reprises & fiabilité</h3>
              <p className="text-muted-foreground">
                Répondez <code className="rounded bg-muted px-1 font-mono text-xs">2xx</code> pour accuser réception. En
                cas d’échec, BLEME réessaie avec un délai croissant, puis abandonne. La livraison est{" "}
                <strong className="text-foreground">au moins une fois</strong> : dédupliquez sur{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">X-Bleme-Id</code>. Un endpoint qui échoue trop
                longtemps est désactivé automatiquement (vous êtes prévenu par email). Le bouton{" "}
                <em>Ping de test</em> envoie un événement <code className="rounded bg-muted px-1 font-mono text-xs">ping</code>{" "}
                pour valider votre intégration.
              </p>
            </Section>

            {/* CTA */}
            <div className="rounded-[1.75rem] border bg-brand-soft/40 p-8 text-center">
              <h2 className="text-xl font-bold">Prêt à connecter votre outil ?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Générez votre première clé et faites votre premier appel en deux minutes.
              </p>
              <Link
                href="/app/parametres/api"
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition-all duration-500 ease-fluid hover:bg-brand-strong active:scale-[0.98]"
              >
                Créer une clé API
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-bold text-ink-foreground">
              BLEME<span className="text-brand">.</span>
            </span>{" "}
            — API v1.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-colors hover:text-ink-foreground">
              Accueil
            </Link>
            <Link href="/tarifs" className="transition-colors hover:text-ink-foreground">
              Tarifs
            </Link>
            <Link href="/app/parametres/webhooks" className="inline-flex items-center gap-1 transition-colors hover:text-ink-foreground">
              <Webhook className="size-3.5" />
              Webhooks
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
