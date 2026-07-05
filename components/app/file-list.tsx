import { Download, FileText, Image as ImageIcon, Mail, Trash2 } from "lucide-react";
import { deleteDocument } from "@/lib/documents/actions";
import { dateFr, fileSize } from "@/lib/format";

export type DocRow = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "message/rfc822") return Mail;
  return FileText;
}

export function FileList({ docs }: { docs: DocRow[] }) {
  if (docs.length === 0) {
    return (
      <p className="rounded-[1.75rem] border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
        Ce dossier est vide pour l’instant. Déposez une première pièce
        ci-dessus.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-[1.75rem] border bg-card">
      {docs.map((d) => {
        const Icon = iconFor(d.mime_type);
        return (
          <div
            key={d.id}
            className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{d.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {fileSize(d.size_bytes)} · ajouté le {dateFr(d.created_at)}
              </p>
            </div>
            <a
              href={`/app/documents/fichier/${d.id}`}
              aria-label={`Télécharger ${d.file_name}`}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
            >
              <Download className="size-4" />
            </a>
            <form action={deleteDocument}>
              <input type="hidden" name="id" value={d.id} />
              <button
                type="submit"
                aria-label={`Supprimer ${d.file_name}`}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
