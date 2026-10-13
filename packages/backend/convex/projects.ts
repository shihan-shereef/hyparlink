import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { audit } from "./auditLog";
import { bump } from "./counters";
import { notify } from "./notifications";
import { requireMember } from "./orgs";
import { recordUsage } from "./usage";

/**
 * Projects module — First-class HyperFrames video projects (Phase 6).
 */

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await requireMember(ctx, userId, workspaceId);
    }

    const items = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(100);

    return Promise.all(
      items.map(async (p) => {
        let videoUrl = p.cdnUrl || p.storageUrl || p.outputUrl;
        if (!videoUrl && p.outputStorageId) {
          videoUrl = (await ctx.storage.getUrl(p.outputStorageId)) ?? undefined;
        }
        if (videoUrl && videoUrl.includes("localhost:4000")) {
          videoUrl = videoUrl.replace(/^https?:\/\/[^/]+/, "");
        }
        let thumbnailUrl = p.thumbnailUrl;
        if (thumbnailUrl && thumbnailUrl.includes("localhost:4000")) {
          thumbnailUrl = thumbnailUrl.replace(/^https?:\/\/[^/]+/, "");
        }
        return {
          ...p,
          videoUrl,
          thumbnailUrl,
        };
      }),
    );
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    if (userId) {
      await requireMember(ctx, userId, project.workspaceId);
    }

    let videoUrl = project.cdnUrl || project.storageUrl || project.outputUrl;
    if (!videoUrl && project.outputStorageId) {
      videoUrl =
        (await ctx.storage.getUrl(project.outputStorageId)) ?? undefined;
    }
    if (videoUrl && videoUrl.includes("localhost:4000")) {
      videoUrl = videoUrl.replace(/^https?:\/\/[^/]+/, "");
    }
    let thumbnailUrl = project.thumbnailUrl;
    if (thumbnailUrl && thumbnailUrl.includes("localhost:4000")) {
      thumbnailUrl = thumbnailUrl.replace(/^https?:\/\/[^/]+/, "");
    }

    return {
      ...project,
      videoUrl,
      thumbnailUrl,
    };
  },
});

export const getVideoPlaybackUrl = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (userId) {
      await requireMember(ctx, userId, project.workspaceId);
    }

    // Prioritize CDN URL, then Cloud Storage URL, then direct output URL, then Convex storage
    let videoUrl = project.cdnUrl || project.storageUrl || project.outputUrl;
    if (!videoUrl && project.outputStorageId) {
      videoUrl =
        (await ctx.storage.getUrl(project.outputStorageId)) ?? undefined;
    }
    if (videoUrl && videoUrl.includes("localhost:4000")) {
      videoUrl = videoUrl.replace(/^https?:\/\/[^/]+/, "");
    }
    let cdnUrl = project.cdnUrl;
    if (cdnUrl && cdnUrl.includes("localhost:4000")) {
      cdnUrl = cdnUrl.replace(/^https?:\/\/[^/]+/, "");
    }

    return {
      projectId,
      videoUrl: videoUrl ?? null,
      storageProvider: project.storageProvider ?? "local",
      storageKey: project.storageKey ?? null,
      cdnUrl: cdnUrl ?? null,
    };
  },
});

function deriveProjectName(rawName: string, prompt: string): string {
  const pLower = prompt.trim().toLowerCase();
  const trimmed = rawName.trim();
  const isPresetOrGeneric =
    !trimmed ||
    trimmed === "Untitled Video" ||
    trimmed.toLowerCase().includes("quarterly revenue") ||
    trimmed.toLowerCase() === "tech academy ad" ||
    trimmed.toLowerCase() === "cinematic product video" ||
    trimmed.toLowerCase() === "ai video project";

  if (isPresetOrGeneric) {
    if (pLower.includes("batman")) return "Absolute Batman";
    if (pLower.includes("lantern") || pLower.includes("guy gardner")) return "DC Lanterns: Guy Gardner";
    if (pLower.includes("ollima")) return "Ollima Ad";
    if (pLower.includes("networks home")) return "Networks Home";
    const cleaned = prompt
      .trim()
      .replace(
        /^create\s+(?:a\s+)?(?:\d+[- ]seconds?\s+)?(?:1080p\s+)?(?:landscape\s+)?(?:cinematic\s+)?(?:product\s+)?(?:advertisement|video|presentation)?\s*(?:of|for|about)?\s*/i,
        "",
      )
      .replace(
        /\s*(?:with\s+(?:three|two|four|\d+)\s+scenes|smooth transitions|final call).*$/i,
        "",
      )
      .trim();
    if (cleaned.length > 2) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 40);
    }
    return "AI Video Project";
  }
  return trimmed;
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    duration: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    assetIds: v.optional(v.array(v.id("assets"))),
    model: v.optional(v.string()),
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

    const duration = args.duration ?? 5;
    const width = args.width ?? 1920;
    const height = args.height ?? 1080;
    const fps = args.fps ?? 30;
    const now = Date.now();
    const finalName = deriveProjectName(args.name, args.prompt);

    // 1. Create project record in "generating" state
    const projectId = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      userId,
      name: finalName,
      description: args.description,
      prompt: args.prompt.trim(),
      status: "generating",
      duration,
      width,
      height,
      fps,
      hyperframesVersion: "0.8.139",
      aiProvider: "ollima",
      aiModel: args.model || "deepseek-v4-flash",
      assetIds: args.assetIds,
      createdAt: now,
      updatedAt: now,
    });


    // Resolve workspace asset records if provided (Phase 8D & Phase 9)
    const resolvedAssets = [];
    if (args.assetIds && args.assetIds.length > 0) {
      for (const assetId of args.assetIds) {
        const asset = await ctx.db.get(assetId);
        if (asset && asset.workspaceId === args.workspaceId) {
          resolvedAssets.push({
            id: String(asset._id),
            name: asset.name,
            originalFilename: asset.originalFilename,
            type: asset.type,
            mimeType: asset.mimeType,
            size: asset.size,
            storageProvider: asset.storageProvider,
            storageKey: asset.storageKey,
            storageUrl: asset.storageUrl,
            cdnUrl: asset.cdnUrl,
          });
        }
      }
    }

    // 2. Create corresponding job in jobs table
    const jobInput = {
      projectId,
      workspaceId: args.workspaceId,
      prompt: args.prompt.trim(),
      duration,
      width,
      height,
      fps,
      resolution: width === 1920 ? "1080p" : "720p",
      assetIds: args.assetIds,
      assets: resolvedAssets,
      model: args.model || "deepseek-v4-flash",
      aiModel: args.model || "deepseek-v4-flash",
    };

    const jobId = await ctx.db.insert("jobs", {
      workspaceId: args.workspaceId,
      userId,
      kind: "video.generate",
      status: "pending",
      input: jobInput,
      createdAt: now,
      updatedAt: now,
    });

    // Link jobId to project
    await ctx.db.patch(projectId, { jobId, updatedAt: now });

    // Usage and counters
    await recordUsage(ctx, args.workspaceId, "videos.created");
    await recordUsage(ctx, args.workspaceId, "jobs.created");
    await audit(ctx, args.workspaceId, userId, "project.create", {
      projectId,
      jobId,
      prompt: args.prompt,
    });
    await bump(ctx, args.workspaceId, "jobs", 1);
    await bump(ctx, args.workspaceId, "openJobs", 1);

    // Schedule background execution to backend service
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });

    return { projectId, jobId };
  },
});

export const createInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    duration: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    assetIds: v.optional(v.array(v.id("assets"))),
  },
  handler: async (ctx, args) => {
    const duration = args.duration ?? 5;
    const width = args.width ?? 1920;
    const height = args.height ?? 1080;
    const fps = args.fps ?? 30;
    const now = Date.now();
    const finalName = deriveProjectName(args.name, args.prompt);

    const projectId = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      name: finalName,
      description: args.description,
      prompt: args.prompt.trim(),
      status: "generating",
      duration,
      width,
      height,
      fps,
      hyperframesVersion: "0.8.139",
      assetIds: args.assetIds,
      createdAt: now,
      updatedAt: now,
    });

    const resolvedAssets = [];
    if (args.assetIds && args.assetIds.length > 0) {
      for (const assetId of args.assetIds) {
        const asset = await ctx.db.get(assetId);
        if (asset && asset.workspaceId === args.workspaceId) {
          resolvedAssets.push({
            id: String(asset._id),
            name: asset.name,
            originalFilename: asset.originalFilename,
            type: asset.type,
            mimeType: asset.mimeType,
            size: asset.size,
            storageProvider: asset.storageProvider,
            storageKey: asset.storageKey,
            storageUrl: asset.storageUrl,
            cdnUrl: asset.cdnUrl,
          });
        }
      }
    }

    const jobInput = {
      projectId,
      workspaceId: args.workspaceId,
      prompt: args.prompt.trim(),
      duration,
      width,
      height,
      fps,
      resolution: width === 1920 ? "1080p" : "720p",
      assets: resolvedAssets.length > 0 ? resolvedAssets : undefined,
    };

    const jobId = await ctx.db.insert("jobs", {
      workspaceId: args.workspaceId,
      userId: args.userId,
      kind: "video.generate",
      status: "pending",
      input: jobInput,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(projectId, { jobId, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });
    return { projectId, jobId };
  },
});

export const renameInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
  },
  handler: async (ctx, { projectId, name }) => {
    await ctx.db.patch(projectId, {
      name: name.trim(),
      updatedAt: Date.now(),
    });
  },
});


export const retry = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    await requireMember(ctx, userId, project.workspaceId);

    const now = Date.now();
    await ctx.db.patch(projectId, {
      status: "generating",
      error: undefined,
      updatedAt: now,
    });

    const jobInput = {
      projectId,
      workspaceId: project.workspaceId,
      prompt: project.prompt,
      duration: project.duration,
      width: project.width,
      height: project.height,
      fps: project.fps,
      resolution: project.width === 1920 ? "1080p" : "720p",
    };

    const jobId = await ctx.db.insert("jobs", {
      workspaceId: project.workspaceId,
      userId,
      kind: "video.generate",
      status: "pending",
      input: jobInput,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(projectId, { jobId, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });

    return { projectId, jobId };
  },
});

export const duplicate = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    await requireMember(ctx, userId, project.workspaceId);

    const now = Date.now();
    const newId = await ctx.db.insert("projects", {
      workspaceId: project.workspaceId,
      userId,
      name: `${project.name} (Copy)`,
      description: project.description,
      prompt: project.prompt,
      status: "draft",
      duration: project.duration,
      width: project.width,
      height: project.height,
      fps: project.fps,
      hyperframesVersion: project.hyperframesVersion,
      createdAt: now,
      updatedAt: now,
    });

    await audit(ctx, project.workspaceId, userId, "project.duplicate", {
      fromId: projectId,
      newId,
    });
    return newId;
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    let userId = await getAuthUserId(ctx);
    if (!userId) {
      const defaultUser = await ctx.db.query("users").first();
      if (defaultUser) userId = defaultUser._id;
    }
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (userId) {
      try {
        await requireMember(ctx, userId, project.workspaceId);
      } catch {
        // Allow deletion in local/demo environment
      }
    }

    if (project.outputStorageId) {
      try {
        await ctx.storage.delete(project.outputStorageId);
      } catch {
        // Ignore deletion error if already removed
      }
    }

    if (project.jobId) {
      try {
        await ctx.db.delete(project.jobId);
      } catch {
        // Ignore
      }
    }

    await ctx.db.delete(projectId);
    if (userId) {
      await audit(ctx, project.workspaceId, userId, "project.delete", {
        projectId,
        name: project.name,
      });
    }
  },
});

export const updateProjectResult = internalMutation({
  args: {
    projectId: v.id("projects"),
    status: v.string(),
    outputUrl: v.optional(v.string()),
    outputStorageId: v.optional(v.id("_storage")),
    aiProvider: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    validationStatus: v.optional(v.string()),
    correctionAttempts: v.optional(v.number()),
    renderTimeSeconds: v.optional(v.number()),
    error: v.optional(v.string()),
    storageProvider: v.optional(v.string()),
    storageKey: v.optional(v.string()),
    storageBucket: v.optional(v.string()),
    storageUrl: v.optional(v.string()),
    cdnUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    etag: v.optional(v.string()),
    uploadedAt: v.optional(v.number()),
    // Phase 8
    thumbnailStorageKey: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    thumbnailCdnUrl: v.optional(v.string()),
    thumbnailFileSize: v.optional(v.number()),
    thumbnailMimeType: v.optional(v.string()),
    thumbnailGeneratedAt: v.optional(v.number()),
    thumbnailStatus: v.optional(v.string()),
    renders: v.optional(
      v.array(
        v.object({
          resolution: v.string(),
          width: v.number(),
          height: v.number(),
          status: v.string(),
          storageKey: v.string(),
          storageUrl: v.string(),
          cdnUrl: v.optional(v.string()),
          fileSize: v.number(),
        }),
      ),
    ),
    hlsMasterUrl: v.optional(v.string()),
    hlsMasterKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return;

    await ctx.db.patch(args.projectId, {
      status: args.status,
      outputUrl: args.outputUrl ?? project.outputUrl,
      outputStorageId: args.outputStorageId ?? project.outputStorageId,
      aiProvider: args.aiProvider ?? project.aiProvider,
      aiModel: args.aiModel ?? project.aiModel,
      validationStatus: args.validationStatus ?? project.validationStatus,
      correctionAttempts: args.correctionAttempts ?? project.correctionAttempts,
      renderTimeSeconds: args.renderTimeSeconds ?? project.renderTimeSeconds,
      storageProvider: args.storageProvider ?? project.storageProvider,
      storageKey: args.storageKey ?? project.storageKey,
      storageBucket: args.storageBucket ?? project.storageBucket,
      storageUrl: args.storageUrl ?? project.storageUrl,
      cdnUrl: args.cdnUrl ?? project.cdnUrl,
      fileSize: args.fileSize ?? project.fileSize,
      mimeType: args.mimeType ?? project.mimeType,
      etag: args.etag ?? project.etag,
      uploadedAt: args.uploadedAt ?? project.uploadedAt,
      thumbnailStorageKey:
        args.thumbnailStorageKey ?? project.thumbnailStorageKey,
      thumbnailUrl: args.thumbnailUrl ?? project.thumbnailUrl,
      thumbnailCdnUrl: args.thumbnailCdnUrl ?? project.thumbnailCdnUrl,
      thumbnailFileSize: args.thumbnailFileSize ?? project.thumbnailFileSize,
      thumbnailMimeType: args.thumbnailMimeType ?? project.thumbnailMimeType,
      thumbnailGeneratedAt:
        args.thumbnailGeneratedAt ?? project.thumbnailGeneratedAt,
      thumbnailStatus: args.thumbnailStatus ?? project.thumbnailStatus,
      renders: args.renders ?? project.renders,
      hlsMasterUrl: args.hlsMasterUrl ?? project.hlsMasterUrl,
      hlsMasterKey: args.hlsMasterKey ?? project.hlsMasterKey,
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return ctx.db.get(projectId);
  },
});

export const listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("projects").order("desc").take(20);
  },
});

export const summaryInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const list = await ctx.db.query("projects").order("desc").take(15);
    return list.map((p) => ({
      id: p._id,
      name: p.name,
      prompt: p.prompt?.slice(0, 80),
      status: p.status,
      created: new Date(p.createdAt).toISOString(),
      outputUrl: p.outputUrl,
    }));
  },
});


