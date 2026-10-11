"""Settings from environment variables (see .env.example).

A local .env file is read if present; real environment variables win.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

_env_file = ROOT / '.env'
if _env_file.exists():
    for _line in _env_file.read_text(encoding='utf-8').splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _name, _value = _line.split('=', 1)
            os.environ.setdefault(_name.strip(), _value.strip().strip('"\''))

API_KEY = os.environ.get('API_KEY', '').strip()
ALLOWED_ORIGINS = [
    origin.strip().rstrip('/')
    for origin in os.environ.get('ALLOWED_ORIGINS', '*').split(',')
    if origin.strip()
] or ['*']
UI_API_BASE_URL = os.environ.get('UI_API_BASE_URL', '').strip().rstrip('/')
UI_API_KEY = os.environ.get('UI_API_KEY', '').strip() or API_KEY
