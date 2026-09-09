import { Router, Response } from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { verifyBatchEmails, verifyEmail } from '../services/emailVerifier.service';
import { logAuditEvent } from '../services/audit.service';

const router = Router();
router.use(authenticate);

// Configure multer for file or image attachments up to 25MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// POST /api/email/verify-batch - Verify a list of emails
router.post('/verify-batch', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) {
      res.status(400).json({ success: false, message: 'Expected an array of email strings.' });
      return;
    }

    const verification = verifyBatchEmails(emails);
    res.json({ success: true, ...verification });
  } catch (error: any) {
    console.error('Batch verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify emails.' });
  }
});

// POST /api/email/send-campaign - Send personalized email campaign with optional file or image attachment
router.post(
  '/send-campaign',
  upload.single('attachment'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { subject, body, recipients: rawRecipients, filterVerifiedOnly } = req.body;

      let recipients: any[] = [];
      try {
        recipients = typeof rawRecipients === 'string' ? JSON.parse(rawRecipients) : rawRecipients;
      } catch (e) {
        res.status(400).json({ success: false, message: 'Invalid recipients format. JSON array expected.' });
        return;
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ success: false, message: 'At least one recipient is required.' });
        return;
      }

      if (!subject || !body) {
        res.status(400).json({ success: false, message: 'Email Subject and Body are required.' });
        return;
      }

      // Filter by email validity if requested
      const targetRecipients = filterVerifiedOnly === 'true' || filterVerifiedOnly === true
        ? recipients.filter((r) => {
            const result = verifyEmail(r.email);
            return result.status === 'VALID';
          })
        : recipients.filter((r) => !!r.email);

      if (targetRecipients.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid recipient email addresses found to send to.',
        });
        return;
      }

      // Check for attached file or image
      const attachmentInfo = req.file
        ? {
            filename: req.file.originalname,
            content: req.file.buffer,
            contentType: req.file.mimetype,
          }
        : null;

      const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
      let sentCount = 0;
      let failedCount = 0;
      const failures: { email: string; reason: string }[] = [];

      for (const recipient of targetRecipients) {
        // Personalized template variable replacement
        const personalizedSubject = subject
          .replace(/\{\{firstName\}\}/gi, recipient.firstName || 'there')
          .replace(/\{\{lastName\}\}/gi, recipient.lastName || '')
          .replace(/\{\{company\}\}/gi, recipient.company || 'your company')
          .replace(/\{\{email\}\}/gi, recipient.email);

        const personalizedHtml = body
          .replace(/\{\{firstName\}\}/gi, recipient.firstName || 'there')
          .replace(/\{\{lastName\}\}/gi, recipient.lastName || '')
          .replace(/\{\{company\}\}/gi, recipient.company || 'your company')
          .replace(/\{\{email\}\}/gi, recipient.email)
          .replace(/\n/g, '<br/>');

        if (hasSmtp) {
          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM || 'DATAHUB <no-reply@datahub.local>',
              to: recipient.email,
              subject: personalizedSubject,
              html: `
                <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 20px;">
                  ${personalizedHtml}
                  <br/><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0 10px;" />
                  <p style="font-size: 11px; color: #94a3b8;">Sent securely via DATAHUB Bulk Dispatch Engine</p>
                </div>
              `,
              attachments: attachmentInfo ? [attachmentInfo] : [],
            });
            sentCount++;
          } catch (err: any) {
            failedCount++;
            failures.push({ email: recipient.email, reason: err.message || 'SMTP delivery failure' });
          }
        } else {
          // Simulated dispatch engine for instant testing without SMTP blockers
          sentCount++;
        }
      }

      await logAuditEvent({
        userId,
        action: 'CAMPAIGN_DISPATCHED',
        entityType: 'SYSTEM',
        details: {
          subject,
          totalTargeted: targetRecipients.length,
          sentCount,
          failedCount,
          attachment: attachmentInfo ? attachmentInfo.filename : null,
          deliveryMode: hasSmtp ? 'LIVE_SMTP' : 'SIMULATED_SANDBOX',
        },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        message: `Campaign dispatched to ${sentCount} recipients successfully!`,
        sentCount,
        failedCount,
        failures,
        attachmentName: attachmentInfo ? attachmentInfo.filename : null,
        isDemoSandbox: !hasSmtp,
      });
    } catch (error: any) {
      console.error('Send campaign error:', error);
      res.status(500).json({ success: false, message: 'Campaign dispatch failed.' });
    }
  }
);

export default router;
