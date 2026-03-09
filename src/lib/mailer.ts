import nodemailer from 'nodemailer'

export interface MailerEnv {
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_PASS?: string
  SMTP_FROM?: string
  REPORT_TO?: string
}

export async function sendReportEmail(
  env: MailerEnv,
  name: string,
  email: string,
  message: string,
): Promise<void> {
  const host = env.SMTP_HOST
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  const to   = env.REPORT_TO

  if (!host || !user || !pass || !to) {
    throw new Error('SMTP configuration is incomplete. Required: SMTP_HOST, SMTP_USER, SMTP_PASS, REPORT_TO')
  }

  const port   = parseInt(env.SMTP_PORT ?? '587', 10)
  const secure = port === 465

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  const from = env.SMTP_FROM ?? user

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1a1a2e;color:#e2e8f0;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;color:#7c3aed;">📬 KOMCAD – New Contact Message</h2>
    <p style="margin:4px 0 0;opacity:0.7;font-size:13px;">Command of Cyber &amp; Active Defense</p>
  </div>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;font-weight:bold;color:#374151;width:120px;">From Name</td>
          <td style="padding:8px 0;color:#1f2937;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;color:#374151;">Reply-To</td>
          <td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#7c3aed;">${escapeHtml(email)}</a></td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;"/>
    <h3 style="margin:0 0 8px;color:#374151;">Message</h3>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:16px;white-space:pre-wrap;color:#374151;">
${escapeHtml(message)}
    </div>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
      Sent from KOMCAD Security Dashboard on ${new Date().toUTCString()}
    </p>
  </div>
</body>
</html>`

  await transporter.sendMail({
    from: `"KOMCAD System" <${from}>`,
    to,
    subject: `[KOMCAD] Report / Contact from ${name}`,
    html,
    replyTo: email,
  })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
