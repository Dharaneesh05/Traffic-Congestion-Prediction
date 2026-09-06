"""
train_tft.py — Temporal Fusion Transformer (TFT) Training & Validation Suite
=============================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Trains the multi-horizon Temporal Fusion Transformer on authentic traffic observations
produced by the YOLO11 + ByteTrack + TrafficAnalyser telemetry pipeline.

Pipeline:
  1. Load real traffic observation dataset (datasets/traffic_observations.json).
  2. Chronological Train / Val / Test split (70% / 15% / 15% — strictly no future leakage).
  3. Preprocess and fit MinMax normalisation on training split only.
  4. Train TFT model with Pinball Quantile Loss [0.10, 0.50, 0.90] and Early Stopping.
  5. Compute MAE & RMSE on held-out test split for 5min, 10min, 15min, and 30min horizons.
  6. Benchmark against moving-average baseline predictor.
  7. Save trained model to backend/models/tft.keras, scaler to backend/models/tft.scaler.json,
     and metadata to backend/models/tft.meta.json.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any

# Ensure backend directory is in sys.path
PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np

# Internal modules
from congestion import (
    CongestionPredictor,
    TFTConfig,
    DataPreprocessor,
    FORECAST_HORIZONS,
    HORIZON_INDICES,
    HORIZON_MAX,
    QUANTILES,
    ENCODER_FEATURES,
    TIME_FEATURES,
    OBSERVED_FEATURES,
    _build_tft_model,
    _quantile_loss,
)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculate MAE and RMSE between ground truth and predictions."""
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    return {"mae": round(mae, 4), "rmse": round(rmse, 4)}


def run_training(
    dataset_path: Path,
    model_output_dir: Path,
    epochs: int = 50,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    lookback_min: int = 60,
    hidden_units: int = 64,
    num_heads: int = 4,
    lstm_units: int = 64,
    dropout_rate: float = 0.1,
) -> Dict[str, Any]:
    """
    Execute full TFT training and evaluation workflow.
    """
    print("=" * 75)
    print("TEMPORAL FUSION TRANSFORMER (TFT) TRAFFIC FORECASTING TRAINING")
    print("=" * 75)

    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Traffic observations dataset not found at: {dataset_path}\n"
            f"Please run 'python training/collect_traffic_data.py' first to collect real traffic telemetry."
        )

    print(f"\n[1/5] Loading traffic observations from {dataset_path.name}...")
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    observations = data.get("observations", [])
    if not observations:
        raise ValueError("Dataset is empty. Run data collection first.")

    print(f"  Loaded {len(observations)} total frame observations.")

    # Configure TFT Hyperparameters
    config = TFTConfig(
        lookback_min=lookback_min,
        hidden_units=hidden_units,
        num_heads=num_heads,
        lstm_units=lstm_units,
        dropout_rate=dropout_rate,
        learning_rate=learning_rate,
        batch_size=batch_size,
        val_split=0.15,
        test_split=0.15,
        min_train_min=50,  # Ensure training runs on collected sessions
    )

    preprocessor = DataPreprocessor(config)

    # ── Step 2: Data Preprocessing & Sequential Windowing ────────────────────
    print("\n[2/5] Preprocessing and creating sliding-window sequences...")
    minute_records = preprocessor.aggregate_to_minutes(observations)
    minute_records = DataPreprocessor.encode_time_features(minute_records)
    print(f"  Aggregated {len(observations)} frames into {len(minute_records)} time-step records.")

    n_records = len(minute_records)
    req_steps = config.lookback_min + HORIZON_MAX
    if n_records < req_steps:
        raise ValueError(
            f"Dataset has {n_records} time steps, but at least {req_steps} steps "
            f"(lookback={config.lookback_min} + horizon={HORIZON_MAX}) are required."
        )

    (X_tr, D_tr, y_tr), (X_v, D_v, y_v), (X_te, D_te, y_te) = preprocessor.fit_transform(minute_records)

    print(f"  Train sequences : {X_tr.shape[0]} (Input: {X_tr.shape}, Decoder: {D_tr.shape})")
    print(f"  Val sequences   : {X_v.shape[0]}")
    print(f"  Test sequences  : {X_te.shape[0]}")

    # ── Step 3: Build & Compile Model ─────────────────────────────────────────
    print("\n[3/5] Building Temporal Fusion Transformer Architecture...")
    import tensorflow as tf

    model = _build_tft_model(config)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(
            learning_rate=config.learning_rate,
            clipnorm=1.0,
        ),
        loss=_quantile_loss(QUANTILES),
    )
    total_params = model.count_params()
    print(f"  TFT Model compiled successfully ({total_params:,} parameters).")
    print(f"  Quantiles: {QUANTILES} | Lookback: {config.lookback_min} | Horizon: {HORIZON_MAX}")

    # Pre-flight forward-pass shape validation with real training tensors
    test_batch_x = X_tr[:min(batch_size, len(X_tr))]
    test_batch_d = D_tr[:min(batch_size, len(D_tr))]
    preflight_out = model([test_batch_x, test_batch_d], training=False)
    expected_shape = (len(test_batch_x), HORIZON_MAX, len(QUANTILES))
    assert tuple(preflight_out.shape) == expected_shape, (
        f"Pre-flight forward pass shape mismatch: expected {expected_shape}, got {tuple(preflight_out.shape)}"
    )
    print(f"  Pre-flight forward pass verified: inputs {test_batch_x.shape} + {test_batch_d.shape} -> output {tuple(preflight_out.shape)}")

    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=12,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1,
        ),
    ]

    # ── Step 4: Model Training ────────────────────────────────────────────────
    print(f"\n[4/5] Training TFT Model for max {epochs} epochs (batch_size={batch_size})...")
    start_train_time = time.time()

    history = model.fit(
        x=[X_tr, D_tr],
        y=y_tr,
        validation_data=([X_v, D_v], y_v),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )
    train_duration_s = round(time.time() - start_train_time, 2)

    # ── Step 5: Test Set Evaluation & Benchmarking ─────────────────────────────
    print("\n[5/5] Evaluating on held-out test split & comparing with baseline...")
    test_loss = model.evaluate([X_te, D_te], y_te, batch_size=batch_size, verbose=0)
    y_test_pred_quantiles = model.predict([X_te, D_te], batch_size=batch_size, verbose=0)
    # y_test_pred_quantiles shape: (N_test, HORIZON_MAX, 3) -> q10=0, q50=1, q90=2

    # TFT Median (q50) predictions for evaluation
    y_pred_q50 = y_test_pred_quantiles[:, :, 1]

    # Baseline predictor: Exponential moving average / persistence of recent target value from encoder
    # Last observed target value in encoder is X_te[:, -1, target_idx]
    target_idx = ENCODER_FEATURES.index("congestion_score")
    last_known_y = X_te[:, -1, target_idx]  # Shape: (N_test,)
    y_baseline_pred = np.tile(last_known_y[:, np.newaxis], (1, HORIZON_MAX))

    # Evaluate per forecast horizon
    horizon_results: Dict[str, Any] = {}
    for name, idx in zip(FORECAST_HORIZONS.keys(), HORIZON_INDICES):
        tft_metrics = compute_metrics(y_te[:, idx], y_pred_q50[:, idx])
        base_metrics = compute_metrics(y_te[:, idx], y_baseline_pred[:, idx])
        horizon_results[name] = {
            "horizon_step": idx + 1,
            "tft_mae": tft_metrics["mae"],
            "tft_rmse": tft_metrics["rmse"],
            "baseline_mae": base_metrics["mae"],
            "baseline_rmse": base_metrics["rmse"],
            "mae_improvement_pct": round(((base_metrics["mae"] - tft_metrics["mae"]) / max(1e-5, base_metrics["mae"])) * 100, 2),
        }

    overall_tft = compute_metrics(y_te, y_pred_q50)
    overall_base = compute_metrics(y_te, y_baseline_pred)

    print("\n" + "=" * 75)
    print("EVALUATION RESULTS ON HELD-OUT TEST DATA")
    print("=" * 75)
    print(f"{'Horizon':<10} | {'TFT MAE':<10} | {'TFT RMSE':<10} | {'Baseline MAE':<14} | {'Baseline RMSE':<14} | {'Improvement':<12}")
    print("-" * 75)
    for name, res in horizon_results.items():
        print(f"{name:<10} | {res['tft_mae']:<10.4f} | {res['tft_rmse']:<10.4f} | {res['baseline_mae']:<14.4f} | {res['baseline_rmse']:<14.4f} | {res['mae_improvement_pct']:+.1f}%")
    print("-" * 75)
    print(f"{'OVERALL':<10} | {overall_tft['mae']:<10.4f} | {overall_tft['rmse']:<10.4f} | {overall_base['mae']:<14.4f} | {overall_base['rmse']:<14.4f} |")
    print("=" * 75)

    # ── Save Model, Scaler, and Training Metadata ────────────────────────────
    model_output_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_output_dir / "tft.keras"
    scaler_path = model_output_dir / "tft.scaler.json"
    meta_path = model_output_dir / "tft.meta.json"

    # Save Keras Model
    model.save(str(model_path))

    # Save Preprocessor Scaler
    scaler_state = preprocessor.get_scaler_state()
    scaler_state["config"] = {
        "lookback_min": config.lookback_min,
        "hidden_units": config.hidden_units,
        "num_heads": config.num_heads,
        "lstm_units": config.lstm_units,
        "dropout_rate": config.dropout_rate,
        "aggregate_fps": config.aggregate_fps,
    }
    with open(scaler_path, "w", encoding="utf-8") as f:
        json.dump(scaler_state, f, indent=2)

    # Save Metadata & Training Metrics
    metadata = {
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model_architecture": "Temporal Fusion Transformer (TFT)",
        "parameters": total_params,
        "training_duration_s": train_duration_s,
        "epochs_trained": len(history.history["loss"]),
        "final_train_loss": float(history.history["loss"][-1]),
        "final_val_loss": float(history.history["val_loss"][-1]),
        "test_pinball_loss": float(test_loss),
        "overall_tft_mae": overall_tft["mae"],
        "overall_tft_rmse": overall_tft["rmse"],
        "overall_baseline_mae": overall_base["mae"],
        "overall_baseline_rmse": overall_base["rmse"],
        "horizons_evaluation": horizon_results,
        "config": {
            "lookback_min": config.lookback_min,
            "hidden_units": config.hidden_units,
            "num_heads": config.num_heads,
            "lstm_units": config.lstm_units,
            "dropout_rate": config.dropout_rate,
            "batch_size": config.batch_size,
            "learning_rate": config.learning_rate,
            "quantiles": QUANTILES,
        }
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Also sync to root models/ directory for backwards-compatibility
    root_models_dir = PROJECT_ROOT / "models"
    if model_output_dir.resolve() != root_models_dir.resolve():
        root_models_dir.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.copy2(str(model_path), str(root_models_dir / "tft.keras"))
        shutil.copy2(str(scaler_path), str(root_models_dir / "tft.scaler.json"))
        shutil.copy2(str(meta_path), str(root_models_dir / "tft.meta.json"))

    print(f"\n[Model Artifacts Successfully Saved]")
    print(f"  Model file   : {model_path} ({model_path.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"  Scaler state : {scaler_path}")
    print(f"  Metadata log : {meta_path}")

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Train TFT traffic forecasting model on real observations.")
    parser.add_argument("--dataset", type=str, default="datasets/traffic_observations.json", help="Path to observations JSON")
    parser.add_argument("--output-dir", type=str, default="backend/models", help="Directory to save trained model artifacts")
    parser.add_argument("--epochs", type=int, default=40, help="Max training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--lookback", type=int, default=60, help="Lookback window in minutes")
    args = parser.parse_args()

    dataset_path = PROJECT_ROOT / args.dataset
    output_dir = PROJECT_ROOT / args.output_dir

    run_training(
        dataset_path=dataset_path,
        model_output_dir=output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        lookback_min=args.lookback,
    )


if __name__ == "__main__":
    main()
