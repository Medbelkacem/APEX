/**
 * Transactional email templates. Each builder returns subject + HTML + a plain
 * text fallback. Kept dependency-free (simple string interpolation) so they are
 * trivial to unit-test and render inside a background job.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'Dental Lab';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:#0f766e;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;">${BRAND}</td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
            This is an automated message from ${BRAND}. Please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${label}</a>`;
}

export const emailTemplates = {
  dentistInvitation(params: { firstName: string; setupUrl: string }): RenderedEmail {
    return {
      subject: `You've been invited to ${BRAND}`,
      html: layout(
        `Welcome, ${params.firstName}`,
        `<p>An account has been created for you on the ${BRAND} portal. Set your password to get started:</p>
         <p style="margin:24px 0;">${button('Set your password', params.setupUrl)}</p>
         <p style="color:#64748b;font-size:13px;">This link expires in 1 hour. If you did not expect this, you can ignore this email.</p>`,
      ),
      text: `Welcome to ${BRAND}, ${params.firstName}. Set your password: ${params.setupUrl} (expires in 1 hour).`,
    };
  },

  passwordReset(params: { firstName: string; resetUrl: string }): RenderedEmail {
    return {
      subject: `Reset your ${BRAND} password`,
      html: layout(
        'Password reset requested',
        `<p>Hi ${params.firstName}, we received a request to reset your password.</p>
         <p style="margin:24px 0;">${button('Reset password', params.resetUrl)}</p>
         <p style="color:#64748b;font-size:13px;">This link expires in 1 hour. If you didn't request this, no action is needed.</p>`,
      ),
      text: `Reset your ${BRAND} password: ${params.resetUrl} (expires in 1 hour).`,
    };
  },

  caseSubmitted(params: { reference: string; caseType: string; dentistName: string }): RenderedEmail {
    return {
      subject: `New case submitted — ${params.reference}`,
      html: layout(
        `New case ${params.reference}`,
        `<p>${params.dentistName} submitted a new <strong>${params.caseType}</strong> case.</p>
         <p>Reference: <strong>${params.reference}</strong></p>`,
      ),
      text: `New case ${params.reference} (${params.caseType}) submitted by ${params.dentistName}.`,
    };
  },

  caseStatusChanged(params: { reference: string; status: string; caseUrl: string }): RenderedEmail {
    return {
      subject: `Case ${params.reference} is now "${params.status}"`,
      html: layout(
        `Case ${params.reference} updated`,
        `<p>Your case status changed to <strong>${params.status}</strong>.</p>
         <p style="margin:24px 0;">${button('View case', params.caseUrl)}</p>`,
      ),
      text: `Case ${params.reference} is now "${params.status}". View: ${params.caseUrl}`,
    };
  },

  contactReceived(params: { name: string; email: string; subject: string; message: string }): RenderedEmail {
    return {
      subject: `Contact form: ${params.subject}`,
      html: layout(
        'New contact message',
        `<p><strong>${params.name}</strong> (${params.email}) wrote:</p>
         <blockquote style="border-left:3px solid #0f766e;padding-left:12px;color:#334155;">${params.message}</blockquote>`,
      ),
      text: `Contact from ${params.name} <${params.email}>: ${params.message}`,
    };
  },
};
