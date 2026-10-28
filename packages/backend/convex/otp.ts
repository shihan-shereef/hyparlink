import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { modifyAccountCredentials } from "@convex-dev/auth/server";

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

export const setUserPassword = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: cleanEmail, secret: password },
    });
    return { success: true, email: cleanEmail };
  },
});

export const markUserEmailVerified = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", cleanEmail))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, {
      emailVerificationTime: Date.now(),
    });
    return { success: true, userId: user._id };
  },
});

export const listAllProjects = query({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("projects").collect();
    const workspaces = await ctx.db.query("workspaces").collect();
    const members = await ctx.db.query("members").collect();
    const users = await ctx.db.query("users").collect();
    return {
      users: users.map((u) => ({ _id: u._id, email: u.email, name: u.name })),
      members: members.map((m) => ({ userId: m.userId, workspaceId: m.workspaceId, role: m.role })),
      workspaces: workspaces.map((w) => ({
        _id: w._id,
        name: w.name,
      })),
      projects: list.map((p) => ({
        _id: p._id,
        name: p.name,
        workspaceId: p.workspaceId,
        status: p.status,
        outputUrl: p.outputUrl,
        videoUrl: p.videoUrl,
        duration: p.duration,
        deletedAt: p.deletedAt,
      })),
    };
  },
});

export const retainOnlyFourShowcaseProjects = mutation({
  args: {},
  handler: async (ctx) => {
    const ws1 = "mh72wqk6xje4evgptha2n9sw6h8gszbw" as Id<"workspaces">;
    const ws2 = "mh76mnv9k6dbe50rbwc0jsqpzd8grsqj" as Id<"workspaces">;
    const user1 = "md71aq4sjst7eskc2zrcms79jx8grr5r" as Id<"users">; // shihanshereef2@gmail.com
    const user2 = "md75v6dhp2sddytzem3c8yvknh8grr07" as Id<"users">; // admin@hyparlink.com

    // 1. All existing projects
    const all = await ctx.db.query("projects").collect();

    // The four desired showcase projects:
    const desired = [
      {
        key: "kerala",
        name: "Kerala — God's Own Country",
        outputUrl: "/outputs/repaired_job-job_code_1792219404621_iizjt_1792381910438.mp4",
        videoUrl: "/outputs/repaired_job-job_code_1792219404621_iizjt_1792381910438.mp4",
        thumbnailUrl: "/outputs/repaired_job-job_code_1792219404621_iizjt_1792381910438_thumb.jpg",
        duration: 40,
        status: "completed",
        width: 1920,
        height: 1080,
        fps: 30,
        hyperframesVersion: "0.8.139",
        prompt: "Kerala tourism scenic travel showcase",
      },
      {
        key: "karnataka",
        name: "Karnataka — A 3-Day Journey",
        outputUrl: "/outputs/karnataka-coorg.mp4",
        videoUrl: "/outputs/karnataka-coorg.mp4",
        thumbnailUrl: "/outputs/repaired_job-job_code_1792219404621_iizjt_1792381910438_thumb.jpg",
        duration: 40,
        status: "completed",
        width: 1920,
        height: 1080,
        fps: 30,
        hyperframesVersion: "0.8.139",
        prompt: "Karnataka Coorg heritage and mist journey",
      },
      {
        key: "london",
        name: "London City Ad",
        outputUrl: "/outputs/repaired_job-job_code_1792382768219_mbcw4_1792382812142.mp4",
        videoUrl: "/outputs/repaired_job-job_code_1792382768219_mbcw4_1792382812142.mp4",
        thumbnailUrl: "/outputs/repaired_job-job_code_1792382768219_mbcw4_1792382812142_thumb.jpg",
        duration: 40,
        status: "completed",
        width: 1920,
        height: 1080,
        fps: 30,
        hyperframesVersion: "0.8.139",
        prompt: "London urban cinematic promotion video",
      },
      {
        key: "macbook",
        name: "MacBook Pro M3 Max (40s)",
        outputUrl: "/cdn/workspaces/mh72wqk6xje4evgptha2n9sw6h8gszbw/projects/proj_code_1793103454604/renders/job_code_1793103454838_jracm/video.mp4",
        videoUrl: "/cdn/workspaces/mh72wqk6xje4evgptha2n9sw6h8gszbw/projects/proj_code_1793103454604/renders/job_code_1793103454838_jracm/video.mp4",
        thumbnailUrl: "/outputs/inspection-frame-1s.png",
        duration: 40,
        status: "completed",
        width: 1920,
        height: 1080,
        fps: 30,
        hyperframesVersion: "0.8.139",
        prompt: "MacBook Pro M3 Max 40-second commercial with dynamic transitions",
      },
    ];

    // Delete all existing projects
    for (const p of all) {
      await ctx.db.delete(p._id);
    }

    // Insert clean projects into ws1
    const idsWs1: Record<string, string> = {};
    for (const d of desired) {
      const id = await ctx.db.insert("projects", {
        workspaceId: ws1,
        userId: user1,
        name: d.name,
        prompt: d.prompt,
        status: d.status,
        duration: d.duration,
        width: d.width,
        height: d.height,
        fps: d.fps,
        hyperframesVersion: d.hyperframesVersion,
        outputUrl: d.outputUrl,
        videoUrl: d.videoUrl,
        thumbnailUrl: d.thumbnailUrl,
        cdnUrl: d.outputUrl,
      });
      idsWs1[d.key] = id;
    }

    // Also mirror to ws2
    const idsWs2: Record<string, string> = {};
    for (const d of desired) {
      const id = await ctx.db.insert("projects", {
        workspaceId: ws2,
        userId: user2,
        name: d.name,
        prompt: d.prompt,
        status: d.status,
        duration: d.duration,
        width: d.width,
        height: d.height,
        fps: d.fps,
        hyperframesVersion: d.hyperframesVersion,
        outputUrl: d.outputUrl,
        videoUrl: d.videoUrl,
        thumbnailUrl: d.thumbnailUrl,
        cdnUrl: d.outputUrl,
      });
      idsWs2[d.key] = id;
    }

    return { ws1: idsWs1, ws2: idsWs2 };
  },
});

export const updateProjectMetadata = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    duration: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.duration !== undefined) patch.duration = args.duration;
    if (args.thumbnailUrl !== undefined) patch.thumbnailUrl = args.thumbnailUrl;
    await ctx.db.patch(args.projectId, patch);
    return { success: true };
  },
});
