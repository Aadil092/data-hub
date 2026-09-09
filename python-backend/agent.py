"""
Data-Hub AI Agent Engine
Provides conversational AI analysis over scraped web content, tables, and CSV data.
Supports Google Gemini, OpenAI, and a built-in Local Analytical Rule & Statistical Engine.
"""

import os
import json
import re
from typing import List, Dict, Any, Optional
import requests
import pandas as pd
import numpy as np


class DataHubAgentEngine:
    def __init__(self):
        pass

    def run_agent(
        self,
        prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        table_records: Optional[List[Dict[str, Any]]] = None,
        table_profile: Optional[Dict[str, Any]] = None,
        page_content: Optional[Dict[str, Any]] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = "gemini",  # "gemini", "openai", "local"
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes an agent inquiry using either external LLM (Gemini/OpenAI)
        or intelligent built-in statistical/NLP analytical fallback.
        """
        prompt_text = prompt.strip()
        if not prompt_text:
            return {
                "success": False,
                "answer": "Please provide a query or instruction for the AI Agent.",
                "insights": [],
                "suggestions": [],
            }

        # Check for API keys from environment if not explicitly passed
        env_gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
        env_openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

        effective_provider = provider or "local"
        effective_key = (api_key or "").strip()

        if effective_provider == "gemini" and not effective_key and env_gemini_key:
            effective_key = env_gemini_key
        elif effective_provider == "openai" and not effective_key and env_openai_key:
            effective_key = env_openai_key

        # If user explicitly requested Gemini/OpenAI but no key is present, fallback gracefully to local analytical AI
        if effective_provider == "gemini" and effective_key:
            try:
                return self._call_gemini_api(
                    prompt=prompt_text,
                    api_key=effective_key,
                    model=model or "gemini-2.0-flash",
                    chat_history=chat_history or [],
                    table_records=table_records,
                    table_profile=table_profile,
                    page_content=page_content,
                )
            except Exception as e:
                # If remote call fails, fall back to local engine with error note
                fallback = self._run_local_analytical_engine(
                    prompt=prompt_text,
                    table_records=table_records,
                    table_profile=table_profile,
                    page_content=page_content,
                )
                fallback["warning"] = f"Gemini API request note: {str(e)}. Switched to built-in analytical agent."
                return fallback

        elif effective_provider == "openai" and effective_key:
            try:
                return self._call_openai_api(
                    prompt=prompt_text,
                    api_key=effective_key,
                    model=model or "gpt-4o-mini",
                    chat_history=chat_history or [],
                    table_records=table_records,
                    table_profile=table_profile,
                    page_content=page_content,
                )
            except Exception as e:
                fallback = self._run_local_analytical_engine(
                    prompt=prompt_text,
                    table_records=table_records,
                    table_profile=table_profile,
                    page_content=page_content,
                )
                fallback["warning"] = f"OpenAI API request note: {str(e)}. Switched to built-in analytical agent."
                return fallback

        # Default / Local Analytical Engine
        return self._run_local_analytical_engine(
            prompt=prompt_text,
            table_records=table_records,
            table_profile=table_profile,
            page_content=page_content,
        )

    def _build_system_context(
        self,
        table_records: Optional[List[Dict[str, Any]]] = None,
        table_profile: Optional[Dict[str, Any]] = None,
        page_content: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Constructs a comprehensive analytical context prompt for LLM engines."""
        context_parts = [
            "You are DATAHUB AI Web & Data Analyst Agent, an expert in web intelligence, statistical analysis, business insights, Python, and data visualization.",
            "You have access to real-time scraped website content and tabular dataset records.",
        ]

        if page_content:
            context_parts.append("\n--- WEBPAGE CONTENT & METADATA ---")
            if page_content.get("title"):
                context_parts.append(f"Webpage Title: {page_content.get('title')}")
            if page_content.get("url"):
                context_parts.append(f"Source URL: {page_content.get('url')}")
            if page_content.get("description"):
                context_parts.append(f"Meta Description: {page_content.get('description')}")
            if page_content.get("headings"):
                h_summary = ", ".join([f"[{h.get('level')}] {h.get('text')}" for h in page_content.get("headings", [])[:10]])
                context_parts.append(f"Key Headings: {h_summary}")
            if page_content.get("textContent"):
                snippet = page_content.get("textContent")[:6000]
                context_parts.append(f"Page Text Excerpt:\n{snippet}\n")

        if table_records:
            total_r = len(table_records)
            sample = table_records[:10]
            headers = list(table_records[0].keys()) if table_records else []
            context_parts.append("\n--- TABULAR DATASET ---")
            context_parts.append(f"Total Rows: {total_r} | Total Columns: {len(headers)}")
            context_parts.append(f"Columns: {', '.join(headers)}")
            context_parts.append(f"Sample Data (First {len(sample)} rows JSON):\n{json.dumps(sample, indent=2)}")

        if table_profile:
            context_parts.append("\n--- STATISTICAL PROFILE ---")
            if "columns" in table_profile:
                col_types = {c.get("name"): c.get("type") for c in table_profile.get("columns", [])}
                context_parts.append(f"Data Types: {json.dumps(col_types)}")
            if "columnStats" in table_profile:
                context_parts.append(f"Numeric Column Stats: {json.dumps(table_profile.get('columnStats'), indent=2)}")
            if "correlations" in table_profile and table_profile.get("correlations"):
                context_parts.append(f"Correlations: {json.dumps(table_profile.get('correlations'))}")

        context_parts.append(
            "\nInstructions:\n"
            "- Provide direct, clear, structured responses with Markdown headings, bullet points, bold highlights, and tables where useful.\n"
            "- If answering numerical questions, cite exact numbers and calculations from the dataset.\n"
            "- If writing Python code, format as ```python ... ```.\n"
            "- Include 3-4 insightful key takeaways at the end.\n"
        )
        return "\n".join(context_parts)

    def _call_gemini_api(
        self,
        prompt: str,
        api_key: str,
        model: str,
        chat_history: List[Dict[str, str]],
        table_records: Optional[List[Dict[str, Any]]],
        table_profile: Optional[Dict[str, Any]],
        page_content: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Calls Google Gemini API using direct REST interface."""
        system_context = self._build_system_context(table_records, table_profile, page_content)

        # Structure contents array for Gemini
        contents = []
        # Add system instruction via user turn or systemInstruction if model supports
        contents.append({
            "role": "user",
            "parts": [{"text": f"System Context:\n{system_context}\n\nPlease acknowledge and get ready."}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "Understood. I have reviewed the webpage content, dataset structure, and statistical profile. How can I assist you with this data?"}]
        })

        # Add recent history
        for msg in chat_history[-6:]:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.get("content", "")}]
            })

        # Add current user prompt
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 2048,
            }
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=40)
        if resp.status_code != 200:
            err_detail = resp.text
            try:
                err_json = resp.json()
                if "error" in err_json and "message" in err_json["error"]:
                    err_detail = err_json["error"]["message"]
            except Exception:
                pass
            raise Exception(f"Gemini API Error ({resp.status_code}): {err_detail}")

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates or "content" not in candidates[0]:
            raise Exception("Empty response received from Gemini API")

        parts = candidates[0]["content"].get("parts", [])
        text_output = "".join([p.get("text", "") for p in parts])

        insights = self._extract_insights_from_text(text_output)
        suggestions = self._generate_follow_up_suggestions(prompt, table_profile, page_content)
        chart_rec = self._detect_chart_recommendation(prompt, text_output, table_profile)

        return {
            "success": True,
            "provider": "gemini",
            "model": model,
            "answer": text_output,
            "insights": insights,
            "suggestions": suggestions,
            "recommendedChart": chart_rec,
        }

    def _call_openai_api(
        self,
        prompt: str,
        api_key: str,
        model: str,
        chat_history: List[Dict[str, str]],
        table_records: Optional[List[Dict[str, Any]]],
        table_profile: Optional[Dict[str, Any]],
        page_content: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Calls OpenAI API using direct REST interface."""
        system_context = self._build_system_context(table_records, table_profile, page_content)

        messages = [
            {"role": "system", "content": system_context}
        ]

        for msg in chat_history[-6:]:
            messages.append({
                "role": "user" if msg.get("role") == "user" else "assistant",
                "content": msg.get("content", "")
            })

        messages.append({"role": "user", "content": prompt})

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 2048,
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=40)
        if resp.status_code != 200:
            err_detail = resp.text
            try:
                err_json = resp.json()
                if "error" in err_json and "message" in err_json["error"]:
                    err_detail = err_json["error"]["message"]
            except Exception:
                pass
            raise Exception(f"OpenAI API Error ({resp.status_code}): {err_detail}")

        data = resp.json()
        choice = data["choices"][0]["message"]
        text_output = choice.get("content", "")

        insights = self._extract_insights_from_text(text_output)
        suggestions = self._generate_follow_up_suggestions(prompt, table_profile, page_content)
        chart_rec = self._detect_chart_recommendation(prompt, text_output, table_profile)

        return {
            "success": True,
            "provider": "openai",
            "model": model,
            "answer": text_output,
            "insights": insights,
            "suggestions": suggestions,
            "recommendedChart": chart_rec,
        }

    def _run_local_analytical_engine(
        self,
        prompt: str,
        table_records: Optional[List[Dict[str, Any]]] = None,
        table_profile: Optional[Dict[str, Any]] = None,
        page_content: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Intelligent Local Rule-Based & Statistical Analytical AI Engine.
        Executes real Pandas queries, aggregations, anomaly detection,
        and content summarization with zero API key requirement.
        """
        p_lower = prompt.lower()
        records = table_records or []
        df = pd.DataFrame(records) if records else pd.DataFrame()

        # Clean numeric cols if df exists
        numeric_cols = []
        if not df.empty:
            for col in df.columns:
                cleaned = df[col].astype(str).str.replace(r"[$,€£¥%]", "", regex=True).str.replace(",", "", regex=False).str.strip()
                num_series = pd.to_numeric(cleaned, errors="coerce")
                if num_series.notna().sum() / len(df) >= 0.6:
                    df[col] = num_series
                    numeric_cols.append(col)

        insights = []
        chart_rec = None
        answer_paragraphs = []

        # 1. Summary / Overview Queries
        if any(w in p_lower for w in ["summar", "overview", "what is this", "explain", "about", "key points", "brief"]):
            answer_paragraphs.append("### 🌐 Data & Content Overview\n")
            if page_content:
                title = page_content.get("title", "Webpage")
                url = page_content.get("url", "")
                words = page_content.get("wordCount", 0)
                read_time = page_content.get("readTimeMinutes", 1)
                desc = page_content.get("description", "")
                answer_paragraphs.append(f"**Webpage Source:** [{title}]({url})\n")
                if desc:
                    answer_paragraphs.append(f"**Description:** *{desc}*\n")
                answer_paragraphs.append(f"- **Total Read Time:** ~{read_time} min ({words:,} words)")
                if page_content.get("headings"):
                    h_list = [h.get("text") for h in page_content.get("headings", [])[:6]]
                    answer_paragraphs.append(f"- **Key Sections:** {', '.join(h_list)}")

            if not df.empty:
                answer_paragraphs.append(f"\n**Tabular Dataset Structure:**")
                answer_paragraphs.append(f"- **Total Records:** {len(df):,} rows across {len(df.columns)} columns")
                answer_paragraphs.append(f"- **Quantitative Metrics:** {', '.join(numeric_cols) if numeric_cols else 'None detected'}")
                answer_paragraphs.append(f"- **Dimensions / Categories:** {', '.join([c for c in df.columns if c not in numeric_cols][:6])}")

            insights.append("Analyzed structured entity schema and webpage core narrative.")
            if numeric_cols:
                insights.append(f"Found {len(numeric_cols)} quantifiable metrics ready for statistical modeling.")

        # 2. Top / Highest / Maximum / Best / Lowest / Minimum Queries
        elif any(w in p_lower for w in ["top", "highest", "maximum", "max", "best", "lowest", "minimum", "min", "bottom", "rank", "leader"]):
            match_n = re.search(r"\b(\d+)\b", p_lower)
            top_n = int(match_n.group(1)) if match_n else 5

            is_lowest = any(w in p_lower for w in ["lowest", "minimum", "min", "bottom", "worst"])

            if not df.empty and numeric_cols:
                # Find most relevant numeric col
                target_col = numeric_cols[0]
                for c in numeric_cols:
                    if c.lower() in p_lower:
                        target_col = c
                        break

                label_col = [c for c in df.columns if c not in numeric_cols][0] if len(df.columns) > len(numeric_cols) else df.columns[0]

                sorted_df = df.sort_values(by=target_col, ascending=is_lowest).dropna(subset=[target_col]).head(top_n)

                answer_paragraphs.append(f"### 🏆 {'Bottom' if is_lowest else 'Top'} {top_n} Records by `{target_col}`\n")
                answer_paragraphs.append(f"Here are the top ranked entries evaluated against metric **{target_col}**:\n")

                table_md = [f"| Rank | {label_col} | {target_col} |"]
                table_md.append("|:---:|:---|:---:|")
                for rank, (_, row) in enumerate(sorted_df.iterrows(), 1):
                    val = row[target_col]
                    formatted_val = f"{val:,.2f}" if isinstance(val, (int, float)) else str(val)
                    table_md.append(f"| {rank} | **{row[label_col]}** | `{formatted_val}` |")

                answer_paragraphs.append("\n".join(table_md))

                top_item = sorted_df.iloc[0]
                insights.append(f"Top entry is **{top_item[label_col]}** with {target_col} = {top_item[target_col]}.")
                insights.append(f"Computed dynamic rank ordering over {len(df)} total rows.")
                chart_rec = {"chartType": "bar", "xCol": label_col, "yCol": target_col}
            else:
                answer_paragraphs.append("No numeric metric columns available to compute rankings directly.")

        # 3. Average / Mean / Median / Statistical Audit
        elif any(w in p_lower for w in ["average", "mean", "median", "statistic", "std", "distribution", "sum", "total"]):
            if not df.empty and numeric_cols:
                answer_paragraphs.append("### 📊 Statistical Summary & Aggregations\n")
                answer_paragraphs.append("Key mathematical measures computed across dataset numerical metrics:\n")

                stats_md = ["| Metric Column | Count | Mean | Median | Min | Max | Std Dev |"]
                stats_md.append("|:---|:---:|:---:|:---:|:---:|:---:|:---:|")

                for col in numeric_cols[:8]:
                    s = df[col].dropna()
                    if not s.empty:
                        stats_md.append(
                            f"| **{col}** | {s.count()} | {s.mean():,.2f} | {s.median():,.2f} | {s.min():,.2f} | {s.max():,.2f} | {s.std():,.2f} |"
                        )
                        insights.append(f"**{col}** averages `{s.mean():,.2f}` (ranging from {s.min():,.2f} to {s.max():,.2f}).")

                answer_paragraphs.append("\n".join(stats_md))
                chart_rec = {"chartType": "histogram", "xCol": numeric_cols[0], "yCol": None}
            else:
                answer_paragraphs.append("No numerical data columns detected to compute mathematical distribution.")

        # 4. Chart Recommendation Query
        elif any(w in p_lower for w in ["chart", "plot", "visualiz", "graph", "histogram", "scatter", "box"]):
            answer_paragraphs.append("### 📈 Recommended Visualizations\n")
            if numeric_cols:
                if len(numeric_cols) >= 2:
                    answer_paragraphs.append(f"1. **Scatter Plot / Correlation**: Compare `{numeric_cols[0]}` vs `{numeric_cols[1]}` to detect trends.")
                    chart_rec = {"chartType": "scatter", "xCol": numeric_cols[0], "yCol": numeric_cols[1]}
                else:
                    label_col = [c for c in df.columns if c not in numeric_cols][0] if len(df.columns) > 1 else df.columns[0]
                    answer_paragraphs.append(f"1. **Bar Chart**: Breakdown of `{numeric_cols[0]}` across `{label_col}`.")
                    chart_rec = {"chartType": "bar", "xCol": label_col, "yCol": numeric_cols[0]}

                answer_paragraphs.append(f"2. **Histogram Distribution**: Inspect distribution frequency of `{numeric_cols[0]}`.")
                answer_paragraphs.append(f"3. **Boxplot Anomaly Detector**: Uncover skew and outliers in quantitative distributions.")
                insights.append(f"Optimal visual representation is a **{chart_rec['chartType'].upper()}** chart.")
            else:
                answer_paragraphs.append("To visualize this dataset, categorical frequency bar charts are recommended.")

        # 5. Data Cleaning / Missing Values
        elif any(w in p_lower for w in ["clean", "missing", "null", "quality", "empty", "nan", "fix"]):
            answer_paragraphs.append("### 🧹 Data Quality & Integrity Audit\n")
            if not df.empty:
                null_counts = df.isna().sum()
                has_nulls = null_counts.sum() > 0
                if has_nulls:
                    answer_paragraphs.append("The following columns contain missing or incomplete records:")
                    for col, cnt in null_counts[null_counts > 0].items():
                        pct = (cnt / len(df)) * 100
                        answer_paragraphs.append(f"- **{col}**: `{cnt}` missing ({pct:.1f}%)")
                    answer_paragraphs.append("\n**Recommendations:** Impute numerical columns with median or filter rows before regression.")
                else:
                    answer_paragraphs.append("✅ **Excellent Data Quality**: Zero missing values detected across all columns!")
                insights.append(f"Dataset completeness rate: {((1 - df.isna().mean().mean()) * 100):.1f}%")

        # 6. Python / Code Generation
        elif any(w in p_lower for w in ["python", "code", "pandas", "script", "sql", "query"]):
            answer_paragraphs.append("### 💻 Python / Pandas Analysis Code\n")
            answer_paragraphs.append("Here is an executable snippet to load and analyze this data:")
            num_var = f"'{numeric_cols[0]}'" if numeric_cols else "'value'"
            code_snippet = f"""```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

# 1. Load dataset
df = pd.read_csv("dataset.csv")

# 2. Inspect summary
print(df.info())
print(df.describe())

# 3. Aggregations & Top Performers
{"top_records = df.sort_values(by=" + num_var + ", ascending=False).head(10)" if numeric_cols else "# Perform aggregations"}
{"print(top_records)" if numeric_cols else ""}

# 4. Plot distribution
{"plt.figure(figsize=(10, 5))" if numeric_cols else ""}
{"df[" + num_var + "].hist(bins=20, color='teal', edgecolor='black')" if numeric_cols else ""}
{"plt.title('Distribution of " + numeric_cols[0] + "')" if numeric_cols else ""}
{"plt.show()" if numeric_cols else ""}
```"""
            answer_paragraphs.append(code_snippet)
            insights.append("Generated ready-to-run Pandas script.")

        # Default fallback intelligent synthesis
        else:
            answer_paragraphs.append(f"### 🤖 Analysis on: *\"{prompt}\"*\n")
            if page_content and page_content.get("textContent"):
                # Search page text for query terms
                query_words = [w for w in re.findall(r"\w+", p_lower) if len(w) > 3]
                matched_sentences = []
                for p in page_content.get("paragraphs", []):
                    if any(qw in p.lower() for qw in query_words):
                        matched_sentences.append(p)

                if matched_sentences:
                    answer_paragraphs.append("**Relevant Findings from Webpage Content:**")
                    for s in matched_sentences[:4]:
                        answer_paragraphs.append(f"> {s}\n")
                    insights.append(f"Found {len(matched_sentences)} relevant contextual sections in webpage.")

            if not df.empty:
                answer_paragraphs.append(f"**Dataset Insights:**")
                answer_paragraphs.append(f"- Evaluated query across **{len(df):,} records** and **{len(df.columns)} dimensions**.")
                if numeric_cols:
                    top_metric = numeric_cols[0]
                    answer_paragraphs.append(f"- Primary quantitative column: `{top_metric}` (Mean: {df[top_metric].mean():,.2f}, Max: {df[top_metric].max():,.2f})")
                insights.append("Analyzed structured dataset against inquiry.")

        suggestions = self._generate_follow_up_suggestions(prompt, table_profile, page_content)

        return {
            "success": True,
            "provider": "local",
            "model": "datahub-analytical-v1",
            "answer": "\n\n".join(answer_paragraphs),
            "insights": insights,
            "suggestions": suggestions,
            "recommendedChart": chart_rec,
        }

    def _extract_insights_from_text(self, text: str) -> List[str]:
        """Extracts key insight bullet points from LLM generated markdown text."""
        insights = []
        for line in text.splitlines():
            line = line.strip()
            if (line.startswith("- ") or line.startswith("* ")) and len(line) > 10:
                clean = re.sub(r"^[-*]\s+", "", line)
                if not clean.startswith("http") and len(clean) < 160:
                    insights.append(clean)
                    if len(insights) >= 4:
                        break
        return insights

    def _generate_follow_up_suggestions(
        self,
        prompt: str,
        table_profile: Optional[Dict[str, Any]],
        page_content: Optional[Dict[str, Any]],
    ) -> List[str]:
        """Generates smart contextual follow-up prompt pills."""
        suggestions = []
        if table_profile and table_profile.get("numericColumns"):
            num_cols = table_profile.get("numericColumns", [])
            suggestions.append(f"Show the top 5 records by {num_cols[0]}")
            if len(num_cols) > 1:
                suggestions.append(f"Calculate correlation between {num_cols[0]} and {num_cols[1]}")
            suggestions.append("Recommend the best chart for this data")
        if page_content:
            suggestions.append("Summarize the key takeaways of this webpage")
            suggestions.append("Draft an executive summary based on this content")
        suggestions.append("Write a Python script to filter and clean this dataset")
        return suggestions[:4]

    def _detect_chart_recommendation(
        self, prompt: str, text: str, table_profile: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Determines if the agent recommended a specific chart."""
        p_lower = (prompt + " " + text).lower()
        if not table_profile or not table_profile.get("numericColumns"):
            return None

        num_cols = table_profile.get("numericColumns", [])
        all_cols = [c.get("name") for c in table_profile.get("columns", [])]

        if "scatter" in p_lower and len(num_cols) >= 2:
            return {"chartType": "scatter", "xCol": num_cols[0], "yCol": num_cols[1]}
        elif "heatmap" in p_lower:
            return {"chartType": "heatmap", "xCol": num_cols[0], "yCol": None}
        elif "bar" in p_lower:
            cat_cols = [c for c in all_cols if c not in num_cols]
            x = cat_cols[0] if cat_cols else num_cols[0]
            y = num_cols[0] if cat_cols else (num_cols[1] if len(num_cols) > 1 else None)
            return {"chartType": "bar", "xCol": x, "yCol": y}
        elif "histogram" in p_lower or "distribution" in p_lower:
            return {"chartType": "histogram", "xCol": num_cols[0], "yCol": None}
        return None
