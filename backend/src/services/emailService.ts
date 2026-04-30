import { Resend } from 'resend';

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendSignupRequestEmail({
  requestId,
  username,
  reason,
  actionToken,
}: {
  requestId: string;
  username: string;
  reason: string;
  actionToken: string;
}) {
  const backendUrl = (
    process.env.BACKEND_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ??
    'http://localhost:3001'
  ).replace(/\/$/, '');

  const adminEmail = process.env.ADMIN_EMAIL ?? 'manasa.somisetty12@gmail.com';
  const approveUrl = `${backendUrl}/api/auth/signup-request/${requestId}/approve?token=${actionToken}`;
  const rejectUrl  = `${backendUrl}/api/auth/signup-request/${requestId}/reject?token=${actionToken}`;

  await getClient().emails.send({
    from: 'ClaimPilot <onboarding@resend.dev>',
    to: adminEmail,
    subject: `Access request from ${username} — ClaimPilot`,
    html: buildRequestEmail(username, reason, approveUrl, rejectUrl),
  });
}

export async function sendApprovalEmail(userEmail: string) {
  const frontendUrl = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
  const adminEmail = process.env.ADMIN_EMAIL ?? 'manasa.somisetty12@gmail.com';

  await getClient().emails.send({
    from: 'ClaimPilot <onboarding@resend.dev>',
    to: adminEmail,
    subject: `Action needed: Forward approval to ${userEmail}`,
    html: buildApprovalEmail(frontendUrl, userEmail),
  });
}

function buildRequestEmail(username: string, reason: string, approveUrl: string, rejectUrl: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:100%;">
        <tr><td style="background:#071b2e;padding:24px 32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#2563eb;border-radius:10px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-weight:800;font-size:1rem;line-height:36px;">C</span>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-weight:700;font-size:1.05rem;">ClaimPilot</div>
              <div style="color:#94a3b8;font-size:0.75rem;">Access request notification</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 6px;font-size:1.1rem;color:#0f172a;">New access request</h2>
          <p style="margin:0 0 28px;font-size:0.85rem;color:#64748b;">Someone wants access to ClaimPilot. Review the details below and approve or reject.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:28px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:4px;">Email</div>
              <div style="font-size:0.95rem;font-weight:700;color:#0f172a;">${escapeHtml(username)}</div>
            </td></tr>
            <tr><td style="padding:14px 18px;">
              <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:4px;">Reason for access</div>
              <div style="font-size:0.88rem;color:#374151;line-height:1.6;">${escapeHtml(reason)}</div>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:8px;" width="50%">
                <a href="${approveUrl}" style="display:block;background:#16a34a;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:0.9rem;">Approve access</a>
              </td>
              <td style="padding-left:8px;" width="50%">
                <a href="${rejectUrl}" style="display:block;background:#dc2626;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:0.9rem;">Reject request</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f1f5f9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:0.72rem;color:#94a3b8;">ClaimPilot · Claims intelligence for accident recovery</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildApprovalEmail(frontendUrl: string, userEmail: string) {
  const mailtoSubject = encodeURIComponent('Your ClaimPilot access has been approved');
  const mailtoBody = encodeURIComponent(
    `Hi,\n\nYour access to ClaimPilot has been approved!\n\nYou can now sign in using the email and password you registered with:\n${frontendUrl}\n\nWelcome aboard!\n\nClaimPilot Team`
  );
  const mailtoLink = `mailto:${userEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fbff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:100%;">
        <tr><td style="background:#071b2e;padding:24px 32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#2563eb;border-radius:10px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-weight:800;font-size:1rem;line-height:36px;">C</span>
            </td>
            <td style="padding-left:12px;">
              <div style="color:#fff;font-weight:700;font-size:1.05rem;">ClaimPilot</div>
              <div style="color:#94a3b8;font-size:0.75rem;">Access approved</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="width:52px;height:52px;border-radius:50%;background:#dcfce7;display:inline-flex;align-items:center;justify-content:center;font-size:1.4rem;margin-bottom:16px;">✓</div>
          <h2 style="margin:0 0 6px;font-size:1.1rem;color:#0f172a;">Access approved</h2>
          <p style="margin:0 0 24px;font-size:0.85rem;color:#64748b;">You approved access for the user below. Click the button to notify them — it will open your email client with a pre-filled message.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:4px;">Approved user</div>
              <div style="font-size:0.95rem;font-weight:700;color:#0f172a;">${escapeHtml(userEmail)}</div>
            </td></tr>
          </table>

          <a href="${mailtoLink}" style="display:block;background:#16a34a;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:0.95rem;">
            Send approval email to ${escapeHtml(userEmail)} →
          </a>

          <p style="margin:16px 0 0;font-size:0.75rem;color:#94a3b8;text-align:center;">Clicking opens your email client with a pre-filled message ready to send.</p>
        </td></tr>
        <tr><td style="background:#f1f5f9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:0.72rem;color:#94a3b8;">ClaimPilot · Claims intelligence for accident recovery</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
