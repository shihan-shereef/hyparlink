import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit } from "./auditLog";
import { bump } from "./counters";
import { requireMember } from "./orgs";
import type { Id } from "./_generated/dataModel";

/**
 * Workspace Media Asset Library (Phase 8D)
 * Provides workspace-scoped asset storage, listing, filtering, previewing, and AI manifest resolution.
 */

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(v.string()), // "image" | "video" | "audio" | "font" | "all"
    search: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, type, search }) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await requireMember(ctx, userId, workspaceId);
    }

    let rows: any[] = [];
    if (type && type !== "all") {
      rows = await ctx.db
        .query("assets")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", workspaceId).eq("type", type),
        )
        .order("desc")
        .take(200);
    } else {
      rows = await ctx.db
        .query("assets")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .order("desc")
        .take(200);
    }

    if (search && search.trim()) {
      const qLower = search.trim().toLowerCase();
      rows = rows.filter(
        (a) =>
          a.name.toLowerCase().includes(qLower) ||
          a.originalFilename.toLowerCase().includes(qLower),
      );
    }

    return rows.map((a) => {
      let storageUrl = a.storageUrl;
      if (storageUrl && storageUrl.includes("localhost:4000")) {
        storageUrl = storageUrl.replace(/^https?:\/\/[^/]+/, "");
      }
      let cdnUrl = a.cdnUrl;
      if (cdnUrl && cdnUrl.includes("localhost:4000")) {
        cdnUrl = cdnUrl.replace(/^https?:\/\/[^/]+/, "");
      }
      return {
        ...a,
        storageUrl,
        cdnUrl,
      };
    });
  },
});

export const get = query({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const userId = await getAuthUserId(ctx);
    const asset = await ctx.db.get(assetId);
    if (!asset) return null;
    if (userId) {
      await requireMember(ctx, userId, asset.workspaceId);
    }
    let storageUrl = asset.storageUrl;
    if (storageUrl && storageUrl.includes("localhost:4000")) {
      storageUrl = storageUrl.replace(/^https?:\/\/[^/]+/, "");
    }
    let cdnUrl = asset.cdnUrl;
    if (cdnUrl && cdnUrl.includes("localhost:4000")) {
      cdnUrl = cdnUrl.replace(/^https?:\/\/[^/]+/, "");
    }
    return {
      ...asset,
      storageUrl,
      cdnUrl,
    };
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    originalFilename: v.string(),
    type: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageProvider: v.string(),
    storageKey: v.string(),
    storageUrl: v.string(),
    cdnUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let userId = await getAuthUserId(ctx);
    if (!userId) {
      let defaultUser = await ctx.db.query("users").first();
      if (!defaultUser) {
        const uId = await ctx.db.insert("users", {
          name: "Admin",
          username: "admin",
          email: "admin@hyparlink.com",
          emailVerificationTime: Date.now(),
        });
        defaultUser = await ctx.db.get(uId);
      }
      userId = defaultUser!._id;
    } else {
      await requireMember(ctx, userId, args.workspaceId);
    }

    const now = Date.now();
    const assetId = await ctx.db.insert("assets", {
      workspaceId: args.workspaceId,
      userId,
      name: args.name,
      originalFilename: args.originalFilename,
      type: args.type,
      mimeType: args.mimeType,
      size: args.size,
      storageProvider: args.storageProvider,
      storageKey: args.storageKey,
      storageUrl: args.storageUrl,
      cdnUrl: args.cdnUrl,
      width: args.width,
      height: args.height,
      duration: args.duration,
      createdAt: now,
      updatedAt: now,
    });

    await audit(ctx, args.workspaceId, userId, "asset.create", {
      assetId,
      name: args.name,
      type: args.type,
    });
    await bump(ctx, args.workspaceId, "assets", 1);

    return assetId;
  },
});

export const createInternal = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    originalFilename: v.string(),
    type: v.string(),
    mimeType: v.string(),
    size: v.number(),
    storageProvider: v.string(),
    storageKey: v.string(),
    storageUrl: v.string(),
    cdnUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const assetId = await ctx.db.insert("assets", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      name: args.name,
      originalFilename: args.originalFilename,
      type: args.type,
      mimeType: args.mimeType,
      size: args.size,
      storageProvider: args.storageProvider,
      storageKey: args.storageKey,
      storageUrl: args.storageUrl,
      cdnUrl: args.cdnUrl,
      width: args.width,
      height: args.height,
      createdAt: now,
      updatedAt: now,
    });
    return assetId;
  },
});

export const remove = mutation({
  args: { assetId: v.id("assets") },
  handler: async (ctx, { assetId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const asset = await ctx.db.get(assetId);
    if (!asset) throw new Error("Asset not found");
    await requireMember(ctx, userId, asset.workspaceId);

    await ctx.db.delete(assetId);
    await audit(ctx, asset.workspaceId, userId, "asset.delete", {
      assetId,
      name: asset.name,
    });
    await bump(ctx, asset.workspaceId, "assets", -1);

    return { success: true, storageKey: asset.storageKey };
  },
});

/**
 * Resolves a list of asset IDs for AI generation, guaranteeing strict workspace isolation.
 * Rejects or filters any asset IDs that do not belong to the target workspace.
 */
export const resolveForAi = query({
  args: {
    workspaceId: v.id("workspaces"),
    assetIds: v.array(v.id("assets")),
  },
  handler: async (ctx, { workspaceId, assetIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireMember(ctx, userId, workspaceId);

    const resolved: Array<{
      id: string;
      name: string;
      type: string;
      mimeType: string;
      url: string;
      storageKey: string;
    }> = [];

    for (const id of assetIds) {
      const asset = await ctx.db.get(id);
      if (asset && asset.workspaceId === workspaceId) {
        resolved.push({
          id: asset._id,
          name: asset.name,
          type: asset.type,
          mimeType: asset.mimeType,
          url: asset.cdnUrl || asset.storageUrl,
          storageKey: asset.storageKey,
        });
      }
    }

    return resolved;
  },
});

export const listAllInternal = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("assets").collect();
  },
});

