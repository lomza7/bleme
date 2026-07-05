/*
 * Parser des exports officiels WhatsApp (« Exporter la discussion », .txt).
 * Formats couverts : Android FR/EN (`12/06/2026, 14:02 - Nom: message`,
 * variante `12/06/2026 à 14:02 - …`) et iOS FR/EN
 * (`[12/06/2026, 14:02:33] Nom: message`), messages multilignes, marqueurs
 * de médias, lignes système. Dates lues en jour/mois (usage France).
 */

export type WaMessage = {
  date: Date;
  author: string | null; // null = message système
  text: string;
  media: boolean;
};

export type WaConversation = {
  messages: WaMessage[];
  participants: string[];
  from: Date;
  to: Date;
  systemLines: number;
};

const LINE_RE =
  /^\[?(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})[,\s]*(?:à\s*)?(\d{1,2})[:h](\d{2})(?::(\d{2}))?(?:\s*[APap][Mm])?\]?\s*[-–]?\s*(.*)$/;

const MEDIA_MARKERS = [
  "<médias omis>",
  "<media omitted>",
  "(fichier joint)",
  "(file attached)",
  "image absente",
  "image omitted",
  "video omitted",
  "vidéo absente",
  "audio omitted",
  "audio absent",
  "sticker omitted",
  "document omitted",
];

function clean(s: string): string {
  // Retire les marques directionnelles et espaces spéciaux des exports.
  return s.replace(/[‎‏‪-‮]/g, "").replace(/ /g, " ").trim();
}

export function parseWhatsAppExport(raw: string): WaConversation | null {
  const lines = raw.split(/\r?\n/);
  const messages: WaMessage[] = [];
  const participants = new Set<string>();
  let systemLines = 0;

  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;

    const m = LINE_RE.exec(line);
    if (!m) {
      // Ligne de continuation d'un message multiligne.
      const last = messages[messages.length - 1];
      if (last) last.text += `\n${line}`;
      continue;
    }

    const [, d, mo, y, h, mi, sec, rest] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const isPm = /[Pp][Mm]\]?\s*[-–]?/.test(line) && Number(h) < 12;
    const date = new Date(
      year,
      Number(mo) - 1,
      Number(d),
      Number(h) + (isPm ? 12 : 0),
      Number(mi),
      Number(sec ?? 0),
    );
    if (Number.isNaN(date.getTime()) || Number(mo) > 12 || Number(d) > 31) {
      continue;
    }

    // `Auteur: texte` — le premier `: ` sépare l'auteur du message.
    const sep = rest.indexOf(": ");
    let author: string | null = null;
    let text = rest;
    if (sep > 0 && sep < 60) {
      author = clean(rest.slice(0, sep));
      text = clean(rest.slice(sep + 2));
    } else {
      systemLines += 1;
    }

    const lower = text.toLowerCase();
    const media = MEDIA_MARKERS.some((marker) => lower.includes(marker));

    if (author) participants.add(author);
    messages.push({ date, author, text, media });
  }

  // Garde-fou : un vrai export a plusieurs messages datés et ≥ 1 auteur.
  const authored = messages.filter((m) => m.author);
  if (authored.length < 3 || participants.size === 0) return null;

  return {
    messages,
    participants: [...participants],
    from: messages[0].date,
    to: messages[messages.length - 1].date,
    systemLines,
  };
}

/* ── Moments clés (heuristique, en attendant l'extraction IA) ─────────────── */

const KEYWORDS = [
  "payer",
  "paie",
  "paiement",
  "règle",
  "regle",
  "virement",
  "chèque",
  "cheque",
  "devis",
  "facture",
  "accord",
  "d'accord",
  "ok pour",
  "valide",
  "validé",
  "commande",
  "livraison",
  "livré",
  "retard",
  "malfaçon",
  "malfacon",
  "rembours",
  "solde",
  "acompte",
  "relance",
  "impayé",
  "promis",
  "promet",
  "paierai",
  "reconnais",
  "reçu",
  "recommandé",
  "avocat",
];

const AMOUNT_RE = /\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:€|euros?)/i;

export function pickKeyMessages(conv: WaConversation, max = 5): WaMessage[] {
  const scored = conv.messages
    .filter((m) => m.author && !m.media && m.text.length >= 10 && m.text.length <= 400)
    .map((m) => {
      const lower = m.text.toLowerCase();
      let score = 0;
      if (AMOUNT_RE.test(m.text)) score += 3;
      for (const k of KEYWORDS) if (lower.includes(k)) score += 1;
      return { m, score };
    })
    .filter((s) => s.score >= 2);

  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, max)
    .map((s) => s.m)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
