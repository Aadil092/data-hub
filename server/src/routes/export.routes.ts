import { Router, Response } from 'express';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import prisma from '../config/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../services/audit.service';

const router = Router();
router.use(authenticate);

async function getFilteredContactsForExport(userId: string, query: any) {
  const { search, status, tag, ids } = query;
  const where: any = { userId };

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

  const contacts = await prisma.contact.findMany({
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
router.get('/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const formattedData = await getFilteredContactsForExport(userId, req.query);

    const csvContent = Papa.unparse(formattedData);

    await logAuditEvent({
      userId,
      action: 'DATA_EXPORTED',
      entityType: 'CONTACT',
      details: { format: 'CSV', count: formattedData.length },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Contacts_Export_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate CSV export.' });
  }
});

// GET /api/export/excel - Stream Excel .xlsx file
router.get('/excel', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const formattedData = await getFilteredContactsForExport(userId, req.query);

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    await logAuditEvent({
      userId,
      action: 'DATA_EXPORTED',
      entityType: 'CONTACT',
      details: { format: 'XLSX', count: formattedData.length },
      ipAddress: req.ip,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Contacts_Export_${Date.now()}.xlsx`);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Excel export.' });
  }
});

export default router;
