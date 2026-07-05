import {
  FileText,
  Image as ImageIcon,
  MessagesSquare,
  UploadCloud,
} from "lucide-react";
import { siGmail, siWhatsapp } from "simple-icons";
import { Reveal, RevealItem, RevealStagger } from "@/components/landing/reveal";

/*
 * « Les preuves viennent à vous » : 4 cartes mini-UI (email, WhatsApp,
 * SMS, drag & drop) avec icônes d'apps flottantes en squircles inclinés,
 * façon vitrine d'intégrations. Données d'exemple, dossier Bâti Concept.
 */

function BrandTile({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`absolute z-[1] flex size-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-zinc-950/[0.12] ring-1 ring-black/5 ${className}`}
    >
      {children}
    </span>
  );
}

function SimpleIcon({ path, hex, title }: { path: string; hex: string; title: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" role="img" aria-label={title}>
      <path d={path} fill={`#${hex}`} />
    </svg>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl bg-white p-5 shadow-xl shadow-zinc-950/[0.06] ring-1 ring-black/5">
      {children}
    </div>
  );
}

const chip =
  "shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand-strong";

export function EvidenceSources() {
  return (
    <section className="border-y bg-muted/60">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Les preuves viennent à vous.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Emails, WhatsApp, SMS, documents : BLEME rassemble le contexte là
              où il vit, et le transforme en preuves datées.
            </p>
          </div>
        </Reveal>

        <RevealStagger className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2">
          {/* Emails */}
          <RevealItem>
            <div className="relative">
              <BrandTile className="-left-3 -top-5 -rotate-6 lg:-left-6">
                <SimpleIcon path={siGmail.path} hex={siGmail.hex} title="Gmail" />
              </BrandTile>
              <CardShell>
                <div className="flex items-center gap-2.5 border-b pb-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft">
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                      <path d={siGmail.path} fill="#EA4335" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold">Boîte du dossier</p>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    d-8f3k2@dossiers.bleme.fr
                  </span>
                </div>
                <div className="flex items-start gap-3 py-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    BC
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      RE: Facture F-2026-042
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Je vous règle la semaine prochaine, promis.
                    </p>
                  </div>
                  <span className={chip}>classé</span>
                </div>
                <div className="flex items-start gap-3 border-t py-3.5 pb-1">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    BC
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      Devis signé + acompte
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Ci-joint le devis signé, ok pour démarrer.
                    </p>
                  </div>
                  <span className={chip}>2 pièces jointes</span>
                </div>
              </CardShell>
            </div>
            <h3 className="mt-6 text-lg font-semibold">Vos emails</h3>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              Transférez les échanges, ou connectez votre boîte : chaque email
              est daté, classé et versé au dossier avec ses pièces jointes.
            </p>
          </RevealItem>

          {/* WhatsApp */}
          <RevealItem>
            <div className="relative">
              <BrandTile className="-right-3 -top-5 rotate-6 lg:-right-6">
                <SimpleIcon path={siWhatsapp.path} hex={siWhatsapp.hex} title="WhatsApp" />
              </BrandTile>
              <CardShell>
                <div className="space-y-2.5 py-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
                    <p className="text-[13px]">
                      Le devis est bon pour moi, vous pouvez lancer.
                    </p>
                    <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                      14:02
                    </p>
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[#D9FDD3] px-3.5 py-2.5">
                    <p className="text-[13px] text-zinc-800">
                      Parfait, début des travaux lundi.
                    </p>
                    <p className="mt-0.5 text-right text-[10px] text-zinc-500">
                      14:05
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Conversation exportée
                  </p>
                  <span className={chip}>12 messages datés</span>
                </div>
              </CardShell>
            </div>
            <h3 className="mt-6 text-lg font-semibold">WhatsApp</h3>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              Exportez la conversation en deux gestes : les accords donnés par
              message deviennent des preuves datées, à leur place dans la
              chronologie.
            </p>
          </RevealItem>

          {/* SMS */}
          <RevealItem>
            <div className="relative">
              <BrandTile className="-left-3 -top-5 -rotate-3 lg:-left-6">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#34C759]">
                  <MessagesSquare className="size-5 text-white" />
                </span>
              </BrandTile>
              <CardShell>
                <div className="space-y-2.5 py-1">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
                    <p className="text-[13px]">
                      Je passe mardi matin pour la reprise des joints.
                    </p>
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-[#DCE9FF] px-3.5 py-2.5">
                    <p className="text-[13px] text-zinc-800">
                      Ok. Le solde reste dû à la fin des reprises.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Capture importée
                  </p>
                  <span className={chip}>texte reconnu et daté</span>
                </div>
              </CardShell>
            </div>
            <h3 className="mt-6 text-lg font-semibold">SMS</h3>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              Une capture d’écran suffit : le texte est reconnu, horodaté et
              rattaché au bon dossier.
            </p>
          </RevealItem>

          {/* Documents */}
          <RevealItem>
            <div className="relative">
              <BrandTile className="-right-3 -top-5 rotate-3 lg:-right-6">
                <FileText className="size-7 text-brand-strong" />
              </BrandTile>
              <BrandTile className="-bottom-5 -right-3 rotate-6 lg:-right-6">
                <ImageIcon className="size-7 text-brand-strong" />
              </BrandTile>
              <CardShell>
                <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-brand/30 bg-brand-soft/40 px-4 py-6 text-center">
                  <UploadCloud className="size-6 text-brand-strong" />
                  <p className="text-[13px] font-medium">
                    Glissez vos fichiers ici
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ou prenez-les en photo depuis le chantier
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t pr-10 pt-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-[13px] font-medium">
                      Facture-042.pdf
                    </span>
                  </span>
                  <span className={chip}>reconnue · 2 400 €</span>
                </div>
              </CardShell>
            </div>
            <h3 className="mt-6 text-lg font-semibold">Documents</h3>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              Glissez-déposez devis, factures et photos : tout est reconnu,
              daté et classé automatiquement dans le dossier.
            </p>
          </RevealItem>
        </RevealStagger>

        <Reveal delay={0.2}>
          <p className="mt-14 text-center text-xs leading-relaxed text-muted-foreground/80">
            Connexion Gmail en cours d’ouverture ; en attendant, le transfert
            vers l’adresse du dossier fait le même travail. Vos données restent
            en Europe et ne servent jamais à entraîner des modèles.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
