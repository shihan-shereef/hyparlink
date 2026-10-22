import { Email } from "@convex-dev/auth/providers/Email";
import { internal } from "./_generated/api";

/**
 * Magic email OTP provider (passwordless) powered directly by Ollastack Mailbox API.
 */
export const ResendOTP = Email({
  id: "resend-otp",
  apiKey:
    process.env.RESEND_API_KEY ||
    process.env.OLLASTACK_API_KEY ||
    "fmd_2200c3e27e67ac686748c88d1c9a47d71fdaea882006a66b",
  maxAge: 60 * 15, // code valid for 15 minutes
  async generateVerificationToken() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 10).toString()).join("");
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: { runAction: (ref: unknown, args: unknown) => Promise<unknown> },
  ) {
    console.warn(`[auth] OTP for ${email}: ${token}`);

    // Direct, reliable Ollastack Mailbox send
    const ollastackKey =
      process.env.OLLASTACK_API_KEY ||
      "fmd_2200c3e27e67ac686748c88d1c9a47d71fdaea882006a66b";
    const mailboxId =
      process.env.OLLASTACK_MAILBOX_ID || "acy7kpS_s8dpYvjRFIBVY";

    if (ollastackKey && mailboxId) {
      try {
        const res = await fetch(
          `https://login.ollastack.com/api/mailboxes/${mailboxId}/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ollastackKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: email,
              subject: "Your Ollastar Verification Code",
              text: `Your Ollastar sign-in verification code is: ${token}\n\nThis one-time passcode will expire in 15 minutes.`,
            }),
          },
        );

        if (res.ok) {
          console.log(`[auth] Ollastack OTP successfully delivered to ${email}`);
          return;
        } else {
          const errText = await res.text();
          console.warn(`[auth] Ollastack send HTTP ${res.status}: ${errText}`);
        }
      } catch (err: any) {
        console.warn(`[auth] Ollastack direct send notice: ${err?.message}`);
      }
    }

    // Fallback through internal action
    try {
      await ctx?.runAction(internal.email.sendEmail, {
        to: email,
        subject: "Your sign-in code",
        text: `Your sign-in code is ${token}`,
      });
    } catch (e) {
      console.warn(`[email] OTP send failed: ${(e as Error).message}`);
    }
  },
});
