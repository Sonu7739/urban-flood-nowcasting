"""
Urban Flood Nowcasting System — AI Model Training
==================================================
Trains XGBoost, LightGBM, and Random Forest regressors.
Evaluates on RMSE, MAE, R². Auto-selects best model.
Saves: models/best_model.pkl, models/metrics.json
Generates: models/plots/

Usage:
    python ai/train.py [--data datasets/processed/training_dataset.csv]
"""

import argparse
import json
import os
import pickle
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

PROJECT_ROOT = Path(__file__).parent.parent
MODELS_DIR   = PROJECT_ROOT / "models"
PLOTS_DIR    = MODELS_DIR / "plots"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
PLOTS_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLS = [
    "rainfall_mm_hr", "elevation", "slope", "curvature",
    "flow_accumulation", "distance_to_drain", "drain_capacity",
    "impervious_ratio", "road_width", "historical_flood_score",
]
TARGET_COL = "water_depth_cm"


# ═══════════════════════════════════════════════════════════════════════════════
# Load & Split Data
# ═══════════════════════════════════════════════════════════════════════════════

def load_data(path: Path):
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values
    print(f"  Dataset: {len(df):,} samples × {len(FEATURE_COLS)} features")
    return X, y, df


# ═══════════════════════════════════════════════════════════════════════════════
# Model Definitions
# ═══════════════════════════════════════════════════════════════════════════════

def build_models():
    models = {}

    # XGBoost
    try:
        import xgboost as xgb
        models["XGBoost"] = xgb.XGBRegressor(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, verbosity=0,
        )
    except ImportError:
        print("  ⚠  XGBoost not installed — skipping")

    # LightGBM
    try:
        import lightgbm as lgb
        models["LightGBM"] = lgb.LGBMRegressor(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, verbose=-1,
        )
    except ImportError:
        print("  ⚠  LightGBM not installed — skipping")

    # Random Forest (always available)
    models["RandomForest"] = RandomForestRegressor(
        n_estimators=200, max_depth=12, min_samples_leaf=2,
        random_state=42, n_jobs=-1,
    )

    return models


# ═══════════════════════════════════════════════════════════════════════════════
# Training & Evaluation
# ═══════════════════════════════════════════════════════════════════════════════

def evaluate_model(model, X_train, X_test, y_train, y_test, name: str) -> dict:
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae  = float(mean_absolute_error(y_test, y_pred))
    r2   = float(r2_score(y_test, y_pred))

    print(f"    {name:15s} → RMSE: {rmse:.3f}  MAE: {mae:.3f}  R²: {r2:.4f}")
    return {"name": name, "rmse": rmse, "mae": mae, "r2": r2, "model": model, "y_pred": y_pred}


# ═══════════════════════════════════════════════════════════════════════════════
# Plotting
# ═══════════════════════════════════════════════════════════════════════════════

DARK_BG  = "#0D1117"
ACCENT   = "#00D4AA"
ACCENT2  = "#FF6B6B"
ACCENT3  = "#FFD93D"

def set_dark_style():
    plt.rcParams.update({
        "figure.facecolor":  DARK_BG,
        "axes.facecolor":    "#161B22",
        "axes.edgecolor":    "#30363D",
        "axes.labelcolor":   "#C9D1D9",
        "xtick.color":       "#8B949E",
        "ytick.color":       "#8B949E",
        "text.color":        "#C9D1D9",
        "grid.color":        "#21262D",
        "grid.alpha":        0.7,
        "font.family":       "DejaVu Sans",
    })


def plot_feature_importance(best_model, model_name: str):
    set_dark_style()
    fig, ax = plt.subplots(figsize=(10, 6))
    fig.patch.set_facecolor(DARK_BG)

    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        idx = np.argsort(importances)
        colors = plt.cm.RdYlGn(np.linspace(0.2, 0.9, len(FEATURE_COLS)))
        bars = ax.barh(
            [FEATURE_COLS[i] for i in idx],
            importances[idx],
            color=colors[idx],
            edgecolor="#30363D",
            linewidth=0.5,
        )
        ax.set_xlabel("Importance Score", fontsize=12)
        ax.set_title(f"Feature Importance — {model_name}", fontsize=14, color=ACCENT, fontweight="bold")
        ax.grid(axis="x", alpha=0.3)
        # Annotate bars
        for bar, val in zip(bars, importances[idx]):
            ax.text(val + 0.002, bar.get_y() + bar.get_height()/2,
                    f"{val:.3f}", va="center", fontsize=9, color="#C9D1D9")
    else:
        ax.text(0.5, 0.5, "Feature importances not available",
                ha="center", va="center", transform=ax.transAxes)

    plt.tight_layout()
    out = PLOTS_DIR / "feature_importance.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Feature importance plot → {out.name}")


def plot_prediction_vs_actual(y_test, y_pred, model_name: str):
    set_dark_style()
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    fig.patch.set_facecolor(DARK_BG)
    fig.suptitle(f"Model Performance — {model_name}", fontsize=15, color=ACCENT, fontweight="bold")

    # Scatter: pred vs actual
    ax = axes[0]
    ax.scatter(y_test, y_pred, alpha=0.4, s=15, color=ACCENT, edgecolors="none")
    lim = max(y_test.max(), y_pred.max()) * 1.05
    ax.plot([0, lim], [0, lim], "--", color=ACCENT2, linewidth=1.5, label="Perfect fit")
    ax.set_xlabel("Actual Water Depth (cm)")
    ax.set_ylabel("Predicted Water Depth (cm)")
    ax.set_title("Predicted vs Actual", color="#C9D1D9")
    ax.legend(facecolor="#161B22", edgecolor="#30363D")
    ax.grid(True, alpha=0.3)

    # Residual plot
    ax = axes[1]
    residuals = y_pred - y_test
    ax.scatter(y_pred, residuals, alpha=0.4, s=15, color=ACCENT3, edgecolors="none")
    ax.axhline(0, color=ACCENT2, linewidth=1.5, linestyle="--")
    ax.set_xlabel("Predicted Water Depth (cm)")
    ax.set_ylabel("Residual (cm)")
    ax.set_title("Residual Plot", color="#C9D1D9")
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    out = PLOTS_DIR / "prediction_vs_actual.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Prediction vs Actual plot → {out.name}")


def plot_model_comparison(results: list):
    set_dark_style()
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    fig.patch.set_facecolor(DARK_BG)
    fig.suptitle("Model Comparison Dashboard", fontsize=15, color=ACCENT, fontweight="bold")

    names  = [r["name"] for r in results]
    colors = [ACCENT, ACCENT2, ACCENT3][:len(results)]
    metrics = [
        ("rmse", "RMSE (cm) ↓", axes[0]),
        ("mae",  "MAE (cm) ↓",  axes[1]),
        ("r2",   "R² Score ↑",  axes[2]),
    ]
    for metric, label, ax in metrics:
        vals = [r[metric] for r in results]
        bars = ax.bar(names, vals, color=colors, edgecolor="#30363D", linewidth=0.8)
        ax.set_title(label, color="#C9D1D9", fontsize=12)
        ax.grid(axis="y", alpha=0.3)
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                    f"{val:.3f}", ha="center", va="bottom", fontsize=10)

    plt.tight_layout()
    out = PLOTS_DIR / "model_comparison.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Model comparison plot → {out.name}")


def plot_depth_distribution(y_test, y_pred):
    set_dark_style()
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor(DARK_BG)

    bins = np.linspace(0, max(y_test.max(), y_pred.max()), 40)
    ax.hist(y_test, bins=bins, alpha=0.6, color=ACCENT,  label="Actual",    edgecolor="none")
    ax.hist(y_pred, bins=bins, alpha=0.6, color=ACCENT2, label="Predicted", edgecolor="none")
    ax.set_xlabel("Water Depth (cm)")
    ax.set_ylabel("Frequency")
    ax.set_title("Flood Depth Distribution", fontsize=14, color=ACCENT, fontweight="bold")
    ax.legend(facecolor="#161B22", edgecolor="#30363D")
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    out = PLOTS_DIR / "depth_distribution.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  ✓ Depth distribution plot → {out.name}")


# ═══════════════════════════════════════════════════════════════════════════════
# Main Training Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="UFNS Model Trainer")
    parser.add_argument(
        "--data", default="datasets/processed/training_dataset.csv",
        help="Path to training CSV"
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed",      type=int,   default=42)
    args = parser.parse_args()

    data_path = PROJECT_ROOT / args.data
    if not data_path.exists():
        print(f"⚠  Training dataset not found at {data_path}")
        print("   Running dataset generator + pipeline first ...")
        os.system(f"python {PROJECT_ROOT / 'ai' / 'dataset_generator.py'}")
        os.system(f"python {PROJECT_ROOT / 'ai' / 'data_pipeline.py'}")

    print("\n🤖 UFNS AI Model Training Pipeline")
    print("=" * 55)

    print("\n[1] Loading data ...")
    X, y, df = load_data(data_path)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed
    )
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    print("\n[2] Training models ...")
    models    = build_models()
    results   = []

    for name, model in models.items():
        print(f"  ▸ {name} ...")
        res = evaluate_model(model, X_train, X_test, y_train, y_test, name)
        results.append(res)

    if not results:
        raise RuntimeError("No models could be trained. Install at least scikit-learn.")

    print("\n[3] Selecting best model (lowest RMSE) ...")
    best = min(results, key=lambda r: r["rmse"])
    print(f"  🏆 Best model: {best['name']}  RMSE={best['rmse']:.3f}  R²={best['r2']:.4f}")

    print("\n[4] Saving model artifact ...")
    model_out = MODELS_DIR / "best_model.pkl"
    with open(model_out, "wb") as f:
        pickle.dump({"model": best["model"], "features": FEATURE_COLS, "name": best["name"]}, f)
    print(f"  ✓ Saved → {model_out}")

    print("\n[5] Saving metrics ...")
    metrics = {
        "best_model":  best["name"],
        "rmse":        round(best["rmse"], 4),
        "mae":         round(best["mae"], 4),
        "r2":          round(best["r2"], 4),
        "features":    FEATURE_COLS,
        "n_train":     int(len(X_train)),
        "n_test":      int(len(X_test)),
        "all_models":  [
            {"name": r["name"], "rmse": round(r["rmse"], 4),
             "mae": round(r["mae"], 4), "r2": round(r["r2"], 4)}
            for r in results
        ],
    }
    metrics_out = MODELS_DIR / "metrics.json"
    with open(metrics_out, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  ✓ Saved → {metrics_out}")

    print("\n[6] Generating plots ...")
    plot_feature_importance(best["model"], best["name"])
    plot_prediction_vs_actual(y_test, best["y_pred"], best["name"])
    plot_model_comparison(results)
    plot_depth_distribution(y_test, best["y_pred"])

    print(f"\n✅ Training complete! Best model: {best['name']}")
    print(f"   RMSE={best['rmse']:.2f} cm | MAE={best['mae']:.2f} cm | R²={best['r2']:.4f}")
    print(f"   Model: {model_out}")
    print(f"   Plots: {PLOTS_DIR}/")


if __name__ == "__main__":
    main()
