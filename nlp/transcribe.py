"""Speech-to-text with local faster-whisper (Whisper)."""
from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path

_model = None
_lock = threading.Lock()
_MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")


def _get_model():
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        from faster_whisper import WhisperModel

        _model = WhisperModel(_MODEL_NAME, device=_DEVICE, compute_type=_COMPUTE)
        return _model


def transcribe_bytes(data: bytes, *, language: str = "es", suffix: str = ".webm") -> str:
    """Transcribe raw audio bytes. Returns trimmed text (may be empty)."""
    if not data:
        return ""
    suf = suffix if suffix.startswith(".") else f".{suffix}"
    path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suf, delete=False) as tmp:
            tmp.write(data)
            path = tmp.name
        model = _get_model()
        segments, _info = model.transcribe(
            path,
            language=language or "es",
            vad_filter=True,
            beam_size=1,
        )
        text = " ".join(seg.text.strip() for seg in segments if seg.text).strip()
        return text
    finally:
        if path:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass


def warmup() -> None:
    """Load model eagerly (optional)."""
    _get_model()
