"use node";

import { v } from "convex/values";
import nodemailer from "nodemailer";
import { internalAction } from "./_generated/server";

/**
 * SMTP sender (Node action).
 * Supports any production SMTP relay (SendGrid, Brevo, AWS SES, Mailgun, Postmark, custom).
 * Reads configuration from Convex environment variables:
 * - SMTP_HOST (e.g. smtp-relay.brevo.com, smtp.sendgrid.net)
 * - SMTP_PORT (e.g. 587, 465, 2525)
 * - SMTP_USER (your SMTP username or API key)
 * - SMTP_PASS (your SMTP password or secret)
 * - SMTP_FROM (e.g. "HyperFrames <auth@yourdomain.com>")
 */
export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
  },
  handler: async (_ctx, { to, subject, text, html }) => {
    const defaultHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Your Sign-In Verification Code</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.5;">Use the following code to sign in to Ollastar. This code is valid for 15 minutes:</p>
        <div style="margin: 24px 0; padding: 18px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #4f46e5;">${text.replace(/[^0-9]/g, "") || text}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;

    // 0. If OLLASTACK_API_KEY is configured, send directly via Ollastack Mailbox API
    const ollastackKey =
      process.env.OLLASTACK_API_KEY ||
      "fmd_fc87c058c4840f4f954b46e229b702318017f680956ff3c7";
    if (ollastackKey) {
      try {
        const mailboxId =
          process.env.OLLASTACK_MAILBOX_ID || "acy7kpS_s8dpYvjRFIBVY";
        const res = await fetch(
          `https://login.ollastack.com/api/mailboxes/${mailboxId}/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ollastackKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to,
              subject,
              text,
            }),
          },
        );

        if (res.ok) {
          const data = (await res.json()) as any;
          console.log(
            `[email] Sent verification email to ${to} via Ollastack Mailbox (ID: ${data?.data?.id || "ok"})`,
          );
          return { success: true, messageId: data?.data?.id };
        } else {
          const errText = await res.text();
          console.warn(`[email] Ollastack send notice: ${errText}`);
        }
      } catch (err: any) {
        console.warn(`[email] Failed to send via Ollastack: ${err.message}`);
      }
    }

    // If RESEND_API_KEY is configured, send directly via Resend REST API
    if (process.env.RESEND_API_KEY) {
      try {
        const from =
          process.env.SMTP_FROM ||
          process.env.RESEND_FROM ||
          "HyperFrames <onboarding@resend.dev>";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            text,
            html: html ?? defaultHtml,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[email] Resend API error: ${errBody}`);
          throw new Error(`Resend API Error: ${errBody}`);
        }

        const data = (await res.json()) as { id: string };
        console.log(`[email] Sent email to ${to} via Resend (ID: ${data.id})`);
        return { success: true, messageId: data.id };
      } catch (err: any) {
        console.error(`[email] Failed to send via Resend: ${err.message}`);
        // Fall through to SMTP if configured
        if (!process.env.SMTP_HOST) {
          throw err;
        }
      }
    }

    const host = process.env.SMTP_HOST;
    if (!host) {
      console.warn("[email] Neither RESEND_API_KEY nor SMTP_HOST set. Email not sent.");
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? "587");
    const isSecure = port === 465;

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      ...(process.env.SMTP_USER
        ? {
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS ?? "",
            },
          }
        : {}),
      tls: {
        rejectUnauthorized: process.env.SMTP_IGNORE_TLS !== "true",
      },
    });


    try {
      const info = await transport.sendMail({
        from: process.env.SMTP_FROM ?? "HyperFrames <noreply@hyparlink.com>",
        to,
        subject,
        text,
        html: html ?? defaultHtml,
      });

      console.log(
        `[email] Sent verification email to ${to} (Message ID: ${info.messageId})`,
      );
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error(`[email] Failed to send email to ${to}: ${err.message}`);
      throw new Error(`SMTP Error: ${err.message}`);
    }
  },
});
