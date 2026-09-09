"""
Web Scraper Module
Extracts and structures tabular data from web pages using BeautifulSoup4 & Pandas.
"""

import re
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup
import pandas as pd
import io

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def clean_text(text: str) -> str:
    """Removes Wikipedia-style references, extra spaces, and newlines."""
    if not text:
        return ""
    # Remove bracketed citation tags like [1], [edit], [note 1]
    text = re.sub(r"\[\s*(\d+|edit|note\s*\d+|citation needed)\s*\]", "", text, flags=re.IGNORECASE)
    # Replace non-breaking spaces and line breaks with single space
    text = text.replace("\xa0", " ").replace("\r", " ").replace("\n", " ")
    # Collapse consecutive whitespace
    return re.sub(r"\s+", " ", text).strip()


def fetch_page_html(url: str, timeout: int = 15) -> str:
    """Fetches HTML content from a given URL with error handling."""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
    response.raise_for_status()
    return response.text


def find_preceding_heading(table_elem) -> Optional[str]:
    """Attempts to find the nearest preceding heading or caption for context."""
    # 1. Check for <caption> inside table
    caption = table_elem.find("caption")
    if caption:
        cleaned = clean_text(caption.get_text())
        if cleaned:
            return cleaned

    # 2. Walk backwards among previous siblings
    curr = table_elem.find_previous_sibling()
    steps = 0
    while curr and steps < 4:
        if curr.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            text = clean_text(curr.get_text())
            if text:
                return text
        curr = curr.find_previous_sibling()
        steps += 1

    # 3. Check parent previous sibling
    parent = table_elem.parent
    if parent:
        parent_prev = parent.find_previous_sibling()
        if parent_prev and parent_prev.name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
            text = clean_text(parent_prev.get_text())
            if text:
                return text

    return None


def extract_tables_from_html(html_content: str, source_url: str = "") -> List[Dict[str, Any]]:
    """
    Parses HTML, discovers all tables, and extracts preview metadata for each table.
    """
    soup = BeautifulSoup(html_content, "html.parser")
    table_elements = soup.find_all("table")

    discovered_tables = []

    for idx, tbl in enumerate(table_elements):
        # Extract rows
        rows = tbl.find_all("tr")
        if not rows or len(rows) < 2:
            continue

        # Extract headers
        headers: List[str] = []
        header_row = rows[0]
        th_tags = header_row.find_all(["th", "td"])

        if th_tags:
            for c_idx, th in enumerate(th_tags):
                hdr = clean_text(th.get_text())
                if not hdr:
                    hdr = f"Column_{c_idx + 1}"
                headers.append(hdr)

        # De-duplicate column names if duplicate headers exist
        seen_headers = {}
        unique_headers = []
        for h in headers:
            if h in seen_headers:
                seen_headers[h] += 1
                unique_headers.append(f"{h}_{seen_headers[h]}")
            else:
                seen_headers[h] = 0
                unique_headers.append(h)
        headers = unique_headers

        # Extract data rows
        data_rows = []
        for r in rows[1:]:
            cells = r.find_all(["td", "th"])
            if not cells:
                continue
            row_data = [clean_text(c.get_text()) for c in cells]
            # Align length with headers
            if len(row_data) < len(headers):
                row_data.extend([""] * (len(headers) - len(row_data)))
            elif len(row_data) > len(headers):
                # Extend headers if data row is longer
                for extra_idx in range(len(headers), len(row_data)):
                    headers.append(f"Column_{extra_idx + 1}")

            row_dict = {headers[i]: row_data[i] for i in range(len(headers))}
            data_rows.append(row_dict)

        if not data_rows:
            continue

        table_title = find_preceding_heading(tbl) or f"Table {idx + 1}"

        discovered_tables.append({
            "index": idx,
            "title": table_title,
            "rowCount": len(data_rows),
            "columnCount": len(headers),
            "headers": headers,
            "sampleRows": data_rows[:5],
            "allRows": data_rows,
        })

    # If beautifulsoup didn't find any standard tables, try pandas read_html
    if not discovered_tables:
        try:
            dfs = pd.read_html(io.StringIO(html_content))
            for idx, df in enumerate(dfs):
                if df.empty or len(df) < 1:
                    continue
                # Flatten multi-index columns if present
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = ['_'.join(str(c) for c in col).strip() for col in df.columns]
                else:
                    df.columns = [str(c) for c in df.columns]

                records = df.fillna("").astype(str).to_dict(orient="records")
                headers = list(df.columns)
                discovered_tables.append({
                    "index": idx,
                    "title": f"Extracted Table {idx + 1}",
                    "rowCount": len(records),
                    "columnCount": len(headers),
                    "headers": headers,
                    "sampleRows": records[:5],
                    "allRows": records,
                })
        except Exception:
            pass

    # If still no tables found, try extracting definition lists <dl> or key-value list structures
    if not discovered_tables:
        try:
            dl_elements = soup.find_all("dl")
            for idx, dl in enumerate(dl_elements):
                dts = [clean_text(dt.get_text()) for dt in dl.find_all("dt")]
                dds = [clean_text(dd.get_text()) for dd in dl.find_all("dd")]
                if dts and dds and len(dts) == len(dds) and len(dts) >= 2:
                    records = [{"Property": dts[i], "Value": dds[i]} for i in range(len(dts))]
                    discovered_tables.append({
                        "index": idx,
                        "title": f"Key-Value List {idx + 1}",
                        "rowCount": len(records),
                        "columnCount": 2,
                        "headers": ["Property", "Value"],
                        "sampleRows": records[:5],
                        "allRows": records,
                    })
        except Exception:
            pass

    return discovered_tables


def extract_page_content_and_metadata(html_content: str, source_url: str = "") -> Dict[str, Any]:
    """
    Universal Webpage Extractor:
    Reads and structures any website URL - extracting Title, Metadata, Headings,
    Main Article / Paragraphs, Lists, and semantic text content for AI Agent analysis.
    """
    soup = BeautifulSoup(html_content, "html.parser")

    # 1. Page Title
    title = ""
    if soup.title and soup.title.string:
        title = clean_text(soup.title.string)
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title = clean_text(og_title["content"])
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = clean_text(h1.get_text())
    if not title:
        title = source_url or "Web Document"

    # 2. Meta Description & Summary
    description = ""
    meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    if meta_desc and meta_desc.get("content"):
        description = clean_text(meta_desc["content"])

    # 3. Canonical URL & Site Name
    site_name = ""
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        site_name = clean_text(og_site["content"])

    # 4. Extract Headings Hierarchy
    headings = []
    for h_tag in soup.find_all(["h1", "h2", "h3", "h4"]):
        h_text = clean_text(h_tag.get_text())
        if h_text and len(h_text) > 1:
            headings.append({
                "level": h_tag.name.lower(),
                "text": h_text,
            })

    # 5. Extract Main Text Sections (Strip script, style, nav, footer, noscript)
    content_soup = BeautifulSoup(html_content, "html.parser")
    for tag in content_soup(["script", "style", "noscript", "svg", "header", "footer", "nav", "iframe", "aside"]):
        tag.decompose()

    # Look for main semantic container if present (e.g. <main>, <article>, #content, .content)
    main_container = (
        content_soup.find("main")
        or content_soup.find("article")
        or content_soup.find("div", {"id": re.compile(r"content|main|article|body", re.I)})
        or content_soup.find("div", {"class": re.compile(r"content|main|article|post", re.I)})
        or content_soup.body
        or content_soup
    )

    paragraphs = []
    structured_sections = []
    current_section = {"heading": title, "content": []}

    for elem in main_container.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        txt = clean_text(elem.get_text())
        if not txt or len(txt) < 15:
            continue

        if elem.name in ["h1", "h2", "h3"]:
            if current_section["content"]:
                structured_sections.append({
                    "heading": current_section["heading"],
                    "text": " ".join(current_section["content"]),
                })
            current_section = {"heading": txt, "content": []}
        else:
            current_section["content"].append(txt)
            paragraphs.append(txt)

    if current_section["content"]:
        structured_sections.append({
            "heading": current_section["heading"],
            "text": " ".join(current_section["content"]),
        })

    # Clean full plain text
    full_text = "\n\n".join(paragraphs) if paragraphs else clean_text(main_container.get_text())
    # Truncate if excessively large (keep first 30k chars for agent context)
    truncated_text = full_text[:30000] if len(full_text) > 30000 else full_text
    words = full_text.split()
    word_count = len(words)
    estimated_read_time = max(1, round(word_count / 200))

    return {
        "url": source_url,
        "title": title,
        "siteName": site_name,
        "description": description,
        "headings": headings[:25],
        "sections": structured_sections[:15],
        "paragraphs": paragraphs[:40],
        "textContent": truncated_text,
        "wordCount": word_count,
        "readTimeMinutes": estimated_read_time,
    }

