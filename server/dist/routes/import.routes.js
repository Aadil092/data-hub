"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const papaparse_1 = __importDefault(require("papaparse"));
const XLSX = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});
const FIELD_ALIASES = {
    firstName: ['first name', 'firstname', 'first_name', 'fname', 'name', 'given name', 'first'],
    lastName: ['last name', 'lastname', 'last_name', 'lname', 'surname', 'family name', 'last'],
    email: ['email', 'e-mail', 'email address', 'mail', 'email_address', 'work email'],
    phone: ['phone', 'phone number', 'mobile', 'cell', 'tel', 'telephone', 'mobile number', 'contact'],
    company: ['company', 'organization', 'org', 'company name', 'business', 'employer'],
    jobTitle: ['job title', 'job', 'title', 'position', 'role', 'designation'],
    tags: ['tags', 'tag', 'categories', 'category', 'groups', 'group', 'label'],
    status: ['status', 'stage', 'lead status', 'pipeline status'],
    notes: ['notes', 'note', 'comments', 'comment', 'description', 'remarks'],
};
function autoSuggestMapping(headers) {
    const mapping = {};
    const normalizedHeaders = headers.map((h) => ({
        original: h,
        cleaned: h.toLowerCase().trim().replace(/[_\s-]+/g, ' '),
    }));
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        const matched = normalizedHeaders.find((h) => aliases.some((alias) => h.cleaned === alias || h.cleaned.includes(alias)));
        if (matched) {
            mapping[field] = matched.original;
        }
    }
    return mapping;
}
// POST /api/import/upload - Upload and parse CSV or Excel
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        const originalName = req.file.originalname;
        const ext = originalName.split('.').pop()?.toLowerCase();
        let rawRows = [];
        let headers = [];
        if (ext === 'csv') {
            const csvString = req.file.buffer.toString('utf8');
            const parseResult = papaparse_1.default.parse(csvString, {
                header: true,
                skipEmptyLines: true,
            });
            rawRows = parseResult.data;
            headers = parseResult.meta.fields || [];
        }
        else if (ext === 'xlsx' || ext === 'xls') {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];
            rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (rawRows.length > 0) {
                headers = Object.keys(rawRows[0]);
            }
        }
        else {
            res.status(400).json({ success: false, message: 'Unsupported file format. Please upload .csv or .xlsx' });
            return;
        }
        if (rawRows.length === 0) {
            res.status(400).json({ success: false, message: 'The uploaded file is empty.' });
            return;
        }
        const suggestedMapping = autoSuggestMapping(headers);
        res.json({
            success: true,
            fileName: originalName,
            fileType: ext?.toUpperCase() || 'CSV',
            totalRows: rawRows.length,
            headers,
            suggestedMapping,
            sampleRows: rawRows.slice(0, 5),
            allRows: rawRows,
        });
    }
    catch (error) {
        console.error('Import upload error:', error);
        res.status(500).json({ success: false, message: 'Failed to process uploaded file.' });
    }
});
// POST /api/import/validate - Map columns, validate rules, detect duplicates
router.post('/validate', async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows, mapping } = req.body;
        if (!Array.isArray(rows) || !mapping) {
            res.status(400).json({ success: false, message: 'Invalid payload: rows and mapping required.' });
            return;
        }
        // Extract all emails and phones from the mapped rows to check DB duplicates in 1 batch
        const candidateEmails = [];
        const candidatePhones = [];
        const mappedRows = rows.map((row, index) => {
            const firstName = mapping.firstName && row[mapping.firstName] ? String(row[mapping.firstName]).trim() : '';
            const lastName = mapping.lastName && row[mapping.lastName] ? String(row[mapping.lastName]).trim() : '';
            const rawEmail = mapping.email && row[mapping.email] ? String(row[mapping.email]).trim().toLowerCase() : '';
            const rawPhone = mapping.phone && row[mapping.phone] ? String(row[mapping.phone]).trim() : '';
            const company = mapping.company && row[mapping.company] ? String(row[mapping.company]).trim() : '';
            const jobTitle = mapping.jobTitle && row[mapping.jobTitle] ? String(row[mapping.jobTitle]).trim() : '';
            const rawTags = mapping.tags && row[mapping.tags] ? String(row[mapping.tags]).trim() : '';
            const rawStatus = mapping.status && row[mapping.status] ? String(row[mapping.status]).trim().toUpperCase() : 'LEAD';
            const notes = mapping.notes && row[mapping.notes] ? String(row[mapping.notes]).trim() : '';
            const tags = rawTags
                ? rawTags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
                : [];
            if (rawEmail)
                candidateEmails.push(rawEmail);
            if (rawPhone)
                candidatePhones.push(rawPhone);
            return {
                rowIndex: index + 1,
                firstName,
                lastName,
                email: rawEmail || null,
                phone: rawPhone || null,
                company,
                jobTitle,
                tags,
                status: ['LEAD', 'PROSPECT', 'CUSTOMER', 'ARCHIVED'].includes(rawStatus) ? rawStatus : 'LEAD',
                notes,
            };
        });
        // Query DB for duplicates
        const existingDbContacts = await prisma_1.default.contact.findMany({
            where: {
                userId,
                OR: [
                    candidateEmails.length > 0 ? { email: { in: candidateEmails } } : undefined,
                    candidatePhones.length > 0 ? { phone: { in: candidatePhones } } : undefined,
                ].filter(Boolean),
            },
            select: { id: true, email: true, phone: true, firstName: true, lastName: true },
        });
        const dbEmailMap = new Map();
        const dbPhoneMap = new Map();
        for (const c of existingDbContacts) {
            if (c.email)
                dbEmailMap.set(c.email.toLowerCase(), c);
            if (c.phone)
                dbPhoneMap.set(c.phone, c);
        }
        // In-file duplicate trackers
        const seenEmailsInFile = new Set();
        const seenPhonesInFile = new Set();
        const analyzedRows = mappedRows.map((row) => {
            const errors = [];
            let isDuplicate = false;
            let duplicateReason = '';
            let existingMatch = null;
            // 1. Validation checks
            if (!row.firstName) {
                errors.push('First name is required');
            }
            if (row.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(row.email)) {
                    errors.push(`Invalid email syntax: "${row.email}"`);
                }
            }
            // 2. Duplicate checks (if email or phone exists)
            if (row.email) {
                if (dbEmailMap.has(row.email)) {
                    isDuplicate = true;
                    existingMatch = dbEmailMap.get(row.email);
                    duplicateReason = `Email matches existing contact in database (${existingMatch.firstName} ${existingMatch.lastName || ''})`;
                }
                else if (seenEmailsInFile.has(row.email)) {
                    isDuplicate = true;
                    duplicateReason = `Duplicate email appears multiple times in this file`;
                }
                seenEmailsInFile.add(row.email);
            }
            if (row.phone && !isDuplicate) {
                if (dbPhoneMap.has(row.phone)) {
                    isDuplicate = true;
                    existingMatch = dbPhoneMap.get(row.phone);
                    duplicateReason = `Phone matches existing contact in database (${existingMatch.firstName} ${existingMatch.lastName || ''})`;
                }
                else if (seenPhonesInFile.has(row.phone)) {
                    isDuplicate = true;
                    duplicateReason = `Duplicate phone appears multiple times in this file`;
                }
                seenPhonesInFile.add(row.phone);
            }
            let rowStatus = 'VALID';
            if (errors.length > 0) {
                rowStatus = 'INVALID';
            }
            else if (isDuplicate) {
                rowStatus = 'DUPLICATE';
            }
            return {
                ...row,
                status: rowStatus,
                errors,
                duplicateReason,
                existingMatchId: existingMatch?.id || null,
            };
        });
        const validCount = analyzedRows.filter((r) => r.status === 'VALID').length;
        const duplicateCount = analyzedRows.filter((r) => r.status === 'DUPLICATE').length;
        const invalidCount = analyzedRows.filter((r) => r.status === 'INVALID').length;
        res.json({
            success: true,
            summary: {
                total: analyzedRows.length,
                validCount,
                duplicateCount,
                invalidCount,
            },
            analyzedRows,
        });
    }
    catch (error) {
        console.error('Validate import error:', error);
        res.status(500).json({ success: false, message: 'Validation analysis failed.' });
    }
});
// POST /api/import/commit - Commit the import with duplicate resolution strategy
router.post('/commit', async (req, res) => {
    try {
        const userId = req.user.id;
        const { fileName, fileType = 'CSV', rows, duplicateStrategy = 'SKIP' } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            res.status(400).json({ success: false, message: 'No rows to commit.' });
            return;
        }
        let importedCount = 0;
        let duplicateHandledCount = 0;
        let failedCount = 0;
        const errorLog = [];
        for (const row of rows) {
            try {
                if (row.status === 'INVALID' || (row.errors && row.errors.length > 0)) {
                    failedCount++;
                    errorLog.push({
                        row: row.rowIndex,
                        data: row,
                        error: row.errors?.join(', ') || 'Invalid data',
                    });
                    continue;
                }
                if (row.status === 'DUPLICATE') {
                    duplicateHandledCount++;
                    if (duplicateStrategy === 'SKIP') {
                        // Do not insert, just log and continue
                        continue;
                    }
                    else if (duplicateStrategy === 'OVERWRITE' && row.existingMatchId) {
                        // Update the existing contact
                        await prisma_1.default.contact.update({
                            where: { id: row.existingMatchId },
                            data: {
                                firstName: row.firstName,
                                lastName: row.lastName || null,
                                phone: row.phone || undefined,
                                company: row.company || undefined,
                                jobTitle: row.jobTitle || undefined,
                                tags: row.tags?.length ? row.tags : undefined,
                                notes: row.notes || undefined,
                            },
                        });
                        importedCount++;
                        continue;
                    }
                    else if (duplicateStrategy === 'MERGE' && row.existingMatchId) {
                        // Fetch existing and only fill in missing fields
                        const existing = await prisma_1.default.contact.findUnique({ where: { id: row.existingMatchId } });
                        if (existing) {
                            await prisma_1.default.contact.update({
                                where: { id: row.existingMatchId },
                                data: {
                                    lastName: existing.lastName || row.lastName || null,
                                    phone: existing.phone || row.phone || null,
                                    company: existing.company || row.company || null,
                                    jobTitle: existing.jobTitle || row.jobTitle || null,
                                    tags: Array.from(new Set([...existing.tags, ...(row.tags || [])])),
                                    notes: existing.notes ? `${existing.notes}\n${row.notes || ''}`.trim() : row.notes || null,
                                },
                            });
                            importedCount++;
                            continue;
                        }
                    }
                }
                // Standard clean insert
                await prisma_1.default.contact.create({
                    data: {
                        userId,
                        firstName: row.firstName,
                        lastName: row.lastName || null,
                        email: row.email || null,
                        phone: row.phone || null,
                        company: row.company || null,
                        jobTitle: row.jobTitle || null,
                        tags: row.tags || [],
                        status: row.status === 'LEAD' || row.status === 'PROSPECT' || row.status === 'CUSTOMER' ? row.status : 'LEAD',
                        source: fileType === 'XLSX' ? 'EXCEL_IMPORT' : 'CSV_IMPORT',
                        notes: row.notes || null,
                    },
                });
                importedCount++;
            }
            catch (err) {
                failedCount++;
                errorLog.push({
                    row: row.rowIndex,
                    data: row,
                    error: err.message || 'Database insert error',
                });
            }
        }
        // Record ImportBatch
        const batch = await prisma_1.default.importBatch.create({
            data: {
                userId,
                fileName: fileName || 'Imported_Data.csv',
                fileType,
                totalRows: rows.length,
                importedRows: importedCount,
                duplicateRows: duplicateHandledCount,
                failedRows: failedCount,
                status: failedCount === 0 ? 'SUCCESS' : importedCount > 0 ? 'PARTIAL' : 'FAILED',
                errorLog: errorLog.length > 0 ? errorLog : undefined,
            },
        });
        await (0, audit_service_1.logAuditEvent)({
            userId,
            action: 'DATA_IMPORTED',
            entityType: 'IMPORT',
            entityId: batch.id,
            details: {
                fileName,
                total: rows.length,
                imported: importedCount,
                duplicates: duplicateHandledCount,
                failed: failedCount,
                duplicateStrategy,
            },
            ipAddress: req.ip,
        });
        // Send email summary
        (0, email_service_1.sendImportSummaryEmail)(req.user.email, {
            fileName: fileName || 'Contacts Import',
            totalRows: rows.length,
            importedRows: importedCount,
            failedRows: failedCount,
            duplicateRows: duplicateHandledCount,
        }).catch(console.error);
        res.json({
            success: true,
            batchId: batch.id,
            summary: {
                totalRows: rows.length,
                importedRows: importedCount,
                duplicateRows: duplicateHandledCount,
                failedRows: failedCount,
                status: batch.status,
            },
            errorLog,
        });
    }
    catch (error) {
        console.error('Commit import error:', error);
        res.status(500).json({ success: false, message: 'Failed to commit import.' });
    }
});
exports.default = router;
