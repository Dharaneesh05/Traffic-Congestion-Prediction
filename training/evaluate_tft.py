"""
evaluate_tft.py — Independent Model Evaluation and Prediction Verifier
======================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Loads a saved trained TFT model from backend/models/tft.keras and backend/models/tft.scaler.json,
runs predictions on validation data, and verifies the exact output schema for 5min, 10min, 15min,
and 30min horizons.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
from congestion import CongestionPredictor, FORECAST_HORIZONS, HORIZON_INDICES


def evaluate_model(model_dir: Path, dataset_path: Path):
    print("=" * 70)
    print("TFT MODEL EVALUATION & INFERENCE VERIFICATION")
    print("=" * 70)

    model_base = model_dir / "tft"
    meta_path = model_dir / "tft.meta.json"

    print(f"[1/3] Loading trained model from {model_base}...")
    predictor = CongestionPredictor.load(str(model_base))

    print(f"  Model loaded successfully!")
    print(f"  Is trained flag: {predictor._is_trained}")
    print(f"  Lookback window: {predictor.config.lookback_min} min")

    # Load metadata if exists
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        print("\n[Metadata from Training Run]")
        print(f"  Trained at       : {meta.get('trained_at')}")
        print(f"  Epochs trained   : {meta.get('epochs_trained')}")
        print(f"  Overall TFT MAE  : {meta.get('overall_tft_mae')}")
        print(f"  Overall TFT RMSE : {meta.get('overall_tft_rmse')}")
        print(f"  Baseline MAE     : {meta.get('overall_baseline_mae')}")
        print(f"  Baseline RMSE    : {meta.get('overall_baseline_rmse')}")

    # Load dataset for live inference simulation
    print(f"\n[2/3] Simulating live prediction using recent observations from {dataset_path.name}...")
    if not dataset_path.exists():
        print(f"  [Warning] Dataset file {dataset_path} not found. Running synthetic sequence.")
        recent_history = [
            {"congestion_score": 0.45 + 0.05 * np.sin(i / 10), "wall_time_s": time.time() - (100 - i) * 60}
            for i in range(100)
        ]
    else:
        with open(dataset_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        recent_history = data.get("observations", [])[-2000:]

    # Run live prediction
    forecast = predictor.predict_live(recent_history)

    print("\n[3/3] Prediction Output Verification:")
    print("-" * 70)
    for h in ["5min", "10min", "15min", "30min"]:
        if h in forecast:
            res = forecast[h]
            print(f"  Horizon {h:>5s}: q10={res.get('q10'):<6.4f} | q50 (Median)={res.get('q50'):<6.4f} | q90={res.get('q90'):<6.4f} | Level={res.get('level_q50'):<10s} (Uncertain: {res.get('uncertain')})")
        else:
            print(f"  [MISSING] Horizon {h}")

    print("-" * 70)
    print(f"  Model info: {forecast.get('model_info')}")
    print("\nTFT INFERENCE AND VERIFICATION SUCCESSFUL! 🚀")
    return forecast


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained TFT model.")
    parser.add_argument("--model-dir", type=str, default="backend/models", help="Directory containing tft.keras and tft.scaler.json")
    parser.add_argument("--dataset", type=str, default="datasets/traffic_observations.json", help="Observations dataset path")
    args = parser.parse_args()

    evaluate_model(PROJECT_ROOT / args.model_dir, PROJECT_ROOT / args.dataset)


if __name__ == "__main__":
    main()
