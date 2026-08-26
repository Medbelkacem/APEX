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

const BRAND = 'Apex Digital Lab';

/**
 * Absolute URL for the logo — email clients cannot resolve relative paths, and
 * CSS masking is unsupported, so the white-on-transparent variant is used
 * directly against the brand-coloured header band.
 */
const LOGO_URL = `${process.env.WEB_URL ?? 'http://localhost:3000'}/logo-white.png`;

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#fff7e6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8edf5;">
          <tr><td style="background:#001e47;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;">
            <img src="${LOGO_URL}" width="28" height="28" alt="" style="vertical-align:middle;margin-right:10px;" />
            <span style="vertical-align:middle;">${BRAND}</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:18px 28px;background:#fff7e6;color:#2b4f80;font-size:12px;border-top:1px solid #e8edf5;">
            This is an automated message from ${BRAND}. Please do not reply.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Escape untrusted text before interpolating it into an HTML email body. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function button(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#0049cc;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${label}</a>`;
}

export const emailTemplates = {
  dentistInvitation(params: { firstName: string; setupUrl: string }): RenderedEmail {
    return {
      subject: `You've been invited to ${BRAND}`,
      html: layout(
        `Welcome, ${escapeHtml(params.firstName)}`,
        `<p>An account has been created for you on the ${BRAND} portal. Set your password to get started:</p>
         <p style="margin:24px 0;">${button('Set your password', params.setupUrl)}</p>
         <p style="color:#2b4f80;font-size:13px;">This link expires in 1 hour. If you did not expect this, you can ignore this email.</p>`,
      ),
      text: `Welcome to ${BRAND}, ${params.firstName}. Set your password: ${params.setupUrl} (expires in 1 hour).`,
    };
  },

  verifyEmail(params: { firstName: string; verifyUrl: string }): RenderedEmail {
    return {
      subject: `Confirm your email address`,
      html: layout(
        `Nearly there, ${escapeHtml(params.firstName)}`,
        `<p>Thanks for registering with ${BRAND}. Confirm this address to complete your application:</p>
         <p style="margin:24px 0;">${button('Confirm email address', params.verifyUrl)}</p>
         <p>Once confirmed, our team reviews the application before your account is opened. We will email you when it is ready.</p>
         <p style="color:#2b4f80;font-size:13px;">This link expires in 24 hours. If you did not register, you can ignore this email.</p>`,
      ),
      text:
        `Thanks for registering with ${BRAND}, ${params.firstName}. ` +
        `Confirm your address: ${params.verifyUrl} (expires in 24 hours). ` +
        `Our team then reviews the application before your account is opened.`,
    };
  },

  /**
   * Sent when someone registers with an address that already has an account.
   * Registration answers identically either way, so this mail is what makes the
   * situation recoverable for the real owner without confirming to a stranger
   * that the address is registered.
   */
  registrationAttempted(params: { firstName: string; loginUrl: string; resetUrl: string }): RenderedEmail {
    return {
      subject: `Someone tried to register with your email address`,
      html: layout(
        'An account already exists',
        `<p>Hi ${escapeHtml(params.firstName)}, someone just tried to register for ${BRAND} using this address. You already have an account, so no new one was created and nothing has changed.</p>
         <p style="margin:24px 0;">${button('Sign in', params.loginUrl)}</p>
         <p>If that was you and you have forgotten your password, you can <a href="${params.resetUrl}">reset it here</a>. If it was not you, no action is needed.</p>`,
      ),
      text:
        `Someone tried to register for ${BRAND} with your address. You already have an account and nothing has changed. ` +
        `Sign in: ${params.loginUrl} — forgotten your password? ${params.resetUrl}`,
    };
  },

  accountApproved(params: { firstName: string; loginUrl: string }): RenderedEmail {
    return {
      subject: `Your ${BRAND} account is ready`,
      html: layout(
        `Welcome aboard, ${escapeHtml(params.firstName)}`,
        `<p>Your application has been approved and your account is now open. You can sign in and start submitting cases.</p>
         <p style="margin:24px 0;">${button('Sign in', params.loginUrl)}</p>`,
      ),
      text: `Your ${BRAND} account has been approved. Sign in: ${params.loginUrl}`,
    };
  },

  accountRejected(params: { firstName: string; reason?: string | null }): RenderedEmail {
    return {
      subject: `About your ${BRAND} application`,
      html: layout(
        'Application not approved',
        `<p>Hi ${escapeHtml(params.firstName)}, thank you for your interest in ${BRAND}. We are not able to open an account at this time.</p>
         ${params.reason ? `<p>${escapeHtml(params.reason)}</p>` : ''}
         <p>If you believe this is a mistake, please get in touch with the laboratory directly.</p>`,
      ),
      text:
        `Thank you for your interest in ${BRAND}. We are not able to open an account at this time.` +
        (params.reason ? ` ${params.reason}` : ''),
    };
  },

  /** Tells the lab a registration is sitting in the approval queue. */
  registrationPendingReview(params: {
    dentistName: string;
    email: string;
    clinicName?: string | null;
    reviewUrl: string;
  }): RenderedEmail {
    return {
      subject: `New dentist registration awaiting review`,
      html: layout(
        'A registration needs your review',
        `<p><strong>${escapeHtml(params.dentistName)}</strong> has registered and confirmed their email address.</p>
         <ul>
           <li>Email: ${escapeHtml(params.email)}</li>
           ${params.clinicName ? `<li>Clinic: ${escapeHtml(params.clinicName)}</li>` : ''}
         </ul>
         <p>They cannot sign in or submit cases until the account is approved.</p>
         <p style="margin:24px 0;">${button('Review registration', params.reviewUrl)}</p>`,
      ),
      text:
        `${params.dentistName} (${params.email}) has registered and confirmed their email. ` +
        `They cannot sign in until approved. Review: ${params.reviewUrl}`,
    };
  },

  passwordReset(params: { firstName: string; resetUrl: string }): RenderedEmail {
    return {
      subject: `Reset your ${BRAND} password`,
      html: layout(
        'Password reset requested',
        `<p>Hi ${escapeHtml(params.firstName)}, we received a request to reset your password.</p>
         <p style="margin:24px 0;">${button('Reset password', params.resetUrl)}</p>
         <p style="color:#2b4f80;font-size:13px;">This link expires in 1 hour. If you didn't request this, no action is needed.</p>`,
      ),
      text: `Reset your ${BRAND} password: ${params.resetUrl} (expires in 1 hour).`,
    };
  },

  caseSubmitted(params: { reference: string; caseType: string; dentistName: string }): RenderedEmail {
    return {
      subject: `New case submitted — ${params.reference}`,
      html: layout(
        `New case ${params.reference}`,
        `<p>${escapeHtml(params.dentistName)} submitted a new <strong>${escapeHtml(
          params.caseType,
        )}</strong> case.</p>
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

  invoiceIssued(params: {
    number: string;
    total: string;
    currency: string;
    dueDate: string | null;
    invoiceUrl: string;
  }): RenderedEmail {
    const due = params.dueDate ? ` It is due on ${params.dueDate}.` : '';
    return {
      subject: `Invoice ${params.number} — ${params.currency} ${params.total}`,
      html: layout(
        `Invoice ${params.number}`,
        `<p>A new invoice for <strong>${params.currency} ${params.total}</strong> has been issued to your account.${due}</p>
         <p style="margin:24px 0;">${button('View and pay invoice', params.invoiceUrl)}</p>`,
      ),
      text: `Invoice ${params.number} for ${params.currency} ${params.total}.${due} View: ${params.invoiceUrl}`,
    };
  },

  paymentReceived(params: {
    number: string;
    total: string;
    currency: string;
    invoiceUrl: string;
  }): RenderedEmail {
    return {
      subject: `Payment received — invoice ${params.number}`,
      html: layout(
        'Thank you — payment received',
        `<p>We've received your payment of <strong>${params.currency} ${params.total}</strong> for invoice ${params.number}.</p>
         <p style="margin:24px 0;">${button('View receipt', params.invoiceUrl)}</p>`,
      ),
      text: `Payment of ${params.currency} ${params.total} received for invoice ${params.number}. ${params.invoiceUrl}`,
    };
  },

  statementReady(params: { period: string; total: string; currency: string; url: string }): RenderedEmail {
    return {
      subject: `Your ${params.period} statement is ready`,
      html: layout(
        `Statement — ${params.period}`,
        `<p>Your monthly statement for <strong>${params.period}</strong> is ready. Total invoiced: <strong>${params.currency} ${params.total}</strong>.</p>
         <p style="margin:24px 0;">${button('Download statement', params.url)}</p>`,
      ),
      text: `Your ${params.period} statement is ready (${params.currency} ${params.total}). Download: ${params.url}`,
    };
  },

  adminBroadcast(params: { subject: string; message: string }): RenderedEmail {
    // Author-supplied text: escape it so a stray < or & cannot break the markup.
    const safe = escapeHtml(params.message).replace(/\n/g, '<br />');
    return {
      subject: params.subject,
      html: layout(params.subject, `<p>${safe}</p>`),
      text: params.message,
    };
  },

  contactReceived(params: { name: string; email: string; subject: string; message: string }): RenderedEmail {
    return {
      subject: `Contact form: ${params.subject}`,
      html: layout(
        'New contact message',
        `<p><strong>${escapeHtml(params.name)}</strong> (${escapeHtml(params.email)}) wrote:</p>
         <blockquote style="border-left:3px solid #0049cc;padding-left:12px;color:#123163;">${escapeHtml(
           params.message,
         ).replace(/\n/g, '<br />')}</blockquote>`,
      ),
      text: `Contact from ${params.name} <${params.email}>: ${params.message}`,
    };
  },
};
