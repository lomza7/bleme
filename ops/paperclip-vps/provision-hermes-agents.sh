#!/usr/bin/env bash
# Provisionne les 6 agents Hermes de BLEME sur le VPS.
# Usage : NOUS_API_KEY=sk-... ./provision-hermes-agents.sh [agent...]
# Sans argument : marius lena jeanne nora sacha basile.
#
# Pour chaque agent : utilisateur Unix dédié (agent-<nom>), installation
# de Hermes Agent (officielle), configuration du provider Nous (endpoint
# OpenAI-compatible), service systemd hermes-bleme@<nom>.
# Reste manuel (par design) : « Create agent » dans l'UI Paperclip pour
# obtenir l'identité de heartbeat de chaque agent, à coller via
# `hermes config set` sous l'utilisateur concerné.
set -euo pipefail

AGENTS=("${@:-marius lena jeanne nora sacha basile}")
[[ $# -eq 0 ]] && AGENTS=(marius lena jeanne nora sacha basile)

if [[ -z "${NOUS_API_KEY:-}" ]]; then
  echo "⚠️  NOUS_API_KEY absent : installation sans provider (à configurer ensuite)." >&2
fi

for a in "${AGENTS[@]}"; do
  u="agent-$a"
  echo "── $u"
  id "$u" >/dev/null 2>&1 || useradd -m -s /bin/bash "$u"

  # Installation Hermes (idempotente : saute si déjà présent)
  if ! sudo -u "$u" test -x "/home/$u/.local/bin/hermes"; then
    sudo -u "$u" bash -c 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash'
  fi

  # Provider Nous (endpoint OpenAI-compatible) si la clé est fournie
  if [[ -n "${NOUS_API_KEY:-}" ]]; then
    sudo -u "$u" /home/$u/.local/bin/hermes config set model.provider custom || true
    sudo -u "$u" /home/$u/.local/bin/hermes config set model.base_url https://inference-api.nousresearch.com/v1 || true
    sudo -u "$u" /home/$u/.local/bin/hermes config set model.api_key "$NOUS_API_KEY" || true
  fi
done

install -m 644 "$(dirname "$0")/hermes-bleme@.service" /etc/systemd/system/hermes-bleme@.service
systemctl daemon-reload
echo
echo "Prêt. Pour chaque agent :"
echo "  1) UI Paperclip → Agents → Create agent → heartbeat → copier l'identité"
echo "  2) sudo -u agent-<nom> hermes config set <clé fournie par Paperclip>"
echo "  3) systemctl enable --now hermes-bleme@<nom>"
