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
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

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

# Bibliothèque de skills : catalogue du repo Hermes, installées dans le home
# BLEME isolé (HERMES_HOME, distinct de l'instance ATLAS).
REPO_SKILLS = Path(HERMES_ROOT) / "skills"
HOME_SKILLS = Path(os.getenv("HERMES_HOME", str(Path.home() / ".hermes"))) / "skills"
SKILL_NAME_RE = re.compile(r"^[a-z0-9_-]+/[a-z0-9_-]+$")
PAPERCLIP_API = os.getenv("PAPERCLIP_API", "http://127.0.0.1:3100/api")

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


# ── Version et mise à jour de Hermes (checkout dédié BLEME) ──────────────────

ROLLBACK_FILE = Path(HERMES_ROOT) / ".bleme-rollback"
_VERSION_CACHE: dict = {"at": 0.0, "data": None}


def _git(*args: str, timeout: int = 30) -> str:
    out = subprocess.run(
        ["git", *args], cwd=HERMES_ROOT, capture_output=True, text=True, timeout=timeout,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip()[:200] or f"git {args[0]} a échoué")
    return out.stdout.strip()


def _pip_sync() -> None:
    pip = Path(HERMES_ROOT) / "venv" / "bin" / "pip"
    if pip.exists():
        subprocess.run(
            [str(pip), "install", "-q", "-e", "."],
            cwd=HERMES_ROOT, capture_output=True, timeout=600,
        )


def _schedule_restart() -> None:
    """systemd (Restart=always) relance le service : le nouveau code se charge."""
    loop = asyncio.get_event_loop()
    loop.call_later(1.0, os._exit, 0)


@app.get("/version", dependencies=[Depends(_auth)])
def version() -> dict:
    now = time.time()
    if _VERSION_CACHE["data"] and now - _VERSION_CACHE["at"] < 900:
        return _VERSION_CACHE["data"]
    try:
        local = _git("rev-parse", "--short", "HEAD")
        date = _git("log", "-1", "--format=%ci")
        behind = None
        with contextlib.suppress(Exception):
            _git("fetch", "-q", "origin", timeout=25)
            behind = int(_git("rev-list", "--count", "HEAD..origin/main"))
        data = {
            "ok": True,
            "commit": local,
            "date": date,
            "behind": behind,
            "rollback_available": ROLLBACK_FILE.exists(),
        }
        _VERSION_CACHE.update(at=now, data=data)
        return data
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


@app.post("/update", dependencies=[Depends(_auth)])
def update() -> dict:
    try:
        before = _git("rev-parse", "--short", "HEAD")
        ROLLBACK_FILE.write_text(before)
        _git("pull", "--ff-only", "origin", "main", timeout=120)
        after = _git("rev-parse", "--short", "HEAD")
        if after != before:
            _pip_sync()
        _VERSION_CACHE["data"] = None
        _schedule_restart()
        return {"ok": True, "from": before, "to": after, "restarting": True}
    except Exception as exc:
        raise HTTPException(502, f"mise à jour échouée : {str(exc)[:200]}")


@app.post("/rollback", dependencies=[Depends(_auth)])
def rollback() -> dict:
    if not ROLLBACK_FILE.exists():
        raise HTTPException(404, "aucun point de retour enregistré")
    target = ROLLBACK_FILE.read_text().strip()
    try:
        _git("checkout", "-q", target)
        _pip_sync()
        _VERSION_CACHE["data"] = None
        _schedule_restart()
        return {"ok": True, "to": target, "restarting": True}
    except Exception as exc:
        raise HTTPException(502, f"rollback échoué : {str(exc)[:200]}")


def _skill_entry(path: Path, name: str) -> dict:
    """Description : champ `description:` du frontmatter, sinon première ligne de prose."""
    description = ""
    for candidate in ("SKILL.md", "DESCRIPTION.md", "README.md"):
        f = path / candidate
        if not f.is_file():
            continue
        with contextlib.suppress(Exception):
            lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
            in_front = False
            prose = ""
            for i, raw in enumerate(lines):
                line = raw.strip()
                if i == 0 and line == "---":
                    in_front = True
                    continue
                if in_front:
                    if line == "---":
                        in_front = False
                        continue
                    if line.lower().startswith("description:"):
                        description = line.split(":", 1)[1].strip().strip("\"'")[:160]
                        break
                    continue
                clean = line.lstrip("#").strip()
                if clean and not prose:
                    prose = clean[:160]
            if not description:
                description = prose
        if description:
            break
    return {"name": name, "description": description}


def _skill_pairs(base: Path) -> list[dict]:
    out: list[dict] = []
    if base.is_dir():
        for cat in sorted(base.iterdir()):
            if not cat.is_dir() or cat.name.startswith((".", "_")):
                continue
            for sk in sorted(cat.iterdir()):
                if sk.is_dir():
                    out.append(_skill_entry(sk, f"{cat.name}/{sk.name}"))
    return out


class SkillRequest(BaseModel):
    name: str


@app.get("/skills", dependencies=[Depends(_auth)])
def list_skills() -> dict:
    installed = _skill_pairs(HOME_SKILLS)
    installed_names = {s["name"] for s in installed}
    available = [s for s in _skill_pairs(REPO_SKILLS) if s["name"] not in installed_names]
    return {"installed": installed, "available": available, "home": str(HOME_SKILLS)}


@app.post("/skills/install", dependencies=[Depends(_auth)])
def install_skill(req: SkillRequest) -> dict:
    name = req.name.strip()
    if not SKILL_NAME_RE.match(name):
        raise HTTPException(400, "nom de skill invalide (attendu: categorie/skill)")
    src = (REPO_SKILLS / name).resolve()
    if not src.is_dir() or REPO_SKILLS.resolve() not in src.parents:
        raise HTTPException(404, f"skill introuvable au catalogue: {name}")
    dst = HOME_SKILLS / name
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst, dirs_exist_ok=True)
    return {"installed": name}


@app.post("/skills/remove", dependencies=[Depends(_auth)])
def remove_skill(req: SkillRequest) -> dict:
    name = req.name.strip()
    if not SKILL_NAME_RE.match(name):
        raise HTTPException(400, "nom de skill invalide")
    dst = (HOME_SKILLS / name).resolve()
    if HOME_SKILLS.resolve() not in dst.parents or not dst.is_dir():
        raise HTTPException(404, f"skill non installée: {name}")
    shutil.rmtree(dst)
    # nettoie la catégorie si vide
    with contextlib.suppress(Exception):
        dst.parent.rmdir()
    return {"removed": name}


def _pc(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(
        f"{PAPERCLIP_API}{path}",
        method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.load(r)


def _pc_company_id() -> str:
    companies = _pc("GET", "/companies")
    if not companies:
        raise HTTPException(502, "aucune company Paperclip")
    return companies[0]["id"]


@app.get("/paperclip/summary", dependencies=[Depends(_auth)])
def paperclip_summary() -> dict:
    try:
        companies = _pc("GET", "/companies")
        return {"ok": True, "companies": companies}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


@app.get("/paperclip/routines", dependencies=[Depends(_auth)])
def paperclip_routines() -> dict:
    try:
        cid = _pc_company_id()
        routines = _pc("GET", f"/companies/{cid}/routines")
        return {"ok": True, "routines": routines}
    except HTTPException:
        raise
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "routines": []}


class RoutineCreate(BaseModel):
    title: str
    description: str | None = None
    cron: str | None = None
    activate: bool = False


@app.post("/paperclip/routines", dependencies=[Depends(_auth)])
def paperclip_routine_create(req: RoutineCreate) -> dict:
    cid = _pc_company_id()
    routine = _pc("POST", f"/companies/{cid}/routines", {
        "title": req.title,
        **({"description": req.description} if req.description else {}),
    })
    rid = routine["id"]
    if req.cron:
        _pc("POST", f"/routines/{rid}/triggers", {
            "kind": "schedule",
            "cronExpression": req.cron,
        })
    if req.activate:
        routine = _pc("PATCH", f"/routines/{rid}", {"status": "active"})
    return {"ok": True, "routine": routine}


class RoutineStatus(BaseModel):
    id: str
    status: str


@app.post("/paperclip/routines/status", dependencies=[Depends(_auth)])
def paperclip_routine_status(req: RoutineStatus) -> dict:
    if req.status not in ("active", "paused", "archived"):
        raise HTTPException(400, "statut invalide")
    routine = _pc("PATCH", f"/routines/{req.id}", {"status": req.status})
    return {"ok": True, "routine": routine}


class RoutineFire(BaseModel):
    id: str


@app.post("/paperclip/routines/fire", dependencies=[Depends(_auth)])
def paperclip_routine_fire(req: RoutineFire) -> dict:
    result = _pc("POST", f"/routines/{req.id}/run", {})
    return {"ok": True, "result": result}


MAX_SKILL_CHARS = 4000
MAX_SKILLS_TOTAL = 14000


def _skills_context(names: list[str]) -> str:
    """Concatène les SKILL.md demandés (bornés) pour injection en système."""
    parts: list[str] = []
    total = 0
    for name in names:
        if not SKILL_NAME_RE.match(name):
            continue
        base = (HOME_SKILLS / name).resolve()
        if HOME_SKILLS.resolve() not in base.parents or not base.is_dir():
            continue
        for candidate in ("SKILL.md", "README.md"):
            f = base / candidate
            if f.is_file():
                with contextlib.suppress(Exception):
                    content = f.read_text(encoding="utf-8", errors="ignore")[:MAX_SKILL_CHARS]
                    chunk = f"### Skill : {name}\n{content}"
                    if total + len(chunk) > MAX_SKILLS_TOTAL:
                        return "\n\n".join(parts)
                    parts.append(chunk)
                    total += len(chunk)
                break
    return "\n\n".join(parts)


class RunRequest(BaseModel):
    agent: str
    system: str
    input: str
    model: str | None = None
    skills: list[str] = []
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
    system = req.system
    if req.skills:
        ctx = _skills_context(req.skills[:12])
        if ctx:
            system = f"{system}\n\n[SAVOIR-FAIRE À TA DISPOSITION]\n{ctx}"

    message = (
        f"{req.input}\n\n"
        "Réponds UNIQUEMENT avec le JSON demandé, sans aucun texte autour."
    )
    loop = asyncio.get_running_loop()
    t0 = time.perf_counter()
    async with _locks[agent]:
        try:
            text = await asyncio.wait_for(
                loop.run_in_executor(None, _chat_sync, agent, model, system, message),
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
