"""
Visualizer Module
Generates high-resolution Matplotlib / Seaborn charts and encodes them as Base64 images.
"""

import io
import base64
from typing import Optional, List, Dict, Any
import matplotlib
matplotlib.use("Agg")  # Non-interactive headless backend
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Set dark theme palette matching DataHub's UI
DARK_BG = "#0f172a"
PANEL_BG = "#1e293b"
TEXT_COLOR = "#f1f5f9"
GRID_COLOR = "#334155"
PRIMARY_COLOR = "#6366f1"  # Indigo
SECONDARY_COLOR = "#38bdf8"  # Sky
ACCENT_COLORS = ["#6366f1", "#38bdf8", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"]


def apply_dark_theme(ax, title: str = "", xlabel: str = "", ylabel: str = ""):
    """Applies modern dark-mode styling to matplotlib axes."""
    fig = ax.get_figure()
    fig.patch.set_facecolor(DARK_BG)
    ax.set_facecolor(PANEL_BG)

    # Spines
    for spine in ax.spines.values():
        spine.set_color(GRID_COLOR)
        spine.set_linewidth(1.2)

    # Grid
    ax.grid(True, linestyle="--", alpha=0.4, color=GRID_COLOR)
    ax.set_axisbelow(True)

    # Labels and Titles
    if title:
        ax.set_title(title, color=TEXT_COLOR, fontsize=14, fontweight="bold", pad=15)
    if xlabel:
        ax.set_xlabel(xlabel, color="#94a3b8", fontsize=11, fontweight="medium", labelpad=10)
    if ylabel:
        ax.set_ylabel(ylabel, color="#94a3b8", fontsize=11, fontweight="medium", labelpad=10)

    # Tick parameters
    ax.tick_params(colors="#cbd5e1", labelsize=9)
    plt.xticks(rotation=25 if len(ax.get_xticklabels()) > 5 else 0, ha="right" if len(ax.get_xticklabels()) > 5 else "center")


def fig_to_base64(fig) -> str:
    """Converts a Matplotlib figure to a base64 encoded PNG data URI."""
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=140, bbox_inches="tight", facecolor=DARK_BG)
    buf.seek(0)
    encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
    plt.close(fig)
    return f"data:image/png;base64,{encoded}"


def generate_chart(
    df: pd.DataFrame,
    chart_type: str,
    x_col: Optional[str] = None,
    y_col: Optional[str] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    """
    Generates a chart based on selected type and parameters.
    Returns { "success": bool, "image": str (base64 data URI), "message": str }
    """
    if df.empty:
        return {"success": False, "image": "", "message": "DataFrame is empty"}

    try:
        fig, ax = plt.subplots(figsize=(9, 5))

        # 1. HISTOGRAM / DISTRIBUTION
        if chart_type in ["histogram", "distribution"]:
            if not x_col or x_col not in df.columns:
                # pick first numeric column
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                if len(numeric_cols) == 0:
                    return {"success": False, "image": "", "message": "No numeric column found for histogram"}
                x_col = numeric_cols[0]

            data = df[x_col].dropna()
            if data.empty:
                return {"success": False, "image": "", "message": f"Column '{x_col}' contains no valid data"}

            bins = min(25, max(8, int(np.sqrt(len(data)))))
            sns.histplot(data, bins=bins, kde=True, color=PRIMARY_COLOR, edgecolor="#1e1b4b", ax=ax, alpha=0.75)
            apply_dark_theme(ax, title=f"Distribution of {x_col}", xlabel=x_col, ylabel="Frequency")

        # 2. CATEGORICAL BAR CHART
        elif chart_type in ["bar", "categorical"]:
            if not x_col or x_col not in df.columns:
                x_col = df.columns[0]

            counts = df[x_col].dropna().astype(str).value_counts().head(top_n)
            if counts.empty:
                return {"success": False, "image": "", "message": f"Column '{x_col}' has no valid categories"}

            bars = ax.bar(range(len(counts)), counts.values, color=ACCENT_COLORS[:len(counts)], edgecolor="#0f172a", width=0.6)
            ax.set_xticks(range(len(counts)))
            ax.set_xticklabels(counts.index, rotation=35, ha="right", color="#cbd5e1")

            # Value labels on top of bars
            for bar in bars:
                height = bar.get_height()
                ax.annotate(
                    f"{height}",
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 4),
                    textcoords="offset points",
                    ha="center",
                    va="bottom",
                    color="#f8fafc",
                    fontsize=8,
                    fontweight="bold",
                )

            apply_dark_theme(ax, title=f"Top {top_n} Categories: {x_col}", xlabel=x_col, ylabel="Count")

        # 3. BOX PLOT
        elif chart_type == "boxplot":
            if not x_col or x_col not in df.columns:
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                if len(numeric_cols) == 0:
                    return {"success": False, "image": "", "message": "No numeric column found for box plot"}
                x_col = numeric_cols[0]

            data = df[x_col].dropna()
            sns.boxplot(
                x=data,
                ax=ax,
                color=SECONDARY_COLOR,
                boxprops=dict(facecolor=SECONDARY_COLOR, alpha=0.7, edgecolor="#f1f5f9"),
                medianprops=dict(color="#f43f5e", linewidth=2.5),
                whiskerprops=dict(color="#94a3b8", linewidth=1.5),
                capprops=dict(color="#94a3b8", linewidth=1.5),
                flierprops=dict(marker="o", markerfacecolor="#f59e0b", markersize=6, alpha=0.7),
            )
            apply_dark_theme(ax, title=f"Box Plot (Outliers & Quartiles): {x_col}", xlabel=x_col)

        # 4. CORRELATION HEATMAP
        elif chart_type == "heatmap":
            num_df = df.select_dtypes(include=[np.number])
            if len(num_df.columns) < 2:
                return {
                    "success": False,
                    "image": "",
                    "message": "At least 2 numeric columns are required to generate a correlation heatmap",
                }

            corr = num_df.corr().round(2)
            cmap = sns.diverging_palette(240, 10, as_cmap=True)
            sns.heatmap(
                corr,
                annot=True,
                fmt=".2f",
                cmap=cmap,
                vmin=-1,
                vmax=1,
                ax=ax,
                cbar_kws={"shrink": 0.8},
                linewidths=0.5,
                linecolor=PANEL_BG,
                annot_kws={"size": 10, "weight": "bold", "color": "#f8fafc"},
            )
            apply_dark_theme(ax, title="Pearson Correlation Heatmap")

        # 5. SCATTER / TREND PLOT
        elif chart_type in ["scatter", "trend"]:
            num_cols = df.select_dtypes(include=[np.number]).columns
            if len(num_cols) < 2 and (not x_col or not y_col):
                return {
                    "success": False,
                    "image": "",
                    "message": "Scatter plot requires two numeric columns (X and Y)",
                }

            target_x = x_col if x_col in df.columns else num_cols[0]
            target_y = y_col if y_col and y_col in df.columns else (num_cols[1] if len(num_cols) > 1 else num_cols[0])

            sns.regplot(
                data=df,
                x=target_x,
                y=target_y,
                ax=ax,
                color=PRIMARY_COLOR,
                scatter_kws={"alpha": 0.6, "color": SECONDARY_COLOR, "edgecolor": "#0f172a", "s": 45},
                line_kws={"color": "#f43f5e", "linewidth": 2},
            )
            apply_dark_theme(ax, title=f"{target_x} vs {target_y}", xlabel=target_x, ylabel=target_y)

        else:
            return {"success": False, "image": "", "message": f"Unsupported chart type: {chart_type}"}

        image_uri = fig_to_base64(fig)
        return {"success": True, "image": image_uri, "message": "Chart generated successfully"}

    except Exception as e:
        plt.close("all")
        return {"success": False, "image": "", "message": f"Failed to generate chart: {str(e)}"}
