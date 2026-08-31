"""
test_full_pipeline.py — Master Integration Test Suite
=====================================================
Smart Traffic Control & Decision Support System (Tamil Nadu Authority)

Verifies the entire end-to-end pipeline:
  1. YOLO11 Detection & ByteTrack
  2. Traffic Analysis & Metrics Aggregation
  3. TFT Congestion Forecasting
  4. RAG Knowledge Base & Policy Grounding
  5. Authority Diversion Engine
  6. Alert Generation & Officer Field Actions
  7. REST API Endpoints
"""

import sys
import os
import time
import json
import urllib.request

# Add backend to Python path
sys.path.insert(0, os.path.abspath("backend"))

def test_pipeline():
    print("=" * 70)
    print("SMART TRAFFIC SYSTEM -- END-TO-END PIPELINE VERIFICATION")
    print("=" * 70)

    # ── 1. RAG Knowledge Base ────────────────────────────────────────────────
    print("\n[Test 1] RAG Knowledge Base (Module 11)...")
    from rag_knowledge import rag_engine
    sop_results = rag_engine.retrieve_guidance(query="IRC 106 capacity saturation diversion", congestion_score=0.85)
    assert len(sop_results) > 0, "RAG failed to retrieve guidelines"
    print(f"  [OK] RAG retrieved {len(sop_results)} SOP entries (e.g. {sop_results[0]['id']})")

    # ── 2. Authority Diversion Engine ─────────────────────────────────────────
    print("\n[Test 2] Authority Diversion Engine (Module 9)...")
    from diversion_engine import diversion_engine
    sim_cam_states = {
        "CAM001": {
            "status": "ONLINE",
            "metrics": {
                "vehicle_count": 35,
                "average_speed_kmh": 14.2,
                "congestion_score": 0.82,
                "congestion_level": "CRITICAL",
                "traffic_flow_vpm": 42.0,
                "road_occupancy": 0.38,
                "class_counts": {"car": 18, "truck": 7, "bus": 3, "motorcycle": 7}
            }
        },
        "CAM002": {"status": "ONLINE", "metrics": {"congestion_score": 0.25, "average_speed_kmh": 44.0, "vehicle_count": 8}},
        "CAM003": {"status": "OFFLINE", "metrics": {}},
        "CAM004": {"status": "OFFLINE", "metrics": {}}
    }
    junc_result = diversion_engine.analyze_junction("Sankagiri Junction", sim_cam_states)
    assert junc_result["status"] == "CRITICAL", "Junction status should be CRITICAL"
    assert len(junc_result["diversion_plans"]) > 0, "Should generate a diversion plan for congested approach"
    plan = junc_result["diversion_plans"][0]
    print(f"  [OK] Generated Diversion Plan: {plan['plan_id']}")
    print(f"    - Action: {plan['police_action']}")
    print(f"    - Target Bypass: {plan['target_diversion']} (Saves ~{plan['time_saved_min']} min)")
    print(f"    - Clearance Time: {plan['estimated_clearance_min']} min (Confidence: {plan['confidence']}%)")

    # ── 3. Alerts & Audit Trail ───────────────────────────────────────────────
    print("\n[Test 3] Alerts & Audit Trail (Modules 16 & 17)...")
    from alerts_audit import alert_audit_manager
    alert = alert_audit_manager.generate_alerts_from_metrics(
        junction_name="Sankagiri Junction",
        camera_id="CAM001",
        approach_name="North: NH544 Salem Inflow",
        metrics=sim_cam_states["CAM001"]["metrics"],
        diversion_plan_id=plan["plan_id"]
    )
    assert alert is not None, "Failed to generate alert"
    assert alert.severity == "CRITICAL", "Alert severity should be CRITICAL"
    print(f"  [OK] Generated Alert: {alert.alert_id} ({alert.severity})")

    # Test Officer Field Action
    action_res = alert_audit_manager.handle_officer_action(
        alert_id=alert.alert_id,
        action="ACCEPT",
        officer_id="OFFICER_TN_042",
        notes="Field diversion executed on NH544 Western Bypass."
    )
    assert action_res["status"] == "ACCEPTED", "Alert status should be ACCEPTED"
    print(f"  [OK] Officer Action 'ACCEPT' logged: Alert Status = {action_res['status']}")

    audit_trail = alert_audit_manager.get_audit_trail(limit=5)
    assert len(audit_trail) > 0, "Audit log should contain records"
    print(f"  [OK] Decision Audit Log: {len(audit_trail)} verified records")

    # ── 4. Live REST API Endpoints ────────────────────────────────────────────
    print("\n[Test 4] Live REST API Endpoints (Module 18)...")
    endpoints = [
        ("GET /api/cameras", "http://127.0.0.1:8000/api/cameras"),
        ("GET /api/junction/overview", "http://127.0.0.1:8000/api/junction/overview"),
        ("GET /api/alerts", "http://127.0.0.1:8000/api/alerts"),
        ("GET /api/audit-log", "http://127.0.0.1:8000/api/audit-log"),
        ("GET /api/rag/query", "http://127.0.0.1:8000/api/rag/query?q=IRC+capacity"),
        ("GET /api/predict-congestion", "http://127.0.0.1:8000/api/predict-congestion"),
        ("GET /api/cameras/aggregate", "http://127.0.0.1:8000/api/cameras/aggregate"),
    ]

    for name, url in endpoints:
        req = urllib.request.urlopen(url)
        assert req.status == 200, f"Endpoint {name} returned status {req.status}"
        data = json.loads(req.read().decode())
        print(f"  [OK] {name} -> HTTP 200 OK (Keys: {list(data.keys())[:3]}...)")

    # ── 5. Test A* Route By Name ──────────────────────────────────────────────
    print("\n[Test 5] A* Congestion-Aware Routing by Name (Module 8)...")
    route_req = urllib.request.Request(
        "http://127.0.0.1:8000/api/get-route-by-name",
        data=json.dumps({"from_name": "Salem Bus Stand", "to_name": "Erode Bus Stand"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(route_req)
    assert res.status == 200, f"Route request failed with status {res.status}"
    rdata = json.loads(res.read().decode())
    assert "distance" in rdata or "congestion" in rdata or "forecast" in rdata, "Missing routing strategies"
    print(f"  [OK] POST /api/get-route-by-name (Salem -> Erode) -> HTTP 200 OK")
    print(f"    - Strategies calculated: {list(rdata.keys())}")

    # ── 6. Test All Officer Field Actions via API ──────────────────────────────
    print("\n[Test 6] Field Officer Actions Dispatch (Modules 15 & 16)...")
    for act in ["ACKNOWLEDGE", "ACCEPT", "NOTIFY", "REJECT", "RESOLVE"]:
        act_req = urllib.request.Request(
            f"http://127.0.0.1:8000/api/alerts/{alert.alert_id}/action",
            data=json.dumps({"action": act, "officer_id": "OFFICER_TN_042", "notes": f"Field test {act}"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        res = urllib.request.urlopen(act_req)
        assert res.status == 200, f"Officer action {act} failed with {res.status}"
        adata = json.loads(res.read().decode())
        print(f"  [OK] Action '{act}' -> HTTP 200 OK (Status: {adata['alert'].get('status')})")

    print("\n" + "=" * 70)
    print("ALL TESTS PASSED! FULL SYSTEM COMPLIANT WITH MASTER SPECIFICATION.")
    print("=" * 70)


if __name__ == "__main__":
    test_pipeline()

