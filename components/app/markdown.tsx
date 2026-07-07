// Rendu Markdown maison (composant serveur) : transforme une string markdown en
// JSX sans dépendance externe ni dangerouslySetInnerHTML. Réutilisé par la page
// dossier et l'export. Styles fournis par .prose-bleme (app/globals.css).

import type { ReactNode } from "react";

// Rend le gras inline "**texte**" en <strong> ; ignore les autres marqueurs.
function renderInline(text: string): ReactNode[] {
  return text.split("**").map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content || content.trim() === "") {
    return null;
  }

  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {items.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${blocks.length}`}>{renderInline(trimmed.slice(4))}</h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${blocks.length}`}>{renderInline(trimmed.slice(3))}</h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${blocks.length}`}>{renderInline(trimmed.slice(2))}</h1>,
      );
    } else {
      blocks.push(
        <p key={`p-${blocks.length}`}>{renderInline(trimmed)}</p>,
      );
    }
  }

  flushList();

  return <div className={`prose-bleme ${className ?? ""}`}>{blocks}</div>;
}
