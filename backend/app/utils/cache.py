import hashlib
import json
from typing import Any, Optional

_cache: dict[str, Any] = {}


def make_cache_key(data: Any) -> str:
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()


def get_cached(key: str) -> Optional[Any]:
    return _cache.get(key)


def set_cached(key: str, value: Any) -> None:
    _cache[key] = value


def clear_cache() -> None:
    _cache.clear()


def cache_size() -> int:
    return len(_cache)
