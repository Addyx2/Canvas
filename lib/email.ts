// Email goes through Resend, the same as Pleasant: set RESEND_API_KEY and
// EMAIL_FROM (an address on a domain verified in Resend).
const FROM = () => process.env.EMAIL_FROM ?? "Aultrum Elements <no-reply@aultrum.co.uk>";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Until email is set up, links are shown on screen instead, but only outside
 * production: in production that would let anyone verify any address.
 */
export function showLinksOnScreen(): boolean {
  return !emailConfigured() && process.env.NODE_ENV !== "production";
}

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(`${process.env.RESEND_API_BASE ?? "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: input.to, subject: input.subject, text: input.text }),
    });
    if (!res.ok) console.error("Email not sent:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("Email not sent:", error);
    return false;
  }
}
