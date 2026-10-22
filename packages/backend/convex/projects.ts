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
      .take(150);

    const activeItems = items.filter((p) => !p.deletedAt);

    return Promise.all(
      activeItems.map(async (p) => {
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

export const listTrash = query({
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
      .take(150);

    const trashedItems = items
      .filter((p) => typeof p.deletedAt === "number")
      .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

    return Promise.all(
      trashedItems.map(async (p) => {
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
  const trimmed = rawName.trim();
  if (prompt === "DIRECT_CODE_RENDER" && trimmed) {
    return trimmed;
  }
  const isPresetOrGeneric =
    !trimmed ||
    trimmed === "Untitled Video" ||
    trimmed.toLowerCase().includes("quarterly revenue") ||
    trimmed.toLowerCase() === "tech academy ad" ||
    trimmed.toLowerCase() === "cinematic product video" ||
    trimmed.toLowerCase() === "ai video project";

  if (isPresetOrGeneric) {
    if (prompt === "DIRECT_CODE_RENDER") {
      return "Direct Code Video";
    }
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
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 45);
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
    avatarId: v.optional(v.string()),
    avatarName: v.optional(v.string()),
    voiceId: v.optional(v.string()),
    voiceName: v.optional(v.string()),
    generationMode: v.optional(v.string()), // "hyperframes_only" | "avatar_mixed" | "avatar_presenter"
    isAvatarVideo: v.optional(v.boolean()),
    mode: v.optional(v.string()), // "plan" | "autopilot"
    productionPlan: v.optional(v.any()),
    planStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let targetWs = args.workspaceId;
    let ws = await ctx.db.get(targetWs);
    if (!ws) {
      const firstWs = await ctx.db.query("workspaces").first();
      if (firstWs) targetWs = firstWs._id;
    }

    const authUserId = await getAuthUserId(ctx);
    let userId: Id<"users">;
    if (!authUserId) {
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
      userId = authUserId;
      const member = await ctx.db
        .query("members")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", userId).eq("workspaceId", targetWs),
        )
        .unique();
      if (!member) {
        await ctx.db.insert("members", {
          workspaceId: targetWs,
          userId,
          role: "member",
          createdAt: Date.now(),
        });
      }
    }

    const duration = args.duration ?? 5;
    const width = args.width ?? 1920;
    const height = args.height ?? 1080;
    const fps = args.fps ?? 30;
    const now = Date.now();
    const finalName = deriveProjectName(args.name, args.prompt);
    const mode = args.mode || "autopilot";
    const isPlanOnly = mode === "plan" && args.planStatus !== "approved";

    // Mode-aware Avatar & Voice Resolution:
    // 1. If user explicitly chose "hyperframes_only", avatar is disabled.
    // 2. If user chose "avatar_presenter" or "avatar_mixed", or explicitly provided avatarId, respect it directly!
    // 3. Fallback to prompt detection only if not explicitly configured.
    const isExplicitNoAvatar = args.generationMode === "hyperframes_only" || /\b(do\s*not\s*create\s*(?:a\s*)?(?:potcast|podcast)|don'?t\s*create\s*(?:a\s*)?(?:potcast|podcast)|no\s*(?:potcast|podcast|avatar|presenter)|without\s*avatar|remove\s*(?:the\s*)?avatar|not\s*(?:a\s*)?(?:potcast|podcast))\b/i.test(args.prompt);
    
    let finalAvatarId: string | undefined = undefined;
    let finalVoiceId: string | undefined = undefined;
    let finalIsAvatar = false;
    let finalGenerationMode = args.generationMode || "hyperframes_only";

    if (!isExplicitNoAvatar) {
      if (args.avatarId && args.avatarId.trim().length > 0) {
        finalAvatarId = args.avatarId.trim();
        finalVoiceId = (args.voiceId && args.voiceId.trim().length > 0) ? args.voiceId.trim() : undefined;
        finalIsAvatar = true;
        if (!args.generationMode || args.generationMode === "hyperframes_only") {
          finalGenerationMode = "avatar_mixed";
        }
      } else if (args.generationMode === "avatar_presenter" || args.generationMode === "avatar_mixed") {
        finalAvatarId = args.avatarId || "a9cde5fa12fc417d9739643969360ae3";
        finalVoiceId = args.voiceId || "71fbdde04ea841c59adab70e41caeb97";
        finalIsAvatar = true;
      } else {
        const hasExplicitAvatarDemand = /\b(avath?ar\s*(?:id|is|named|presenter)?|talking\s+avath?ar|talking\s+head|spokesperson|heygen\s+avath?ar|presenter\s+video)\b/i.test(args.prompt);
        if (hasExplicitAvatarDemand) {
          const avMatch = args.prompt.match(/(?:(?:heygen\s+)?avath?ar(?:_id|\s+id)?|avath?ar)(?:[:=]|\s+(?:id|is|named)?[:=\s]?)\s*["']?([a-zA-Z0-9_\-]+)["']?/i);
          const vcMatch = args.prompt.match(/(?:(?:heygen\s+)?voice(?:_id|\s+id)?|voice)(?:[:=]|\s+(?:id|is|named)?[:=\s]?)\s*["']?([a-zA-Z0-9_\-]+)["']?/i);
          finalAvatarId = avMatch ? avMatch[1] : "a9cde5fa12fc417d9739643969360ae3";
          finalVoiceId = vcMatch ? vcMatch[1] : "71fbdde04ea841c59adab70e41caeb97";
          finalIsAvatar = true;
          finalGenerationMode = "avatar_mixed";
        }
      }
    }

    // Auto-resolve workspace asset records if not provided but prompt references them
    let effectiveAssetIds = args.assetIds || [];
    if (effectiveAssetIds.length === 0) {
      const promptLower = (args.prompt || "").toLowerCase();
      const mentionsAssets = /\b(workspace\s*assets|reference\s*media|attached|attach|photo|image|picture|logo|vikas|swami|ollasoftware|networkers)\b/i.test(promptLower);
      if (mentionsAssets) {
        const wsAssets = await ctx.db
          .query("assets")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .collect();
        const matched = wsAssets.filter((a) => {
          const name = (a.name || a.originalFilename || "").toLowerCase();
          const baseName = name ? name.split(".")[0] : "";
          return (
            Boolean(baseName && promptLower.includes(baseName)) ||
            promptLower.includes("workspace assets") ||
            promptLower.includes("attached") ||
            promptLower.includes("reference media")
          );
        });
        if (matched.length > 0) {
          effectiveAssetIds = matched.map((a) => a._id);
        } else if (wsAssets.length > 0) {
          effectiveAssetIds = wsAssets.map((a) => a._id);
        }
      }
    }

    // 1. Create project record
    const projectId = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      userId,
      name: finalName,
      description: args.description,
      prompt: args.prompt.trim(),
      status: isPlanOnly ? "plan_ready" : "generating",
      duration,
      width,
      height,
      fps,
      hyperframesVersion: "0.8.139",
      aiProvider: "ollima",
      aiModel: args.model || "gemini-3-flash",
      assetIds: effectiveAssetIds.length > 0 ? effectiveAssetIds : undefined,
      avatarId: finalAvatarId,
      avatarName: args.avatarName,
      voiceId: finalVoiceId,
      voiceName: args.voiceName,
      generationMode: finalGenerationMode,
      isAvatarVideo: finalIsAvatar,
      mode,
      productionPlan: args.productionPlan,
      planStatus: args.planStatus || (isPlanOnly ? "ready" : undefined),
      chatHistory: args.productionPlan
        ? [
            {
              role: "assistant",
              content: "I have drafted the complete video production plan. Review the scenes, script, and visual direction, or let me know what changes you would like to make.",
              timestamp: now,
            },
          ]
        : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Resolve workspace asset records if provided (Phase 8D & Phase 9)
    const resolvedAssets = [];
    if (effectiveAssetIds.length > 0) {
      for (const assetId of effectiveAssetIds) {
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

    // 2. If in Autopilot mode or already approved, create job in jobs table immediately
    let jobId: any = null;
    if (!isPlanOnly && mode !== "direct_code") {
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
        model: args.model || "gemini-3-flash",
        aiModel: args.model || "gemini-3-flash",
        avatarId: args.avatarId,
        voiceId: args.voiceId,
        isAvatarVideo: args.isAvatarVideo,
        mode,
        productionPlan: args.productionPlan,
      };

      jobId = await ctx.db.insert("jobs", {
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
      await recordUsage(ctx, args.workspaceId, "jobs.created");
    }

    // Usage and counters
    await recordUsage(ctx, args.workspaceId, "videos.created");
    await audit(ctx, args.workspaceId, userId, "project.create", {
      projectId,
      jobId,
      prompt: args.prompt,
      mode,
    });

    if (jobId) {
      await bump(ctx, args.workspaceId, "jobs", 1);
      await bump(ctx, args.workspaceId, "openJobs", 1);
      await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });
    }

    return { projectId, jobId, mode };
  },
});

export const saveProductionPlan = mutation({
  args: {
    projectId: v.id("projects"),
    productionPlan: v.any(),
    planStatus: v.optional(v.string()),
    chatMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    const now = Date.now();
    const chatHistory = [...(project.chatHistory || [])];
    if (args.chatMessage) {
      chatHistory.push({
        role: "user",
        content: args.chatMessage,
        timestamp: now,
      });
      chatHistory.push({
        role: "assistant",
        content: "I have updated the video production plan based on your feedback. Please review the updated scenes and script.",
        timestamp: now + 1,
      });
    }
    await ctx.db.patch(args.projectId, {
      productionPlan: args.productionPlan,
      planStatus: args.planStatus || "ready",
      chatHistory,
      updatedAt: now,
    });
    return { success: true };
  },
});

export const addChatMessage = mutation({
  args: {
    projectId: v.id("projects"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    const now = Date.now();
    const chatHistory = [...(project.chatHistory || [])];
    chatHistory.push({
      role: args.role,
      content: args.content,
      timestamp: now,
    });
    await ctx.db.patch(args.projectId, {
      chatHistory,
      updatedAt: now,
    });
    return { success: true };
  },
});

export const approveAndRenderPlan = mutation({
  args: {
    projectId: v.id("projects"),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    let userId = await getAuthUserId(ctx);
    if (!userId) {
      userId = project.userId;
    }
    const now = Date.now();
    await ctx.db.patch(args.projectId, {
      planStatus: "approved",
      status: "generating",
      updatedAt: now,
    });

    // Resolve assets for plan execution
    const resolvedAssets = [];
    if (project.assetIds && project.assetIds.length > 0) {
      for (const assetId of project.assetIds) {
        const asset = await ctx.db.get(assetId);
        if (asset && asset.workspaceId === project.workspaceId) {
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
      projectId: project._id,
      workspaceId: project.workspaceId,
      prompt: project.prompt,
      duration: project.duration,
      width: project.width,
      height: project.height,
      fps: project.fps,
      resolution: project.width === 1920 ? "1080p" : "720p",
      assetIds: project.assetIds,
      assets: resolvedAssets,
      model: args.model || project.aiModel || "gemini-3-flash",
      aiModel: args.model || project.aiModel || "gemini-3-flash",
      avatarId: project.avatarId,
      voiceId: project.voiceId,
      isAvatarVideo: project.isAvatarVideo,
      productionPlan: project.productionPlan,
      mode: "plan",
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

    await ctx.db.patch(project._id, { jobId, updatedAt: now });
    await recordUsage(ctx, project.workspaceId, "videos.rendered");
    await audit(ctx, project.workspaceId, userId, "project.render_plan", {
      projectId: project._id,
      jobId,
    });
    await bump(ctx, project.workspaceId, "jobs", 1);
    await bump(ctx, project.workspaceId, "openJobs", 1);
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });
    return { success: true, jobId };
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

/**
 * Soft delete: Move project/video to Trash.
 */
export const moveToTrash = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (userId) {
      await requireMember(ctx, userId, project.workspaceId);
    }

    await ctx.db.patch(projectId, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (userId) {
      await audit(ctx, project.workspaceId, userId, "project.move_to_trash", {
        projectId,
        name: project.name,
      });
    }
    return { success: true };
  },
});

// Alias remove to moveToTrash so standard delete action sends to Trash
export const remove = moveToTrash;

/**
 * Restore project/video from Trash.
 */
export const restoreFromTrash = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found");
    if (userId) {
      await requireMember(ctx, userId, project.workspaceId);
    }

    await ctx.db.patch(projectId, {
      deletedAt: undefined,
      updatedAt: Date.now(),
    });

    if (userId) {
      await audit(ctx, project.workspaceId, userId, "project.restore", {
        projectId,
        name: project.name,
      });
    }
    return { success: true };
  },
});

/**
 * Permanently purge a single project and its stored assets.
 */
export const permanentDelete = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    const project = await ctx.db.get(projectId);
    if (!project) return { success: true };
    if (userId) {
      await requireMember(ctx, userId, project.workspaceId);
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
      await audit(ctx, project.workspaceId, userId, "project.permanent_delete", {
        projectId,
        name: project.name,
      });
    }
    return { success: true };
  },
});

/**
 * Empty Trash: Permanently purge all trashed projects for a workspace.
 */
export const emptyTrash = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await requireMember(ctx, userId, workspaceId);
    }

    const all = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    const trashed = all.filter((p) => typeof p.deletedAt === "number");
    let count = 0;

    for (const project of trashed) {
      if (project.outputStorageId) {
        try {
          await ctx.storage.delete(project.outputStorageId);
        } catch {}
      }
      if (project.jobId) {
        try {
          await ctx.db.delete(project.jobId);
        } catch {}
      }
      await ctx.db.delete(project._id);
      count++;
    }

    if (userId && count > 0) {
      await audit(ctx, workspaceId, userId, "project.empty_trash", { count });
    }

    return { success: true, count };
  },
});

export const updateProjectResult = internalMutation({
  args: {
    projectId: v.string(),
    workspaceId: v.optional(v.string()),
    name: v.optional(v.string()),
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
    let project = null;
    try {
      project = await ctx.db.get(args.projectId as Id<"projects">);
    } catch {
      // args.projectId might not be a valid Convex ID
    }

    if (!project) {
      let targetWs: Id<"workspaces"> | null = null;
      if (args.workspaceId) {
        try {
          const ws = await ctx.db.get(args.workspaceId as Id<"workspaces">);
          if (ws) targetWs = ws._id;
        } catch {}
      }
      if (!targetWs) {
        const firstWs = await ctx.db.query("workspaces").first();
        if (firstWs) targetWs = firstWs._id;
      }
      if (!targetWs) return;

      const firstUser = await ctx.db.query("users").first();
      const userId = firstUser ? firstUser._id : (args.projectId as any);

      const newId = await ctx.db.insert("projects", {
        workspaceId: targetWs,
        userId,
        name: args.name || "Direct Code Video",
        prompt: "DIRECT_CODE_RENDER",
        status: args.status,
        duration: 30,
        width: 1920,
        height: 1080,
        fps: 30,
        hyperframesVersion: "0.8.139",
        outputUrl: args.outputUrl,
        cdnUrl: args.cdnUrl,
        storageUrl: args.storageUrl,
        storageKey: args.storageKey,
        storageProvider: args.storageProvider,
        storageBucket: args.storageBucket,
        fileSize: args.fileSize,
        mimeType: args.mimeType || "video/mp4",
        validationStatus: args.validationStatus || "PASSED",
        renderTimeSeconds: args.renderTimeSeconds,
        thumbnailUrl: args.thumbnailUrl,
        thumbnailCdnUrl: args.thumbnailCdnUrl,
        thumbnailStorageKey: args.thumbnailStorageKey,
        thumbnailStatus: args.thumbnailStatus || "completed",
        thumbnailFileSize: args.thumbnailFileSize,
        renders: args.renders,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return newId;
    }

    await ctx.db.patch(project._id, {
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

export const checkProjectsStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const keepIds = new Set([
      "m57dqzmtt88kqnvhcpbp42f55n8gb5v0",
      "m572pgs8w3yt2j05sjz33qgm3h8gavya",
      "m573f8bqdwdn4f833pzemaq0ms8g68ta",
      "m579g6v1s41trb1d80re8jfdds8g27n3",
      "m5746v3vf72h3q3xqm9fxmw1kh8g7mpd",
      "m577q3xx2e4evn5t0e0pjvc6fs8gd0df",
      "m57ffxt9knfty64hb4cn8zns498gdw1s",
      "m57f7edthgtxbmh702nabk0cth8gcdps",
    ]);

    const allProjects = await ctx.db.query("projects").collect();
    const keptList: any[] = [];
    const toBeRemovedList: any[] = [];

    for (const p of allProjects) {
      const info = { id: p._id, name: p.name, status: p.status, outputUrl: p.outputUrl };
      if (keepIds.has(String(p._id))) {
        keptList.push(info);
      } else {
        toBeRemovedList.push(info);
      }
    }

    const foundKeepIds = new Set(keptList.map((p) => String(p.id)));
    const missingKeepIds = [...keepIds].filter((id) => !foundKeepIds.has(id));

    return { total: allProjects.length, keptList, toBeRemovedList, missingKeepIds };
  },
});

export const pruneExceptKeepList = internalMutation({
  args: {},
  handler: async (ctx) => {
    const keepIds = new Set([
      "m57dqzmtt88kqnvhcpbp42f55n8gb5v0",
      "m572pgs8w3yt2j05sjz33qgm3h8gavya",
      "m573f8bqdwdn4f833pzemaq0ms8g68ta",
      "m579g6v1s41trb1d80re8jfdds8g27n3",
      "m5746v3vf72h3q3xqm9fxmw1kh8g7mpd",
      "m577q3xx2e4evn5t0e0pjvc6fs8gd0df",
      "m57ffxt9knfty64hb4cn8zns498gdw1s",
      "m57f7edthgtxbmh702nabk0cth8gcdps",
    ]);

    const allProjects = await ctx.db.query("projects").collect();
    const removed: string[] = [];
    const kept: string[] = [];

    for (const p of allProjects) {
      if (!keepIds.has(String(p._id))) {
        await ctx.db.delete(p._id);
        removed.push(`${p._id}: ${p.name}`);
      } else {
        kept.push(`${p._id}: ${p.name}`);
      }
    }

    return { keptCount: kept.length, removedCount: removed.length, kept, removed };
  },
});


