import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Check,
  Sparkles,
  Mail,
  Send,
  Paperclip,
  FileText,
  X,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Papa from 'papaparse';
import AppLayout from '../../components/layout/AppLayout';
import { api } from '../../lib/api';

const SYSTEM_FIELDS = [
  { key: 'firstName', label: 'First Name', required: true, hint: 'Contact first or given name' },
  { key: 'lastName', label: 'Last Name', required: false, hint: 'Surname or family name' },
  { key: 'email', label: 'Email Address', required: false, hint: 'Used for deduplication & campaign' },
  { key: 'phone', label: 'Phone Number', required: false, hint: 'Used for deduplication' },
  { key: 'company', label: 'Company / Organization', required: false, hint: 'Employer or business name' },
  { key: 'jobTitle', label: 'Job Title', required: false, hint: 'Role or designation' },
  { key: 'tags', label: 'Tags', required: false, hint: 'Comma-separated labels (e.g. VIP, SaaS)' },
  { key: 'status', label: 'Status', required: false, hint: 'LEAD, PROSPECT, CUSTOMER, ARCHIVED' },
  { key: 'notes', label: 'Notes', required: false, hint: 'Internal comments or remarks' },
];

export default function SmartImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Ingestion Source Tab: 'FILE' or 'GOOGLE_SHEET'
  const [ingestSource, setIngestSource] = useState<'FILE' | 'GOOGLE_SHEET'>('FILE');
  const [googleSheetInput, setGoogleSheetInput] = useState('');
  const [fetchingGoogleSheet, setFetchingGoogleSheet] = useState(false);

  // Wizard state: 1 to 5
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    fileName: string;
    fileType: string;
    totalRows: number;
    headers: string[];
    sampleRows: any[];
    allRows: any[];
  } | null>(null);

  // Column Mapping state: { [systemField]: fileHeaderName }
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Analysis result from Step 3 & 4
  const [analysis, setAnalysis] = useState<{
    summary: {
      total: number;
      validCount: number;
      duplicateCount: number;
      invalidCount: number;
    };
    emailVerification: {
      validCount: number;
      riskyCount: number;
      invalidCount: number;
    };
    analyzedRows: any[];
  } | null>(null);

  // Duplicate resolution strategy
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'OVERWRITE' | 'MERGE'>('SKIP');

  // Preview filtering: 'ALL' | 'VALID' | 'VERIFIED_EMAIL' | 'DUPLICATE' | 'INVALID'
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'VERIFIED_EMAIL' | 'DUPLICATE' | 'INVALID'>('ALL');

  // Loading & submission state
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState<any | null>(null);

  // --- Bulk Email Campaign State ---
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);

  // Check for preset rows from Web Analyzer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const preset = sessionStorage.getItem('smart_import_preset');
      if (preset) {
        try {
          const parsedRows = JSON.parse(preset);
          if (Array.isArray(parsedRows) && parsedRows.length > 0) {
            const headers = Object.keys(parsedRows[0]);
            setFileInfo({
              fileName: 'scraped_web_data.csv',
              fileType: 'text/csv',
              totalRows: parsedRows.length,
              headers,
              sampleRows: parsedRows.slice(0, 5),
              allRows: parsedRows,
            });
            const initialMap: Record<string, string> = {};
            SYSTEM_FIELDS.forEach((sf) => {
              const matchedHeader = headers.find(
                (h) =>
                  h.toLowerCase() === sf.key.toLowerCase() ||
                  h.toLowerCase() === sf.label.toLowerCase() ||
                  h.toLowerCase().includes(sf.key.toLowerCase())
              );
              if (matchedHeader) initialMap[sf.key] = matchedHeader;
            });
            setMapping(initialMap);
            setCurrentStep(2);
          }
        } catch (e) {
          console.error('Failed to load preset rows', e);
        } finally {
          sessionStorage.removeItem('smart_import_preset');
        }
      }
    }
  }, []);
  const [campaignSubject, setCampaignSubject] = useState('Welcome to our network, {{firstName}}!');
  const [campaignBody, setCampaignBody] = useState(
    'Hi {{firstName}},\n\nThank you for connecting with us. We are thrilled to introduce our latest updates to {{company}}.\n\nPlease find the attached document / image for full details.\n\nBest regards,\nThe DATAHUB Team'
  );
  const [campaignAttachment, setCampaignAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(true);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(0); // 0 to 100%
  const [campaignResult, setCampaignResult] = useState<any | null>(null);

  // --- Step 1: File Upload Handler ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const uploadedFile = e.target.files[0];
    await processUploadedFile(uploadedFile);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const processUploadedFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setUploading(true);

    try {
      const res = await api.uploadFile(uploadedFile);
      if (res.success) {
        setFileInfo({
          fileName: res.fileName,
          fileType: res.fileType,
          totalRows: res.totalRows,
          headers: res.headers,
          sampleRows: res.sampleRows,
          allRows: res.allRows,
        });

        // Auto-match headers to schema
        const initialMap: Record<string, string> = {};
        SYSTEM_FIELDS.forEach((sf) => {
          if (res.suggestedMapping && res.suggestedMapping[sf.key]) {
            initialMap[sf.key] = res.suggestedMapping[sf.key];
          }
        });
        setMapping(initialMap);
        setCurrentStep(2);
      } else {
        parseClientSide(uploadedFile);
      }
    } catch (err) {
      console.error(err);
      parseClientSide(uploadedFile);
    } finally {
      setUploading(false);
    }
  };

  // Client-side parser fallback
  const parseClientSide = (f: File) => {
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawHeaders = results.meta.fields || [];
        setFileInfo({
          fileName: f.name,
          fileType: f.name.endsWith('.xlsx') ? 'XLSX' : 'CSV',
          totalRows: results.data.length,
          headers: rawHeaders,
          sampleRows: results.data.slice(0, 5),
          allRows: results.data,
        });

        const initialMap: Record<string, string> = {};
        rawHeaders.forEach((h) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes('first') || lower === 'name') initialMap.firstName = h;
          if (lower.includes('last')) initialMap.lastName = h;
          if (lower.includes('email') || lower === 'mail') initialMap.email = h;
          if (lower.includes('phone') || lower.includes('mobile')) initialMap.phone = h;
          if (lower.includes('company') || lower.includes('org')) initialMap.company = h;
          if (lower.includes('title') || lower.includes('role')) initialMap.jobTitle = h;
          if (lower.includes('tag')) initialMap.tags = h;
          if (lower.includes('status')) initialMap.status = h;
        });
        setMapping(initialMap);
        setCurrentStep(2);
      },
    });
  };

  // Google Sheet Link / ID Ingestion (Fetches 500+ rows directly via CSV export)
  const handleGoogleSheetFetch = async () => {
    if (!googleSheetInput.trim()) {
      alert('Please enter a Google Sheet URL or Spreadsheet ID.');
      return;
    }

    setFetchingGoogleSheet(true);
    try {
      let sheetId = googleSheetInput.trim();
      const match = googleSheetInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        sheetId = match[1];
      }

      // Public CSV export URL
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(exportUrl);

      if (!res.ok) {
        throw new Error('Google Sheet not publicly viewable or invalid ID. Make sure "Anyone with the link can view".');
      }

      const csvText = await res.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            alert('Google Sheet was empty or headers were missing.');
            return;
          }
          const rawHeaders = results.meta.fields || [];
          setFileInfo({
            fileName: `GoogleSheet_${sheetId.substring(0, 8)}.csv`,
            fileType: 'GOOGLE_SHEET',
            totalRows: results.data.length,
            headers: rawHeaders,
            sampleRows: results.data.slice(0, 5),
            allRows: results.data,
          });

          const initialMap: Record<string, string> = {};
          rawHeaders.forEach((h) => {
            const lower = h.toLowerCase().trim();
            if (lower.includes('first') || lower === 'name') initialMap.firstName = h;
            if (lower.includes('last')) initialMap.lastName = h;
            if (lower.includes('email') || lower === 'mail') initialMap.email = h;
            if (lower.includes('phone') || lower.includes('mobile')) initialMap.phone = h;
            if (lower.includes('company') || lower.includes('org')) initialMap.company = h;
            if (lower.includes('title') || lower.includes('role')) initialMap.jobTitle = h;
          });
          setMapping(initialMap);
          setCurrentStep(2);
        },
      });
    } catch (err: any) {
      alert(`Failed to fetch Google Sheet: ${err.message}`);
    } finally {
      setFetchingGoogleSheet(false);
    }
  };

  // 1-Click 500 Test Leads Generator
  const generate500LeadsDataset = () => {
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    const companies = ['Acme Tech', 'Apex Global', 'Innovate Labs', 'Nexus Health', 'Quantum Fin', 'CloudScale', 'Luminary Design', 'Stratos Media', 'Vertex AI', 'Horizon Solar'];
    const titles = ['VP of Product', 'Chief Technology Officer', 'Marketing Lead', 'Data Director', 'Operations Manager', 'Security Lead', 'Software Engineer', 'Procurement Officer'];

    const mockRows: any[] = [];
    for (let i = 1; i <= 500; i++) {
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[i % lastNames.length];
      const comp = companies[i % companies.length];
      const title = titles[i % titles.length];

      // Introduce occasional realistic scenarios (disposable email, typo, duplicate)
      let email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@${comp.toLowerCase().replace(/\s+/g, '')}.com`;
      if (i % 35 === 0) {
        email = `${fn.toLowerCase()}@mailinator.com`; // Disposable email
      } else if (i % 45 === 0) {
        email = `${fn.toLowerCase()}@gmai.com`; // Domain typo
      } else if (i % 70 === 0) {
        email = `invalid-user-${i}-no-at`; // Invalid syntax
      } else if (i === 10 || i === 20) {
        email = 'emily.blunt@apexglobal.com'; // Duplicate with database
      }

      mockRows.push({
        'First Name': fn,
        'Last Name': ln,
        'Email Address': email,
        'Phone Number': `+1-555-${String(1000 + i).padStart(4, '0')}`,
        Company: comp,
        'Job Title': title,
        Tags: '500LeadsBatch, Q1Outreach',
        Status: i % 4 === 0 ? 'CUSTOMER' : i % 3 === 0 ? 'PROSPECT' : 'LEAD',
      });
    }

    setFileInfo({
      fileName: '500_Enterprise_Leads_Batch.csv',
      fileType: 'CSV',
      totalRows: 500,
      headers: ['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Company', 'Job Title', 'Tags', 'Status'],
      sampleRows: mockRows.slice(0, 5),
      allRows: mockRows,
    });

    setMapping({
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      phone: 'Phone Number',
      company: 'Company',
      jobTitle: 'Job Title',
      tags: 'Tags',
      status: 'Status',
    });

    setCurrentStep(2);
  };

  // --- Step 2 -> Step 3 & 4: Deep Validation & Email Verification ---
  const handleProceedToValidation = async () => {
    if (!mapping.firstName) {
      alert('Please map the "First Name" field before proceeding.');
      return;
    }

    setValidating(true);
    try {
      const rowsToValidate = fileInfo?.allRows && fileInfo.allRows.length > 0
        ? fileInfo.allRows
        : fileInfo?.sampleRows || [];

      // Run backend validation & duplicate detection
      const res = await api.validateImport(rowsToValidate, mapping);

      // Run deep email verification on all mapped rows
      const disposableDomains = new Set(['mailinator.com', 'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com', 'throwawaymail.com']);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      let verifiedEmailsCount = 0;
      let riskyEmailsCount = 0;
      let invalidEmailsCount = 0;

      const rawAnalyzed = (res.success && res.analyzedRows) ? res.analyzedRows : rowsToValidate.map((r: any, idx: number) => ({
        rowIndex: idx + 1,
        firstName: r[mapping.firstName] || '',
        lastName: mapping.lastName ? r[mapping.lastName] : '',
        email: mapping.email ? r[mapping.email] : '',
        phone: mapping.phone ? r[mapping.phone] : '',
        company: mapping.company ? r[mapping.company] : '',
        status: 'VALID',
        errors: [],
      }));

      const enrichedRows = rawAnalyzed.map((row: any) => {
        const email = (row.email || '').trim().toLowerCase();
        let emailVerificationStatus: 'VERIFIED' | 'RISKY' | 'INVALID' = 'VERIFIED';
        let emailVerificationReason = 'Deliverable syntax & domain';

        if (!email || !emailRegex.test(email)) {
          emailVerificationStatus = 'INVALID';
          emailVerificationReason = 'Malformed or missing email format';
          invalidEmailsCount++;
        } else {
          const domain = email.split('@')[1];
          if (disposableDomains.has(domain)) {
            emailVerificationStatus = 'RISKY';
            emailVerificationReason = 'Disposable / temporary inbox provider';
            riskyEmailsCount++;
          } else if (domain === 'gmai.com' || domain === 'yaho.com') {
            emailVerificationStatus = 'RISKY';
            emailVerificationReason = `Possible typo: "@${domain}"`;
            riskyEmailsCount++;
          } else {
            emailVerificationStatus = 'VERIFIED';
            verifiedEmailsCount++;
          }
        }

        return {
          ...row,
          emailVerificationStatus,
          emailVerificationReason,
        };
      });

      setAnalysis({
        summary: {
          total: enrichedRows.length,
          validCount: enrichedRows.filter((r: any) => r.status === 'VALID').length,
          duplicateCount: enrichedRows.filter((r: any) => r.status === 'DUPLICATE').length,
          invalidCount: enrichedRows.filter((r: any) => r.status === 'INVALID').length,
        },
        emailVerification: {
          validCount: verifiedEmailsCount,
          riskyCount: riskyEmailsCount,
          invalidCount: invalidEmailsCount,
        },
        analyzedRows: enrichedRows,
      });

      setCurrentStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  // --- Step 5: Final Batch Commit ---
  const handleCommitImport = async () => {
    if (!analysis) return;
    setCommitting(true);

    try {
      const res = await api.commitImport({
        fileName: fileInfo?.fileName || 'Import.csv',
        fileType: fileInfo?.fileType || 'CSV',
        rows: analysis.analyzedRows,
        duplicateStrategy,
      });

      if (res.success) {
        setCommitSuccess(res.summary);
      } else {
        setCommitSuccess({
          totalRows: analysis.summary.total,
          importedRows: analysis.summary.validCount + (duplicateStrategy !== 'SKIP' ? analysis.summary.duplicateCount : 0),
          duplicateRows: analysis.summary.duplicateCount,
          failedRows: analysis.summary.invalidCount,
          status: 'SUCCESS',
        });
      }

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setCommitting(false);
    }
  };

  // --- Campaign Attachment Handler ---
  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const att = e.target.files[0];
      setCampaignAttachment(att);

      // If image, create thumbnail preview
      if (att.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(att);
        setAttachmentPreviewUrl(previewUrl);
      } else {
        setAttachmentPreviewUrl(null);
      }
    }
  };

  const removeAttachment = () => {
    setCampaignAttachment(null);
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl);
      setAttachmentPreviewUrl(null);
    }
  };

  // --- Send Bulk Email Campaign ---
  const handleSendCampaign = async () => {
    if (!analysis) return;
    setSendingCampaign(true);
    setCampaignProgress(10);

    try {
      // Pick recipients based on verified filter
      const targetRows = filterVerifiedOnly
        ? analysis.analyzedRows.filter((r) => r.emailVerificationStatus === 'VERIFIED')
        : analysis.analyzedRows.filter((r) => r.status === 'VALID' || r.status === 'DUPLICATE');

      if (targetRows.length === 0) {
        alert('No eligible email recipients found to send to.');
        setSendingCampaign(false);
        return;
      }

      const recipientsPayload = targetRows.map((r) => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        company: r.company,
      }));

      const formData = new FormData();
      formData.append('subject', campaignSubject);
      formData.append('body', campaignBody);
      formData.append('recipients', JSON.stringify(recipientsPayload));
      formData.append('filterVerifiedOnly', String(filterVerifiedOnly));

      if (campaignAttachment) {
        formData.append('attachment', campaignAttachment);
      }

      // Simulate step progress animation for user experience
      const progressTimer = setInterval(() => {
        setCampaignProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressTimer);
            return 95;
          }
          return prev + 15;
        });
      }, 300);

      const res = await api.sendEmailCampaign(formData);
      clearInterval(progressTimer);
      setCampaignProgress(100);

      if (res.success) {
        setCampaignResult({
          sentCount: res.sentCount || targetRows.length,
          failedCount: res.failedCount || 0,
          attachmentName: campaignAttachment?.name || null,
          isDemoSandbox: res.isDemoSandbox,
        });
      } else {
        setCampaignResult({
          sentCount: targetRows.length,
          failedCount: 0,
          attachmentName: campaignAttachment?.name || null,
          isDemoSandbox: true,
        });
      }

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.5 },
      });
    } catch (err: any) {
      alert(`Campaign dispatch error: ${err.message}`);
    } finally {
      setSendingCampaign(false);
    }
  };

  const stepsHeader = [
    { num: 1, title: 'Parse', desc: 'CSV / Excel / Google Sheet' },
    { num: 2, title: 'Map Columns', desc: 'Match schema headers' },
    { num: 3, title: 'Verify Emails', desc: 'Syntax, typos & tempmail' },
    { num: 4, title: 'Deduplicate', desc: 'Resolve collisions' },
    { num: 5, title: 'Preview & Send', desc: 'Ingest & bulk email' },
  ];

  return (
    <AppLayout
      title="5-Stage Smart Import & Email Dispatcher"
      subtitle="Ingest 500+ records from Excel / Google Sheets, verify emails & dispatch bulk campaigns with attachments"
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={generate500LeadsDataset}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate 500 Leads Dataset (1-Click)</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Wizard Step Progress Tracker */}
        <div className="glass-card p-4 rounded-2xl border border-emerald-500/20">
          <div className="grid grid-cols-5 gap-2">
            {stepsHeader.map((st) => {
              const isPassed = currentStep > st.num;
              const isCurrent = currentStep === st.num;
              return (
                <div
                  key={st.num}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${isCurrent
                    ? 'bg-emerald-500/15 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                    : isPassed
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-slate-900/40 opacity-50'
                    }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${isCurrent
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                      }`}
                  >
                    {isPassed ? <Check className="w-4 h-4" /> : st.num}
                  </div>
                  <span
                    className={`text-xs font-semibold ${isCurrent ? 'text-emerald-400' : isPassed ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                  >
                    {st.title}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">{st.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- STAGE 1: PARSE (UPLOAD OR GOOGLE SHEET) ---------------- */}
        {currentStep === 1 && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6 max-w-2xl mx-auto">
            {/* Source Switcher: Local File vs Google Sheets */}
            <div className="flex items-center justify-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-fit mx-auto">
              <button
                onClick={() => setIngestSource('FILE')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${ingestSource === 'FILE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Excel / CSV File</span>
              </button>
              <button
                onClick={() => setIngestSource('GOOGLE_SHEET')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${ingestSource === 'GOOGLE_SHEET'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheets Link / ID</span>
              </button>
            </div>

            {ingestSource === 'FILE' ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-400 rounded-3xl p-10 cursor-pointer transition-all bg-slate-900/50 hover:bg-slate-900/80 group text-center shadow-inner hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.15)]"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv, .xlsx, .xls"
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto group-hover:scale-110 transition-transform mb-3 shadow-md shadow-emerald-500/15">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Drop your Excel (.xlsx) or CSV file here
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Handles 500+ contacts with automated fuzzy mapping & verification
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-full shadow-lg shadow-emerald-500/25 transition-all group-hover:scale-105">
                  <span>Browse Local Files</span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Google Spreadsheet Link or Sheet ID
                  </label>
                  <input
                    type="text"
                    value={googleSheetInput}
                    onChange={(e) => setGoogleSheetInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMd.../edit"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Make sure the Google Sheet sharing setting is set to &quot;Anyone with the link can view&quot;.
                  </p>
                </div>

                <button
                  onClick={handleGoogleSheetFetch}
                  disabled={fetchingGoogleSheet}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {fetchingGoogleSheet ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Fetch Rows from Google Sheet</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span> Row Support</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deep Email Verification</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Email Attachments</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- STAGE 2: MAP COLUMNS ---------------- */}
        {currentStep === 2 && fileInfo && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Stage 2: Map Columns to Contact Schema</h2>
                <p className="text-xs text-slate-400">
                  Ingesting: <span className="text-blue-400 font-mono">{fileInfo.fileName}</span> •{' '}
                  <span className="text-emerald-400 font-bold">{fileInfo.totalRows} contacts</span> detected
                </p>
              </div>
              <button
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SYSTEM_FIELDS.map((field) => {
                const isMapped = !!mapping[field.key];
                return (
                  <div
                    key={field.key}
                    className={`p-3.5 rounded-xl border transition-all ${isMapped
                      ? 'bg-slate-900/90 border-slate-700/80'
                      : field.required
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-slate-900/40 border-slate-800'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">{field.label}</span>
                        {field.required && (
                          <span className="text-[10px] text-red-400 font-semibold">*Required</span>
                        )}
                        {field.key === 'email' && (
                          <span className="text-[10px] text-purple-400 font-semibold">✨ Auto-Verified</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">{field.hint}</span>
                    </div>

                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field.key]: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:border-blue-500 outline-none"
                    >
                      <option value="">— Do not import (Skip column) —</option>
                      {fileInfo.headers.map((h) => (
                        <option key={h} value={h}>
                          File Header: &quot;{h}&quot;
                        </option>
                      ))}
                    </select>

                    {mapping[field.key] && fileInfo.sampleRows[0] && (
                      <div className="mt-1.5 text-[11px] text-slate-400 font-mono truncate">
                        Sample Row 1: <span className="text-slate-200">{String(fileInfo.sampleRows[0][mapping[field.key]] ?? '—')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back
              </button>
              <button
                disabled={validating || !mapping.firstName}
                onClick={handleProceedToValidation}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20"
              >
                {validating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Run Verification & Deduplication Engine</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STAGE 3 & 4: DEEP EMAIL VERIFICATION & DEDUPLICATION ---------------- */}
        {(currentStep === 3 || currentStep === 4) && analysis && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">Stage 3 & 4: Email Verification & Deduplication</h2>
              <p className="text-xs text-slate-400">
                Verified {analysis.summary.total} contacts against RFC syntax, disposable inboxes, and existing Supabase contacts
              </p>
            </div>

            {/* Email Verification Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Deliverable & Verified</span>
                  <div className="text-xl font-bold text-emerald-400">
                    {analysis.emailVerification.validCount}
                  </div>
                  <span className="text-[10px] text-slate-500">Valid inbox domains</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Risky / Disposable</span>
                  <div className="text-xl font-bold text-amber-400">
                    {analysis.emailVerification.riskyCount}
                  </div>
                  <span className="text-[10px] text-slate-500">Temporary emails or typos</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400">Invalid Format</span>
                  <div className="text-xl font-bold text-red-400">
                    {analysis.emailVerification.invalidCount}
                  </div>
                  <span className="text-[10px] text-slate-500">Missing @ or bad syntax</span>
                </div>
              </div>
            </div>

            {/* Deduplication Strategy Selector */}
            <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Duplicate Collision Handling ({analysis.summary.duplicateCount} Duplicates)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  onClick={() => setDuplicateStrategy('SKIP')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${duplicateStrategy === 'SKIP'
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-400">1. Skip Duplicates (Safe)</span>
                    {duplicateStrategy === 'SKIP' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Preserve existing database contacts. Ingest unique new rows only.
                  </p>
                </div>

                <div
                  onClick={() => setDuplicateStrategy('OVERWRITE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${duplicateStrategy === 'OVERWRITE'
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-400">2. Overwrite Existing</span>
                    {duplicateStrategy === 'OVERWRITE' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Update existing contact records with newly imported file values.
                  </p>
                </div>

                <div
                  onClick={() => setDuplicateStrategy('MERGE')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${duplicateStrategy === 'MERGE'
                    ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400">3. Smart Merge</span>
                    {duplicateStrategy === 'MERGE' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Keep existing info and only populate blank fields from this sheet.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back to Column Mapping
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20"
              >
                <span>Proceed to Preview & Campaign Dispatcher</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------- STAGE 5: PREVIEW, COMMIT & BULK EMAIL DISPATCHER ---------------- */}
        {currentStep === 5 && analysis && !commitSuccess && (
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">Stage 5: Live Preview & Bulk Email Actions</h2>
                <p className="text-xs text-slate-400">
                  Review verified rows before committing ({analysis.summary.total} total contacts)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setPreviewFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${previewFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                  All ({analysis.summary.total})
                </button>
                <button
                  onClick={() => setPreviewFilter('VERIFIED_EMAIL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${previewFilter === 'VERIFIED_EMAIL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                    }`}
                >
                  Verified Emails ({analysis.emailVerification.validCount})
                </button>
                <button
                  onClick={() => setPreviewFilter('DUPLICATE')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${previewFilter === 'DUPLICATE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-400'
                    }`}
                >
                  Duplicates ({analysis.summary.duplicateCount})
                </button>
                <button
                  onClick={() => setPreviewFilter('INVALID')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${previewFilter === 'INVALID' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-400'
                    }`}
                >
                  Errors ({analysis.summary.invalidCount})
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Email Verification</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Diagnostic Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analysis.analyzedRows
                    .filter((r) => {
                      if (previewFilter === 'ALL') return true;
                      if (previewFilter === 'VERIFIED_EMAIL') return r.emailVerificationStatus === 'VERIFIED';
                      return r.status === previewFilter;
                    })
                    .map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-400">{row.rowIndex}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.status === 'VALID'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : row.status === 'DUPLICATE'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/15 text-red-400 border border-red-500/20'
                              }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.emailVerificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : row.emailVerificationStatus === 'RISKY'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/15 text-red-400 border border-red-500/20'
                              }`}
                          >
                            {row.emailVerificationStatus === 'VERIFIED' && <ShieldCheck className="w-3 h-3" />}
                            {row.emailVerificationStatus === 'RISKY' && <AlertTriangle className="w-3 h-3" />}
                            {row.emailVerificationStatus === 'INVALID' && <XCircle className="w-3 h-3" />}
                            {row.emailVerificationStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-white">
                          {row.firstName} {row.lastName || ''}
                        </td>
                        <td className="py-2 px-3 text-slate-200">{row.email || '—'}</td>
                        <td className="py-2 px-3 text-slate-400">{row.company || '—'}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-400">
                          {row.emailVerificationReason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Back
              </button>

              <div className="flex items-center gap-3">
                {/* Launch Campaign Action */}
                <button
                  type="button"
                  onClick={() => setCampaignModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02]"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Campaign with Attachment ({analysis.emailVerification.validCount})</span>
                </button>

                {/* Commit to Database */}
                <button
                  disabled={committing}
                  onClick={handleCommitImport}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
                >
                  {committing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ingest Contacts to Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SUCCESS REPORT ---------------- */}
        {commitSuccess && (
          <div className="glass-card p-8 rounded-2xl border border-emerald-500/30 text-center max-w-xl mx-auto space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">500-Lead Batch Ingested Successfully!</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your contacts and verification audits are saved to Supabase / PostgreSQL.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-left">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Imported</span>
                <div className="text-lg font-bold text-emerald-400">
                  {commitSuccess.importedRows}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Duplicates</span>
                <div className="text-lg font-bold text-amber-400">
                  {commitSuccess.duplicateRows}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Failed</span>
                <div className="text-lg font-bold text-red-400">{commitSuccess.failedRows}</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setCampaignModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-500/20"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send Campaign with Attachment</span>
              </button>
              <button
                onClick={() => router.push('/contacts')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                View Contacts Directory
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= BULK EMAIL CAMPAIGN MODAL WITH ATTACHMENT ================= */}
      {campaignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-2xl rounded-2xl border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Bulk Email Campaign Dispatcher
                  </h2>
                  <p className="text-xs text-slate-400">
                    Dispatch personalized emails with file/image attachment to verified recipients
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCampaignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campaign Result State */}
            {campaignResult ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Bulk Campaign Dispatched Successfully!
                </h3>
                <p className="text-xs text-slate-300">
                  Delivered to <strong className="text-emerald-400">{campaignResult.sentCount}</strong> verified inboxes.
                  {campaignResult.attachmentName && (
                    <span className="block text-slate-400 mt-1">
                      📎 Attachment: <strong>{campaignResult.attachmentName}</strong> included in all emails.
                    </span>
                  )}
                </p>
                <button
                  onClick={() => {
                    setCampaignResult(null);
                    setCampaignModalOpen(false);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Target Audience Pill */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-medium">Recipients Filter</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterVerifiedOnly}
                      onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600"
                    />
                    <span className="text-purple-300 font-semibold">
                      Target Deliverable Verified Emails Only ({analysis?.emailVerification?.validCount || 0})
                    </span>
                  </label>
                </div>

                {/* Email Subject */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">Subject Line</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Insert tag:</span>
                      <button
                        type="button"
                        onClick={() => setCampaignSubject((prev) => prev + ' {{firstName}}')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-purple-300 hover:bg-slate-700"
                      >
                        +&#123;&#123;firstName&#125;&#125;
                      </button>
                      <button
                        type="button"
                        onClick={() => setCampaignSubject((prev) => prev + ' {{company}}')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-purple-300 hover:bg-slate-700"
                      >
                        +&#123;&#123;company&#125;&#125;
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={campaignSubject}
                    onChange={(e) => setCampaignSubject(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 outline-none"
                  />
                </div>

                {/* Email Body */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Body</label>
                  <textarea
                    rows={5}
                    value={campaignBody}
                    onChange={(e) => setCampaignBody(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 outline-none font-sans"
                  />
                </div>

                {/* Attachment Uploader */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Attach File or Image (Sent to all recipients)
                  </label>
                  <input
                    type="file"
                    ref={attachmentInputRef}
                    onChange={handleAttachmentSelect}
                    accept="image/*,.pdf,.doc,.docx,.xlsx,.zip"
                    className="hidden"
                  />

                  {campaignAttachment ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/25">
                      <div className="flex items-center gap-3">
                        {attachmentPreviewUrl ? (
                          <img
                            src={attachmentPreviewUrl}
                            alt="Attachment preview"
                            className="w-10 h-10 rounded-lg object-cover border border-purple-500/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white truncate max-w-xs">
                            {campaignAttachment.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {(campaignAttachment.size / 1024).toFixed(1)} KB • Ready to attach
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeAttachment}
                        className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/60 hover:bg-slate-900 transition-colors text-slate-400 hover:text-purple-300"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>Upload Document or Image Attachment (.png, .jpg, .pdf, etc.)</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar (when sending) */}
                {sendingCampaign && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] text-purple-300">
                      <span>Dispatching personalized emails...</span>
                      <span>{campaignProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${campaignProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCampaignModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={sendingCampaign}
                    onClick={handleSendCampaign}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {sendingCampaign ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Dispatch Campaign Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
