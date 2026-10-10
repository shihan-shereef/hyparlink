import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Multi-tenant: resources carry workspaceId. It is `optional` on pre-existing tables only so
// deploys don't fail validation against pre-migration rows; the function layer always sets it.
export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  }).index("email", ["email"]),

  events: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    source: v.string(),
    type: v.string(),
    payload: v.any(),
    receivedAt: v.number(),
  })
    .index("by_received", ["receivedAt"])
    .index("by_workspace", ["workspaceId"]),

  jobs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    kind: v.string(),
    status: v.string(),
    input: v.optional(v.any()),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  auditLogs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    action: v.string(),
    meta: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  usage: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.id("users")),
    metric: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_metric", ["userId", "metric"])
    .index("by_workspace_metric", ["workspaceId", "metric"]),

  apiKeys: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.id("users"),
    name: v.string(),
    prefix: v.string(),
    hash: v.string(),
    revoked: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_hash", ["hash"]),

  // Files (workspace-scoped). Stored in Convex file storage; row holds metadata.
  files: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    storageId: v.id("_storage"),
    size: v.number(),
    contentType: v.string(),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  }),
  members: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),
  invites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.string(),
    invitedBy: v.id("users"),
    accepted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"]),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  // Maintained counters so dashboard.stats is O(1) instead of scanning every row.
  counters: defineTable({
    workspaceId: v.id("workspaces"),
    metric: v.string(),
    value: v.number(),
  }).index("by_workspace_metric", ["workspaceId", "metric"]),

  // Phase 8D: Workspace Media Asset Library
  assets: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    originalFilename: v.string(),
    type: v.string(), // "image" | "video" | "audio" | "font"
    mimeType: v.string(),
    size: v.number(),
    storageProvider: v.string(), // "r2" | "s3" | "convex" | "local"
    storageKey: v.string(), // workspaces/{ws}/assets/{assetId}/{filename}
    storageUrl: v.string(),
    cdnUrl: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    duration: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_workspace_createdAt", ["workspaceId", "createdAt"]),

  // First-class Video Projects (Phase 6 HyperFrames integration)
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    status: v.string(), // "draft" | "generating" | "validating" | "rendering" | "completed" | "failed"
    duration: v.number(),
    width: v.number(),
    height: v.number(),
    fps: v.number(),
    hyperframesVersion: v.string(),
    aiProvider: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    validationStatus: v.optional(v.string()),
    correctionAttempts: v.optional(v.number()),
    renderTimeSeconds: v.optional(v.number()),
    outputFileId: v.optional(v.id("files")),
    outputStorageId: v.optional(v.id("_storage")),
    outputUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    // Phase 7: Persistent Cloud Storage & CDN metadata
    storageProvider: v.optional(v.string()), // "r2" | "s3" | "convex" | "local"
    storageKey: v.optional(v.string()), // "workspaces/{ws}/projects/{proj}/renders/{job}/video.mp4"
    storageBucket: v.optional(v.string()),
    storageUrl: v.optional(v.string()),
    cdnUrl: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    etag: v.optional(v.string()),
    uploadedAt: v.optional(v.number()),
    // Phase 8A: Video Poster / Thumbnail
    thumbnailStorageKey: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    thumbnailCdnUrl: v.optional(v.string()),
    thumbnailFileSize: v.optional(v.number()),
    thumbnailMimeType: v.optional(v.string()),
    thumbnailGeneratedAt: v.optional(v.number()),
    thumbnailStatus: v.optional(v.string()), // "completed" | "failed" | "pending"
    // Phase 8B: Multi-Resolution Rendering Profiles
    renders: v.optional(
      v.array(
        v.object({
          resolution: v.string(), // "1080p" | "720p" | "480p"
          width: v.number(),
          height: v.number(),
          status: v.string(), // "completed" | "failed"
          storageKey: v.string(),
          storageUrl: v.string(),
          cdnUrl: v.optional(v.string()),
          fileSize: v.number(),
        }),
      ),
    ),
    // Phase 8C: HLS Adaptive Streaming
    hlsMasterUrl: v.optional(v.string()),
    hlsMasterKey: v.optional(v.string()),
    // Phase 8D: Selected Workspace Assets
    assetIds: v.optional(v.array(v.id("assets"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_user", ["userId"])
    .index("by_workspace_status", ["workspaceId", "status"]),
});
