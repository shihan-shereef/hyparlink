import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const recordOtp = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { email, code }) => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .collect();

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    await ctx.db.insert("otpCodes", {
      email: cleanEmail,
      code,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
    });
  },
});

export const getLatestOtp = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return null;

    const row = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .order("desc")
      .first();

    if (!row) return null;
    if (Date.now() > row.expiresAt) return null;

    return {
      code: row.code,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  },
});

export const inspectAuthState = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    const cleanEmail = email.trim().toLowerCase();
    const rateLimits = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", cleanEmail))
      .collect();

    const verificationCodes = await ctx.db
      .query("authVerificationCodes")
      .collect();

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", cleanEmail))
      .first();

    const accounts = user
      ? await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
          .collect()
      : [];

    return {
      cleanEmail,
      rateLimits,
      verificationCodesCount: verificationCodes.length,
      verificationCodes: verificationCodes.map((v) => ({
        ...v,
        isExpired: Date.now() > v.expirationTime,
      })),
      user: user ? { _id: user._id, email: user.email } : null,
      accounts: accounts.map((a) => ({ provider: a.provider, accountId: a.providerAccountId })),
    };
  },
});

export const resetRateLimit = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }) => {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", cleanEmail))
      .collect();

    for (const r of existing) {
      await ctx.db.delete(r._id);
    }

    return { deleted: existing.length };
  },
});

