/*
 * Email de vérification à la création de compte : un code à 6 chiffres, mis en
 * scène. HTML inline (contraintes des clients mail), thème clair, wordmark
 * BLEME, code en gros caractères espacés sur fond dégradé brand. Le point du
 * message, c'est le code — tout le reste le sert.
 */

const BRAND = "#c2410c"; // brand-strong (orange BLEME)
const BRAND_SOFT = "#fff1e9";
const INK = "#1c1917";
const MUTED = "#78716c";

export function otpEmailHtml(code: string, name?: string | null): string {
  const hello = name?.trim() ? `Bonjour ${escapeHtml(name.trim())},` : "Bonjour,";
  const spaced = code.split("").join('<span style="display:inline-block;width:8px"></span>');
  return `<!-- BLEME · code de vérification -->
<div style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;padding-bottom:8px">
      <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK}">BLEME<span style="color:${BRAND}">.</span></span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:24px;overflow:hidden">
      <div style="padding:32px 32px 8px">
        <p style="margin:0 0 6px;font-size:15px;color:${INK}">${hello}</p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED}">
          Voici votre code de vérification pour activer votre compte. Il est valable
          <strong style="color:${INK}">15 minutes</strong>.
        </p>
      </div>
      <div style="padding:24px 32px">
        <div style="background:linear-gradient(135deg,${BRAND_SOFT},#ffffff);border:1px solid #f5d9c8;border-radius:18px;padding:26px;text-align:center">
          <div style="font-size:38px;font-weight:800;letter-spacing:8px;color:${BRAND};font-variant-numeric:tabular-nums">${spaced}</div>
        </div>
      </div>
      <div style="padding:0 32px 30px">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">
          Saisissez ce code sur la page ouverte dans votre navigateur. Si vous n'êtes
          pas à l'origine de cette demande, ignorez cet email : aucun compte ne sera activé.
        </p>
      </div>
    </div>
    <p style="text-align:center;margin:22px 0 0;font-size:12px;color:${MUTED}">
      BLEME — vos blèmes de pro, pris au sérieux.
    </p>
  </div>
</div>`;
}

export function otpEmailText(code: string): string {
  return `Votre code de vérification BLEME : ${code}\n\nIl est valable 15 minutes. Saisissez-le sur la page ouverte dans votre navigateur.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
