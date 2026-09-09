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
const papaparse_1 = __importDefault(require("papaparse"));
const XLSX = __importStar(require("xlsx"));
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
async function getFilteredContactsForExport(userId, query) {
    const { search, status, tag, ids } = query;
    const where = { userId };
    if (ids && typeof ids === 'string') {
        const idArray = ids.split(',').filter(Boolean);
        if (idArray.length > 0) {
            where.id = { in: idArray };
        }
    }
    if (status && status !== 'ALL') {
        where.status = status;
    }
    if (tag && tag !== 'ALL') {
        where.tags = { has: tag };
    }
    if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
        ];
    }
    const contacts = await prisma_1.default.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
    return contacts.map((c) => ({
        'First Name': c.firstName,
        'Last Name': c.lastName || '',
        'Email Address': c.email || '',
        'Phone Number': c.phone || '',
        Company: c.company || '',
        'Job Title': c.jobTitle || '',
        Tags: c.tags.join(', '),
        Status: c.status,
        Source: c.source,
        Notes: c.notes || '',
        'Created At': c.createdAt.toISOString(),
    }));
}
// GET /api/export/csv - Stream CSV file
router.get('/csv', async (req, res) => {
    try {
        const userId = req.user.id;
        const formattedData = await getFilteredContactsForExport(userId, req.query);
        const csvContent = papaparse_1.default.unparse(formattedData);
        await (0, audit_service_1.logAuditEvent)({
            userId,
            action: 'DATA_EXPORTED',
            entityType: 'CONTACT',
            details: { format: 'CSV', count: formattedData.length },
            ipAddress: req.ip,
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=Contacts_Export_${Date.now()}.csv`);
        res.status(200).send(csvContent);
    }
    catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate CSV export.' });
    }
});
// GET /api/export/excel - Stream Excel .xlsx file
router.get('/excel', async (req, res) => {
    try {
        const userId = req.user.id;
        const formattedData = await getFilteredContactsForExport(userId, req.query);
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        await (0, audit_service_1.logAuditEvent)({
            userId,
            action: 'DATA_EXPORTED',
            entityType: 'CONTACT',
            details: { format: 'XLSX', count: formattedData.length },
            ipAddress: req.ip,
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Contacts_Export_${Date.now()}.xlsx`);
        res.status(200).send(buffer);
    }
    catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate Excel export.' });
    }
});
exports.default = router;
