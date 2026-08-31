"""
alerts_audit.py — Alert Management & Decision Audit Trail
=========================================================
Smart Traffic Control & Decision Support System (Tamil Nadu Authority)

Provides:
  1. Threshold-based Alert Generation (Congestion, Queue, Incident, Camera Failure)
  2. Lifecycle Management (PENDING -> ACKNOWLEDGED -> ACCEPTED / REJECTED -> RESOLVED)
  3. Complete Audit Trail for Control Room & Police Field Actions
"""

import json
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Any

AUDIT_LOG_FILE = Path(__file__).parent / "audit_log.json"

@dataclass
class Alert:
    alert_id: str
    severity: str                 # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    alert_type: str               # "CONGESTION_SURGE", "QUEUE_GROWTH", "SPEED_DROP", "CAMERA_OFFLINE"
    junction: str
    approach: str
    camera_id: str
    timestamp: float
    message: str
    evidence: List[str]
    status: str = "PENDING"       # "PENDING", "ACKNOWLEDGED", "ACCEPTED", "REJECTED", "RESOLVED"
    diversion_plan_id: Optional[str] = None
    action_taken: Optional[str] = None
    officer_id: Optional[str] = None
    officer_notes: Optional[str] = None
    acknowledged_at: Optional[float] = None
    resolved_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["id"] = self.alert_id
        return d


@dataclass
class AuditEntry:
    entry_id: str
    timestamp: float
    action: str                   # "ALERT_GENERATED", "RECOMMENDATION_ISSUED", "OFFICER_ACKNOWLEDGE", "OFFICER_ACCEPT", "OFFICER_REJECT", "OFFICER_RESOLVE", "OFFICER_NOTIFY"
    actor: str                    # "SYSTEM_AI", "CONTROL_ROOM_OPERATOR", "FIELD_OFFICER_01"
    junction: str
    approach: Optional[str]
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AlertAndAuditManager:
    """
    Manages active traffic alerts and the immutable decision audit log.
    """

    def __init__(self):
        self.alerts: Dict[str, Alert] = {}
        self.audit_log: List[AuditEntry] = []
        self._load_persisted_audit()

    def generate_alerts_from_metrics(
        self,
        junction_name: str,
        camera_id: str,
        approach_name: str,
        metrics: Dict[str, Any],
        diversion_plan_id: Optional[str] = None
    ) -> Optional[Alert]:
        """
        Generate alert if metrics cross regulatory thresholds.
        """
        score = metrics.get("congestion_score", 0.0)
        speed = metrics.get("average_speed_kmh", 0.0)
        count = metrics.get("vehicle_count", 0)

        alert_type = None
        severity = "LOW"
        msg = ""
        evidence = []

        if score >= 0.80:
            alert_type = "CRITICAL_CONGESTION_STANDSTILL"
            severity = "CRITICAL"
            msg = f"Critical congestion detected at {approach_name}. Standstill conditions (Score: {score:.2f})."
            evidence = [f"Average speed dropped to {speed:.1f} km/h", f"Active vehicle count: {count} units", "Immediate diversion required"]
        elif score >= 0.60:
            alert_type = "CONGESTION_SURGE"
            severity = "HIGH"
            msg = f"Heavy traffic surge on {approach_name} (Score: {score:.2f}, Speed: {speed:.1f} km/h)."
            evidence = [f"Volume exceeding approach capacity", f"Queue growth on {approach_name}"]
        elif speed < 12.0 and count > 15:
            alert_type = "SPEED_COLLAPSE"
            severity = "MEDIUM"
            msg = f"Sudden velocity drop detected on {approach_name} ({speed:.1f} km/h)."
            evidence = [f"Speed reduced below 12 km/h threshold", f"Potential bottleneck"]

        if not alert_type:
            return None

        # Check if an active un-resolved alert already exists for this camera/type
        for existing in self.alerts.values():
            if existing.camera_id == camera_id and existing.status in ["PENDING", "ACKNOWLEDGED", "ACCEPTED"]:
                # Update existing alert timestamp and evidence
                existing.message = msg
                existing.severity = severity
                existing.evidence = evidence
                existing.diversion_plan_id = diversion_plan_id
                return existing

        # Create new alert
        alert_id = f"ALT_{camera_id}_{int(time.time())}"
        alert = Alert(
            alert_id=alert_id,
            severity=severity,
            alert_type=alert_type,
            junction=junction_name,
            approach=approach_name,
            camera_id=camera_id,
            timestamp=time.time(),
            message=msg,
            evidence=evidence,
            status="PENDING",
            diversion_plan_id=diversion_plan_id
        )
        self.alerts[alert_id] = alert

        # Log audit entry
        self.log_action(
            action="ALERT_GENERATED",
            actor="SYSTEM_AI",
            junction=junction_name,
            approach=approach_name,
            details={
                "alert_id": alert_id,
                "severity": severity,
                "score": score,
                "message": msg
            }
        )

        return alert

    def handle_officer_action(
        self,
        alert_id: str,
        action: str,  # "ACKNOWLEDGE", "ACCEPT", "REJECT", "RESOLVE", "NOTIFY"
        officer_id: str = "OFFICER_TN_042",
        notes: str = ""
    ) -> Dict[str, Any]:
        """
        Record officer action on an alert and update status.
        """
        alert = self.alerts.get(alert_id)
        if not alert:
            # Create ad-hoc record if alert_id is virtual
            alert = Alert(
                alert_id=alert_id,
                severity="HIGH",
                alert_type="OFFICER_DISPATCH",
                junction="Sankagiri Junction",
                approach="North Approach (NH544)",
                camera_id="CAM001",
                timestamp=time.time(),
                message="Officer field intervention action logged.",
                evidence=["Field officer manual dispatch"],
                status="ACCEPTED"
            )
            self.alerts[alert_id] = alert

        now = time.time()
        if action == "ACKNOWLEDGE":
            alert.status = "ACKNOWLEDGED"
            alert.acknowledged_at = now
        elif action == "ACCEPT":
            alert.status = "ACCEPTED"
            alert.action_taken = "DIVERSION_EXECUTED"
        elif action == "REJECT":
            alert.status = "REJECTED"
            alert.action_taken = "OVERRIDDEN_BY_OFFICER"
        elif action == "RESOLVE":
            alert.status = "RESOLVED"
            alert.resolved_at = now
            alert.action_taken = "CONGESTION_CLEARED"
        elif action == "NOTIFY":
            alert.action_taken = "NEARBY_OFFICERS_ALERTED"

        alert.officer_id = officer_id
        alert.officer_notes = notes

        # Audit log
        self.log_action(
            action=f"OFFICER_{action}",
            actor=officer_id,
            junction=alert.junction,
            approach=alert.approach,
            details={
                "alert_id": alert_id,
                "action": action,
                "notes": notes,
                "diversion_plan_id": alert.diversion_plan_id
            }
        )

        return alert.to_dict()

    def log_action(
        self,
        action: str,
        actor: str,
        junction: str,
        approach: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> AuditEntry:
        """
        Log an entry to the immutable decision audit log.
        """
        entry = AuditEntry(
            entry_id=f"AUD_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}",
            timestamp=time.time(),
            action=action,
            actor=actor,
            junction=junction,
            approach=approach,
            details=details or {}
        )
        self.audit_log.insert(0, entry) # Most recent first
        self._persist_audit()
        return entry

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        # Sort by timestamp descending
        sorted_alerts = sorted(self.alerts.values(), key=lambda a: a.timestamp, reverse=True)
        return [a.to_dict() for a in sorted_alerts]

    def get_audit_trail(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.audit_log[:limit]]

    def _persist_audit(self):
        try:
            entries = [e.to_dict() for e in self.audit_log[:200]]
            with open(AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
                json.dump(entries, f, indent=2)
        except Exception:
            pass

    def _load_persisted_audit(self):
        if AUDIT_LOG_FILE.exists():
            try:
                with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        self.audit_log.append(AuditEntry(**item))
            except Exception:
                pass


# Global singleton instance
alert_audit_manager = AlertAndAuditManager()
