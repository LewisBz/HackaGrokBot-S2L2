"""LLM extract via Google Gemini (free tier). Fallback: xAI if set."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from nlp.extractor import PLACES

_ENV_LOADED = False


def _load_dotenv() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    for candidate in (
        Path.cwd() / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def _place_names() -> list[str]:
    return [canonical for canonical, _aliases in PLACES]


def _parse_json_content(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:].strip()
    return json.loads(content)


def _normalize(parsed: dict) -> dict:
    allowed = set(_place_names())
    origen = parsed.get("origen")
    destino = parsed.get("destino")
    restriccion = parsed.get("restriccion")
    if origen not in allowed:
        origen = None
    if destino not in allowed:
        destino = None
    if restriccion is not None and not isinstance(restriccion, str):
        restriccion = None
    return {"origen": origen, "destino": destino, "restriccion": restriccion}


def _system_prompt() -> str:
    places = ", ".join(_place_names())
    return (
        "Eres el NLP de una app de buses en Barranquilla. "
        "Extrae origen, destino y restriccion del mensaje. "
        "Responde SOLO JSON: "
        '{"origen": string|null, "destino": string|null, "restriccion": string|null}. '
        "origen y destino DEBEN ser exactamente uno de estos nodos (o null): "
        f"{places}. "
        "REGLAS DE ORDEN (criticas): "
        "'desde X', 'salgo de X', 'saliendo de X', 'vengo de X' => origen=X. "
        "'a Y', 'al Y', 'para Y', 'pa Y', 'llegar a Y', 'ir a Y', 'llevame a Y' => destino=Y. "
        "Ejemplo: 'llevame pa Soledad desde Riomar' => origen=Riomar, destino=Soledad. "
        "Ejemplo: 'a la playa saliendo de la arenosa' => origen=La Arenosa, destino=Playa. "
        "Slang: uni=Uninorte, estadio=Estadio Metropolitano, arenosa=La Arenosa, "
        "joe=Joe Arroyo, terminal=Terminal de Transportes. "
        "Si solo hay un lugar, destino=ese lugar."
    )


def _extract_gemini(mensaje: str, api_key: str) -> dict | None:
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": _system_prompt()}]},
        "contents": [
            {
                "role": "user",
                "parts": [{"text": mensaje}],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return _normalize(_parse_json_content(content))
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        KeyError,
        IndexError,
        json.JSONDecodeError,
        OSError,
        TypeError,
    ):
        return None


def _extract_xai(mensaje: str, api_key: str) -> dict | None:
    payload = {
        "model": os.environ.get("XAI_MODEL", "grok-4-fast"),
        "temperature": 0,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": mensaje},
        ],
    }
    req = urllib.request.Request(
        "https://api.x.ai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return _normalize(_parse_json_content(content))
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        KeyError,
        IndexError,
        json.JSONDecodeError,
        OSError,
        TypeError,
    ):
        return None


def extract_with_ai(mensaje: str) -> dict | None:
    """Prefer Gemini; optional xAI fallback."""
    _load_dotenv()
    gemini = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini:
        hit = _extract_gemini(mensaje, gemini)
        if hit is not None:
            return hit
    xai = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY")
    if xai:
        return _extract_xai(mensaje, xai)
    return None
