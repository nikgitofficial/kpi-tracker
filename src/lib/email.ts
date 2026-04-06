import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "KPI";

export async function sendOTPEmail(email: string, otp: string, name?: string) {
  const displayName = name ?? email.split("@")[0];

  return resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: email,
    subject: `${otp} — your ${APP_NAME} verification code`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your identity</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Logo row -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#0f0f0f;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.5px;line-height:36px;display:inline-block;padding:0 10px;">${APP_NAME.charAt(0)}</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:15px;font-weight:600;color:#0f0f0f;letter-spacing:-0.3px;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e8e8;overflow:hidden;">

              <!-- Top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#0f0f0f 0%,#404040 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Card body -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:44px 48px 40px;">

                    <!-- Label -->
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Security code</p>

                    <!-- Heading -->
                    <h1 style="margin:0 0 20px 0;font-size:26px;font-weight:700;color:#0f0f0f;letter-spacing:-0.8px;line-height:1.2;">Verify your identity</h1>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr>
                    </table>

                    <!-- Greeting -->
                    <p style="margin:0 0 16px 0;font-size:15px;color:#444444;line-height:1.6;">Hi ${displayName},</p>
                    <p style="margin:0 0 32px 0;font-size:15px;color:#666666;line-height:1.7;">
                      We received a password reset request for your account. Use the code below to continue. This code expires in <span style="color:#0f0f0f;font-weight:600;">15 minutes</span>.
                    </p>

                    <!-- OTP Block -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="background:#f8f8f8;border:1px solid #ebebeb;border-radius:12px;padding:32px;text-align:center;">
                          <p style="margin:0 0 12px 0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#aaaaaa;">One-time passcode</p>
                          <p style="margin:0;font-size:44px;font-weight:700;letter-spacing:14px;color:#0f0f0f;font-family:'Courier New',Courier,monospace;padding-left:14px;">${otp}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Warning note -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:0;">
                      <tr>
                        <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
                          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                            <span style="font-weight:600;">Didn't request this?</span> You can safely ignore this email. Your account password will not be changed.
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 4px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#aaaaaa;line-height:1.6;">
                    © ${new Date().getFullYear()} ${APP_NAME} · This is an automated message, please do not reply.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  return resend.emails.send({
    from: `${APP_NAME} <${FROM}>`,
    to: email,
    subject: `Welcome to ${APP_NAME}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f6f6;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

          <!-- Logo row -->
          <tr>
            <td style="padding:0 0 28px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#0f0f0f;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.5px;line-height:36px;display:inline-block;padding:0 10px;">${APP_NAME.charAt(0)}</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:15px;font-weight:600;color:#0f0f0f;letter-spacing:-0.3px;">${APP_NAME}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e8e8e8;overflow:hidden;">

              <!-- Top accent bar -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#0f0f0f 0%,#404040 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Card body -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:44px 48px 40px;">

                    <!-- Label -->
                    <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999999;">Account created</p>

                    <!-- Heading -->
                    <h1 style="margin:0 0 20px 0;font-size:26px;font-weight:700;color:#0f0f0f;letter-spacing:-0.8px;line-height:1.2;">Welcome aboard, ${name.split(" ")[0]}.</h1>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                      <tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr>
                    </table>

                    <p style="margin:0 0 16px 0;font-size:15px;color:#444444;line-height:1.7;">
                      Your ${APP_NAME} account is ready. You can now sign in and start using the platform.
                    </p>

                    <!-- Feature list -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #f4f4f4;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:20px;font-size:13px;color:#0f0f0f;">✓</td>
                              <td style="font-size:14px;color:#555555;padding-left:8px;">Secure JWT-based authentication</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #f4f4f4;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:20px;font-size:13px;color:#0f0f0f;">✓</td>
                              <td style="font-size:14px;color:#555555;padding-left:8px;">Password reset via email verification</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="width:20px;font-size:13px;color:#0f0f0f;">✓</td>
                              <td style="font-size:14px;color:#555555;padding-left:8px;">30-day session with automatic renewal</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#0f0f0f;border-radius:8px;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "#"}/login" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                            Sign in to your account →
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 4px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;color:#aaaaaa;line-height:1.6;">
                    © ${new Date().getFullYear()} ${APP_NAME} · This is an automated message, please do not reply.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}