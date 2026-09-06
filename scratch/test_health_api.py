"""
test_health_api.py — Verify GET /api/health Endpoint
"""
import sys
import os
import asyncio

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import initialize_backend, health_check

print("Initializing backend components...")
initialize_backend()

print("Testing health_check() function...")
res = asyncio.run(health_check())
print("Health API Response Body:")
print(res)

assert "status" in res
assert "detector" in res
assert "tracker" in res
assert "route_engine" in res
assert "database" in res
assert "redis" in res
assert res["detector"] is True
assert res["tracker"] is True
assert res["database"] is True

print("\nHEALTH API TEST PASSED SUCCESSFULLY!")
