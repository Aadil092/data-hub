"""
Data Analyzer Module
Cleans, profiles, and analyzes tabular data using Pandas and NumPy.
"""

from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np
import re


def clean_and_convert_series(series: pd.Series) -> pd.Series:
    """
    Intelligently attempts to convert a text series to numeric or datetime
    by stripping currency symbols, commas, and percentage signs.
    """
    # If already numeric, return as is
    if pd.api.types.is_numeric_dtype(series):
        return series

    # Drop NA for sampling
    non_null = series.dropna().astype(str).str.strip()
    if non_null.empty:
        return series

    # Try numeric conversion after cleaning common patterns
    # e.g., "$1,234.50", "45%", "€90.00"
    cleaned = non_null.str.replace(r"[$,€£¥%]", "", regex=True).str.replace(",", "", regex=False).str.strip()
    
    # Check what proportion converts to numeric
    numeric_converted = pd.to_numeric(cleaned, errors="coerce")
    valid_ratio = numeric_converted.notna().sum() / len(non_null)

    # If over 75% are valid numbers, treat column as numeric
    if valid_ratio >= 0.75:
        # Apply to entire original series
        full_cleaned = series.astype(str).str.replace(r"[$,€£¥%]", "", regex=True).str.replace(",", "", regex=False).str.strip()
        # Treat empty strings or 'nan' as actual NaN
        full_cleaned = full_cleaned.replace(["nan", "None", "", "N/A", "null", "-", "—"], np.nan)
        return pd.to_numeric(full_cleaned, errors="coerce")

    # Try datetime conversion if text looks like a date (e.g. YYYY-MM-DD or MM/DD/YYYY)
    if non_null.str.contains(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", regex=True).mean() > 0.6:
        try:
            date_converted = pd.to_datetime(series, errors="coerce")
            if date_converted.notna().sum() / len(non_null) >= 0.7:
                return date_converted
        except Exception:
            pass

    # Replace empty-like strings with NaN
    cleaned_text = series.replace(["", "nan", "None", "N/A", "null", "-", "—"], np.nan)
    return cleaned_text


def records_to_cleaned_dataframe(records: List[Dict[str, Any]]) -> pd.DataFrame:
    """Creates a cleaned and typed DataFrame from a list of record dicts."""
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)

    # Clean column names (strip spaces, normalize)
    df.columns = [str(col).strip() for col in df.columns]

    # Convert each series
    for col in df.columns:
        df[col] = clean_and_convert_series(df[col])

    return df


def profile_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes a comprehensive profile of the DataFrame:
    - Dimensions (rows, cols)
    - Missing value analysis (counts, percentages)
    - Data types
    - Numerical summary statistics (mean, median, min, max, std, quartiles)
    - Categorical summary statistics (unique counts, mode)
    - Correlation matrix
    """
    total_rows = len(df)
    total_cols = len(df.columns)

    if total_rows == 0 or total_cols == 0:
        return {
            "totalRows": 0,
            "totalColumns": 0,
            "columns": [],
            "missingSummary": {},
            "columnStats": {},
            "correlations": {},
            "previewRows": [],
        }

    columns_info = []
    missing_summary = {}
    column_stats = {}

    numeric_cols = []
    categorical_cols = []

    for col in df.columns:
        series = df[col]
        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_rows) * 100, 2) if total_rows > 0 else 0

        # Classify dtype
        if pd.api.types.is_numeric_dtype(series):
            dtype_label = "numeric"
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(series):
            dtype_label = "datetime"
        elif pd.api.types.is_bool_dtype(series):
            dtype_label = "boolean"
        else:
            dtype_label = "text"
            categorical_cols.append(col)

        columns_info.append({
            "name": col,
            "type": dtype_label,
            "rawType": str(series.dtype),
            "missingCount": null_count,
            "missingPercentage": null_pct,
            "uniqueCount": int(series.nunique(dropna=True)),
        })

        missing_summary[col] = {
            "missing": null_count,
            "percentage": null_pct,
            "present": total_rows - null_count,
        }

        # Calculate statistics
        if dtype_label == "numeric":
            valid_nums = series.dropna()
            if not valid_nums.empty:
                column_stats[col] = {
                    "type": "numeric",
                    "count": int(valid_nums.count()),
                    "mean": round(float(valid_nums.mean()), 2),
                    "std": round(float(valid_nums.std()), 2) if len(valid_nums) > 1 else 0.0,
                    "min": round(float(valid_nums.min()), 2),
                    "p25": round(float(valid_nums.quantile(0.25)), 2),
                    "median": round(float(valid_nums.median()), 2),
                    "p75": round(float(valid_nums.quantile(0.75)), 2),
                    "max": round(float(valid_nums.max()), 2),
                }
        else:
            valid_cats = series.dropna().astype(str)
            if not valid_cats.empty:
                top_counts = valid_cats.value_counts().head(5).to_dict()
                column_stats[col] = {
                    "type": "categorical",
                    "count": int(valid_cats.count()),
                    "unique": int(valid_cats.nunique()),
                    "topValue": str(valid_cats.mode().iloc[0]) if not valid_cats.empty else None,
                    "topValueCount": int(valid_cats.value_counts().iloc[0]) if not valid_cats.empty else 0,
                    "topCategories": {str(k): int(v) for k, v in top_counts.items()},
                }

    # Correlation matrix for numeric columns
    correlations = {}
    if len(numeric_cols) >= 2:
        try:
            corr_df = df[numeric_cols].corr().round(3)
            # Replace NaNs with 0
            corr_df = corr_df.fillna(0)
            correlations = corr_df.to_dict()
        except Exception:
            correlations = {}

    # Preview rows (top 50 rows converted to JSON-serializable format)
    preview_df = df.head(50).copy()
    # Format datetimes and NaNs
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
        elif pd.api.types.is_numeric_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].apply(lambda x: None if pd.isna(x) else x)
        else:
            preview_df[col] = preview_df[col].apply(lambda x: "" if pd.isna(x) else str(x))

    preview_rows = preview_df.to_dict(orient="records")

    return {
        "totalRows": total_rows,
        "totalColumns": total_cols,
        "numericColumns": numeric_cols,
        "categoricalColumns": categorical_cols,
        "columns": columns_info,
        "missingSummary": missing_summary,
        "columnStats": column_stats,
        "correlations": correlations,
        "previewRows": preview_rows,
    }
