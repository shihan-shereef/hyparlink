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
    "fmd_fc87c058c4840f4f954b46e229b702318017f680956ff3c7",
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

    // Record OTP for instant UI verification
    try {
      if ((ctx as any)?.runMutation) {
        await (ctx as any).runMutation(internal.otp.recordOtp, { email, code: token });
      }
    } catch (e) {
      console.warn(`[auth] Could not record OTP in database: ${(e as Error).message}`);
    }

    const timeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const subject = `[${token}] Your Ollastar Verification Code (${timeStr})`;
    const text = `Your new Ollastar sign-in verification code is: ${token}\n\nGenerated at: ${timeStr}\nThis code is valid for 15 minutes.`;

    // 1. Dispatch email delivery through Convex Action (runs in Node environment, avoids 1s mutation timeout)
    if (ctx?.runAction) {
      try {
        await ctx.runAction(internal.email.sendEmail, {
          to: email,
          subject,
          text,
        });
        console.log(`[auth] OTP email action dispatched successfully to ${email}`);
        return;
      } catch (err: any) {
        console.warn(`[auth] Failed to dispatch email action: ${err?.message}`);
      }
    }

    // Direct fallback if action not available
    const ollastackKey =
      process.env.OLLASTACK_API_KEY ||
      "fmd_fc87c058c4840f4f954b46e229b702318017f680956ff3c7";
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
              subject,
              text,
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
