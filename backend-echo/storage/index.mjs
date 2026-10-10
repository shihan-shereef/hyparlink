import { S3R2StorageProvider } from "./s3-r2.mjs";
import { ConvexStorageProvider } from "./convex-storage.mjs";
import { LocalStorageProvider } from "./local.mjs";

/**
 * Storage Provider Factory.
 * Determines the active storage provider from environment variables.
 */
export function getStorageProvider(config = {}) {
  const providerType = (
    process.env.STORAGE_PROVIDER ||
    config.provider ||
    "local"
  ).toLowerCase();

  switch (providerType) {
    case "r2":
    case "s3":
      try {
        return new S3R2StorageProvider(config);
      } catch (err) {
        console.warn(
          `[Storage Factory] Could not initialize ${providerType.toUpperCase()} provider (${err.message}). Falling back to Local Storage Provider.`,
        );
        return new LocalStorageProvider(config);
      }

    case "convex":
      return new ConvexStorageProvider(config);

    case "local":
    default:
      return new LocalStorageProvider(config);
  }
}

/**
 * Constructs a predictable, isolated object key per Section 5 specification:
 * workspaces/{workspaceId}/projects/{projectId}/renders/{jobId}/video.mp4
 */
export function buildObjectKey(workspaceId, projectId, jobId) {
  const ws = workspaceId || "default-workspace";
  const proj = projectId || "default-project";
  const job = jobId || `render-${Date.now()}`;
  return `workspaces/${ws}/projects/${proj}/renders/${job}/video.mp4`;
}
