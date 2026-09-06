"""
redis_client.py — Redis Live Traffic State Cache Handler
========================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Manages connection to Redis for storing and retrieving high-frequency live
traffic observations per camera: key format `traffic:camera:{camera_id}`.

Includes resilient fallback to an in-memory dictionary cache if Redis is unavailable.
"""

import json
import os
import sys
import time
from typing import Dict, Optional, Any

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class RedisClient:
    """
    Thread-safe Redis client for caching live camera traffic states.
    Automatically falls back to an in-memory dictionary if Redis is offline.
    """

    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis = None
        self.is_connected = False
        self._memory_cache: Dict[str, dict] = {}
        self._connect_attempted = False
        self._init_redis()

    def _init_redis(self):
        self._connect_attempted = True
        try:
            import redis
            print(f"[Redis] Connecting to Redis at: {self.redis_url}")
            r = redis.Redis.from_url(self.redis_url, socket_timeout=1.5, socket_connect_timeout=1.5, decode_responses=True)
            r.ping()
            self.redis = r
            self.is_connected = True
            print("[Redis] Connected successfully to Redis server.")
        except Exception as e:
            print(f"[Redis] Connection unavailable ({e}). Using in-memory fallback cache.")
            self.is_connected = False
            self.redis = None

    def health_check(self) -> bool:
        """Check if Redis server is reachable."""
        if not self.is_connected or self.redis is None:
            return False
        try:
            return bool(self.redis.ping())
        except Exception:
            self.is_connected = False
            return False

    def set_camera_state(self, camera_id: str, data: dict, ttl: int = 60) -> bool:
        """
        Store live traffic observation for a camera under key `traffic:camera:{camera_id}`.
        Expected data schema:
        {
          "status": "online",
          "vehicles": int,
          "cars": int,
          "trucks": int,
          "buses": int,
          "bikes": int,
          "congestion": int,
          "speed": float,
          "timestamp": str (ISO 8601)
        }
        """
        key = f"traffic:camera:{camera_id}"
        # Always update memory cache as fallback
        self._memory_cache[camera_id] = data

        if self.is_connected and self.redis is not None:
            try:
                payload = json.dumps(data)
                self.redis.set(key, payload, ex=ttl)
                return True
            except Exception as e:
                # Log error and temporarily fallback to memory cache
                self.is_connected = False
                return False
        return True

    def get_camera_state(self, camera_id: str) -> Optional[dict]:
        """Fetch live traffic observation for a camera from Redis or fallback memory cache."""
        key = f"traffic:camera:{camera_id}"
        if self.is_connected and self.redis is not None:
            try:
                raw = self.redis.get(key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                self.is_connected = False

        # Fallback to memory cache
        return self._memory_cache.get(camera_id)

    def get_all_camera_states(self) -> Dict[str, dict]:
        """Fetch all active camera live traffic states."""
        results = dict(self._memory_cache)
        if self.is_connected and self.redis is not None:
            try:
                keys = self.redis.keys("traffic:camera:*")
                for key in keys:
                    cam_id = key.replace("traffic:camera:", "")
                    raw = self.redis.get(key)
                    if raw:
                        results[cam_id] = json.loads(raw)
            except Exception:
                self.is_connected = False
        return results


# Global singleton client instance
redis_client = RedisClient()
