"""
congestion.py — Temporal Fusion Transformer (TFT) Congestion Predictor
=======================================================================
Smart Traffic Congestion Prediction and Intelligent Route Recommendation System

Implements a Temporal Fusion Transformer (Lim et al., 2021 — NeurIPS) using
TensorFlow/Keras for multi-horizon congestion score prediction.

Prediction horizons: 5 min · 10 min · 15 min · 30 min
Output per horizon:  [q10, q50, q90] quantile estimates (uncertainty range)

Input features (from traffic_analysis.py FrameMetrics):
    Observed (past only):
        vehicle_count       — total vehicles in frame
        vehicle_density     — vehicles / 100 m²
        average_speed_kmh   — mean tracked speed
        traffic_flow_vpm    — vehicles per minute (counter crossings)
        road_occupancy      — bbox area / frame area

    Target (observed in past, predicted in future):
        congestion_score    — the value being predicted [0.0, 1.0]

    Known future (time features, computable for any future timestamp):
        hour_sin, hour_cos   — hour of day, cyclically encoded
        minute_sin, minute_cos — minute of hour, cyclically encoded
        dow_sin, dow_cos    — day of week, cyclically encoded

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA PREPROCESSING EXPLAINED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1 — Frame-to-Minute Aggregation
    traffic_analysis.py emits one FrameMetrics per video frame (~30 FPS).
    The TFT is trained at 1-minute resolution. We group frames by minute:
        minute_key = int(timestamp_ms // 60_000)
    and aggregate using:
        vehicle_count       → mean (average of a minute)
        vehicle_density     → mean
        average_speed_kmh   → mean (zero-speed frames excluded)
        traffic_flow_vpm    → max (peak flow within the minute)
        road_occupancy      → mean
        congestion_score    → max (worst-case within the minute)
    Missing minutes are forward-filled (ffill) then backward-filled (bfill).

Step 2 — Cyclical Time Feature Encoding
    Traffic patterns are periodic (rush hour, weekday/weekend). Raw integers
    (hour=23 and hour=0 appear far apart) break this periodicity. Cyclical
    encoding maps them onto the unit circle:
        hour_sin = sin(2π × hour / 24)
        hour_cos = cos(2π × hour / 24)
        dow_sin  = sin(2π × day_of_week / 7)   # 0=Monday, 6=Sunday
        dow_cos  = cos(2π × day_of_week / 7)
        min_sin  = sin(2π × minute / 60)
        min_cos  = cos(2π × minute / 60)
    These 6 features are KNOWN FUTURE inputs — they can be computed for any
    future timestamp without observing the traffic, which is exactly what the
    TFT decoder expects.

Step 3 — MinMax Normalisation
    All observed features are normalised to [0, 1]:
        x_norm = (x - x_min) / (x_max - x_min + ε)
    Scalers are fit ONLY on the training split to prevent data leakage.
    congestion_score is already in [0, 1] but is still passed through the
    scaler for numerical consistency.

Step 4 — Temporal Train/Val/Test Split
    Split is chronological (NO shuffling — past must not leak into future):
        Train : first 70% of minutes
        Val   : next  15% of minutes
        Test  : last  15% of minutes
    A temporal split is essential for time-series: random splits allow the
    model to "see the future" during training, causing inflated metrics.

Step 5 — Sliding Window Sequence Creation
    For each minute t in the dataset:
        Encoder input X: minutes [t - lookback_min : t]
                         Shape (lookback_min, n_enc_features)
        Decoder input D: time features only for [t : t + horizon_max]
                         Shape (horizon_max, n_time_features)
        Target      y:   congestion_score for [t : t + horizon_max]
                         Shape (horizon_max,)
    We then extract y[:, [4, 9, 14, 29]] for the 4 forecast horizons.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TFT ARCHITECTURE OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Encoder Input (lookback steps)     Decoder Input (future steps)
           │                                      │
    ┌──────▼──────┐                       ┌───────▼──────┐
    │  Variable   │                       │  Variable    │
    │  Selection  │                       │  Selection   │
    │  Network    │                       │  Network     │
    └──────┬──────┘                       └───────┬──────┘
           │                                      │
    ┌──────▼──────┐                       ┌───────▼──────┐
    │ LSTM Encoder│──(state_h, state_c)──▶│ LSTM Decoder │
    └──────┬──────┘                       └───────┬──────┘
           │                                      │
           └───────────────┐ ┌────────────────────┘
                    ┌──────▼─▼──────┐
                    │ Temporal Self │
                    │   Attention   │
                    └──────┬────────┘
                           │
                    ┌──────▼────────┐
                    │  Gated Res.   │
                    │   Network     │
                    └──────┬────────┘
                           │
                    ┌──────▼────────┐
                    │ Dense Quantile│
                    │  [q10,q50,q90]│
                    └──────┬────────┘
                           │
               Extract steps [4,9,14,29]
                    (5,10,15,30 min)

Usage:
    from congestion import CongestionPredictor, TFTConfig

    # ── Training ────────────────────────────────────────────────────────────
    from traffic_analysis import TrafficAnalyser

    analyser = TrafficAnalyser(...)
    # ... run video processing loop ...

    history = analyser.get_history(as_dicts=True)
    # OR load from exported JSON:
    # history = json.load(open("analytics.json"))["history"]

    predictor = CongestionPredictor(TFTConfig())
    predictor.build()
    predictor.train(history, epochs=50, save_path="models/tft.keras")

    # ── Live inference (FastAPI endpoint) ───────────────────────────────────
    recent = analyser.get_history(last_n=60, as_dicts=True)  # last 60 minutes
    forecast = predictor.predict_live(recent)
    # Returns:
    # {
    #   "5min":  {"q10": 0.31, "q50": 0.45, "q90": 0.62, "level": "MODERATE"},
    #   "10min": {"q10": 0.38, "q50": 0.52, "q90": 0.71, "level": "MODERATE"},
    #   "15min": {...},
    #   "30min": {...},
    # }

    # ── Save / load ─────────────────────────────────────────────────────────
    predictor.save("models/tft.keras")
    predictor2 = CongestionPredictor.load("models/tft.keras")
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

# Ensure backend directory is in sys.path
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

warnings.filterwarnings("ignore", category=UserWarning)


# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────


# Prediction horizons in minutes and their 0-based indices in the target array.
# The TFT decoder predicts HORIZON_MAX steps; we extract specific ones.
FORECAST_HORIZONS: Dict[str, int] = {
    "5min":  5,
    "10min": 10,
    "15min": 15,
    "30min": 30,
}
HORIZON_MAX: int = max(FORECAST_HORIZONS.values())   # 30
HORIZON_INDICES: List[int] = [v - 1 for v in FORECAST_HORIZONS.values()]  # [4,9,14,29]

# Quantile levels for prediction intervals
QUANTILES: List[float] = [0.10, 0.50, 0.90]   # p10, median, p90

# Observed features fed to both encoder and as targets
OBSERVED_FEATURES: List[str] = [
    "vehicle_count",
    "vehicle_density",
    "average_speed_kmh",
    "traffic_flow_vpm",
    "road_occupancy",
    "congestion_score",
]
TARGET_FEATURE: str = "congestion_score"

# Known future features (time encoding — computable for any future timestamp)
TIME_FEATURES: List[str] = [
    "hour_sin", "hour_cos",
    "minute_sin", "minute_cos",
    "dow_sin", "dow_cos",
]

# All encoder features (observed + time)
ENCODER_FEATURES: List[str] = OBSERVED_FEATURES + TIME_FEATURES

# Congestion level mapping (mirrors traffic_analysis.py _SCORE_THRESHOLDS)
_SCORE_TO_LEVEL: List[Tuple[float, str]] = [
    (0.20, "FREE_FLOW"),
    (0.40, "LIGHT"),
    (0.60, "MODERATE"),
    (0.80, "HEAVY"),
    (1.01, "CONGESTED"),
]


# ──────────────────────────────────────────────────────────────────────────────
# TFT Configuration
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class TFTConfig:
    """
    All TFT hyperparameters in one place.

    Attributes:
        lookback_min    : Historical lookback window in minutes.
                          60 = model sees the last 1 hour of traffic.
        hidden_units    : Embedding dimension used throughout the TFT.
                          32 is fast for development; 64–128 for production.
        num_heads       : Number of attention heads in temporal self-attention.
                          Must divide hidden_units evenly.
        lstm_units      : LSTM hidden state size. Typically == hidden_units.
        dropout_rate    : Dropout applied in GRNs and attention (regularisation).
        learning_rate   : Adam optimizer learning rate.
        batch_size      : Training batch size.
        val_split       : Fraction of data used for validation.
        test_split      : Fraction of data used for testing (held-out).
        min_train_min   : Minimum minutes of data required before training.
        aggregate_fps   : Source FPS for frame→minute aggregation.
                          Use 1 if history is already minute-level.
    """
    lookback_min:    int   = 60
    hidden_units:    int   = 64
    num_heads:       int   = 4
    lstm_units:      int   = 64
    dropout_rate:    float = 0.1
    learning_rate:   float = 1e-3
    batch_size:      int   = 32
    val_split:       float = 0.15
    test_split:      float = 0.15
    min_train_min:   int   = 200    # at least 200 minutes of data
    aggregate_fps:   float = 30.0   # source frame rate


# ──────────────────────────────────────────────────────────────────────────────
# Data Preprocessor
# ──────────────────────────────────────────────────────────────────────────────

class DataPreprocessor:
    """
    Converts raw FrameMetrics dicts from traffic_analysis.py into
    (encoder_X, decoder_D, target_y) numpy arrays ready for TFT training.

    Pipeline (see module docstring for full explanation):
        1. Frame-to-minute aggregation
        2. Cyclical time feature engineering
        3. MinMax normalisation (fit on train split only)
        4. Chronological train/val/test split
        5. Sliding window sequence creation
    """

    def __init__(self, config: TFTConfig) -> None:
        self.config = config

        # Fitted scalers: {feature_name: (min, max)}
        self._scalers: Dict[str, Tuple[float, float]] = {}
        self._is_fitted: bool = False

    # ── Step 1: Aggregation ───────────────────────────────────────────────────

    def aggregate_to_minutes(
        self,
        history_dicts: List[dict],
    ) -> List[dict]:
        """
        Aggregate frame-level FrameMetrics dicts to minute-level records.

        Why aggregate?
        ──────────────
        At 30 FPS, 1 minute = 1800 frames. The TFT works at 1-minute resolution
        so it can predict 5–30 minutes ahead without training on 1800× the data.
        Aggregation also smooths out per-frame noise from the detector.

        Aggregation rules (all justified by domain knowledge):
          vehicle_count     → mean  : representative load for the minute
          vehicle_density   → mean  : representative density
          average_speed_kmh → mean  : zero-speed frames excluded before mean
          traffic_flow_vpm  → max   : peak flow matters for capacity analysis
          road_occupancy    → mean  : representative spatial coverage
          congestion_score  → max   : worst-case is the risk we want to predict

        Wall clock timestamps: each frame has wall_time_s. We use this (not
        timestamp_ms which is stream position) so offline/online data align.

        Args:
            history_dicts: List[dict] from TrafficAnalyser.get_history(as_dicts=True)
                           or from the "history" key of the exported JSON.

        Returns:
            List of minute-level dicts, sorted by minute_key ascending.
        """
        if not history_dicts:
            raise ValueError("[Preprocessor] Empty history — nothing to aggregate.")

        # Group frames by minute bucket
        buckets: Dict[int, List[dict]] = {}
        for frame in history_dicts:
            # Prefer wall_time_s (monotonic) over timestamp_ms (stream position)
            t_s = frame.get("wall_time_s", frame.get("timestamp_ms", 0) / 1000.0)
            minute_key = int(t_s // 60)
            buckets.setdefault(minute_key, []).append(frame)

        minute_records = []
        for minute_key in sorted(buckets.keys()):
            frames = buckets[minute_key]

            # Collect values safely
            counts   = [f.get("vehicle_count", f.get("total_count", f.get("total", 0))) for f in frames]
            densities= [f.get("vehicle_density", f.get("road_occupancy", 0.0)) for f in frames]
            speeds   = [f.get("average_speed_kmh", f.get("average_speed", 0.0)) for f in frames if f.get("average_speed_kmh", f.get("average_speed", 0.0)) > 0]
            flows    = [f.get("traffic_flow_vpm", 0.0) for f in frames]
            occs     = [f.get("road_occupancy", 0.0) for f in frames]
            scores   = [f.get("congestion_score", 0.0) for f in frames]

            # Use the last frame's wall_time_s as the minute representative
            ref_time_s = frames[-1].get("wall_time_s", minute_key * 60.0)

            minute_records.append({
                "minute_key":        minute_key,
                "wall_time_s":       ref_time_s,
                "vehicle_count":     float(sum(counts) / len(counts)) if counts else 0.0,
                "vehicle_density":   float(sum(densities) / len(densities)) if densities else 0.0,
                "average_speed_kmh": float(sum(speeds) / len(speeds)) if speeds else 0.0,
                "traffic_flow_vpm":  float(max(flows)) if flows else 0.0,
                "road_occupancy":    float(sum(occs) / len(occs)) if occs else 0.0,
                "congestion_score":  float(max(scores)) if scores else 0.0,
            })

        # Forward-fill then backward-fill any missing minutes
        minute_records = self._fill_missing_minutes(minute_records)
        return minute_records

    @staticmethod
    def _fill_missing_minutes(records: List[dict]) -> List[dict]:
        """
        Fill gaps in the minute sequence using forward/backward fill.

        Why fill gaps?
        ──────────────
        Night-time periods, processing pauses, or video fast-forwards can leave
        gaps. LSTM models require a contiguous sequence. Forward-fill propagates
        the last known state (sensible for traffic — conditions change gradually).

        Args:
            records: Sorted list of minute-level dicts.

        Returns:
            Gap-free list with every minute from min_key to max_key.
        """
        if not records:
            return records

        filled = []
        record_by_key = {r["minute_key"]: r for r in records}
        min_key = records[0]["minute_key"]
        max_key = records[-1]["minute_key"]

        prev = None
        for mk in range(min_key, max_key + 1):
            if mk in record_by_key:
                prev = record_by_key[mk]
                filled.append(dict(prev))
            elif prev is not None:
                # Forward fill: copy prev, update the minute key
                fwd = dict(prev)
                fwd["minute_key"] = mk
                fwd["wall_time_s"] = float(mk * 60)
                filled.append(fwd)
            # else: leading gap — skip (handled by bfill if needed)

        # Backward fill: if first minutes are gaps, copy from the first known
        first_known = next((r for r in filled if r["minute_key"] in record_by_key), None)
        if first_known:
            for r in filled:
                if r["minute_key"] not in record_by_key:
                    for feat in OBSERVED_FEATURES:
                        r[feat] = first_known[feat]
                else:
                    break

        return filled

    # ── Step 2: Time Feature Engineering ─────────────────────────────────────

    @staticmethod
    def encode_time_features(records: List[dict]) -> List[dict]:
        """
        Add cyclical time features to each minute record.

        Why cyclical encoding?
        ──────────────────────
        Linear encoding (e.g. hour=0, 1, 2, … 23) treats hour=23 and hour=0 as
        far apart (distance = 23). In reality, 11 PM and midnight are consecutive.
        Cyclical encoding maps hours onto a unit circle:
            sin(2π × 23/24) ≈ sin(2π × 0/24) — nearly identical, as desired.

        The sin/cos pair fully encodes each cycle without ambiguity:
            sin alone: hour=1 and hour=11 give different sines (both near 0.5)
            sin+cos:   the (sin, cos) pair is unique for each hour in [0, 23]

        Args:
            records: List of minute-level dicts with 'wall_time_s'.

        Returns:
            Records with 6 extra time feature keys added in-place.
        """
        import datetime
        for r in records:
            dt = datetime.datetime.fromtimestamp(r["wall_time_s"])
            h   = dt.hour
            m   = dt.minute
            dow = dt.weekday()   # 0=Monday, 6=Sunday

            r["hour_sin"]   = math.sin(2 * math.pi * h   / 24)
            r["hour_cos"]   = math.cos(2 * math.pi * h   / 24)
            r["minute_sin"] = math.sin(2 * math.pi * m   / 60)
            r["minute_cos"] = math.cos(2 * math.pi * m   / 60)
            r["dow_sin"]    = math.sin(2 * math.pi * dow  / 7)
            r["dow_cos"]    = math.cos(2 * math.pi * dow  / 7)

        return records

    # ── Step 3: Normalisation ─────────────────────────────────────────────────

    def fit(self, records: List[dict]) -> "DataPreprocessor":
        """
        Fit MinMax scalers on the TRAINING records only.

        Why fit only on training data?
        ─────────────────────────────
        Fitting the scaler on the full dataset (including val/test) causes data
        leakage: the model indirectly learns the future value range through the
        normalisation boundaries. Fitting only on training records and applying
        the fitted scaler to val/test prevents this.

        Args:
            records: Training minute-level records (NOT the full dataset).

        Returns:
            self (for chaining: preprocessor.fit(train).transform(val))
        """
        for feat in ENCODER_FEATURES:
            vals = [r[feat] for r in records if feat in r]
            if not vals:
                self._scalers[feat] = (0.0, 1.0)
                continue
            f_min = float(min(vals))
            f_max = float(max(vals))
            # Add ε to denominator to avoid division by zero for constant features
            self._scalers[feat] = (f_min, f_max + 1e-8)

        self._is_fitted = True
        return self

    def _scale(self, value: float, feature: str) -> float:
        """Apply MinMax scaling to a single value."""
        f_min, f_max = self._scalers.get(feature, (0.0, 1.0))
        return max(0.0, min(1.0, (value - f_min) / (f_max - f_min + 1e-8)))

    def _inverse_scale(self, value: float, feature: str) -> float:
        """Reverse MinMax scaling (for converting predictions to real units)."""
        f_min, f_max = self._scalers.get(feature, (0.0, 1.0))
        return value * (f_max - f_min) + f_min

    def transform(
        self,
        records: List[dict],
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Convert minute-level records to (encoder_X, decoder_D, target_y) arrays.

        Sequence creation (sliding window):
            For each minute t (where t ≥ lookback_min and t + HORIZON_MAX ≤ N):
                encoder_X[t] = normalised ENCODER_FEATURES for minutes [t-lookback:t]
                               Shape: (lookback_min, len(ENCODER_FEATURES))
                decoder_D[t] = normalised TIME_FEATURES for minutes [t:t+HORIZON_MAX]
                               Shape: (HORIZON_MAX, len(TIME_FEATURES))
                target_y[t]  = raw (un-normalised) congestion_score for [t:t+HORIZON_MAX]
                               Shape: (HORIZON_MAX,)

        Why raw targets?
        ────────────────
        The quantile loss is computed in normalised space during training, but
        for inference we want predictions in the original [0,1] congestion score
        range. Since congestion_score is already [0,1], the scaler barely changes
        it — but for correctness we inverse-transform predictions at inference time.

        Args:
            records: Minute-level records (already time-encoded).

        Returns:
            (encoder_X, decoder_D, target_y) numpy arrays.

        Raises:
            RuntimeError: If fit() has not been called.
            ValueError:   If records are too short for any sequence.
        """
        if not self._is_fitted:
            raise RuntimeError(
                "[Preprocessor] Call fit() on training records before transform()."
            )

        n = len(records)
        lb = self.config.lookback_min
        hor = HORIZON_MAX

        required = lb + hor
        if n < required:
            raise ValueError(
                f"[Preprocessor] Need at least {required} minute records "
                f"(lookback={lb} + horizon={hor}). Got {n}."
            )

        # Build normalised feature arrays
        enc_array = np.zeros((n, len(ENCODER_FEATURES)), dtype=np.float32)
        dec_array = np.zeros((n, len(TIME_FEATURES)),    dtype=np.float32)
        tgt_array = np.zeros(n,                          dtype=np.float32)

        for i, rec in enumerate(records):
            for j, feat in enumerate(ENCODER_FEATURES):
                enc_array[i, j] = self._scale(rec.get(feat, 0.0), feat)
            for j, feat in enumerate(TIME_FEATURES):
                dec_array[i, j] = self._scale(rec.get(feat, 0.0), feat)
            tgt_array[i] = rec.get(TARGET_FEATURE, 0.0)  # raw [0,1] score

        # Sliding window
        num_seqs = n - lb - hor + 1
        X = np.zeros((num_seqs, lb,  len(ENCODER_FEATURES)), dtype=np.float32)
        D = np.zeros((num_seqs, hor, len(TIME_FEATURES)),    dtype=np.float32)
        y = np.zeros((num_seqs, hor),                        dtype=np.float32)

        for i in range(num_seqs):
            t = i + lb
            X[i] = enc_array[i : t]
            D[i] = dec_array[t : t + hor]
            y[i] = tgt_array[t : t + hor]

        return X, D, y

    def fit_transform(
        self,
        records: List[dict],
    ) -> Tuple[
        Tuple[np.ndarray, np.ndarray, np.ndarray],   # train
        Tuple[np.ndarray, np.ndarray, np.ndarray],   # val
        Tuple[np.ndarray, np.ndarray, np.ndarray],   # test
    ]:
        """
        Run the full preprocessing pipeline: fit on train, transform all splits.

        Temporal split (NO SHUFFLING):
            train = records[:train_end]
            val   = records[train_end:val_end]
            test  = records[val_end:]

        Why no shuffling?
        ──────────────────
        Traffic is a time series. Shuffling allows the model to "see" future
        data during training (e.g. a Tuesday sequence trained alongside the
        following Thursday's data). Temporal ordering must be preserved.

        Args:
            records: Full minute-level records (aggregated + time-encoded).

        Returns:
            Three (X, D, y) tuples for train, val, and test splits.
        """
        n = len(records)
        cfg = self.config
        train_end = int(n * (1 - cfg.val_split - cfg.test_split))
        val_end   = int(n * (1 - cfg.test_split))

        train_rec = records[:train_end]
        val_rec   = records[train_end : val_end]
        test_rec  = records[val_end:]

        print(
            f"[Preprocessor] Split — "
            f"train={len(train_rec)} | val={len(val_rec)} | test={len(test_rec)} min"
        )

        if len(train_rec) < cfg.min_train_min:
            raise ValueError(
                f"[Preprocessor] Only {len(train_rec)} training minutes. "
                f"Minimum required: {cfg.min_train_min}. "
                f"Record more sessions or lower config.min_train_min."
            )

        self.fit(train_rec)

        # Include lookback overlap so val and test don't lose context
        # val starts at train_end but needs lookback_min before it too
        val_with_context  = records[max(0, train_end - cfg.lookback_min) : val_end]
        test_with_context = records[max(0, val_end   - cfg.lookback_min):]

        train_arrays = self.transform(train_rec)
        val_arrays   = self.transform(val_with_context)
        test_arrays  = self.transform(test_with_context)

        print(
            f"[Preprocessor] Sequences — "
            f"train={train_arrays[0].shape[0]} | "
            f"val={val_arrays[0].shape[0]} | "
            f"test={test_arrays[0].shape[0]}"
        )
        return train_arrays, val_arrays, test_arrays

    def inverse_transform_score(self, score: float) -> float:
        """Convert a normalised congestion score back to [0, 1] original scale."""
        return float(np.clip(self._inverse_scale(score, TARGET_FEATURE), 0.0, 1.0))

    def get_scaler_state(self) -> dict:
        """Return scaler parameters for serialisation (save alongside model)."""
        return {"fitted": self._is_fitted, "scalers": self._scalers}

    def set_scaler_state(self, state: dict) -> None:
        """Restore scaler parameters from a saved state dict."""
        self._is_fitted = state.get("fitted", False)
        self._scalers = state.get("scalers", {})


# ──────────────────────────────────────────────────────────────────────────────
# TFT Keras Layers
# ──────────────────────────────────────────────────────────────────────────────

def _build_tft_model(config: TFTConfig) -> Any:
    """
    Build the Temporal Fusion Transformer using the Keras Functional API.

    Architecture matches Lim et al. (2021) with the following components:
      1. Input projection    — projects each feature to hidden_units
      2. Variable Selection  — learns which features matter most per timestep
      3. LSTM Encoder/Dec    — captures temporal dynamics
      4. Temporal Attention  — focuses on the most relevant past steps
      5. Gated Feed-Forward  — position-wise transformation
      6. Quantile Dense      — outputs [q10, q50, q90] per horizon step

    Returns:
        Compiled tf.keras.Model ready for training.

    Implementation notes:
    ─────────────────────
    We implement the GRN as a nested function rather than a Layer subclass to
    avoid serialisation complexity for the initial version. The functional
    equivalent is identical in behaviour.

    MultiHeadAttention (tf.keras.layers.MultiHeadAttention) requires TF ≥ 2.4.
    The attention operates on decoder_outputs as query/value and encoder_outputs
    as key/value — this is the cross-attention step from the TFT paper.
    """
    import tensorflow as tf
    from tensorflow.keras import layers


    units    = config.hidden_units
    d_rate   = config.dropout_rate
    n_enc    = len(ENCODER_FEATURES)
    n_time   = len(TIME_FEATURES)
    lb       = config.lookback_min
    hor      = HORIZON_MAX
    n_q      = len(QUANTILES)

    # ── Gated Residual Network (GRN) as a function ────────────────────────────
    # From paper: GRN(a, c) = LayerNorm(a + GLU(η₁))
    # where η₂ = ELU(W₂(a) + W₃(c) + b₂)   [context c optional]
    #       η₁ = W₁(η₂) + b₁
    #       GLU = η₁ * sigmoid(W₄(η₂) + b₄)
    def grn(x, context=None, name_prefix="grn"):
        skip = x
        if x.shape[-1] != units:
            skip = layers.Dense(units, use_bias=False,
                                name=f"{name_prefix}_skip")(x)

        # η₂ — primary transformation with optional context conditioning
        n2 = layers.Dense(units, name=f"{name_prefix}_n2")(x)
        if context is not None:
            n2 = n2 + layers.Dense(units, use_bias=False,
                                   name=f"{name_prefix}_ctx")(context)
        n2 = layers.Activation("elu",  name=f"{name_prefix}_elu")(n2)
        n2 = layers.Dropout(d_rate,    name=f"{name_prefix}_drop")(n2)

        # η₁ — second projection
        n1 = layers.Dense(units, name=f"{name_prefix}_n1")(n2)

        # Gated Linear Unit (sigmoid gate × η₁)
        gate = layers.Dense(units, activation="sigmoid",
                            name=f"{name_prefix}_gate")(n2)
        glu = layers.Multiply(name=f"{name_prefix}_glu")([n1, gate])

        # Residual + LayerNorm
        out = layers.Add(name=f"{name_prefix}_add")([skip, glu])
        out = layers.LayerNormalization(name=f"{name_prefix}_ln")(out)
        return out

    # ── Variable Selection Network (VSN) ─────────────────────────────────────
    # Learns a softmax distribution over input features to select the most
    # informative variables at each timestep.
    # From paper: ξ_t = Σ ṽ_{i,t} · ξ̃_t^(i)
    #   where ṽ = softmax(W_v * GRN([ξ⁽¹⁾...ξ⁽ⁿ⁾]))
    #         ξ̃_t^(i) = GRN(ξ_t^(i))
    def vsn(inputs_tensor, n_vars: int, name_prefix: str):
        # inputs_tensor shape: (batch, time, n_vars)
        # Split along feature axis → list of (batch, time, 1)
        split_inputs = tf.split(inputs_tensor, num_or_size_splits=n_vars, axis=-1)

        # Process each variable through its own GRN
        var_processed = [
            grn(inp, name_prefix=f"{name_prefix}_var_{i}")
            for i, inp in enumerate(split_inputs)
        ]

        # Stack → (batch, time, n_vars, units) via Concatenate + Reshape
        # Concatenate along last axis: (batch, time, n_vars * units)
        var_concat = layers.Concatenate(axis=-1, name=f"{name_prefix}_concat")(var_processed)
        var_stack = layers.Reshape((-1, n_vars, units), name=f"{name_prefix}_stack")(var_concat)

        # Selection weights via GRN on flat concatenation of raw inputs
        flat_concat = layers.Reshape((-1, n_vars), name=f"{name_prefix}_flatten")(inputs_tensor)
        weight_logits = grn(flat_concat, name_prefix=f"{name_prefix}_weight_grn")
        weight_logits = layers.Dense(n_vars, name=f"{name_prefix}_weight_proj")(weight_logits)
        weights = layers.Softmax(axis=-1, name=f"{name_prefix}_softmax")(weight_logits)

        # Weighted sum: (batch, time, n_vars, units) × (batch, time, n_vars, 1)
        weights_exp = layers.Reshape((-1, n_vars, 1), name=f"{name_prefix}_weights_exp")(weights)
        weighted_vars = layers.Multiply(name=f"{name_prefix}_weighted_mult")([var_stack, weights_exp])
        combined = tf.reduce_sum(weighted_vars, axis=2)

        return combined, weights   # (batch, time, units), (batch, time, n_vars)

    # ── Model Inputs ─────────────────────────────────────────────────────────
    enc_input = layers.Input(shape=(lb, n_enc),  name="encoder_input")
    dec_input = layers.Input(shape=(hor, n_time), name="decoder_input")

    # ── Encoder path ──────────────────────────────────────────────────────────
    # Feed raw encoder input (batch, time, n_enc) into VSN
    enc_selected, enc_weights = vsn(enc_input, n_enc, name_prefix="enc_vsn")
    enc_selected = layers.Dropout(d_rate, name="enc_drop")(enc_selected)

    # LSTM Encoder: processes lookback_min steps, passes state to decoder
    enc_out, state_h, state_c = layers.LSTM(
        config.lstm_units,
        return_sequences=True,
        return_state=True,
        dropout=d_rate,
        name="lstm_encoder",
    )(enc_selected)
    enc_out = grn(enc_out, name_prefix="enc_grn_post")

    # ── Decoder path ──────────────────────────────────────────────────────────
    # Feed raw decoder input (batch, time, n_time) into VSN
    dec_selected, dec_weights = vsn(dec_input, n_time, name_prefix="dec_vsn")
    dec_selected = layers.Dropout(d_rate, name="dec_drop")(dec_selected)

    # LSTM Decoder: initialised with encoder's final state (seq2seq handoff)
    dec_out = layers.LSTM(
        config.lstm_units,
        return_sequences=True,
        dropout=d_rate,
        name="lstm_decoder",
    )(dec_selected, initial_state=[state_h, state_c])
    dec_out = grn(dec_out, name_prefix="dec_grn_post")

    # ── Temporal Self-Attention ───────────────────────────────────────────────
    # Decoder queries attend to encoder keys/values.
    # This lets each future step focus on the most relevant past patterns.
    # (cross-attention: query=decoder, key=value=encoder)
    attended = layers.MultiHeadAttention(
        num_heads=config.num_heads,
        key_dim=units // config.num_heads,
        dropout=d_rate,
        name="temporal_attention",
    )(query=dec_out, value=enc_out, key=enc_out)

    # Add residual around attention + layer norm (standard Transformer pattern)
    attended = layers.Add(name="attn_residual")([dec_out, attended])
    attended = layers.LayerNormalization(name="attn_ln")(attended)

    # ── Position-wise GRN (feed-forward in Transformer terms) ─────────────────
    ff_out = grn(attended, name_prefix="ff_grn")

    # Final skip: add pre-attention decoder output to preserve gradient flow
    ff_out = layers.Add(name="ff_residual")([attended, ff_out])
    ff_out = layers.LayerNormalization(name="ff_ln")(ff_out)

    # ── Quantile Output Head ─────────────────────────────────────────────────
    # For each of the HORIZON_MAX decoder steps, predict 3 quantiles.
    # Shape: (batch, HORIZON_MAX, n_quantiles)
    output = layers.Dense(n_q, activation="sigmoid", name="quantile_output")(ff_out)

    model = tf.keras.Model(
        inputs=[enc_input, dec_input],
        outputs=output,
        name="TemporalFusionTransformer",
    )
    return model


def _quantile_loss(quantiles: List[float]):
    """
    Pinball (quantile) loss for probabilistic forecasting.

    Formula for quantile q and prediction ŷ vs target y:
        L(q, y, ŷ) = q × max(y − ŷ, 0) + (1 − q) × max(ŷ − y, 0)

    Why quantile loss?
    ──────────────────
    MSE produces a single point estimate (mean). Quantile loss produces
    a prediction interval [q10, q90] that quantifies uncertainty.
    This is critical for traffic management: knowing that the 90th-percentile
    forecast is CONGESTED even when the median is MODERATE lets operators
    decide to intervene proactively.

    The total loss is the sum over all quantile levels.
    """
    import tensorflow as tf
    q_tensor = tf.constant(quantiles, dtype=tf.float32)   # shape (n_q,)

    def loss(y_true, y_pred):
        # y_true: (batch, horizon)
        # y_pred: (batch, horizon, n_q)
        y_true_exp = tf.expand_dims(y_true, -1)            # (batch, horizon, 1)
        error = y_true_exp - y_pred                         # (batch, horizon, n_q)

        # L(q) = q*max(e,0) + (1-q)*max(-e,0)
        l_pos = q_tensor * tf.maximum(error,  0.0)
        l_neg = (1.0 - q_tensor) * tf.maximum(-error, 0.0)
        per_quantile = l_pos + l_neg                        # (batch, horizon, n_q)
        return tf.reduce_mean(per_quantile)

    loss.__name__ = "quantile_loss"
    return loss


# ──────────────────────────────────────────────────────────────────────────────
# Congestion Predictor
# ──────────────────────────────────────────────────────────────────────────────

def _score_to_level(score: float) -> str:
    """Map a congestion score [0,1] to a level string."""
    for threshold, level in _SCORE_TO_LEVEL:
        if score < threshold:
            return level
    return "CONGESTED"


class CongestionPredictor:
    """
    End-to-end Temporal Fusion Transformer predictor for traffic congestion.

    Wraps model building, training, inference, and save/load into a single
    coherent interface consumed by FastAPI and the LangGraph agent.

    Call sequence:
        predictor = CongestionPredictor(TFTConfig())
        predictor.build()
        predictor.train(history_dicts, epochs=50)
        forecast = predictor.predict_live(recent_history)

    Or, to load a saved model:
        predictor = CongestionPredictor.load("models/tft.keras")
    """

    def __init__(self, config: Optional[TFTConfig] = None) -> None:
        self.config = config or TFTConfig()
        self.preprocessor = DataPreprocessor(self.config)
        self._model: Optional[object] = None   # tf.keras.Model
        self._history_record: List[dict] = []  # Keras training history per epoch
        self._is_trained: bool = False
        self._build_time_s: float = 0.0
        self._train_time_s: float = 0.0

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    # ── Build ─────────────────────────────────────────────────────────────────

    def build(self) -> "CongestionPredictor":
        """
        Construct and compile the TFT Keras model.

        Called before train() or independently when loading weights separately.

        Returns:
            self (for chaining).
        """
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError(
                "[Predictor] TensorFlow is not installed.\n"
                "  Install with: pip install tensorflow>=2.10"
            )

        t0 = time.time()
        self._model = _build_tft_model(self.config)
        self._model.compile(
            optimizer=tf.keras.optimizers.Adam(
                learning_rate=self.config.learning_rate,
                clipnorm=1.0,    # gradient clipping prevents exploding gradients
            ),
            loss=_quantile_loss(QUANTILES),
        )
        self._build_time_s = time.time() - t0

        total_params = self._model.count_params()
        print(
            f"[Predictor] TFT built in {self._build_time_s:.2f}s\n"
            f"  Parameters : {total_params:,}\n"
            f"  Lookback   : {self.config.lookback_min} min\n"
            f"  Horizon    : {HORIZON_MAX} min -> predict {list(FORECAST_HORIZONS.keys())}\n"
            f"  Quantiles  : {QUANTILES}"
        )
        return self

    # ── Training ──────────────────────────────────────────────────────────────

    def train(
        self,
        history_dicts: List[dict],
        epochs: int = 50,
        save_path: Optional[Union[str, Path]] = None,
        verbose: int = 1,
    ) -> dict:
        """
        Preprocess data and train the TFT model.

        Full pipeline:
            1. Aggregate frames → minutes
            2. Encode time features
            3. Fit/transform → train/val/test numpy arrays
            4. Fit model with early stopping + LR reduction
            5. Evaluate on test set
            6. Save if path provided

        Args:
            history_dicts : List[dict] from TrafficAnalyser.get_history(as_dicts=True)
                            or loaded from an exported JSON file.
                            Minimum: config.min_train_min × FPS × 60 frames.
            epochs        : Maximum training epochs (early stopping may end sooner).
            save_path     : If provided, save the model + scaler state here.
            verbose       : Keras verbosity (0=silent, 1=progress bar, 2=epoch line).

        Returns:
            dict with training history and test metrics.

        Raises:
            RuntimeError: If build() has not been called.
            ValueError  : If insufficient data is provided.
        """
        if self._model is None:
            raise RuntimeError(
                "[Predictor] Call build() before train()."
            )

        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError("[Predictor] TensorFlow required for training.")

        t0 = time.time()

        # ── Preprocessing ─────────────────────────────────────────────────────
        print("[Predictor] Preprocessing data...")
        minute_records = self.preprocessor.aggregate_to_minutes(history_dicts)
        minute_records = DataPreprocessor.encode_time_features(minute_records)

        print(
            f"[Predictor] Aggregated {len(history_dicts)} frames → "
            f"{len(minute_records)} minutes"
        )

        (X_tr, D_tr, y_tr), (X_v, D_v, y_v), (X_te, D_te, y_te) = \
            self.preprocessor.fit_transform(minute_records)

        # ── Callbacks ─────────────────────────────────────────────────────────
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=10,
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

        if save_path:
            save_path = Path(save_path)
            save_path.parent.mkdir(parents=True, exist_ok=True)
            callbacks.append(
                tf.keras.callbacks.ModelCheckpoint(
                    filepath=str(save_path.with_suffix("")) + "_best.keras",
                    monitor="val_loss",
                    save_best_only=True,
                    verbose=0,
                )
            )

        # ── Training ──────────────────────────────────────────────────────────
        print(f"[Predictor] Training — {X_tr.shape[0]} samples, {epochs} max epochs")
        keras_history = self._model.fit(
            x=[X_tr, D_tr],
            y=y_tr,
            validation_data=([X_v, D_v], y_v),
            epochs=epochs,
            batch_size=self.config.batch_size,
            callbacks=callbacks,
            verbose=verbose,
        )

        # ── Test evaluation ────────────────────────────────────────────────────
        test_loss = self._model.evaluate(
            [X_te, D_te], y_te,
            batch_size=self.config.batch_size,
            verbose=0,
        )
        self._train_time_s = time.time() - t0
        self._is_trained = True

        # ── Record history ─────────────────────────────────────────────────────
        self._history_record = keras_history.history

        result = {
            "epochs_trained":   len(keras_history.history["loss"]),
            "final_train_loss": float(keras_history.history["loss"][-1]),
            "final_val_loss":   float(keras_history.history["val_loss"][-1]),
            "test_loss":        float(test_loss),
            "train_time_s":     round(self._train_time_s, 2),
            "train_samples":    int(X_tr.shape[0]),
            "val_samples":      int(X_v.shape[0]),
            "test_samples":     int(X_te.shape[0]),
        }

        print(
            f"\n[Predictor] Training complete\n"
            f"  Epochs      : {result['epochs_trained']}\n"
            f"  Train loss  : {result['final_train_loss']:.5f}\n"
            f"  Val loss    : {result['final_val_loss']:.5f}\n"
            f"  Test loss   : {result['test_loss']:.5f}\n"
            f"  Time        : {result['train_time_s']}s"
        )

        # ── Save ──────────────────────────────────────────────────────────────
        if save_path:
            self.save(save_path)

        return result

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict(
        self,
        encoder_X: np.ndarray,
        decoder_D: np.ndarray,
    ) -> np.ndarray:
        """
        Run raw model inference.

        Args:
            encoder_X: (batch, lookback_min, n_enc_features)
            decoder_D: (batch, HORIZON_MAX, n_time_features)

        Returns:
            (batch, HORIZON_MAX, n_quantiles) — normalised quantile predictions.

        Raises:
            RuntimeError: If model has not been built.
        """
        if self._model is None:
            raise RuntimeError("[Predictor] Model not built. Call build() or load().")

        preds = self._model(
            [encoder_X, decoder_D],
            training=False,
        ).numpy()
        return preds   # (batch, HORIZON_MAX, n_q)

    def predict_live(
        self,
        recent_history: List[dict],
    ) -> dict:
        """
        Predict congestion for all four horizons from the last N minutes of data.

        This is the primary API consumed by:
          - FastAPI GET /api/congestion/forecast
          - LangGraph CongestionAgent.assess_future_risk()

        Args:
            recent_history: List[dict] from TrafficAnalyser.get_history(as_dicts=True).
                            Must contain at least config.lookback_min + HORIZON_MAX
                            minute-equivalent records.

        Returns:
            Structured forecast dict:
            {
              "5min":  {"q10": 0.31, "q50": 0.45, "q90": 0.62,
                        "level_q50": "MODERATE", "uncertain": false},
              "10min": {...},
              "15min": {...},
              "30min": {...},
              "model_info": {"is_trained": true, "lookback_min": 60}
            }

        Note:
            When the model is NOT trained (e.g. first launch), this returns a
            rule-based heuristic forecast so the API never returns an error.
        """
        if not recent_history:
            return self._heuristic_forecast(recent_history)

        # 1. Log live telemetry received
        latest = recent_history[-1]
        v_count = latest.get("vehicle_count", latest.get("total_count", latest.get("total", 0)))
        v_density = latest.get("vehicle_density", latest.get("road_occupancy", 0.0))
        v_speed = latest.get("average_speed_kmh", latest.get("average_speed", 0.0))
        v_flow = latest.get("traffic_flow_vpm", 0.0)
        v_occ = latest.get("road_occupancy", 0.0)
        v_score = latest.get("congestion_score", 0.0)

        print("[Predictor] Live telemetry received:")
        print(f"  vehicle_count={v_count}")
        print(f"  vehicle_density={v_density:.4f}" if isinstance(v_density, float) else f"  vehicle_density={v_density}")
        print(f"  average_speed_kmh={v_speed:.2f}" if isinstance(v_speed, float) else f"  average_speed_kmh={v_speed}")
        print(f"  traffic_flow_vpm={v_flow:.2f}" if isinstance(v_flow, float) else f"  traffic_flow_vpm={v_flow}")
        print(f"  road_occupancy={v_occ:.4f}" if isinstance(v_occ, float) else f"  road_occupancy={v_occ}")
        print(f"  congestion_score={v_score:.4f}" if isinstance(v_score, float) else f"  congestion_score={v_score}")

        if self._model is None or not self._is_trained:
            print("[Predictor] Insufficient live telemetry — heuristic fallback active.")
            return self._heuristic_forecast(recent_history)

        try:
            # Preprocess live data
            records = self.preprocessor.aggregate_to_minutes(recent_history)
            records = DataPreprocessor.encode_time_features(records)

            lb  = self.config.lookback_min
            hor = HORIZON_MAX

            if len(records) < lb:
                print("[Predictor] Insufficient live telemetry — heuristic fallback active.")
                return self._heuristic_forecast(recent_history)

            print("[Predictor] Using trained TFT model for live forecast.")

            # Build a single sequence from the tail of the records
            enc_records = records[-lb:]
            last_time_s = records[-1]["wall_time_s"]

            # Build future time feature records
            future_records = []
            for step in range(1, hor + 1):
                future_time_s = last_time_s + step * 60.0
                fr = {"wall_time_s": future_time_s}
                DataPreprocessor.encode_time_features([fr])
                future_records.append(fr)

            # Encoder input
            X = np.zeros((1, lb, len(ENCODER_FEATURES)), dtype=np.float32)
            for i, rec in enumerate(enc_records[:lb]):
                for j, feat in enumerate(ENCODER_FEATURES):
                    X[0, i, j] = self.preprocessor._scale(rec.get(feat, 0.0), feat)

            # Decoder input (future time features only)
            D = np.zeros((1, hor, len(TIME_FEATURES)), dtype=np.float32)
            for i, rec in enumerate(future_records[:hor]):
                for j, feat in enumerate(TIME_FEATURES):
                    D[0, i, j] = self.preprocessor._scale(rec.get(feat, 0.0), feat)

            # Raw model output: (1, HORIZON_MAX, n_q)
            raw = self.predict(X, D)[0]   # (HORIZON_MAX, n_q)

            forecast = self._format_forecast(raw)
            forecast["telemetry_status"] = "trained_tft"
            forecast["minute_records"] = len(records)
            return forecast

        except Exception as exc:
            print(f"[Predictor] predict_live error: {exc} — using heuristic")
            print("[Predictor] Insufficient live telemetry — heuristic fallback active.")
            return self._heuristic_forecast(recent_history)

    def _format_forecast(self, raw: np.ndarray) -> dict:
        """
        Convert raw (HORIZON_MAX, n_q) array into the structured forecast dict.

        Args:
            raw: Model output, shape (HORIZON_MAX, n_q), values in [0, 1].

        Returns:
            Structured dict with per-horizon quantile estimates and level labels.
        """
        result: dict = {}
        for name, idx in zip(FORECAST_HORIZONS.keys(), HORIZON_INDICES):
            q10 = float(np.clip(raw[idx, 0], 0.0, 1.0))
            q50 = float(np.clip(raw[idx, 1], 0.0, 1.0))
            q90 = float(np.clip(raw[idx, 2], 0.0, 1.0))

            # Uncertainty flag: wide interval (q90 - q10 > 0.3) means low confidence
            uncertain = (q90 - q10) > 0.30

            result[name] = {
                "q10":       round(q10, 4),
                "q50":       round(q50, 4),
                "q90":       round(q90, 4),
                "level_q50": _score_to_level(q50),
                "level_q90": _score_to_level(q90),   # worst-case level
                "uncertain": uncertain,
            }

        result["model_info"] = {
            "is_trained":   self._is_trained,
            "lookback_min": self.config.lookback_min,
            "quantiles":    QUANTILES,
        }
        return result

    def _heuristic_forecast(self, recent_history: List[dict]) -> dict:
        """
        Rule-based fallback forecast when the TFT model is not yet trained or telemetry is insufficient.

        Uses the mean of the last 5 congestion scores and adds uncertainty.
        This ensures the FastAPI endpoint always returns a valid response.

        Args:
            recent_history: Most recent FrameMetrics dicts.

        Returns:
            Structured forecast dict (same schema as _format_forecast output).
        """
        recent_scores = [
            d.get("congestion_score", 0.3)
            for d in (recent_history[-300:] if recent_history else [])
        ]
        base = float(np.mean(recent_scores)) if recent_scores else 0.3

        # Simple heuristic: assume slight increase over time
        result: dict = {}
        for name, minutes in FORECAST_HORIZONS.items():
            drift = min(0.05 * (minutes / 5), 0.20)   # up to +0.20 over 30 min
            q50 = float(np.clip(base + drift * 0.5, 0.0, 1.0))
            q10 = float(np.clip(q50 - 0.10, 0.0, 1.0))
            q90 = float(np.clip(q50 + 0.15, 0.0, 1.0))
            result[name] = {
                "q10":       round(q10, 4),
                "q50":       round(q50, 4),
                "q90":       round(q90, 4),
                "level_q50": _score_to_level(q50),
                "level_q90": _score_to_level(q90),
                "uncertain": True,   # heuristic always flagged uncertain
            }

        result["model_info"] = {
            "is_trained":   self._is_trained,
            "lookback_min": self.config.lookback_min,
            "quantiles":    QUANTILES,
            "note":         "Heuristic fallback active — insufficient live telemetry history" if self._is_trained else "Heuristic forecast — TFT not yet trained",
        }
        result["telemetry_status"] = "heuristic_fallback"
        return result

    # ── Save / Load ───────────────────────────────────────────────────────────

    def save(self, path: Union[str, Path]) -> None:
        """
        Save the TFT model weights and preprocessor scaler state.

        Two files are written:
            <path>.keras        — Keras model (weights + architecture)
            <path>.scaler.json  — DataPreprocessor MinMax scaler parameters

        Why save the scaler separately?
        ─────────────────────────────────
        Keras saves the model graph and weights, but not Python objects like
        the DataPreprocessor. Without the fitted scaler, predictions would use
        wrong normalisation (e.g. vehicle_count=30 would be scaled differently
        to what training used).

        Args:
            path: Base path. Extensions .keras and .scaler.json are appended.

        Raises:
            RuntimeError: If the model has not been built.
        """
        if self._model is None:
            raise RuntimeError("[Predictor] No model to save. Call build() first.")

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        model_path  = path.with_suffix(".keras")
        scaler_path = path.with_suffix(".scaler.json")

        self._model.save(str(model_path))

        scaler_state = self.preprocessor.get_scaler_state()
        scaler_state["config"] = {
            "lookback_min":  self.config.lookback_min,
            "hidden_units":  self.config.hidden_units,
            "num_heads":     self.config.num_heads,
            "lstm_units":    self.config.lstm_units,
            "dropout_rate":  self.config.dropout_rate,
            "aggregate_fps": self.config.aggregate_fps,
        }
        with open(scaler_path, "w") as fh:
            json.dump(scaler_state, fh, indent=2)

        print(
            f"[Predictor] Saved\n"
            f"  Model  : {model_path}\n"
            f"  Scaler : {scaler_path}"
        )

    @classmethod
    def load(cls, path: Union[str, Path]) -> "CongestionPredictor":
        """
        Load a saved TFT model and scaler from disk.

        Args:
            path: Base path used during save() (without extension).

        Returns:
            A ready-to-use CongestionPredictor with is_trained=True.

        Raises:
            FileNotFoundError: If model or scaler files are not found.
        """
        try:
            import tensorflow as tf
        except ImportError:
            raise ImportError("[Predictor] TensorFlow required for loading.")

        path = Path(path)
        candidates = [
            path,
            Path("backend/models/tft"),
            Path("models/tft"),
            Path(__file__).parent / "models" / "tft",
            Path(__file__).parent.parent / "backend" / "models" / "tft",
        ]

        model_path = None
        scaler_path = None
        for cand in candidates:
            mp = cand.with_suffix(".keras")
            sp = cand.with_suffix(".scaler.json")
            if mp.exists() and sp.exists():
                model_path = mp
                scaler_path = sp
                break

        if model_path is None or scaler_path is None:
            raise FileNotFoundError(
                f"[Predictor] Model or scaler file not found for path: {path} "
                f"(Checked: {[str(c) for c in candidates]})"
            )

        # Load scaler to reconstruct config
        with open(scaler_path) as fh:
            scaler_state = json.load(fh)
        saved_cfg = scaler_state.get("config", {})
        config = TFTConfig(**{k: v for k, v in saved_cfg.items() if hasattr(TFTConfig, k)})

        # Reconstruct predictor
        predictor = cls(config)

        # Load model with custom loss and safe_mode=False for Lambda layers
        predictor._model = tf.keras.models.load_model(
            str(model_path),
            custom_objects={"quantile_loss": _quantile_loss(QUANTILES)},
            safe_mode=False,
        )
        predictor.preprocessor.set_scaler_state(scaler_state)
        predictor._is_trained = True

        print(
            f"[Predictor] Loaded from {model_path}\n"
            f"  Lookback : {config.lookback_min} min\n"
            f"  Params   : {predictor._model.count_params():,}"
        )
        return predictor

    # ── Diagnostics ───────────────────────────────────────────────────────────

    def get_model_summary(self) -> str:
        """Return Keras model.summary() as a string."""
        if self._model is None:
            return "[Predictor] Model not built."
        import io
        buf = io.StringIO()
        self._model.summary(print_fn=lambda x: buf.write(x + "\n"))
        return buf.getvalue()

    def get_stats(self) -> dict:
        """
        Return a status dict for the FastAPI /api/congestion/status endpoint.

        Returns:
            JSON-serialisable dict with model readiness and performance metadata.
        """
        return {
            "is_built":       self._model is not None,
            "is_trained":     self._is_trained,
            "lookback_min":   self.config.lookback_min,
            "horizon_max":    HORIZON_MAX,
            "horizons":       list(FORECAST_HORIZONS.keys()),
            "quantiles":      QUANTILES,
            "hidden_units":   self.config.hidden_units,
            "build_time_s":   round(self._build_time_s, 2),
            "train_time_s":   round(self._train_time_s, 2),
            "total_params":   self._model.count_params() if self._model else 0,
        }

    def __repr__(self) -> str:
        status = "trained" if self._is_trained else ("built" if self._model else "not built")
        return (
            f"CongestionPredictor("
            f"status={status}, "
            f"lookback={self.config.lookback_min}min, "
            f"horizons={list(FORECAST_HORIZONS.keys())})"
        )
