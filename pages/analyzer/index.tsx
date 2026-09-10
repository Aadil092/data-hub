import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Globe,
  Table as TableIcon,
  Download,
  BarChart3,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Filter,
  TrendingUp,
  Search,
  Layers,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Activity,
  Sliders,
  Maximize2,
  Info,
  Check,
  UploadCloud,
  Upload,
  X,
  Square,
  Trash2,
  Bot,
  Send,
  Settings,
  MessageSquare,
  Copy,
  Terminal,
  FileText,
  BookOpen,
  Cpu,
  Lightbulb,
  Code2,
} from 'lucide-react';
import Papa from 'papaparse';
import AppLayout from '../../components/layout/AppLayout';
import { pythonApi } from '../../lib/api';

const SAMPLE_CSV_DATA = `Company,Sector,Revenue_Billions,Profit_Billions,Employees,Country,Growth_Rate
Walmart,Retail,611.3,11.7,2100000,United States,6.7
Amazon,Technology,514.0,-2.7,1541000,United States,9.4
State Grid,Utilities,530.0,8.2,871145,China,13.8
Saudi Aramco,Energy,603.7,159.1,70496,Saudi Arabia,51.0
China National Petroleum,Energy,483.0,21.0,1087049,China,15.2
Sinopec Group,Energy,471.2,9.7,527487,China,14.6
ExxonMobil,Energy,413.7,55.7,62000,United States,44.8
Apple,Technology,394.3,99.8,164000,United States,7.8
Shell,Energy,386.2,20.1,93000,United Kingdom,41.6
TotalEnergies,Energy,281.2,20.5,101279,France,36.4
Alphabet,Technology,282.8,59.9,190234,United States,9.8
Toyota,Automotive,274.5,18.1,375235,Japan,11.5
Samsung Electronics,Technology,234.1,43.5,270372,South Korea,8.1
Berkshire Hathaway,Financials,302.1,-22.8,383000,United States,9.4
Microsoft,Technology,198.3,72.7,221000,United States,18.0`;

const PRESET_URLS = [
  {
    name: 'Top 50 Companies by Revenue',
    url: 'https://en.wikipedia.org/wiki/List_of_largest_companies_by_revenue',
    desc: 'Fortune Global 500 company metrics (Revenue, Profit, Employees)',
  },
  {
    name: 'Countries by GDP (Nominal)',
    url: 'https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)',
    desc: 'IMF & World Bank international economic indicators',
  },
  {
    name: 'Premier League All-Time Table',
    url: 'https://en.wikipedia.org/wiki/Premier_League_records_and_statistics',
    desc: 'Football clubs records, points, and goals statistics',
  },
  {
    name: 'Artificial Intelligence (Article & Text)',
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    desc: 'Deep technical article with headings, sections, and concept definitions',
  },
];

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  insights?: string[];
  suggestions?: string[];
  recommendedChart?: {
    chartType: 'histogram' | 'bar' | 'boxplot' | 'heatmap' | 'scatter';
    xCol?: string;
    yCol?: string;
  } | null;
  warning?: string;
}

export default function WebAnalyzerPage() {
  const router = useRouter();

  // Ingestion Mode: Scrape Web URL or Upload CSV
  const [ingestMode, setIngestMode] = useState<'SCRAPE' | 'CSV'>('SCRAPE');

  // Input & Scraping State
  const [url, setUrl] = useState('');
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);

  // Universal Scraped Page Content
  const [pageContent, setPageContent] = useState<any | null>(null);

  // Active View Tab: 'DATA_STUDIO' | 'ARTICLE_READER' | 'AI_AGENT'
  const [activeTab, setActiveTab] = useState<'DATA_STUDIO' | 'ARTICLE_READER' | 'AI_AGENT'>('DATA_STUDIO');

  // CSV Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvFileSize, setCsvFileSize] = useState<string>('');
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef<boolean>(false);
  const activeFileReaderRef = useRef<FileReader | null>(null);

  // Analysis & Profiling State
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);

  // Chart Studio State
  const [chartType, setChartType] = useState<'histogram' | 'bar' | 'boxplot' | 'heatmap' | 'scatter'>('histogram');
  const [xCol, setXCol] = useState<string>('');
  const [yCol, setYCol] = useState<string>('');
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartImage, setChartImage] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartModalOpen, setChartModalOpen] = useState(false);

  // Table Preview State
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Export State
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Backend Health check
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // --- AI Agent State ---
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [agentProvider, setAgentProvider] = useState<'local' | 'gemini' | 'openai'>('local');
  const [agentApiKey, setAgentApiKey] = useState('');
  const [agentModel, setAgentModel] = useState('');
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check python backend connectivity on mount
    pythonApi
      .health()
      .then((res) => setBackendOnline(res.success))
      .catch(() => setBackendOnline(false));

    // Load saved AI preferences
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('datahub_ai_provider');
      const savedKey = localStorage.getItem('datahub_ai_apikey');
      const savedModel = localStorage.getItem('datahub_ai_model');
      if (savedProvider) setAgentProvider(savedProvider as any);
      if (savedKey) setAgentApiKey(savedKey);
      if (savedModel) setAgentModel(savedModel);
    }
  }, []);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (activeTab === 'AI_AGENT') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentMessages, activeTab, loadingAgent]);

  // Initial welcome message from AI Agent
  useEffect(() => {
    if (agentMessages.length === 0) {
      setAgentMessages([
        {
          id: 'welcome',
          role: 'agent',
          content:
            "### 👋 Hello! I'm your Data-Hub AI Analyst Agent.\n\nI can read and analyze **any website URL** or uploaded dataset in real-time. Ask me questions, request executive summaries, detect statistical anomalies, generate Python code, or let me recommend the best charts!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: [
            'Summarize this dataset & key takeaways',
            'Show top 5 records by quantitative metrics',
            'Recommend the optimal chart for this data',
            'Audit data quality and missing values',
          ],
        },
      ]);
    }
  }, []);

  // Save AI Settings
  const handleSaveAiSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('datahub_ai_provider', agentProvider);
      localStorage.setItem('datahub_ai_apikey', agentApiKey);
      localStorage.setItem('datahub_ai_model', agentModel);
    }
    setShowAiSettings(false);
  };

  // Copy text helper
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Resilient fallback profiler if Python backend is offline
  const buildClientSideProfile = (targetTable: any) => {
    const allRows: any[] = targetTable?.allRows || [];
    const headers: string[] = targetTable?.headers || [];
    const totalRows = allRows.length;
    const totalColumns = headers.length;

    const numericCols: string[] = [];
    const categoricalCols: string[] = [];

    const columnsInfo = headers.map((col) => {
      let missingCount = 0;
      let numericCount = 0;
      const uniqueValues = new Set();

      allRows.forEach((row) => {
        const val = row[col];
        if (val === null || val === undefined || String(val).trim() === '') {
          missingCount++;
        } else {
          uniqueValues.add(val);
          const cleanVal = String(val).replace(/[$,€£¥%]/g, '').replace(/,/g, '').trim();
          if (cleanVal !== '' && !isNaN(Number(cleanVal))) {
            numericCount++;
          }
        }
      });

      const isNumeric = allRows.length > 0 && numericCount / (allRows.length - missingCount || 1) >= 0.7;
      const colType = isNumeric ? 'numeric' : 'text';
      if (isNumeric) numericCols.push(col);
      else categoricalCols.push(col);

      const missingPercentage = totalRows > 0 ? (missingCount / totalRows) * 100 : 0;

      return {
        name: col,
        type: colType,
        rawType: isNumeric ? 'float64' : 'object',
        missingCount,
        missingPercentage,
        uniqueCount: uniqueValues.size,
      };
    });

    return {
      totalRows,
      totalColumns,
      columns: columnsInfo,
      numericColumns: numericCols,
      categoricalColumns: categoricalCols,
      missingSummary: {},
      columnStats: {},
      correlations: {},
      previewRows: allRows.slice(0, 10),
    };
  };

  // Stop ongoing parsing or profiling process
  const handleStopProcess = () => {
    isCancelledRef.current = true;
    if (activeFileReaderRef.current) {
      try {
        activeFileReaderRef.current.abort();
      } catch (e) {
        // ignore
      }
    }
    setLoadingCsv(false);
    setLoadingProfile(false);
    setScrapeError('Process stopped by user.');
  };

  // Cancel process and completely remove uploaded CSV file and its data
  const handleCancelAndRemoveCsv = () => {
    isCancelledRef.current = true;
    if (activeFileReaderRef.current) {
      try {
        activeFileReaderRef.current.abort();
      } catch (e) {
        // ignore
      }
    }

    setLoadingCsv(false);
    setLoadingProfile(false);
    setScrapeError(null);

    // Remove file references
    setCsvFile(null);
    setCsvFileName('');
    setCsvFileSize('');
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }

    // Filter out CSV upload from discovered datasets
    const remaining = discoveredTables.filter((t) => t.source !== 'CSV Upload');
    setDiscoveredTables(remaining);

    if (remaining.length > 0) {
      setSelectedTableIndex(0);
      handleSelectTable(0, remaining);
    } else {
      setProfile(null);
      setChartImage(null);
      setChartError(null);
    }
  };

  // When a table is selected or discovered tables change, analyze the selected table
  const handleSelectTable = async (index: number, tables = discoveredTables) => {
    if (isCancelledRef.current) return;
    setSelectedTableIndex(index);
    const targetTable = tables[index];
    if (!targetTable || !targetTable.allRows || targetTable.allRows.length === 0) return;

    setLoadingProfile(true);
    setChartImage(null);
    setChartError(null);

    try {
      const res = await pythonApi.previewTable({ records: targetTable.allRows });
      if (isCancelledRef.current) return;
      if (res.success && res.profile) {
        setProfile(res.profile);
        // Pre-select chart columns based on numeric/categorical
        if (res.profile.numericColumns && res.profile.numericColumns.length > 0) {
          setXCol(res.profile.numericColumns[0]);
          if (res.profile.numericColumns.length > 1) {
            setYCol(res.profile.numericColumns[1]);
          }
        } else if (res.profile.columns && res.profile.columns.length > 0) {
          setXCol(res.profile.columns[0].name);
        }
      } else {
        if (!isCancelledRef.current) {
          setProfile(buildClientSideProfile(targetTable));
          if (res.message) {
            setScrapeError(res.message);
          }
        }
      }
    } catch (err: any) {
      if (!isCancelledRef.current) {
        setProfile(buildClientSideProfile(targetTable));
      }
    } finally {
      if (!isCancelledRef.current) {
        setLoadingProfile(false);
        setPage(1);
      }
    }
  };

  // Process raw CSV text using PapaParse and profile with Pandas
  const processCsvContent = (content: string, filename: string) => {
    if (isCancelledRef.current) return;
    setLoadingCsv(true);
    setScrapeError(null);
    try {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: async (results) => {
          if (isCancelledRef.current) return;
          if (results.errors && results.errors.length > 0 && results.data.length === 0) {
            setScrapeError(`CSV parse error: ${results.errors[0].message}`);
            setLoadingCsv(false);
            return;
          }

          const rawRows = results.data as any[];
          if (!rawRows || rawRows.length === 0) {
            setScrapeError('The selected CSV file is empty or contains no readable rows.');
            setLoadingCsv(false);
            return;
          }

          const headers = Object.keys(rawRows[0]).filter((h) => h && h.trim().length > 0);
          if (headers.length === 0) {
            setScrapeError('No valid column headers found in the CSV file.');
            setLoadingCsv(false);
            return;
          }

          const cleanTitle = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          const formattedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          const newTable = {
            title: `${formattedTitle} (.csv)`,
            source: 'CSV Upload',
            source_url: filename,
            rowCount: rawRows.length,
            columnCount: headers.length,
            headers: headers,
            sampleRows: rawRows.slice(0, 5),
            allRows: rawRows,
          };

          const updatedTables = [newTable, ...discoveredTables.filter((t) => t.source_url !== filename)];
          setDiscoveredTables(updatedTables);
          setSelectedTableIndex(0);
          await handleSelectTable(0, updatedTables);
          if (!isCancelledRef.current) {
            setLoadingCsv(false);
          }
        },
        error: (err: any) => {
          if (!isCancelledRef.current) {
            setScrapeError(`Failed to read CSV: ${err.message}`);
            setLoadingCsv(false);
          }
        },
      });
    } catch (err: any) {
      if (!isCancelledRef.current) {
        setScrapeError(`Failed to process CSV file: ${err.message}`);
        setLoadingCsv(false);
      }
    }
  };

  // Handle local file selection from <input type="file" />
  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setScrapeError('Please select a valid .csv file.');
      return;
    }

    isCancelledRef.current = false;
    setCsvFile(file);
    setCsvFileName(file.name);
    setCsvFileSize((file.size / 1024).toFixed(1) + ' KB');
    setLoadingCsv(true);

    const reader = new FileReader();
    activeFileReaderRef.current = reader;

    reader.onload = (e) => {
      if (isCancelledRef.current) return;
      const text = e.target?.result as string;
      if (text) {
        processCsvContent(text, file.name);
      }
    };
    reader.onerror = () => {
      if (!isCancelledRef.current) {
        setScrapeError('Failed to read file from disk.');
        setLoadingCsv(false);
      }
    };
    reader.readAsText(file);
  };

  // Handle drag and drop files onto the dropzone
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Submit URL for Universal Scraping (Both Content & Tables)
  const handleScrape = async (targetUrl?: string) => {
    const scrapeTarget = targetUrl || url;
    if (!scrapeTarget.trim()) {
      setScrapeError('Please enter a valid website URL');
      return;
    }

    setLoadingScrape(true);
    setScrapeError(null);
    setDiscoveredTables([]);
    setPageContent(null);
    setProfile(null);
    setChartImage(null);

    try {
      const res = await pythonApi.scrapeUniversalUrl(scrapeTarget);
      if (res.success) {
        if (res.pageContent) {
          setPageContent(res.pageContent);
        }

        if (res.tables && res.tables.length > 0) {
          setDiscoveredTables(res.tables);
          await handleSelectTable(0, res.tables);
        } else if (res.pageContent && res.pageContent.textContent) {
          // If no tables at all, switch directly to article view
          setActiveTab('ARTICLE_READER');
        } else {
          setScrapeError('No readable content or tables could be extracted from this URL.');
        }
      } else {
        setScrapeError(res.message || 'Failed to scrape URL.');
      }
    } catch (err: any) {
      setScrapeError(err.message || 'Failed to scrape URL. Ensure the Python FastAPI server is running.');
    } finally {
      setLoadingScrape(false);
    }
  };

  // Send Message to AI Agent
  const handleSendAgentMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || agentPrompt).trim();
    if (!promptToSend || loadingAgent) return;

    const userMsg: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAgentMessages((prev) => [...prev, userMsg]);
    setAgentPrompt('');
    setLoadingAgent(true);

    const currentTable = discoveredTables[selectedTableIndex];
    const historyPayload = agentMessages.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      content: m.content,
    }));

    try {
      const res = await pythonApi.sendAgentMessage({
        prompt: promptToSend,
        chat_history: historyPayload,
        table_records: currentTable?.allRows || (profile?.previewRows ?? []),
        table_profile: profile,
        page_content: pageContent,
        api_key: agentApiKey || undefined,
        provider: agentProvider,
        model: agentModel || undefined,
      });

      if (res.success) {
        const agentMsg: AgentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: res.answer || 'Analysis complete.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          insights: res.insights || [],
          suggestions: res.suggestions || [],
          recommendedChart: res.recommendedChart || null,
          warning: res.warning || undefined,
        };
        setAgentMessages((prev) => [...prev, agentMsg]);
      } else {
        const errorMsg: AgentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: `⚠️ **Agent Notice**: ${res.message || res.answer || 'Could not process query.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setAgentMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `⚠️ **Connection Error**: ${err.message || 'Unable to connect to AI Agent service.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setAgentMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoadingAgent(false);
    }
  };

  // Apply Chart Recommendation from Agent
  const handleApplyRecommendedChart = (rec: { chartType: any; xCol?: string; yCol?: string }) => {
    if (rec.chartType) setChartType(rec.chartType);
    if (rec.xCol) setXCol(rec.xCol);
    if (rec.yCol) setYCol(rec.yCol);
    setActiveTab('DATA_STUDIO');
    // Scroll or trigger chart generation
    setTimeout(() => {
      handleGenerateChart();
    }, 100);
  };

  // Generate Matplotlib Chart
  const handleGenerateChart = async () => {
    const currentTable = discoveredTables[selectedTableIndex];
    if (!currentTable || !currentTable.allRows) return;

    setLoadingChart(true);
    setChartError(null);

    try {
      const res = await pythonApi.generateChart({
        records: currentTable.allRows,
        chart_type: chartType,
        x_col: xCol || undefined,
        y_col: yCol || undefined,
      });

      if (res.success && res.image) {
        setChartImage(res.image);
      } else {
        setChartError(res.message || 'Could not generate chart with selected options');
      }
    } catch (err: any) {
      setChartError(err.message || 'Chart generation failed');
    } finally {
      setLoadingChart(false);
    }
  };

  // Export handlers
  const handleExport = async (format: 'csv' | 'xlsx') => {
    const currentTable = discoveredTables[selectedTableIndex];
    if (!currentTable || !currentTable.allRows) return;

    if (format === 'csv') setExportingCsv(true);
    else setExportingExcel(true);

    try {
      const filename = `${currentTable.title || 'scraped_data'}_cleaned`
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      await pythonApi.exportTable(currentTable.allRows, format, filename);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      if (format === 'csv') setExportingCsv(false);
      else setExportingExcel(false);
    }
  };

  // Sort and filter table rows
  const currentTable = discoveredTables[selectedTableIndex];
  const allRows: any[] = currentTable?.allRows || [];

  const filteredRows = allRows.filter((row) => {
    if (!searchQuery.trim()) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortCol) return 0;
    const valA = a[sortCol] ?? '';
    const valB = b[sortCol] ?? '';
    const numA = Number(valA);
    const numB = Number(valB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    return sortDir === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage) || 1;
  const paginatedRows = sortedRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colName);
      setSortDir('asc');
    }
  };

  // Formatter for Agent Markdown
  const renderAgentMarkdown = (text: string) => {
    // Quick and safe markdown line formatter
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    const rendered: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // close block
          rendered.push(
            <div key={`code-${idx}`} className="my-3 rounded-xl bg-slate-950 border border-emerald-500/30 overflow-hidden text-xs">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-emerald-500/20 text-slate-400 font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Code Snippet</span>
                </div>
                <button
                  onClick={() => handleCopyText(codeContent, `code-${idx}`)}
                  className="hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedId === `code-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === `code-${idx}` ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 text-emerald-300 font-mono overflow-x-auto whitespace-pre">
                {codeContent}
              </pre>
            </div>
          );
          codeContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        return;
      }

      if (line.startsWith('### ')) {
        rendered.push(
          <h4 key={idx} className="text-sm font-bold text-emerald-400 mt-3 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {line.replace('### ', '')}
          </h4>
        );
      } else if (line.startsWith('## ')) {
        rendered.push(
          <h3 key={idx} className="text-base font-bold text-white mt-4 mb-2">
            {line.replace('## ', '')}
          </h3>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        rendered.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 my-1 pl-1">
            <span className="text-emerald-400 font-bold">•</span>
            <span>{line.replace(/^[-*]\s+/, '')}</span>
          </div>
        );
      } else if (line.startsWith('> ')) {
        rendered.push(
          <blockquote key={idx} className="pl-3 border-l-2 border-emerald-500/50 italic text-xs text-slate-300 my-2 bg-emerald-500/5 py-1 rounded-r">
            {line.replace('> ', '')}
          </blockquote>
        );
      } else if (line.trim() === '') {
        rendered.push(<div key={idx} className="h-1.5" />);
      } else {
        rendered.push(
          <p key={idx} className="text-xs text-slate-200 my-1 leading-relaxed">
            {line}
          </p>
        );
      }
    });

    return <div>{rendered}</div>;
  };

  return (
    <AppLayout
      title="Web Data Analyzer & AI Agent"
      subtitle="Read any website URL or CSV dataset, converse with the AI Data Agent, profile with Pandas & NumPy, and visualize with Matplotlib"
    >
      <Head>
        <title>Web Data Analyzer & AI Agent | DATAHUB</title>
      </Head>

      <div className="space-y-6 pb-12">
        {/* Backend Status Banner if Offline */}
        {backendOnline === false && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-300">Python FastAPI Backend Offline</p>
              <p className="text-amber-400/80 text-xs mt-0.5">
                The Python server is not currently reachable at <code>http://localhost:8000</code>.
                Start it using <code>npm run dev:python</code> or by activating the virtualenv in <code>python-backend/</code>.
              </p>
            </div>
          </div>
        )}

        {/* Ingestion Bar: Universal URL Scraper or CSV File Upload */}
        <div className="p-6 sm:p-7 rounded-3xl glass-card border border-emerald-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Universal Web Intelligence & AI Agent Studio
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {ingestMode === 'SCRAPE' ? 'Read Any Website URL & Extract Data' : 'Upload Local .CSV Spreadsheet'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {ingestMode === 'SCRAPE'
                  ? 'Input any webpage URL. Reads full articles, headings, paragraphs, and extracts all HTML tables for AI analysis.'
                  : 'Drop your .csv file here. Instant parsing + deep Pandas/NumPy profiling & Matplotlib charts.'}
              </p>
            </div>

            {/* Ingestion Source Tabs */}
            <div className="flex items-center p-1 rounded-full bg-slate-900/90 border border-emerald-500/25 shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => {
                  setIngestMode('SCRAPE');
                  setScrapeError(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${ingestMode === 'SCRAPE'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web URL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIngestMode('CSV');
                  setScrapeError(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${ingestMode === 'CSV'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload .CSV</span>
              </button>
            </div>
          </div>

          {/* Mode 1: URL Scraper Bar */}
          {ingestMode === 'SCRAPE' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-4 top-3.5 w-5 h-5 text-emerald-400/80" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                    placeholder="Enter any website URL (e.g. Wikipedia, news, blog, documentation, reports)..."
                    className="w-full pl-11 pr-4 py-3 rounded-full bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-all shadow-inner"
                  />
                </div>
                <button
                  onClick={() => handleScrape()}
                  disabled={loadingScrape}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  {loadingScrape ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Reading Website...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Read & Analyze</span>
                    </>
                  )}
                </button>
              </div>

              {/* Preset Chips */}
              <div className="mt-4 pt-4 border-t border-emerald-500/20 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium mr-1">Quick Demos:</span>
                {PRESET_URLS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setUrl(preset.url);
                      handleScrape(preset.url);
                    }}
                    disabled={loadingScrape}
                    className="text-xs px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                    title={preset.desc}
                  >
                    <span>{preset.name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: CSV File Upload Dropzone */}
          {ingestMode === 'CSV' && (
            <div className="space-y-4">
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {/* Dropzone Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!loadingCsv) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  if (!loadingCsv) handleDrop(e);
                }}
                onClick={() => {
                  if (!loadingCsv) csvFileInputRef.current?.click();
                }}
                className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${loadingCsv
                  ? 'border-amber-500/50 bg-amber-500/5 cursor-default'
                  : isDragging
                    ? 'border-emerald-400 bg-emerald-500/15 scale-[1.01]'
                    : 'border-emerald-500/30 hover:border-emerald-500/60 bg-slate-900/50 hover:bg-slate-900/80'
                  }`}
              >
                <div
                  className={`h-16 w-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-md ${loadingCsv
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-amber-500/20'
                    : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 shadow-emerald-500/15'
                    }`}
                >
                  {loadingCsv ? (
                    <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">
                    {loadingCsv
                      ? 'Parsing and Profiling CSV Dataset...'
                      : csvFileName
                        ? `Selected File: ${csvFileName} (${csvFileSize})`
                        : 'Drag & Drop your .CSV file here, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Supports large tabular CSV files with automatic delimiter and numeric type detection
                  </p>
                </div>
              </div>

              {/* Cancel / Stop Bar during CSV processing */}
              {loadingCsv && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span className="text-xs text-amber-300 font-medium">Processing {csvFileName}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStopProcess}
                      className="px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Stop background parsing"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Process</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAndRemoveCsv}
                      className="px-3.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      title="Cancel and remove .csv file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancel & Remove .CSV</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Demo CSV */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Quick Demo:</span>
                  <button
                    type="button"
                    onClick={() => {
                      isCancelledRef.current = false;
                      setCsvFileName('fortune_500_sample.csv');
                      setCsvFileSize('1.2 KB');
                      processCsvContent(SAMPLE_CSV_DATA, 'fortune_500_sample.csv');
                    }}
                    disabled={loadingCsv}
                    className="text-xs px-3.5 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-emerald-300 hover:text-white border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Load Sample Companies CSV</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {scrapeError && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{scrapeError}</span>
            </div>
          )}
        </div>

        {/* View Switcher & Datasets Header (When Content or Tables are Loaded) */}
        {(discoveredTables.length > 0 || pageContent) && (
          <div className="space-y-4">
            {/* Top Navigation Tabs: Data Studio | Webpage Content Reader | AI Agent */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl glass-card border border-emerald-500/20">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-emerald-500/20">
                <button
                  onClick={() => setActiveTab('DATA_STUDIO')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'DATA_STUDIO'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Data & Schema Studio</span>
                </button>

                {pageContent && (
                  <button
                    onClick={() => setActiveTab('ARTICLE_READER')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'ARTICLE_READER'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Webpage Article Reader</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                      {pageContent.wordCount} words
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('AI_AGENT')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${activeTab === 'AI_AGENT'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/30'
                    : 'text-emerald-400 hover:text-white bg-emerald-500/10'
                    }`}
                >
                  <Bot className="w-4 h-4 animate-pulse" />
                  <span>AI Web & Data Agent</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-400/20 text-emerald-300 font-mono">
                    ONLINE
                  </span>
                </button>
              </div>

              {/* Quick AI Settings Trigger */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAiSettings(!showAiSettings)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-emerald-500/20 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Configure AI Engine (Gemini, OpenAI, or Local)"
                >
                  <Settings className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Config: <strong className="text-emerald-400 uppercase">{agentProvider}</strong></span>
                </button>
              </div>
            </div>

            {/* Discovered Tables Carousel / Selector */}
            {discoveredTables.length > 0 && activeTab === 'DATA_STUDIO' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                      Discovered Datasets ({discoveredTables.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIngestMode('CSV');
                        csvFileInputRef.current?.click();
                      }}
                      className="text-xs text-emerald-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>+ Upload Another CSV</span>
                    </button>
                    <span className="hidden sm:inline text-xs text-slate-500">|</span>
                    <span className="hidden sm:inline text-xs text-slate-400">Click a card to profile & visualize</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {discoveredTables.map((tbl, idx) => {
                    const isSelected = selectedTableIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectTable(idx)}
                        className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden cursor-pointer ${isSelected
                          ? 'bg-emerald-600/15 border-emerald-500 shadow-md shadow-emerald-500/15 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800 hover:border-emerald-500/40'
                          }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400 animate-ping"></div>
                        )}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {tbl.source === 'CSV Upload' ? 'CSV FILE' : `TABLE #${idx + 1}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-mono border border-slate-700/50">
                              {tbl.rowCount} rows
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-mono border border-slate-700/50">
                              {tbl.columnCount} cols
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-200 line-clamp-1">{tbl.title || `Table ${idx + 1}`}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tbl.headers.slice(0, 3).map((h: string, hIdx: number) => (
                            <span key={hIdx} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 truncate max-w-[120px] border border-slate-700/40">
                              {h}
                            </span>
                          ))}
                          {tbl.headers.length > 3 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-500 border border-slate-700/30">
                              +{tbl.headers.length - 3} more
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI CONFIGURATION MODAL / POPOVER */}
        {showAiSettings && (
          <div className="p-6 rounded-3xl glass-card border border-emerald-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">AI Agent Intelligence Configuration</h4>
              </div>
              <button
                onClick={() => setShowAiSettings(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">AI Engine Provider</label>
                <select
                  value={agentProvider}
                  onChange={(e) => setAgentProvider(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="local">Built-in Local Analytical AI (Free, Zero Setup)</option>
                  <option value="gemini">Google Gemini API (Fast & Smart)</option>
                  <option value="openai">OpenAI API (GPT-4o / GPT-4o-mini)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Local engine runs statistical formulas and aggregations with zero API keys.
                </p>
              </div>

              {/* API Key (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {agentProvider === 'local' ? 'API Key (Not Required)' : `${agentProvider.toUpperCase()} API Key`}
                </label>
                <input
                  type="password"
                  value={agentApiKey}
                  onChange={(e) => setAgentApiKey(e.target.value)}
                  disabled={agentProvider === 'local'}
                  placeholder={agentProvider === 'local' ? 'Built-in local engine active' : 'Enter your API Key...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-white focus:outline-none focus:border-emerald-400 disabled:opacity-40"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Stored securely in your local browser session.
                </p>
              </div>

              {/* Model Choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Model Name</label>
                <input
                  type="text"
                  value={agentModel}
                  onChange={(e) => setAgentModel(e.target.value)}
                  placeholder={agentProvider === 'gemini' ? 'gemini-2.0-flash' : agentProvider === 'openai' ? 'gpt-4o-mini' : 'datahub-analytical-v1'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">Default model will be used if left blank.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveAiSettings}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                Save AI Configuration
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 1: AI WEB & DATA AGENT STUDIO ("Write a text to agent") */}
        {/* ==================================================================== */}
        {activeTab === 'AI_AGENT' && (
          <div className="p-6 sm:p-7 rounded-3xl glass-card border border-emerald-500/25 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    AI Web & Data Analyst Agent
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      {agentProvider.toUpperCase()} ACTIVE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Conversational agent with direct access to scraped webpage text, tabular datasets, and statistical distributions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAgentMessages([
                      {
                        id: 'reset',
                        role: 'agent',
                        content: '### 🧹 Conversation Cleared\n\nI am ready for your next question or analysis inquiry.',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      },
                    ]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs border border-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Clear chat history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Chat</span>
                </button>
              </div>
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Quick Action Inquiries:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '⚡ Summarize Content', query: 'Summarize the core takeaways and main highlights of this webpage/dataset' },
                  { label: '🏆 Top 5 Ranked', query: 'Show the top 5 highest performers evaluated against the primary quantitative metrics' },
                  { label: '📊 Statistical Anomaly Audit', query: 'Perform a deep statistical audit and highlight any distributions, skew, or anomalies' },
                  { label: '📈 Optimal Chart Suggestion', query: 'Recommend the best visualization chart type for this dataset and explain why' },
                  { label: '🧹 Data Quality Audit', query: 'Analyze the data quality, schema completeness, and missing values' },
                  { label: '💻 Generate Pandas Code', query: 'Write an executable Python / Pandas analysis script for this dataset' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendAgentMessage(item.query)}
                    disabled={loadingAgent}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-emerald-600/20 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Message Scroll Window */}
            <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-4 sm:p-5 min-h-[380px] max-h-[520px] overflow-y-auto space-y-4 shadow-inner">
              {agentMessages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-emerald-500/10">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 transition-all shadow-md ${isUser
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                        : 'bg-slate-900/90 border border-emerald-500/25 text-slate-100 rounded-tl-none'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="text-[11px] font-bold tracking-wider uppercase opacity-75">
                          {isUser ? 'You' : 'Data-Hub AI Agent'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] opacity-60 font-mono">{msg.timestamp}</span>
                          {!isUser && (
                            <button
                              onClick={() => handleCopyText(msg.content, msg.id)}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy Answer"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Message Content */}
                      <div className="space-y-1">
                        {isUser ? (
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          renderAgentMarkdown(msg.content)
                        )}
                      </div>

                      {/* Warning if switched fallback */}
                      {msg.warning && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
                          {msg.warning}
                        </div>
                      )}

                      {/* Chart Recommendation Action */}
                      {msg.recommendedChart && (
                        <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-emerald-300 block">
                              📈 Recommended Chart: {msg.recommendedChart.chartType.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              X: {msg.recommendedChart.xCol || 'Auto'} {msg.recommendedChart.yCol ? `| Y: ${msg.recommendedChart.yCol}` : ''}
                            </span>
                          </div>
                          <button
                            onClick={() => handleApplyRecommendedChart(msg.recommendedChart!)}
                            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer shrink-0"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Apply & Render Chart</span>
                          </button>
                        </div>
                      )}

                      {/* Follow-up Suggestions Pills */}
                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            Suggested Follow-Ups:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSendAgentMessage(sug)}
                                disabled={loadingAgent}
                                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 transition-all text-left cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Thinking / Loading Bubble */}
              {loadingAgent && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-emerald-500/10">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-slate-900/90 border border-emerald-500/25 rounded-2xl rounded-tl-none p-4 text-xs text-slate-300 flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Analyzing dataset schema, calculating metrics, and synthesizing agent response...</span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Input Bar: "Write a text to agent" */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAgentMessage();
                      }
                    }}
                    placeholder="Write a message or instruction to the AI Agent (e.g. 'Summarize this page', 'Find outliers', 'Filter top 10 by profit')..."
                    className="w-full pl-5 pr-12 py-3.5 rounded-2xl bg-slate-900/95 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25 transition-all shadow-inner"
                  />
                  <div className="absolute right-3 top-3 text-[10px] text-slate-500 font-mono hidden sm:block">
                    Press ↵ Enter
                  </div>
                </div>

                <button
                  onClick={() => handleSendAgentMessage()}
                  disabled={loadingAgent || !agentPrompt.trim()}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {loadingAgent ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send to Agent</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: WEBPAGE ARTICLE & CONTENT READER */}
        {/* ==================================================================== */}
        {activeTab === 'ARTICLE_READER' && pageContent && (
          <div className="space-y-6">
            {/* Webpage Header Overview Card */}
            <div className="p-6 sm:p-7 rounded-3xl glass-card border border-emerald-500/20 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono text-emerald-400 font-semibold uppercase">
                      {pageContent.siteName || 'Web Document'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{pageContent.title}</h3>
                  {pageContent.url && (
                    <a
                      href={pageContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1 mt-1 transition-colors"
                    >
                      <span className="truncate max-w-md">{pageContent.url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-slate-900 border border-emerald-500/30 text-xs text-emerald-300 font-mono">
                    ~{pageContent.readTimeMinutes} min read ({pageContent.wordCount} words)
                  </span>
                  <button
                    onClick={() => {
                      setActiveTab('AI_AGENT');
                      handleSendAgentMessage(`Summarize the key points of the webpage titled "${pageContent.title}"`);
                    }}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Ask Agent to Summarize</span>
                  </button>
                </div>
              </div>

              {/* Meta Description */}
              {pageContent.description && (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 italic">
                  <strong>Meta Description:</strong> {pageContent.description}
                </div>
              )}

              {/* Headings Hierarchy Navigation */}
              {pageContent.headings && pageContent.headings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Page Section Index ({pageContent.headings.length} headings):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {pageContent.headings.map((h: any, hIdx: number) => (
                      <span
                        key={hIdx}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center gap-1"
                      >
                        <span className="text-emerald-400 font-mono text-[9px] uppercase font-bold">[{h.level}]</span>
                        <span className="truncate max-w-[200px]">{h.text}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Structured Page Sections & Paragraphs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main Content Articles (8 Cols) */}
              <div className="lg:col-span-8 p-6 sm:p-7 rounded-3xl glass-card border border-emerald-500/20 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    Extracted Article Content & Paragraphs
                  </h4>
                  <button
                    onClick={() => handleCopyText(pageContent.textContent, 'full-page-text')}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedId === 'full-page-text' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'full-page-text' ? 'Copied Full Text' : 'Copy All Text'}</span>
                  </button>
                </div>

                {pageContent.sections && pageContent.sections.length > 0 ? (
                  <div className="space-y-6">
                    {pageContent.sections.map((sec: any, sIdx: number) => (
                      <div key={sIdx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-bold text-emerald-400">{sec.heading}</h5>
                          <button
                            onClick={() => {
                              setActiveTab('AI_AGENT');
                              handleSendAgentMessage(`Analyze and explain this section: "${sec.heading} - ${sec.text.slice(0, 300)}"`);
                            }}
                            className="text-[11px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Bot className="w-3 h-3 text-emerald-400" />
                            <span>Ask Agent</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{sec.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pageContent.paragraphs.map((para: string, pIdx: number) => (
                      <p key={pIdx} className="text-xs text-slate-300 leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar: Quick Actions & Agent Insights (4 Cols) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-6 rounded-3xl glass-card border border-emerald-500/20 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-emerald-500/20">
                    <Lightbulb className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">AI Web Actions</h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Interact directly with this webpage content using natural language prompts.
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setActiveTab('AI_AGENT');
                        handleSendAgentMessage('Extract all key facts, statistics, and figures mentioned in this article');
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/20 hover:border-emerald-500/40 text-xs text-slate-200 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>🔍 Extract Facts & Figures</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('AI_AGENT');
                        handleSendAgentMessage('Draft a professional executive brief email summarizing this webpage');
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/20 hover:border-emerald-500/40 text-xs text-slate-200 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>📝 Draft Executive Brief</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('AI_AGENT');
                        handleSendAgentMessage('Convert the unstructured points in this article into a structured tabular matrix');
                      }}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/20 hover:border-emerald-500/40 text-xs text-slate-200 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>📊 Convert to Structured Table</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: DATA & SCHEMA STUDIO (PROFILER + MATPLOTLIB + DATA TABLE) */}
        {/* ==================================================================== */}
        {activeTab === 'DATA_STUDIO' && (
          <>
            {/* Loading Profile Skeleton */}
            {loadingProfile && (
              <div className="p-12 rounded-3xl glass-card border border-emerald-500/20 text-center flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-semibold text-slate-200">Profiling Table with Pandas & NumPy...</p>
                <p className="text-xs text-slate-400 mt-1">Analyzing data types, calculating missing values, and generating stats</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleStopProcess}
                    className="px-4 py-2 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Process</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAndRemoveCsv}
                    className="px-4 py-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel & Remove .CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Data Analysis & Quality Overview */}
            {profile && !loadingProfile && (
              <div className="space-y-6">
                {/* KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Rows</span>
                    <span className="text-2xl font-bold text-white mt-1 block font-mono">{profile.totalRows.toLocaleString()}</span>
                    <span className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Parsed & Structured
                    </span>
                  </div>

                  <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Columns</span>
                    <span className="text-2xl font-bold text-white mt-1 block font-mono">{profile.totalColumns}</span>
                    <span className="text-[11px] text-teal-400 mt-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Headers Extracted
                    </span>
                  </div>

                  <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Numeric Columns</span>
                    <span className="text-2xl font-bold text-emerald-400 mt-1 block font-mono">
                      {profile.numericColumns ? profile.numericColumns.length : 0}
                    </span>
                    <span className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Quantitative Metrics
                    </span>
                  </div>

                  <div className="glass-card p-4 rounded-2xl border border-emerald-500/20 shadow-sm">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Categorical / Text</span>
                    <span className="text-2xl font-bold text-teal-300 mt-1 block font-mono">
                      {profile.categoricalColumns ? profile.categoricalColumns.length : 0}
                    </span>
                    <span className="text-[11px] text-teal-400 mt-1 flex items-center gap-1">
                      <PieChart className="w-3 h-3" /> Dimensions / Labels
                    </span>
                  </div>
                </div>

                {/* Two Column Layout: Data Schema & Quality + Chart Studio */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left: Column Schema & Missing Values Meter (5 Cols) */}
                  <div className="lg:col-span-5 p-6 rounded-3xl glass-card border border-emerald-500/20 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-bold text-white">Data Quality & Schema</h4>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{profile.columns.length} columns</span>
                      </div>

                      <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {profile.columns.map((col: any, idx: number) => {
                          const isNumeric = col.type === 'numeric';
                          const isDate = col.type === 'datetime';
                          const completeness = 100 - col.missingPercentage;

                          return (
                            <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/30 transition-all text-xs">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-semibold text-slate-200 truncate max-w-[180px]" title={col.name}>
                                  {col.name}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${isNumeric
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : isDate
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}
                                >
                                  {col.type}
                                </span>
                              </div>

                              {/* Completeness Bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Completeness: {completeness.toFixed(1)}%</span>
                                  <span>
                                    {col.missingCount > 0 ? (
                                      <span className="text-amber-400 font-semibold">{col.missingCount} missing</span>
                                    ) : (
                                      <span className="text-emerald-400">100% complete</span>
                                    )}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-700/60 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${completeness === 100
                                      ? 'bg-emerald-500'
                                      : completeness > 80
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                      }`}
                                    style={{ width: `${completeness}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Descriptive Stats Pill */}
                    <div className="mt-4 pt-3 border-t border-emerald-500/20 text-xs text-slate-400 flex items-center justify-between">
                      <span>NumPy Cleaned: NaNs detected & filtered</span>
                      <span className="text-emerald-400 font-medium">Auto-Type Inference Active</span>
                    </div>
                  </div>

                  {/* Right: Matplotlib Visualizer Studio (7 Cols) */}
                  <div className="lg:col-span-7 p-6 rounded-3xl glass-card border border-emerald-500/20 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-bold text-white">Matplotlib Visualizer Studio</h4>
                        </div>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">
                          Python Generated
                        </span>
                      </div>

                      {/* Chart Controls Bar */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Chart Type Selector */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Chart Type
                          </label>
                          <select
                            value={chartType}
                            onChange={(e) => setChartType(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 transition-all"
                          >
                            <option value="histogram">Distribution / Histogram</option>
                            <option value="bar">Top Categories Bar Chart</option>
                            <option value="boxplot">Box Plot (Outliers & IQR)</option>
                            <option value="heatmap">Correlation Heatmap</option>
                            <option value="scatter">Scatter & Trend Plot</option>
                          </select>
                        </div>

                        {/* X Column Selector */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            {chartType === 'heatmap' ? 'Target Dimension' : 'X-Axis / Column'}
                          </label>
                          <select
                            value={xCol}
                            onChange={(e) => setXCol(e.target.value)}
                            disabled={chartType === 'heatmap'}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 disabled:opacity-40 transition-all"
                          >
                            {profile.columns.map((c: any) => (
                              <option key={c.name} value={c.name}>
                                {c.name} ({c.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Y Column Selector (Scatter Plot) */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Y-Axis (Scatter Only)
                          </label>
                          <select
                            value={yCol}
                            onChange={(e) => setYCol(e.target.value)}
                            disabled={chartType !== 'scatter'}
                            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 disabled:opacity-40 transition-all"
                          >
                            {profile.numericColumns && profile.numericColumns.length > 0 ? (
                              profile.numericColumns.map((c: string) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))
                            ) : (
                              <option value="">No numeric columns</option>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Render Button */}
                      <div className="mt-3.5 flex justify-end">
                        <button
                          onClick={handleGenerateChart}
                          disabled={loadingChart}
                          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {loadingChart ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating Plot...</span>
                            </>
                          ) : (
                            <>
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Generate Python Chart</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Chart Display Canvas */}
                      <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-4 min-h-[240px] flex items-center justify-center relative overflow-hidden shadow-inner">
                        {chartError && (
                          <div className="p-3 text-rose-400 text-xs text-center flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{chartError}</span>
                          </div>
                        )}

                        {chartImage && !chartError && (
                          <div className="w-full relative group">
                            <img
                              src={chartImage}
                              alt="Matplotlib generated chart"
                              className="w-full h-auto rounded-xl shadow-lg object-contain max-h-[300px]"
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                              <button
                                onClick={() => setChartModalOpen(true)}
                                className="p-2 rounded-full bg-slate-900/90 text-white hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 shadow-md transition-all cursor-pointer"
                                title="Expand Chart"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                              <a
                                href={chartImage}
                                download={`${chartType}_chart.png`}
                                className="p-2 rounded-full bg-slate-900/90 text-white hover:bg-slate-800 border border-emerald-500/30 hover:border-emerald-400 shadow-md flex items-center justify-center transition-all cursor-pointer"
                                title="Download Image"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        )}

                        {!chartImage && !chartError && !loadingChart && (
                          <div className="text-center p-6 text-slate-500">
                            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-400" />
                            <p className="text-xs">Click "Generate Python Chart" to render a high-res Matplotlib graphic</p>
                          </div>
                        )}

                        {loadingChart && (
                          <div className="text-center p-6 text-slate-400 flex flex-col items-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                            <p className="text-xs">Processing figure with Matplotlib & Seaborn...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Data Table Preview & Export Actions */}
                <div className="p-6 rounded-3xl glass-card border border-emerald-500/20 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                        Cleaned Data Preview ({filteredRows.length} of {allRows.length} rows)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Explore data records before exporting or transferring to CRM database
                      </p>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleExport('csv')}
                        disabled={exportingCsv}
                        className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {exportingCsv ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>Download Cleaned CSV</span>
                      </button>

                      <button
                        onClick={() => handleExport('xlsx')}
                        disabled={exportingExcel}
                        className="px-4 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {exportingExcel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                        <span>Download Excel (.xlsx)</span>
                      </button>

                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            sessionStorage.setItem('smart_import_preset', JSON.stringify(currentTable.allRows));
                            router.push('/smart-import');
                          }
                        }}
                        className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                      >
                        <span>Import into Contacts</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Table Search & Filter Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-emerald-400/80" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Search records..."
                        className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs text-slate-400">Rows per page:</span>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setPage(1);
                        }}
                        className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 transition-all cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  {/* Scrollable Data Table */}
                  <div className="overflow-x-auto rounded-2xl border border-emerald-500/20 bg-slate-950/40 shadow-inner">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-emerald-500/20 bg-slate-900/90 text-slate-200">
                          <th className="p-3 font-semibold w-12 text-center text-slate-500">#</th>
                          {currentTable.headers.map((hdr: string, hIdx: number) => (
                            <th
                              key={hIdx}
                              onClick={() => handleSort(hdr)}
                              className="p-3 font-semibold cursor-pointer hover:text-white transition-colors select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{hdr}</span>
                                {sortCol === hdr && (
                                  <span className="text-emerald-400 font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paginatedRows.length > 0 ? (
                          paginatedRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-mono text-[11px] text-center text-slate-500">
                                {(page - 1) * rowsPerPage + rIdx + 1}
                              </td>
                              {currentTable.headers.map((hdr: string, cIdx: number) => {
                                const val = row[hdr];
                                const isNull = val === null || val === undefined || val === '';
                                return (
                                  <td key={cIdx} className="p-3 text-slate-300 font-mono text-[11px] max-w-[220px] truncate">
                                    {isNull ? (
                                      <span className="text-slate-600 italic">null</span>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={currentTable.headers.length + 1} className="p-8 text-center text-slate-500">
                              No matching records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, sortedRows.length)} of{' '}
                      {sortedRows.length} rows
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs px-2.5 text-slate-300 font-mono">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State before any URL or CSV is entered */}
        {!profile && !pageContent && !loadingScrape && !loadingProfile && !loadingCsv && (
          <div className="p-12 rounded-3xl glass-card border border-emerald-500/25 border-dashed text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/25 shadow-md shadow-emerald-500/15">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">No Dataset or Webpage Analyzed Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
              Enter any website URL above to scrape text & tables, or upload a .csv spreadsheet to converse with the AI Agent, profile data with Pandas, and render charts.
            </p>
          </div>
        )}

        {/* Modal for Expanded Chart View */}
        {chartModalOpen && chartImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setChartModalOpen(false)}
          >
            <div
              className="bg-[#0a111e] border-2 border-emerald-500/40 rounded-3xl p-6 max-w-4xl w-full relative shadow-2xl shadow-emerald-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                <h4 className="text-sm font-bold text-white">Matplotlib Chart Full Preview</h4>
                <div className="flex items-center gap-2">
                  <a
                    href={chartImage}
                    download={`${chartType}_chart_full.png`}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG</span>
                  </a>
                  <button
                    onClick={() => setChartModalOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center bg-slate-950/80 rounded-2xl p-4 border border-emerald-500/20">
                <img src={chartImage} alt="Expanded Chart" className="w-full h-auto max-h-[75vh] object-contain rounded-lg" />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
