"""
rag_knowledge.py — Traffic Management Knowledge Base & RAG Engine
==================================================================
Smart Traffic Control & Decision Support System (Tamil Nadu Authority)

Provides legitimate, structured traffic engineering and regulatory SOPs:
  - Indian Road Congress (IRC) standards (IRC:SP:41, IRC:106, IRC:67)
  - Tamil Nadu Traffic Police & Highway Authority Standard Operating Procedures
  - Corridor clearance protocols (NH544, SH47, Salem-Namakkal-Erode-Coimbatore)
  - Congestion classification and diversion criteria

Used by the Agentic AI / Decision Agent to ground recommendations in real rules.
"""

from typing import List, Dict, Any, Optional
import re

# ──────────────────────────────────────────────────────────────────────────────
# Traffic Management Knowledge Base Entries
# ──────────────────────────────────────────────────────────────────────────────

TRAFFIC_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    {
        "id": "IRC-106-CAPACITY",
        "title": "IRC:106 Guidelines for Capacity of Urban Roads in Plain Areas",
        "authority": "Indian Roads Congress (IRC:106-1990)",
        "category": "capacity",
        "rules": [
            "A 4-lane divided urban arterial has a design service volume of 4,000–5,000 Passenger Car Units (PCU) per hour in both directions at Level of Service (LOS) C.",
            "When Volume-to-Capacity (V/C) ratio exceeds 0.80, flow becomes unstable with significant speed drop (speed < 20 km/h) and queue accumulation.",
            "At V/C > 0.90 (Congestion Score >= 0.75), authority diversion must be initiated at upstream junction nodes to prevent gridlock."
        ],
        "keywords": ["capacity", "v/c ratio", "urban arterial", "pcu", "level of service", "los", "saturation"]
    },
    {
        "id": "IRC-SP41-JUNCTION",
        "title": "IRC:SP:41 Guidelines for the Design of At-Grade Intersections",
        "authority": "Indian Roads Congress (IRC:SP:41-1994)",
        "category": "junction_management",
        "rules": [
            "At 4-arm major junctions, approach queue lengths exceeding 150 meters require dynamic signal split adjustments or physical traffic diversion.",
            "Right-turning heavy vehicles cause up to 2.5× the delay of straight-through passenger cars; prohibit right turns during peak congestion if alternate loop exists.",
            "Left-turn slip lanes must remain unblocked; deploy field traffic personnel when spillback obstructs free left turns."
        ],
        "keywords": ["intersection", "junction", "signal", "queue length", "right turn", "slip lane", "spillback"]
    },
    {
        "id": "TN-NH544-DIVERSION-SOP",
        "title": "Tamil Nadu Police NH544 / Urban Corridor Diversion Protocol",
        "authority": "Tamil Nadu Traffic Police & National Highways Authority of India (NHAI)",
        "category": "diversion_protocol",
        "rules": [
            "Salem–Erode–Coimbatore Corridor (NH544): When main junction approaches experience sustained congestion (score >= 0.70 for > 10 mins), divert multi-axle commercial trucks to the designated Ring Road / Bypass.",
            "Heavy vehicles bound for Namakkal / Trichy from Salem Junction must be routed via NH544 Bypass to avoid city arterial bottleneck.",
            "Field officers at upstream check-posts must be alerted 15 minutes prior to peak queue saturation to execute staging and diversion.",
            "Emergency vehicles (ambulances, fire tenders) require an immediate green-wave corridor on the central lane with all intersecting approaches held."
        ],
        "keywords": ["nh544", "salem", "erode", "namakkal", "bypass", "truck diversion", "ring road", "heavy vehicles"]
    },
    {
        "id": "SOP-CONGESTION-ESCALATION",
        "title": "Standard Operating Procedure for Congestion Escalation & Incident Response",
        "authority": "Urban Traffic Management Centre (UTMC) Standard Guidelines",
        "category": "escalation",
        "rules": [
            "FREE FLOW (Score < 0.30, Speed > 40 km/h): Normal automated surveillance; no operator intervention needed.",
            "MODERATE (Score 0.30–0.60, Speed 25–40 km/h): Advisory alert to control room; monitor queue build-up on approach.",
            "HEAVY (Score 0.60–0.80, Speed 12–25 km/h): Generate AI diversion recommendation; alert field officer via mobile app.",
            "CRITICAL (Score >= 0.80, Speed < 12 km/h): Mandatory diversion dispatch; field officer override and upstream hold required."
        ],
        "keywords": ["escalation", "free flow", "moderate", "heavy", "critical", "threshold", "alert", "speed"]
    },
    {
        "id": "SOP-INCIDENT-MANAGEMENT",
        "title": "Road Obstruction & Manual Incident Protocol",
        "authority": "Highway Traffic Safety & Incident Response Code",
        "category": "incident",
        "rules": [
            "In the event of a stationary breakdown, lane blockage, or reported obstruction, immediately mark the affected approach as restricted.",
            "Downstream capacity is reduced by 60% for a single-lane blockage on a dual-lane carriageway due to merging friction.",
            "Divert incoming approach traffic at the preceding junction to alternate parallel collectors."
        ],
        "keywords": ["obstruction", "breakdown", "incident", "lane blockage", "stationary", "downstream"]
    }
]

# ──────────────────────────────────────────────────────────────────────────────
# RAG Retrieval Engine
# ──────────────────────────────────────────────────────────────────────────────

class TrafficRAGEngine:
    """
    Lightweight, deterministic RAG retrieval engine for traffic management knowledge.
    Matches observed traffic conditions, congestion levels, and locations to official SOPs.
    """

    def __init__(self, knowledge_base: Optional[List[Dict[str, Any]]] = None):
        self.kb = knowledge_base or TRAFFIC_KNOWLEDGE_BASE

    def retrieve_guidance(
        self,
        query: str,
        congestion_score: float = 0.0,
        approach: Optional[str] = None,
        top_k: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant SOPs and regulatory rules based on query and context.
        """
        query_tokens = set(re.findall(r'\w+', query.lower()))
        if approach:
            query_tokens.update(re.findall(r'\w+', approach.lower()))

        scored_entries = []
        for entry in self.kb:
            score = 0.0
            # Keyword matching
            for kw in entry["keywords"]:
                if kw in query.lower() or any(kw in token for token in query_tokens):
                    score += 2.0
                for token in query_tokens:
                    if token in kw:
                        score += 1.0

            # Context boost based on congestion score
            if congestion_score >= 0.80 and entry["category"] in ["diversion_protocol", "escalation"]:
                score += 3.0
            elif congestion_score >= 0.60 and entry["category"] in ["capacity", "junction_management"]:
                score += 2.0

            if score > 0:
                scored_entries.append((score, entry))

        scored_entries.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in scored_entries[:top_k]]

    def get_policy_context(
        self,
        congestion_score: float,
        level: str,
        approach_name: str,
        vehicle_count: int,
        avg_speed: float
    ) -> Dict[str, Any]:
        """
        Generate a structured policy grounding block for an AI recommendation.
        """
        query = f"congestion {level} {approach_name} speed {avg_speed} traffic flow"
        guidelines = self.retrieve_guidance(query, congestion_score=congestion_score, approach=approach_name, top_k=2)

        citations = []
        applicable_rules = []

        for g in guidelines:
            citations.append({
                "id": g["id"],
                "authority": g["authority"],
                "title": g["title"],
            })
            applicable_rules.extend(g["rules"][:2])

        return {
            "applicable_rules": applicable_rules,
            "citations": citations,
            "threshold_exceeded": congestion_score >= 0.60,
            "action_mandated": "DIVERSION" if congestion_score >= 0.75 else ("MONITOR" if congestion_score >= 0.50 else "NORMAL_FLOW")
        }


# Global singleton instance
rag_engine = TrafficRAGEngine()
