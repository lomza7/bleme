"""
BLEME bleme-bridge v0.1 — les agents produit de BLEME tournent en Hermes.

Dérivé du pattern éprouvé d'ATLAS hermes-bridge (même VPS) : HermesCLI
chargé en mémoire (réponses warm en quelques secondes), mais MULTI-PERSONA :
une instance par agent BLEME (marius, lena, jeanne, nora, sacha, basile),
créée paresseusement, avec verrou d'accès et historique purgé après chaque
requête (les appels produit sont sans état ; la mémoire longue viendra des
skills Hermes pilotés par Paperclip).

Le prompt système de chaque persona est envoyé PAR REQUÊTE depuis BLEME :
la console /admin (table agents, prompts versionnés) reste l'unique source
de vérité — modifier un prompt dans l'admin change le comportement ici à
l'appel suivant, sans SSH.

Env (/root/.bleme-bridge.env) :
  BLEME_BRIDGE_BEARER   jeton d'auth (le même que BLEME_BRIDGE_TOKEN côté BLEME)
  HERMES_ROOT           checkout Hermes (défaut /root/.hermes/hermes-agent)
  BLEME_HERMES_MODEL    défaut nousresearch/hermes-4-70b (via OpenRouter)
  BLEME_HERMES_PROVIDER défaut openrouter
"""
from __future__ import annotations

import asyncio
import contextlib
import io
import os
import sys
import time

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

HERMES_ROOT = os.getenv("HERMES_ROOT", "/root/.hermes/hermes-agent")
BRIDGE_BEARER = os.getenv("BLEME_BRIDGE_BEARER", "")
MODEL = os.getenv("BLEME_HERMES_MODEL", "nousresearch/hermes-4-70b")
PROVIDER = os.getenv("BLEME_HERMES_PROVIDER", "openrouter")
# Clé OpenRouter dédiée BLEME (facturation séparée d'ATLAS) ; si absente,
# HermesCLI retombe sur la clé du config.yaml partagé.
API_KEY = os.getenv("BLEME_OPENROUTER_API_KEY") or None
CHAT_TIMEOUT = int(os.getenv("BLEME_CHAT_TIMEOUT", "180"))

AGENTS = ("marius", "lena", "jeanne", "nora", "sacha", "basile")

app = FastAPI(title="BLEME bleme-bridge", version="0.1.0")
security = HTTPBearer(auto_error=False)

_instances: dict[str, object] = {}
_locks: dict[str, asyncio.Lock] = {a: asyncio.Lock() for a in AGENTS}
_load_errors: dict[str, str] = {}


def _auth(creds: HTTPAuthorizationCredentials | None = Depends(security)) -> None:
    if not BRIDGE_BEARER:
        raise HTTPException(500, "BLEME_BRIDGE_BEARER non configuré sur le bridge")
    if creds is None or creds.credentials != BRIDGE_BEARER:
        raise HTTPException(401, "unauthorized")


def _new_cli(model: str):
    if HERMES_ROOT not in sys.path:
        sys.path.insert(0, HERMES_ROOT)
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
        import cli as cli_module  # type: ignore

        # v1 produit : raisonnement pur → JSON. Pas de toolsets locaux ni de
        # MCP (les endpoints OpenRouter des modèles Hermes 4 ne routent pas
        # le tool use). N'affecte que CE processus, pas le bridge ATLAS.
        with contextlib.suppress(Exception):
            cli_module.CLI_CONFIG["mcp_servers"] = {}
        # toolsets=["__aucun__"] : toolset inexistant → get_tool_definitions
        # filtre tout → aucun outil envoyé à l'API (requis : les endpoints
        # OpenRouter des modèles Hermes 4 ne routent pas le tool use).
        return cli_module.HermesCLI(
            model=model, provider=PROVIDER, api_key=API_KEY, toolsets=["__aucun__"]
        )


def _get_cli(agent: str, model: str):
    key = f"{agent}:{model}"
    if key not in _instances:
        t0 = time.perf_counter()
        _instances[key] = _new_cli(model)
        print(f"[bleme-bridge] HermesCLI({key}) chargé en {time.perf_counter() - t0:.2f}s")
    return _instances[key]


def _clear_history(cli) -> None:
    """Les appels produit sont sans état : on purge ce qui ressemble à un historique."""
    for holder in (cli, getattr(cli, "agent", None)):
        if holder is None:
            continue
        for attr in ("history", "messages", "conversation", "conversation_history"):
            value = getattr(holder, attr, None)
            if isinstance(value, list):
                value.clear()


def _disarm_tools(cli) -> None:
    """Garantit qu'aucune définition d'outil ne part dans l'appel API."""
    agent_obj = getattr(cli, "agent", None)
    if agent_obj is not None:
        with contextlib.suppress(Exception):
            agent_obj.tools = []
            agent_obj.valid_tool_names = set()


def _seed_system(cli, system: str) -> bool:
    """Vide l'historique et pose le prompt système de la persona (par requête)."""
    for holder in (cli, getattr(cli, "agent", None)):
        if holder is None:
            continue
        v = getattr(holder, "conversation_history", None)
        if isinstance(v, list):
            v.clear()
            v.append({"role": "system", "content": system})
            return True
    return False


def _chat_sync(agent: str, model: str, system: str, message: str) -> str:
    cli = _get_cli(agent, model)
    _disarm_tools(cli)
    if not _seed_system(cli, system):
        message = f"[RÔLE — à respecter strictement]\n{system}\n\n{message}"
    sink = io.StringIO()
    try:
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            response = cli.chat(message)
    except BaseException as exc:
        # Instance potentiellement corrompue : on la jette, elle sera recréée.
        _instances.pop(f"{agent}:{model}", None)
        raise RuntimeError(f"HermesCLI.chat a échoué: {exc!r}") from exc
    finally:
        with contextlib.suppress(Exception):
            _clear_history(cli)
    if response is None:
        raise RuntimeError("HermesCLI.chat a renvoyé None")
    return str(response).strip()


class RunRequest(BaseModel):
    agent: str
    system: str
    input: str
    model: str | None = None
    timeout_s: int | None = None


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "bleme-bridge",
        "model": MODEL,
        "provider": PROVIDER,
        "loaded_agents": sorted(_instances.keys()),
        "load_errors": _load_errors,
    }


@app.post("/run", dependencies=[Depends(_auth)])
async def run(req: RunRequest) -> dict:
    agent = req.agent.strip().lower()
    if agent not in AGENTS:
        raise HTTPException(400, f"agent inconnu: {agent}")
    model = (req.model or MODEL).strip()

    message = (
        f"{req.input}\n\n"
        "Réponds UNIQUEMENT avec le JSON demandé, sans aucun texte autour."
    )
    loop = asyncio.get_running_loop()
    t0 = time.perf_counter()
    async with _locks[agent]:
        try:
            text = await asyncio.wait_for(
                loop.run_in_executor(None, _chat_sync, agent, model, req.system, message),
                timeout=req.timeout_s or CHAT_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise HTTPException(504, "délai Hermes dépassé")
        except RuntimeError as exc:
            _load_errors[agent] = str(exc)[:300]
            raise HTTPException(502, str(exc)[:300])
    _load_errors.pop(agent, None)
    return {
        "agent": agent,
        "model": model,
        "text": text,
        "duration_ms": int((time.perf_counter() - t0) * 1000),
    }
