import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export async function sendImportSummaryEmail(to: string, batchInfo: {
  fileName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  duplicateRows: number;
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Email Service - Simulated] Import Summary email sent to ${to}:`, batchInfo);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'DATAHUB <no-reply@datahub.local>',
      to,
      subject: `DATAHUB: Import Completed for ${batchInfo.fileName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">DATAHUB Import Summary</h2>
          <p>Your file <strong>${batchInfo.fileName}</strong> has completed processing.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Total Rows</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${batchInfo.totalRows}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #16a34a;">Successfully Imported</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #16a34a;">${batchInfo.importedRows}</td>
            </tr>
            <tr style="background-color: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #d97706;">Duplicates Handled</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #d97706;">${batchInfo.duplicateRows}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #dc2626;">Failed / Invalid</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #dc2626;">${batchInfo.failedRows}</td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 13px;">View full details and error records directly in your DATAHUB dashboard.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending import summary email:', error);
  }
}
