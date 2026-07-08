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
import threading
import time
import urllib.error
import urllib.parse
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


def _session_usage(cli) -> tuple[int, int, float]:
    """(tokens_entrée, tokens_sortie, coût_estimé_usd) cumulés de la session.

    `session_estimated_cost_usd` est le coût que Hermes calcule lui-même (le
    même que sa commande /usage) : on le forwarde pour que BLEME affiche le
    chiffre de Hermes plutôt qu'un tarif-liste recalculé. Absent → 0.0, et
    BLEME retombe alors sur son estimation par slug (comportement inchangé)."""
    holder = getattr(cli, "agent", None)
    if holder is None:
        return (0, 0, 0.0)
    return (
        int(getattr(holder, "session_prompt_tokens", 0) or 0),
        int(getattr(holder, "session_completion_tokens", 0) or 0),
        float(getattr(holder, "session_estimated_cost_usd", 0.0) or 0.0),
    )


def _chat_sync(agent: str, model: str, system: str, message: str) -> tuple[str, int, int, float]:
    """Retourne (texte, tokens_entrée, tokens_sortie, coût_usd) — deltas de session."""
    cli = _get_cli(agent, model)
    _disarm_tools(cli)
    if not _seed_system(cli, system):
        message = f"[RÔLE — à respecter strictement]\n{system}\n\n{message}"
    before_in, before_out, before_cost = _session_usage(cli)
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
    after_in, after_out, after_cost = _session_usage(cli)
    return (
        str(response).strip(),
        max(0, after_in - before_in),
        max(0, after_out - before_out),
        max(0.0, after_cost - before_cost),
    )


def _vision_chat(
    model: str, system: str, user_text: str, attachments: list[dict]
) -> tuple[str, int, int, float]:
    """Lecture multimodale (PDF/image) via OpenRouter : on court-circuite
    HermesCLI (texte seul) et on envoie un message avec pièces au modèle vision
    demandé. Renvoie (texte, tokens_in, tokens_out, coût_usd)."""
    content: list[dict] = [{"type": "text", "text": user_text}]
    has_pdf = False
    for a in attachments:
        mime = str(a.get("mime") or "").lower()
        data = a.get("data_base64") or ""
        if not data:
            continue
        if mime == "application/pdf":
            has_pdf = True
            content.append(
                {
                    "type": "file",
                    "file": {
                        "filename": "piece.pdf",
                        "file_data": f"data:application/pdf;base64,{data}",
                    },
                }
            )
        elif mime.startswith("image/"):
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}}
            )
    body: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": content},
        ],
        "max_tokens": 800,
        "usage": {"include": True},
    }
    if has_pdf:
        body["plugins"] = [{"id": "file-parser", "pdf": {"engine": "native"}}]
    http = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(http, timeout=CHAT_TIMEOUT) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    choices = payload.get("choices") or [{}]
    text = (choices[0].get("message") or {}).get("content") or ""
    usage = payload.get("usage") or {}
    try:
        cost = float(usage.get("cost") or 0.0)
    except (TypeError, ValueError):
        cost = 0.0
    return (
        str(text).strip(),
        int(usage.get("prompt_tokens", 0) or 0),
        int(usage.get("completion_tokens", 0) or 0),
        cost,
    )


# ── Routines liées : chaque cron appartient à un agent, avec ses skills ──────
# Binding = {agent, skills[], system (prompt capturé au lien), input, last_fire}
BINDINGS_FILE = Path(os.getenv("HERMES_HOME", str(Path.home() / ".hermes"))) / "routine-bindings.json"


def _load_bindings() -> dict:
    with contextlib.suppress(Exception):
        return json.loads(BINDINGS_FILE.read_text())
    return {}


def _save_bindings(b: dict) -> None:
    BINDINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    BINDINGS_FILE.write_text(json.dumps(b, ensure_ascii=False, indent=1))


class RoutineBind(BaseModel):
    id: str
    agent: str
    skills: list[str] = []
    system: str
    input: str


@app.post("/routines/bind", dependencies=[Depends(_auth)])
def routine_bind(req: RoutineBind) -> dict:
    if req.agent not in AGENTS:
        raise HTTPException(400, f"agent inconnu: {req.agent}")
    bindings = _load_bindings()
    prev = bindings.get(req.id, {})
    bindings[req.id] = {
        "agent": req.agent,
        "skills": [s for s in req.skills if SKILL_NAME_RE.match(s)][:12],
        "system": req.system[:20000],
        "input": req.input[:8000],
        "last_fire": prev.get("last_fire", 0),
    }
    _save_bindings(bindings)
    # Miroir Paperclip : la routine est assignée à l agent homonyme (requis
    # pour l activation côté Paperclip).
    with contextlib.suppress(Exception):
        assignee = _pc_agent_id(req.agent)
        if assignee:
            _pc("PATCH", f"/routines/{req.id}", {"assigneeAgentId": assignee})
    return {"ok": True}


class RoutineUnbind(BaseModel):
    id: str


@app.post("/routines/unbind", dependencies=[Depends(_auth)])
def routine_unbind(req: RoutineUnbind) -> dict:
    bindings = _load_bindings()
    bindings.pop(req.id, None)
    _save_bindings(bindings)
    return {"ok": True}


async def _execute_routine(routine_id: str, title: str) -> str:
    """Exécute la routine via l'agent lié (skills injectées) et dépose le
    résultat en ticket Paperclip. Retourne le texte produit."""
    bindings = _load_bindings()
    binding = bindings.get(routine_id)
    if not binding:
        raise HTTPException(400, "routine non liée à un agent")
    agent = binding["agent"]
    system = binding["system"]
    if binding.get("skills"):
        ctx = _skills_context(binding["skills"])
        if ctx:
            system = f"{system}\n\n[SAVOIR-FAIRE À TA DISPOSITION]\n{ctx}"
    message = (
        f"[ROUTINE PLANIFIÉE : {title}]\n{binding.get('input') or title}\n\n"
        "Exécute cette routine et rédige le résultat en français clair et "
        "structuré, prêt à être lu dans un ticket. Pour cette tâche, ignore "
        "toute consigne de format JSON : réponds en texte libre (titres et "
        "puces bienvenus)."
    )
    loop = asyncio.get_running_loop()
    async with _locks[agent]:
        text, _tok_in, _tok_out, _cost = await asyncio.wait_for(
            loop.run_in_executor(None, _chat_sync, agent, MODEL, system, message),
            timeout=CHAT_TIMEOUT,
        )
    # Rapport en ticket Paperclip
    with contextlib.suppress(Exception):
        cid = _pc_company_id()
        stamp = time.strftime("%d/%m %H:%M")
        _pc("POST", f"/companies/{cid}/issues", {
            "title": f"[{agent}] {title} — {stamp}",
            "description": text[:8000],
        })
    # Si le déclencheur natif de Paperclip a ouvert un ticket de travail pour
    # cette routine, on le clôt : notre rapport fait foi.
    with contextlib.suppress(Exception):
        routine = _pc("GET", f"/routines/{routine_id}")
        active_issue = (routine.get("activeIssue") or {}).get("id")
        if active_issue:
            _pc("PATCH", f"/issues/{active_issue}", {"status": "done"})
    bindings = _load_bindings()
    if routine_id in bindings:
        bindings[routine_id]["last_fire"] = time.time()
        _save_bindings(bindings)
    return text


class RoutineExecute(BaseModel):
    id: str
    title: str = "Routine"


@app.post("/routines/execute", dependencies=[Depends(_auth)])
async def routine_execute(req: RoutineExecute) -> dict:
    text = await _execute_routine(req.id, req.title)
    return {"ok": True, "preview": text[:400]}


async def _scheduler() -> None:
    """Toutes les 60 s : déclenche les routines actives dont le cron est dû."""
    from croniter import croniter

    while True:
        await asyncio.sleep(60)
        try:
            cid = _pc_company_id()
            routines = _pc("GET", f"/companies/{cid}/routines")
            bindings = _load_bindings()
            now = time.time()
            for r in routines:
                if r.get("status") != "active":
                    continue
                binding = bindings.get(r["id"])
                if not binding:
                    continue
                crons = [
                    tr.get("cronExpression")
                    for tr in (r.get("triggers") or [])
                    if tr.get("kind") == "schedule" and tr.get("cronExpression")
                ]
                if not crons:
                    continue
                last = binding.get("last_fire") or (now - 90)
                due = any(
                    croniter(c, last).get_next() <= now for c in crons if croniter.is_valid(c)
                )
                if due:
                    print(f"[scheduler] routine due: {r['title']} → {binding['agent']}")
                    try:
                        await _execute_routine(r["id"], r["title"])
                    except Exception as exc:
                        print(f"[scheduler] échec {r['title']}: {exc!r}")
        except Exception as exc:
            print(f"[scheduler] tick en erreur: {exc!r}")


@app.on_event("startup")
async def _start_scheduler() -> None:
    _sp_maybe_refresh()
    _ta_maybe_refresh()
    asyncio.create_task(_scheduler())


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
    """systemd (Restart=always) relance le service : le nouveau code se charge.
    threading.Timer et non asyncio : les endpoints sync tournent dans un
    thread AnyIO sans event loop."""
    threading.Timer(1.0, os._exit, args=(0,)).start()


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


_PC_AGENTS_CACHE: dict = {"at": 0.0, "map": {}}


def _pc_agent_id(persona: str) -> str | None:
    """Retrouve l'agent Paperclip homonyme (Marius → marius) avec cache 5 min."""
    now = time.time()
    if now - _PC_AGENTS_CACHE["at"] > 300:
        with contextlib.suppress(Exception):
            cid = _pc_company_id()
            agents = _pc("GET", f"/companies/{cid}/agents")
            _PC_AGENTS_CACHE["map"] = {a["name"].lower(): a["id"] for a in agents}
            _PC_AGENTS_CACHE["at"] = now
    return _PC_AGENTS_CACHE["map"].get(persona.lower())


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
        bindings = _load_bindings()
        for r in routines:
            r["binding"] = bindings.get(r["id"])
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
    agent: str | None = None


@app.post("/paperclip/routines", dependencies=[Depends(_auth)])
def paperclip_routine_create(req: RoutineCreate) -> dict:
    cid = _pc_company_id()
    assignee = _pc_agent_id(req.agent) if req.agent else None
    routine = _pc("POST", f"/companies/{cid}/routines", {
        "title": req.title,
        **({"description": req.description} if req.description else {}),
        **({"assigneeAgentId": assignee} if assignee else {}),
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


@app.get("/paperclip/agents", dependencies=[Depends(_auth)])
def paperclip_agents() -> dict:
    try:
        cid = _pc_company_id()
        agents = _pc("GET", f"/companies/{cid}/agents")
        return {"ok": True, "agents": agents}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "agents": []}


@app.get("/paperclip/issues", dependencies=[Depends(_auth)])
def paperclip_issues() -> dict:
    try:
        cid = _pc_company_id()
        issues = _pc("GET", f"/companies/{cid}/issues")
        return {"ok": True, "issues": issues}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200], "issues": []}


class PcAgentCreate(BaseModel):
    name: str
    title: str | None = None
    reports_to: str | None = None


@app.post("/paperclip/agents/create", dependencies=[Depends(_auth)])
def paperclip_agent_create(req: PcAgentCreate) -> dict:
    cid = _pc_company_id()
    agent = _pc("POST", f"/companies/{cid}/agents", {
        "name": req.name.strip()[:60],
        **({"title": req.title.strip()[:80]} if req.title else {}),
        **({"reportsTo": req.reports_to} if req.reports_to else {}),
    })
    _PC_AGENTS_CACHE["at"] = 0  # invalide le cache nom → id
    return {"ok": True, "agent": agent}


ALLOWED_AGENT_PATCH = {"title", "reportsTo", "status", "budgetMonthlyCents"}


class PcAgentPatch(BaseModel):
    id: str
    patch: dict


@app.post("/paperclip/agents/update", dependencies=[Depends(_auth)])
def paperclip_agent_update(req: PcAgentPatch) -> dict:
    patch = {k: v for k, v in req.patch.items() if k in ALLOWED_AGENT_PATCH}
    if not patch:
        raise HTTPException(400, "aucun champ modifiable fourni")
    agent = _pc("PATCH", f"/agents/{req.id}", patch)
    _PC_AGENTS_CACHE["at"] = 0
    return {"ok": True, "agent": agent}


class PcAgentDelete(BaseModel):
    id: str


@app.post("/paperclip/agents/delete", dependencies=[Depends(_auth)])
def paperclip_agent_delete(req: PcAgentDelete) -> dict:
    result = _pc("DELETE", f"/agents/{req.id}")
    _PC_AGENTS_CACHE["at"] = 0
    return {"ok": True, "result": result}


class IssueCreate(BaseModel):
    title: str
    description: str | None = None
    agent: str | None = None


@app.post("/paperclip/issues", dependencies=[Depends(_auth)])
def paperclip_issue_create(req: IssueCreate) -> dict:
    cid = _pc_company_id()
    assignee = _pc_agent_id(req.agent) if req.agent else None
    issue = _pc("POST", f"/companies/{cid}/issues", {
        "title": req.title,
        **({"description": req.description} if req.description else {}),
        **({"assigneeAgentId": assignee} if assignee else {}),
    })
    return {"ok": True, "issue": issue}


class IssueStatus(BaseModel):
    id: str
    status: str


@app.post("/paperclip/issues/status", dependencies=[Depends(_auth)])
def paperclip_issue_status(req: IssueStatus) -> dict:
    issue = _pc("PATCH", f"/issues/{req.id}", {"status": req.status})
    return {"ok": True, "issue": issue}


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




# ── APIs outils : exécutées ici pendant une boucle agentique ─────────────────
# Le tool use natif n'étant pas routé par OpenRouter pour Hermes 4, l'agent
# émet {"outil": "api.action", "params": {...}} ; le bridge exécute l'appel
# HTTP et renvoie le résultat en observation, jusqu'au JSON final (4 appels max).

TOOL_HTTP_TIMEOUT = 20
TOOL_RESULT_MAX = 3500
TOOL_CALLS_MAX = 4

_piste_tokens: dict[str, tuple[str, float]] = {}  # client_id → (token, expiry)


def _http_json(req: urllib.request.Request) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=TOOL_HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8", errors="ignore"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")[:400]
        return {"erreur": f"HTTP {exc.code} : {body}"}
    except Exception as exc:  # réseau, timeout, JSON invalide
        return {"erreur": f"{type(exc).__name__}: {exc}"}


def _piste_sandbox(credentials: dict) -> bool:
    return str(credentials.get("PISTE_ENV", "")).strip().lower() == "sandbox"


def _piste_token(credentials: dict) -> str | dict:
    cid = credentials.get("PISTE_CLIENT_ID", "")
    secret = credentials.get("PISTE_CLIENT_SECRET", "")
    if not cid or not secret:
        return {"erreur": "clés PISTE absentes du coffre (/admin/cles)"}
    sandbox = _piste_sandbox(credentials)
    cache_key = f"{cid}:{sandbox}"
    cached = _piste_tokens.get(cache_key)
    if cached and cached[1] > time.time():
        return cached[0]
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": cid,
        "client_secret": secret,
        "scope": "openid",
    }).encode()
    oauth_url = (
        "https://sandbox-oauth.piste.gouv.fr/api/oauth/token"
        if sandbox
        else "https://oauth.piste.gouv.fr/api/oauth/token"
    )
    req = urllib.request.Request(
        oauth_url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    payload = _http_json(req)
    if "erreur" in payload:
        return payload
    token = payload.get("access_token")
    if not token:
        return {"erreur": f"réponse OAuth PISTE inattendue : {str(payload)[:200]}"}
    _piste_tokens[cache_key] = (token, time.time() + int(payload.get("expires_in", 3600)) - 300)
    return token


LEGIFRANCE_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app"
LEGIFRANCE_BASE_SANDBOX = "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app"


def _legifrance_post(path: str, body: dict, credentials: dict) -> dict:
    token = _piste_token(credentials)
    if isinstance(token, dict):
        return token
    base = LEGIFRANCE_BASE_SANDBOX if _piste_sandbox(credentials) else LEGIFRANCE_BASE
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    return _http_json(req)


def _legifrance_search(fond: str, mots_cles: str, credentials: dict) -> dict:
    payload = _legifrance_post("/search", {
        "fond": fond,
        "recherche": {
            "champs": [{
                "typeChamp": "ALL",
                "criteres": [{
                    "typeRecherche": "TOUS_LES_MOTS_DANS_UN_CHAMP",
                    "valeur": mots_cles[:200],
                    "operateur": "ET",
                }],
                "operateur": "ET",
            }],
            "pageNumber": 1,
            "pageSize": 5,
            "operateur": "ET",
            "sort": "PERTINENCE",
            "typePagination": "DEFAUT",
        },
    }, credentials)
    if "erreur" in payload:
        return payload
    resultats = []
    for r in (payload.get("results") or [])[:5]:
        titres = r.get("titles") or []
        extraits = []
        for section in (r.get("sections") or [])[:2]:
            for ext in (section.get("extracts") or [])[:2]:
                v = re.sub(r"<[^>]+>", "", str(ext.get("values") or ext.get("value") or ""))
                if v.strip():
                    extraits.append(v.strip()[:280])
        resultats.append({
            "id": (titres[0].get("id") if titres else r.get("id")) or "",
            "titre": re.sub(r"<[^>]+>", "", str((titres[0].get("title") if titres else "") or r.get("text", "")))[:150],
            "nature": r.get("nature") or "",
            "date": r.get("date") or "",
            "extraits": extraits,
        })
    return {"total": payload.get("totalResultNumber", len(resultats)), "resultats": resultats}


def _tool_legifrance(action: str, params: dict, credentials: dict) -> dict:
    if action == "rechercher_loi":
        return _legifrance_search("LODA_DATE", str(params.get("mots_cles", "")), credentials)
    if action == "rechercher_jurisprudence":
        return _legifrance_search("JURI", str(params.get("mots_cles", "")), credentials)
    if action == "rechercher_convention":
        return _legifrance_search("KALI", str(params.get("mots_cles", "")), credentials)
    if action == "consulter_article":
        payload = _legifrance_post("/consult/getArticle", {"id": str(params.get("id", ""))}, credentials)
        if "erreur" in payload:
            return payload
        article = payload.get("article") or {}
        return {
            "id": article.get("id", ""),
            "numero": article.get("num", ""),
            "etat": article.get("etat", ""),
            "contexte": article.get("fullSectionsTitre", ""),
            "texte": re.sub(r"<[^>]+>", "", str(article.get("texte") or ""))[:2500],
        }
    return {"erreur": f"action legifrance inconnue : {action}"}


JUDILIBRE_BASE = "https://api.piste.gouv.fr/cassation/judilibre/v1.0"
JUDILIBRE_BASE_SANDBOX = "https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0"


def _judilibre_get(path: str, params: dict, credentials: dict) -> dict:
    token = _piste_token(credentials)
    if isinstance(token, dict):
        return token
    base = JUDILIBRE_BASE_SANDBOX if _piste_sandbox(credentials) else JUDILIBRE_BASE
    url = f"{base}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    return _http_json(req)


def _tool_judilibre(action: str, params: dict, credentials: dict) -> dict:
    if action == "rechercher":
        mots = str(params.get("mots_cles", ""))[:200]
        if not mots.strip():
            return {"erreur": "paramètre 'mots_cles' vide"}
        payload = _judilibre_get("/search", {
            "query": mots,
            "page_size": 5,
            "sort": "score",
            "resolve_references": "true",
        }, credentials)
        if "erreur" in payload:
            return payload
        resultats = []
        for r in (payload.get("results") or [])[:5]:
            resultats.append({
                "id": r.get("id") or "",
                "juridiction": r.get("jurisdiction") or "",
                "chambre": r.get("chamber") or "",
                "numero": r.get("number") or "",
                "date": r.get("decision_date") or "",
                "solution": r.get("solution") or "",
                "resume": re.sub(r"<[^>]+>", "", str(r.get("summary") or ""))[:300],
                "extraits": [
                    re.sub(r"<[^>]+>", "", h)[:200]
                    for h in (r.get("highlights", {}) or {}).get("text", [])[:2]
                ],
            })
        return {"total": payload.get("total", len(resultats)), "resultats": resultats}
    if action == "consulter_decision":
        did = str(params.get("id", ""))
        if not did.strip():
            return {"erreur": "paramètre 'id' vide (id obtenu via judilibre.rechercher)"}
        payload = _judilibre_get("/decision", {"id": did, "resolve_references": "true"}, credentials)
        if "erreur" in payload:
            return payload
        return {
            "id": payload.get("id") or "",
            "juridiction": payload.get("jurisdiction") or "",
            "chambre": payload.get("chamber") or "",
            "numero": payload.get("number") or "",
            "date": payload.get("decision_date") or "",
            "solution": payload.get("solution") or "",
            "texte": re.sub(r"<[^>]+>", "", str(payload.get("text") or ""))[:2800],
        }
    return {"erreur": f"action judilibre inconnue : {action}"}


PAPPERS_API = "https://api.pappers.fr/v2"


def _tool_pappers(action: str, params: dict, credentials: dict) -> dict:
    key = credentials.get("PAPPERS_API_KEY", "")
    if not key:
        return {"erreur": "clé Pappers absente du coffre (/admin/cles)"}
    if action != "fiche":
        return {"erreur": f"action pappers inconnue : {action}"}
    siren = re.sub(r"\D", "", str(params.get("siren", "")))[:9]
    if len(siren) != 9:
        return {"erreur": "paramètre 'siren' invalide (9 chiffres attendus)"}
    url = f"{PAPPERS_API}/entreprise?" + urllib.parse.urlencode({"api_token": key, "siren": siren})
    payload = _http_json(urllib.request.Request(url, headers={"Accept": "application/json"}))
    if "erreur" in payload:
        # ne jamais refléter l'URL (contient la clé)
        return {"erreur": payload["erreur"].split(" : ")[0] + " : réponse Pappers en erreur"} if "HTTP" in payload["erreur"] else payload
    siege = payload.get("siege") or {}
    procs = payload.get("procedures_collectives") or []
    comptes = payload.get("comptes") or []
    return {
        "siren": siren,
        "denomination": payload.get("nom_entreprise") or payload.get("denomination") or "",
        "forme_juridique": payload.get("forme_juridique") or "",
        "date_creation": payload.get("date_creation") or "",
        "cessee": bool(payload.get("entreprise_cessee")),
        "date_cessation": payload.get("date_cessation"),
        "statut_rcs": payload.get("statut_rcs") or "",
        "adresse_siege": ", ".join(filter(None, [siege.get("adresse_ligne_1"), siege.get("code_postal"), siege.get("ville")])),
        "numero_tva": payload.get("numero_tva_intracommunautaire") or "",
        "capital": payload.get("capital_formate") or "",
        "procedure_collective_en_cours": bool(payload.get("procedure_collective_en_cours")),
        "procedures_collectives": [
            {"type": p.get("type") or "", "date_debut": p.get("date_debut") or ""} for p in procs[:4]
        ] or None,
        "dirigeants": [
            {
                "nom": " ".join(filter(None, [d.get("prenom"), d.get("nom")])) or d.get("denomination") or "",
                "qualite": d.get("qualite") or "",
            }
            for d in (payload.get("representants") or [])[:6]
        ],
        "derniers_comptes": (comptes[0].get("date_cloture") if comptes and isinstance(comptes[0], dict) else None),
        "nb_actes_deposes": len(payload.get("depots_actes") or []),
    }


BODACC_API = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records"


def _tool_bodacc(action: str, params: dict, _credentials: dict) -> dict:
    if action != "annonces":
        return {"erreur": f"action bodacc inconnue : {action}"}
    siren = re.sub(r"\D", "", str(params.get("siren", "")))[:9]
    if len(siren) != 9:
        return {"erreur": "paramètre 'siren' invalide (9 chiffres attendus)"}
    url = BODACC_API + "?" + urllib.parse.urlencode({
        "where": f'registre="{siren}"',
        "order_by": "dateparution desc",
        "limit": 8,
    })
    payload = _http_json(urllib.request.Request(url, headers={"Accept": "application/json"}))
    if "erreur" in payload:
        return payload
    annonces, alerte = [], []
    for r in payload.get("results") or []:
        jugement = {}
        with contextlib.suppress(Exception):
            jugement = json.loads(r.get("jugement") or "{}")
        famille = r.get("familleavis_lib") or r.get("familleavis") or ""
        if r.get("familleavis") == "collective":
            alerte.append(f"procédure collective ({jugement.get('nature', 'nature inconnue')})")
        if r.get("radiationaurcs"):
            alerte.append("radiation au RCS")
        annonces.append({
            "date": r.get("dateparution") or "",
            "famille": famille,
            "nature": jugement.get("nature") or r.get("typeavis") or "",
            "tribunal": r.get("tribunal") or "",
        })
    return {
        "siren": siren,
        "total_annonces": payload.get("total_count", len(annonces)),
        "alerte": "; ".join(sorted(set(alerte))) or None,
        "annonces": annonces,
    }


def _tool_justice_administrative(action: str, params: dict, credentials: dict) -> dict:
    if action == "rechercher":
        return _legifrance_search("CETAT", str(params.get("mots_cles", "")), credentials)
    if action == "rechercher_ta":
        if not TA_DB.exists():
            return {"erreur": "index des tribunaux administratifs en cours de construction, réessaye plus tard"}
        mots = str(params.get("mots_cles", ""))[:150]
        termes = re.findall(r"[\w'àâäéèêëîïôöùûüç-]+", mots.lower())[:8]
        if not termes:
            return {"erreur": "paramètre 'mots_cles' vide"}
        fts = lambda op: op.join(f'"{x}"' for x in termes)  # noqa: E731
        sql = ("SELECT id, juridiction, date, type_recours, solution, snippet(ta, 8, '', '', '…', 24) "
               "FROM ta WHERE ta MATCH ? ORDER BY bm25(ta) LIMIT 5")
        try:
            db = _ta_db()
            rows = db.execute(sql, (fts(" "),)).fetchall() or db.execute(sql, (fts(" OR "),)).fetchall()
            db.close()
        except Exception as exc:
            return {"erreur": f"recherche invalide : {str(exc)[:120]}"}
        return {"resultats": [
            {"id": r[0], "juridiction": r[1], "date": r[2], "type_recours": r[3],
             "solution": r[4], "extrait": r[5]} for r in rows]}
    if action == "consulter_decision_ta":
        did = str(params.get("id", "")).strip()[:60]
        if not TA_DB.exists():
            return {"erreur": "index des tribunaux administratifs en cours de construction"}
        db = _ta_db()
        rows = db.execute(
            "SELECT id, juridiction, numero, date, type_decision, type_recours, solution, texte "
            "FROM ta WHERE id = ? LIMIT 1", (did,)).fetchall()
        db.close()
        if not rows:
            return {"erreur": f"décision introuvable : {did}"}
        r = rows[0]
        return {"id": r[0], "juridiction": r[1], "numero": r[2], "date": r[3],
                "type_decision": r[4], "type_recours": r[5], "solution": r[6], "texte": r[7][:2800]}
    if action == "consulter_decision":
        did = str(params.get("id", "")).strip()
        if not did.startswith("CETATEXT"):
            return {"erreur": "paramètre 'id' invalide (attendu : CETATEXT…, obtenu via la recherche)"}
        payload = _legifrance_post("/consult/juri", {"textId": did}, credentials)
        if "erreur" in payload:
            return payload
        txt = payload.get("text") or {}
        return {
            "id": did,
            "titre": re.sub(r"<[^>]+>", "", str(txt.get("titre") or txt.get("title") or ""))[:200],
            "nature": txt.get("nature") or "",
            "date": txt.get("dateTexte") or "",
            "texte": re.sub(r"<[^>]+>", "", str(txt.get("texte") or ""))[:2800],
        }
    return {"erreur": f"action justice_administrative inconnue : {action}"}


def _tool_entreprises(action: str, params: dict, _credentials: dict) -> dict:
    if action != "rechercher":
        return {"erreur": f"action entreprises inconnue : {action}"}
    q = str(params.get("recherche", "") or params.get("q", ""))[:120]
    if not q.strip():
        return {"erreur": "paramètre 'recherche' vide"}
    url = "https://recherche-entreprises.api.gouv.fr/search?" + urllib.parse.urlencode(
        {"q": q, "page": 1, "per_page": 5}
    )
    payload = _http_json(urllib.request.Request(url, headers={"Accept": "application/json"}))
    if "erreur" in payload:
        return payload
    resultats = []
    for r in (payload.get("results") or [])[:5]:
        siege = r.get("siege") or {}
        resultats.append({
            "nom": r.get("nom_complet") or r.get("nom_raison_sociale") or "",
            "siren": r.get("siren") or "",
            "siret_siege": siege.get("siret") or "",
            "etat": {"A": "active", "C": "cessée"}.get(r.get("etat_administratif"), r.get("etat_administratif") or "?"),
            "activite": r.get("activite_principale") or "",
            "adresse_siege": siege.get("adresse") or "",
            "date_creation": r.get("date_creation") or "",
            "dirigeants": [
                f"{d.get('prenoms', d.get('prenom', ''))} {d.get('nom', d.get('denomination', ''))} ({d.get('qualite', '?')})".strip()
                for d in (r.get("dirigeants") or [])[:3]
            ],
        })
    return {"total": payload.get("total_results", len(resultats)), "resultats": resultats}



# ── Tribunaux administratifs : index local des décisions (open data CE) ──────
# opendata.justice-administrative.fr ne publie que des dumps XML mensuels
# (pas d'API de recherche). Fenêtre glissante de TA_MONTHS mois, sync
# incrémentale par mois, purge des mois sortis de fenêtre. Le fond CETAT
# (Légifrance) couvre déjà CE + CAA : ici on n'indexe que les TA.

TA_DB = Path(os.getenv("HERMES_HOME", str(Path.home() / ".hermes"))) / "tribunaux-administratifs.db"
TA_MONTHS = int(os.getenv("BLEME_TA_MONTHS", "24"))
TA_FLUX = "https://opendata.justice-administrative.fr/DTA/{annee}/{mois:02d}/TA_{annee}{mois:02d}.zip"
_ta_sync_lock = threading.Lock()


def _ta_window() -> list[str]:
    """Mois YYYYMM de la fenêtre, du plus récent (mois précédent) au plus ancien."""
    annee, mois = time.gmtime().tm_year, time.gmtime().tm_mon
    out = []
    for _ in range(TA_MONTHS):
        mois -= 1
        if mois == 0:
            annee, mois = annee - 1, 12
        out.append(f"{annee}{mois:02d}")
    return out


def _ta_db(create: bool = False):
    import sqlite3

    db = sqlite3.connect(TA_DB if create else f"file:{TA_DB}?mode=ro", uri=not create)
    if create:
        db.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS ta USING fts5"
            "(id, juridiction, numero, date, type_decision, type_recours, solution, mois, texte,"
            " tokenize='unicode61 remove_diacritics 2')"
        )
        db.execute("CREATE TABLE IF NOT EXISTS ta_state (mois TEXT PRIMARY KEY, decisions INTEGER, synced_at TEXT)")
    return db


def _ta_sync_month(db, yyyymm: str) -> int:
    import tempfile
    import xml.etree.ElementTree as ET
    import zipfile

    url = TA_FLUX.format(annee=int(yyyymm[:4]), mois=int(yyyymm[4:]))
    with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
        try:
            with urllib.request.urlopen(url, timeout=600) as resp:
                shutil.copyfileobj(resp, tmp)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:  # mois pas encore publié
                return -1
            raise
        tmp.flush()
        n = 0
        with zipfile.ZipFile(tmp.name) as z:
            for name in z.namelist():
                if not name.endswith(".xml"):
                    continue
                with contextlib.suppress(Exception):
                    root = ET.fromstring(z.read(name))
                    dossier = root.find("Dossier")
                    if dossier is None:
                        continue
                    g = lambda tag: (dossier.findtext(tag) or "").strip()  # noqa: E731
                    texte = re.sub(r"\s+", " ", root.findtext("Decision/Texte_Integral") or "").strip()
                    if not texte:
                        continue
                    did = f"{g('Code_Juridiction')}_{g('Numero_Dossier')}_{g('Date_Lecture').replace('-', '')}"
                    db.execute(
                        "INSERT INTO ta VALUES (?,?,?,?,?,?,?,?,?)",
                        (did, g("Nom_Juridiction"), g("Numero_Dossier"), g("Date_Lecture"),
                         g("Type_Decision"), g("Type_Recours"), g("Solution"), yyyymm, texte[:8000]),
                    )
                    n += 1
        return n


def _ta_sync() -> dict:
    """Synchronise la fenêtre glissante. Long au premier passage (~30 min) : à lancer en thread."""
    if not _ta_sync_lock.acquire(blocking=False):
        return {"ok": False, "erreur": "synchronisation déjà en cours"}
    try:
        db = _ta_db(create=True)
        fenetre = _ta_window()
        connus = {r[0] for r in db.execute("SELECT mois FROM ta_state").fetchall()}
        ajoutes = 0
        for yyyymm in sorted(set(fenetre) - connus, reverse=True):
            n = _ta_sync_month(db, yyyymm)
            if n < 0:
                continue
            db.execute("INSERT OR REPLACE INTO ta_state VALUES (?,?,datetime('now'))", (yyyymm, n))
            db.commit()
            ajoutes += n
            print(f"[bleme-bridge] TA {yyyymm} : {n} décisions indexées")
        for yyyymm in connus - set(fenetre):
            db.execute("DELETE FROM ta WHERE mois = ?", (yyyymm,))
            db.execute("DELETE FROM ta_state WHERE mois = ?", (yyyymm,))
            db.commit()
            print(f"[bleme-bridge] TA {yyyymm} : purgé (hors fenêtre)")
        total = db.execute("SELECT coalesce(sum(decisions), 0) FROM ta_state").fetchone()[0]
        db.close()
        print(f"[bleme-bridge] TA sync terminée : {total} décisions au total")
        return {"ok": True, "decisions_ajoutees": ajoutes, "decisions_total": total}
    except Exception as exc:
        return {"ok": False, "erreur": f"{type(exc).__name__}: {str(exc)[:200]}"}
    finally:
        _ta_sync_lock.release()


def _ta_maybe_refresh() -> None:
    """Au démarrage : sync en arrière-plan si l'index manque ou si un mois récent manque."""
    try:
        db = _ta_db()
        connus = {r[0] for r in db.execute("SELECT mois FROM ta_state").fetchall()}
        db.close()
    except Exception:
        connus = set()
    if set(_ta_window()[:2]) - connus:  # les 2 mois les plus récents attendus
        threading.Thread(target=_ta_sync, daemon=True).start()


@app.post("/tools/justice-administrative/sync-ta", dependencies=[Depends(_auth)])
def justice_administrative_sync_ta() -> dict:
    if _ta_sync_lock.locked():
        return {"ok": True, "statut": "synchronisation en cours"}
    threading.Thread(target=_ta_sync, daemon=True).start()
    return {"ok": True, "statut": "synchronisation lancée en arrière-plan"}


@app.get("/tools/justice-administrative/etat-ta", dependencies=[Depends(_auth)])
def justice_administrative_etat_ta() -> dict:
    try:
        db = _ta_db()
        rows = db.execute("SELECT mois, decisions FROM ta_state ORDER BY mois DESC").fetchall()
        db.close()
        return {"ok": True, "en_cours": _ta_sync_lock.locked(),
                "mois": len(rows), "decisions": sum(r[1] for r in rows)}
    except Exception:
        return {"ok": True, "en_cours": _ta_sync_lock.locked(), "mois": 0, "decisions": 0}



# ── Service-Public / Entreprendre : index local des fiches pratiques ─────────
# Pas d'API de recherche officielle : la DILA publie les fiches en XML
# (Licence Ouverte). On les indexe en SQLite FTS5 dans le home Hermes ;
# resynchronisation via POST /tools/service-public/sync (et au démarrage
# si l'index a plus de 30 jours).

SP_DB = Path(os.getenv("HERMES_HOME", str(Path.home() / ".hermes"))) / "service-public.db"
SP_FLUX = {
    "professionnels": "https://lecomarquage.service-public.gouv.fr/vdd/3.5/pro/zip/vosdroits-latest.zip",
    "particuliers": "https://lecomarquage.service-public.gouv.fr/vdd/3.5/part/zip/vosdroits-latest.zip",
}
_sp_sync_lock = threading.Lock()


def _sp_sync() -> dict:
    """Télécharge les flux DILA et reconstruit l'index. ~2 min, sous verrou."""
    import sqlite3
    import tempfile
    import xml.etree.ElementTree as ET
    import zipfile

    if not _sp_sync_lock.acquire(blocking=False):
        return {"ok": False, "erreur": "synchronisation déjà en cours"}
    try:
        tmp_db = SP_DB.with_suffix(".tmp")
        tmp_db.unlink(missing_ok=True)
        db = sqlite3.connect(tmp_db)
        db.execute(
            "CREATE VIRTUAL TABLE fiches USING fts5"
            "(id, audience, titre, sujet, description, texte, url, tokenize='unicode61 remove_diacritics 2')"
        )
        total = 0
        for audience, url in SP_FLUX.items():
            with tempfile.NamedTemporaryFile(suffix=".zip") as tmp:
                with urllib.request.urlopen(url, timeout=180) as resp:
                    shutil.copyfileobj(resp, tmp)
                tmp.flush()
                with zipfile.ZipFile(tmp.name) as z:
                    for name in z.namelist():
                        base = name.rsplit("/", 1)[-1]
                        if not (base.startswith("F") and base.endswith(".xml")):
                            continue
                        with contextlib.suppress(Exception):
                            root = ET.fromstring(z.read(name))
                            fid = root.get("ID") or base[:-4]
                            ns = {"dc": "http://purl.org/dc/elements/1.1/"}
                            titre = (root.findtext("dc:title", "", ns) or "").strip()
                            if not titre:
                                continue
                            db.execute(
                                "INSERT INTO fiches VALUES (?,?,?,?,?,?,?)",
                                (
                                    fid,
                                    audience,
                                    titre,
                                    (root.findtext("dc:subject", "", ns) or "").strip(),
                                    (root.findtext("dc:description", "", ns) or "").strip(),
                                    re.sub(r"\s+", " ", " ".join(root.itertext()))[:20000],
                                    root.get("spUrl") or "",
                                ),
                            )
                            total += 1
        db.commit()
        db.close()
        tmp_db.replace(SP_DB)
        return {"ok": True, "fiches": total}
    except Exception as exc:
        return {"ok": False, "erreur": f"{type(exc).__name__}: {str(exc)[:200]}"}
    finally:
        _sp_sync_lock.release()


def _sp_maybe_refresh() -> None:
    """Au démarrage : (re)construit l'index en arrière-plan si absent ou > 30 j."""
    try:
        age = time.time() - SP_DB.stat().st_mtime
    except OSError:
        age = None
    if age is None or age > 30 * 86400:
        threading.Thread(target=_sp_sync, daemon=True).start()


def _sp_query(sql: str, params: tuple) -> list[tuple]:
    import sqlite3

    db = sqlite3.connect(f"file:{SP_DB}?mode=ro", uri=True)
    try:
        return db.execute(sql, params).fetchall()
    finally:
        db.close()


def _tool_service_public(action: str, params: dict, _credentials: dict) -> dict:
    if not SP_DB.exists():
        return {"erreur": "index des fiches en cours de construction, réessaye dans une minute"}
    if action == "rechercher_fiche":
        mots = str(params.get("mots_cles", ""))[:150]
        termes = re.findall(r"[\w'àâäéèêëîïôöùûüç-]+", mots.lower())[:8]
        if not termes:
            return {"erreur": "paramètre 'mots_cles' vide"}
        fts = lambda op: op.join(f'"{t}"' for t in termes)  # noqa: E731
        sql = (
            "SELECT id, audience, titre, description, url FROM fiches "
            "WHERE fiches MATCH ? ORDER BY bm25(fiches) LIMIT 5"
        )
        try:
            rows = _sp_query(sql, (fts(" "),)) or _sp_query(sql, (fts(" OR "),))
        except Exception as exc:
            return {"erreur": f"recherche invalide : {str(exc)[:120]}"}
        return {
            "resultats": [
                {"id": r[0], "audience": r[1], "titre": r[2], "description": r[3][:250], "url": r[4]}
                for r in rows
            ]
        }
    if action == "consulter_fiche":
        fid = str(params.get("id", "")).strip()
        if not re.fullmatch(r"[FN]\d{2,6}", fid):
            return {"erreur": "paramètre 'id' invalide (attendu : F suivi de chiffres, ex. F23211)"}
        rows = _sp_query(
            "SELECT id, audience, titre, sujet, texte, url FROM fiches WHERE id = ? LIMIT 1", (fid,)
        )
        if not rows:
            return {"erreur": f"fiche introuvable : {fid}"}
        r = rows[0]
        return {"id": r[0], "audience": r[1], "titre": r[2], "sujet": r[3], "texte": r[4][:2800], "url": r[5]}
    return {"erreur": f"action service_public inconnue : {action}"}


@app.post("/tools/service-public/sync", dependencies=[Depends(_auth)])
def service_public_sync() -> dict:
    return _sp_sync()

TOOL_APIS = {
    "legifrance": {
        "executor": _tool_legifrance,
        "spec": (
            "### legifrance — textes officiels (Légifrance)\n"
            "- legifrance.rechercher_loi {\"mots_cles\": \"...\"} : lois et décrets en vigueur.\n"
            "- legifrance.rechercher_jurisprudence {\"mots_cles\": \"...\"} : décisions de justice judiciaire.\n"
            "- legifrance.rechercher_convention {\"mots_cles\": \"...\"} : conventions collectives et accords de branche (fond KALI).\n"
            "- legifrance.consulter_article {\"id\": \"LEGIARTI...\"} : texte intégral d'un article (id obtenu via une recherche)."
        ),
    },
    "judilibre": {
        "executor": _tool_judilibre,
        "spec": (
            "### judilibre — jurisprudence de la Cour de cassation (texte intégral)\n"
            "- judilibre.rechercher {\"mots_cles\": \"...\"} : décisions pertinentes (id, chambre, date, solution, extraits).\n"
            "- judilibre.consulter_decision {\"id\": \"...\"} : texte intégral d'une décision (id obtenu via la recherche)."
        ),
    },
    "pappers": {
        "executor": _tool_pappers,
        "spec": (
            "### pappers — fiche légale complète du débiteur (agrégateur RNE, BODACC, greffes)\n"
            "- pappers.fiche {\"siren\": \"9 chiffres\"} : dénomination, forme juridique, siège officiel, "
            "dirigeants, procédures collectives, cessation, comptes et actes déposés. "
            "Source d'identification fiable avant mise en demeure ou recommandé."
        ),
    },
    "bodacc": {
        "executor": _tool_bodacc,
        "spec": (
            "### bodacc — annonces commerciales officielles (BODACC)\n"
            "- bodacc.annonces {\"siren\": \"9 chiffres\"} : procédures collectives, radiations, ventes, "
            "modifications. Le champ 'alerte' signale une procédure collective ou radiation — à vérifier "
            "AVANT toute relance ou mise en demeure."
        ),
    },
    "justice_administrative": {
        "executor": _tool_justice_administrative,
        "spec": (
            "### justice_administrative — jurisprudence administrative (Conseil d'État, CAA, TA)\n"
            "- justice_administrative.rechercher {\"mots_cles\": \"...\"} : décisions du contentieux "
            "administratif (fiscal, URSSAF public, amendes administratives, recours contre l'administration).\n"
            "- justice_administrative.consulter_decision {\"id\": \"CETATEXT...\"} : texte intégral "
            "(id obtenu via la recherche).\n"
            "- justice_administrative.rechercher_ta {\"mots_cles\": \"...\"} : décisions des tribunaux "
            "administratifs (première instance, 24 derniers mois).\n"
            "- justice_administrative.consulter_decision_ta {\"id\": \"...\"} : texte intégral d'une "
            "décision TA (id obtenu via rechercher_ta)."
        ),
    },
    "service_public": {
        "executor": _tool_service_public,
        "spec": (
            "### service_public — fiches pratiques officielles (Service-Public / Entreprendre)\n"
            "- service_public.rechercher_fiche {\"mots_cles\": \"...\"} : démarches, procédures, "
            "contestations, délais, formulaires (fiches DILA officielles).\n"
            "- service_public.consulter_fiche {\"id\": \"F23211\"} : contenu d'une fiche "
            "(id obtenu via la recherche)."
        ),
    },
    "entreprises": {
        "executor": _tool_entreprises,
        "spec": (
            "### entreprises — annuaire officiel des entreprises françaises\n"
            "- entreprises.rechercher {\"recherche\": \"nom ou SIREN/SIRET\"} : identité, état administratif (active/cessée), siège, dirigeants."
        ),
    },
}


def _tools_system_block(apis: list[dict]) -> str:
    specs = [TOOL_APIS[a["name"]]["spec"] for a in apis if a.get("name") in TOOL_APIS]
    if not specs:
        return ""
    return (
        "\n\n[OUTILS DISPONIBLES]\n"
        "Tu peux interroger des APIs officielles avant de produire ta réponse.\n"
        "Pour appeler un outil, réponds UNIQUEMENT avec : "
        "{\"outil\": \"<api.action>\", \"params\": {...}} — rien d'autre.\n"
        "Un SEUL appel par réponse, puis arrête-toi : le résultat réel te sera "
        "renvoyé sous [RÉSULTAT OUTIL]. N'écris JAMAIS toi-même un bloc "
        "[RÉSULTAT OUTIL] ni un résultat imaginé. "
        f"Tu disposes d'au plus {TOOL_CALLS_MAX} appels ; ensuite, produis le JSON final demandé.\n"
        "N'invente jamais un contenu que l'outil peut vérifier.\n\n" + "\n\n".join(specs)
    )


def _first_json_object(text: str) -> dict | None:
    """Premier objet JSON complet du texte (équilibrage d'accolades), sinon None.
    Indispensable : le modèle ajoute parfois du texte ou des blocs hallucinés
    après son JSON — first-{ → last-} casserait le parsing."""
    start = text.find("{")
    while start >= 0:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(text)):
            c = text[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
            elif c == '"':
                in_str = True
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    with contextlib.suppress(Exception):
                        obj = json.loads(text[start:i + 1])
                        if isinstance(obj, dict):
                            return obj
                    break
        start = text.find("{", start + 1)
    return None


def _parse_tool_call(text: str) -> dict | None:
    """Repère {"outil": ..., "params": ...} en tête de réponse, sinon None."""
    obj = _first_json_object(text)
    if obj is not None and isinstance(obj.get("outil"), str):
        return obj
    return None


def _execute_tool_call(call: dict, apis_by_name: dict[str, dict]) -> dict:
    ref = call.get("outil", "")
    api_name, _, action = ref.partition(".")
    api = apis_by_name.get(api_name)
    if api is None or api_name not in TOOL_APIS:
        return {"erreur": f"outil non activé : {ref}"}
    params = call.get("params") if isinstance(call.get("params"), dict) else {}
    result = TOOL_APIS[api_name]["executor"](action, params, api.get("credentials") or {})
    text = json.dumps(result, ensure_ascii=False)
    if len(text) > TOOL_RESULT_MAX:
        return {"tronque": text[:TOOL_RESULT_MAX] + "… (tronqué)"}
    return result



class RunRequest(BaseModel):
    agent: str
    system: str
    input: str
    model: str | None = None
    skills: list[str] = []
    tool_apis: list[dict] = []
    timeout_s: int | None = None
    # Pièces à lire en VISION (PDF/image, base64). Quand non vide, on court-circuite
    # HermesCLI (texte) et on appelle OpenRouter en multimodal avec `model`.
    attachments: list[dict] = []


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

    apis = [a for a in req.tool_apis if isinstance(a, dict) and a.get("name") in TOOL_APIS]
    apis_by_name = {a["name"]: a for a in apis}
    system += _tools_system_block(apis)

    message = (
        f"{req.input}\n\n"
        "Réponds UNIQUEMENT avec le JSON demandé, sans aucun texte autour."
    )
    loop = asyncio.get_running_loop()
    t0 = time.perf_counter()
    total_in = total_out = 0
    total_cost = 0.0
    tool_trace: list[str] = []

    # Vision : pièces jointes → lecture multimodale directe (pas de boucle outil).
    if req.attachments:
        try:
            text, total_in, total_out, total_cost = await asyncio.wait_for(
                loop.run_in_executor(
                    None, _vision_chat, model, system, message, req.attachments
                ),
                timeout=req.timeout_s or CHAT_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise HTTPException(504, "délai vision dépassé")
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"vision: {exc}"[:300])
        return {
            "agent": agent,
            "model": model,
            "text": text,
            "input_tokens": total_in,
            "output_tokens": total_out,
            "cost": round(total_cost, 6),
            "tool_calls": [],
            "duration_ms": int((time.perf_counter() - t0) * 1000),
        }

    async with _locks[agent]:
        try:
            for _ in range(TOOL_CALLS_MAX + 1):
                text, tokens_in, tokens_out, cost = await asyncio.wait_for(
                    loop.run_in_executor(None, _chat_sync, agent, model, system, message),
                    timeout=req.timeout_s or CHAT_TIMEOUT,
                )
                total_in += tokens_in
                total_out += tokens_out
                total_cost += cost
                call = _parse_tool_call(text) if apis else None
                if call is None or len(tool_trace) >= TOOL_CALLS_MAX:
                    if apis:
                        final_obj = _first_json_object(text)
                        if final_obj is not None and "outil" not in final_obj:
                            text = json.dumps(final_obj, ensure_ascii=False)
                    break
                result = await loop.run_in_executor(None, _execute_tool_call, call, apis_by_name)
                tool_trace.append(call.get("outil", "?"))
                # Appels sans état : on reconstruit le message avec la transcription.
                message = (
                    f"{message}\n\n[TON APPEL OUTIL {len(tool_trace)}]\n"
                    f"{json.dumps(call, ensure_ascii=False)}\n"
                    f"[RÉSULTAT OUTIL {len(tool_trace)}]\n"
                    f"{json.dumps(result, ensure_ascii=False)[:TOOL_RESULT_MAX]}\n\n"
                    "Poursuis : appelle un autre outil si nécessaire, sinon réponds "
                    "maintenant UNIQUEMENT avec le JSON final demandé."
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
        "input_tokens": total_in,
        "output_tokens": total_out,
        # Coût estimé par Hermes (USD≈€). BLEME le lit via payload.cost et le
        # stocke tel quel ; s'il est 0/absent, BLEME retombe sur le tarif-liste.
        "cost": round(total_cost, 6),
        "tool_calls": tool_trace,
        "duration_ms": int((time.perf_counter() - t0) * 1000),
    }
