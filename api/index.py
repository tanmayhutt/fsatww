"""Vercel entry point. Vercel turns this file into a serverless function and
routes /api/* to it (see vercel.json). The FastAPI app is unchanged."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401
