"""
Data Exporter Module
Exports processed and cleaned tabular data into CSV or Excel files.
"""

import io
from typing import Tuple
import pandas as pd


def export_to_csv(df: pd.DataFrame, filename: str = "cleaned_data.csv") -> Tuple[io.BytesIO, str, str]:
    """Exports DataFrame to CSV in-memory buffer."""
    output = io.StringIO()
    df.to_csv(output, index=False, encoding="utf-8")
    bytes_buffer = io.BytesIO(output.getvalue().encode("utf-8"))
    bytes_buffer.seek(0)
    
    clean_name = filename if filename.endswith(".csv") else f"{filename}.csv"
    return bytes_buffer, "text/csv; charset=utf-8", clean_name


def export_to_excel(df: pd.DataFrame, filename: str = "cleaned_data.xlsx") -> Tuple[io.BytesIO, str, str]:
    """Exports DataFrame to Excel (.xlsx) in-memory buffer with styling."""
    bytes_buffer = io.BytesIO()
    with pd.ExcelWriter(bytes_buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="ExtractedData")
    bytes_buffer.seek(0)

    clean_name = filename if filename.endswith(".xlsx") else f"{filename}.xlsx"
    return (
        bytes_buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        clean_name,
    )
