"""
FastAPI Backend Application
Web Data Analyzer & CSV Generator Engine
"""

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl

from scraper import fetch_page_html, extract_tables_from_html, extract_page_content_and_metadata
from analyzer import records_to_cleaned_dataframe, profile_dataframe
from visualizer import generate_chart
from exporter import export_to_csv, export_to_excel
from agent import DataHubAgentEngine

app = FastAPI(
    title="Data-Hub Web Analyzer API",
    description="Python FastAPI service for Web Scraping (BeautifulSoup), Data Profiling (Pandas, NumPy), Visualization (Matplotlib), AI Data Agent, and CSV Export",
    version="2.0.0",
)

agent_engine = DataHubAgentEngine()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---
class ScrapeRequest(BaseModel):
    url: str


class TablePreviewRequest(BaseModel):
    url: Optional[str] = None
    table_index: Optional[int] = 0
    records: Optional[List[Dict[str, Any]]] = None


class ChartRequest(BaseModel):
    records: List[Dict[str, Any]]
    chart_type: str  # histogram, bar, boxplot, heatmap, scatter
    x_col: Optional[str] = None
    y_col: Optional[str] = None
    top_n: Optional[int] = 10


class ExportRequest(BaseModel):
    records: List[Dict[str, Any]]
    format: str = "csv"  # csv or xlsx
    filename: Optional[str] = "extracted_data"


class AgentChatRequest(BaseModel):
    prompt: str
    chat_history: Optional[List[Dict[str, str]]] = None
    table_records: Optional[List[Dict[str, Any]]] = None
    table_profile: Optional[Dict[str, Any]] = None
    page_content: Optional[Dict[str, Any]] = None
    api_key: Optional[str] = None
    provider: Optional[str] = "local"  # "gemini", "openai", "local"
    model: Optional[str] = None


# --- Endpoints ---
@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
        "service": "Data-Hub Web Analyzer & AI Agent",
        "features": ["BeautifulSoup", "Pandas", "NumPy", "Matplotlib", "CSV/Excel Export", "AI Data Agent", "Universal Web Scraper"],
    }


@app.post("/api/scrape")
def scrape_url(payload: ScrapeRequest):
    """
    Legacy/Standard table scraper.
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    try:
        html = fetch_page_html(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch website: {str(e)}")

    try:
        tables = extract_tables_from_html(html, source_url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping error: {str(e)}")

    return {
        "success": True,
        "url": url,
        "tableCount": len(tables),
        "tables": tables,
    }


@app.post("/api/scrape/universal")
def scrape_universal_url(payload: ScrapeRequest):
    """
    Universal Website Reader:
    Extracts webpage text, metadata, headings, sections, AND discovered tables
    from any website URL.
    """
    url = payload.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    try:
        html = fetch_page_html(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch website: {str(e)}")

    try:
        page_content = extract_page_content_and_metadata(html, source_url=url)
        tables = extract_tables_from_html(html, source_url=url)

        # If no tables found, but sections exist, create a structured section table for analysis
        if not tables and page_content.get("sections"):
            section_records = [
                {"Section": s["heading"], "Content": s["text"][:300], "Length": len(s["text"])}
                for s in page_content["sections"]
            ]
            if section_records:
                tables.append({
                    "index": 0,
                    "title": f"Webpage Sections ({page_content.get('title', 'Page')})",
                    "rowCount": len(section_records),
                    "columnCount": 3,
                    "headers": ["Section", "Content", "Length"],
                    "sampleRows": section_records[:5],
                    "allRows": section_records,
                })

        return {
            "success": True,
            "url": url,
            "pageContent": page_content,
            "tableCount": len(tables),
            "tables": tables,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Universal scrape error: {str(e)}")


@app.post("/api/agent/chat")
def agent_chat(payload: AgentChatRequest):
    """
    AI Web & Data Analyst Agent:
    Answers questions, derives insights, generates chart recommendations,
    and analyzes web content/datasets via conversational interface.
    """
    try:
        result = agent_engine.run_agent(
            prompt=payload.prompt,
            chat_history=payload.chat_history,
            table_records=payload.table_records,
            table_profile=payload.table_profile,
            page_content=payload.page_content,
            api_key=payload.api_key,
            provider=payload.provider,
            model=payload.model,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")


@app.post("/api/table/preview")
def preview_table(payload: TablePreviewRequest):
    """
    Cleans and profiles table data into a Pandas DataFrame, returning
    row/col counts, missing values breakdown, data types, and stats.
    """
    records = payload.records

    # If records not provided directly, scrape from URL
    if not records and payload.url:
        try:
            html = fetch_page_html(payload.url)
            tables = extract_tables_from_html(html)
            idx = payload.table_index or 0
            if idx < 0 or idx >= len(tables):
                raise HTTPException(status_code=404, detail="Table index out of bounds")
            records = tables[idx]["allRows"]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to load table: {str(e)}")

    if not records:
        raise HTTPException(status_code=400, detail="No table records provided")

    try:
        df = records_to_cleaned_dataframe(records)
        profile = profile_dataframe(df)
        return {
            "success": True,
            "profile": profile,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data analysis error: {str(e)}")


@app.post("/api/table/chart")
def create_chart(payload: ChartRequest):
    """
    Generates a Matplotlib / Seaborn visualization and returns it as a Base64 image.
    """
    if not payload.records:
        raise HTTPException(status_code=400, detail="No data records provided for chart generation")

    try:
        df = records_to_cleaned_dataframe(payload.records)
        result = generate_chart(
            df=df,
            chart_type=payload.chart_type,
            x_col=payload.x_col,
            y_col=payload.y_col,
            top_n=payload.top_n or 10,
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return {
            "success": True,
            "image": result["image"],
            "message": result["message"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart generation error: {str(e)}")


@app.post("/api/table/export")
def export_table(payload: ExportRequest):
    """
    Exports the cleaned dataset to downloadable CSV or Excel.
    """
    if not payload.records:
        raise HTTPException(status_code=400, detail="No records provided to export")

    try:
        df = records_to_cleaned_dataframe(payload.records)
        filename = payload.filename or "data_hub_export"

        if payload.format.lower() in ["xlsx", "excel"]:
            buffer, media_type, file_name = export_to_excel(df, filename)
        else:
            buffer, media_type, file_name = export_to_csv(df, filename)

        return StreamingResponse(
            buffer,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={file_name}",
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

