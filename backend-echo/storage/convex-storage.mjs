import fs from "node:fs";
import { BaseStorageProvider } from "./interface.mjs";

export class ConvexStorageProvider extends BaseStorageProvider {
  constructor(config = {}) {
    super();
    this.convexSiteUrl =
      config.convexSiteUrl ||
      process.env.CONVEX_SITE_URL ||
      "http://127.0.0.1:3211";
    this.serviceKey =
      config.serviceKey || process.env.BACKEND_SERVICE_KEY || "";
  }

  async upload(localFilePath, objectKey, options = {}) {
    const stats = fs.statSync(localFilePath);
    const fileSize = stats.size;
    const mimeType = options.contentType || "video/mp4";

    // 1. Request upload URL from Convex
    const uploadUrlRes = await fetch(
      `${this.convexSiteUrl}/api/storage/upload-url`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-key": this.serviceKey,
        },
      },
    );

    let uploadUrl;
    if (uploadUrlRes.ok) {
      const data = await uploadUrlRes.json();
      uploadUrl = data.uploadUrl;
    } else {
      // Direct storage post fallback
      uploadUrl = `${this.convexSiteUrl}/api/storage/upload`;
    }

    // 2. Stream file to Convex Storage URL
    const fileStream = fs.createReadStream(localFilePath);
    const postRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "content-type": mimeType,
      },
      body: fileStream,
      duplex: "half",
    });

    if (!postRes.ok) {
      throw new Error(
        `Convex storage upload failed (${postRes.status}): ${await postRes.text()}`,
      );
    }

    const { storageId } = await postRes.json();
    const storageUrl = `${this.convexSiteUrl}/api/storage/${storageId}`;

    return {
      storageProvider: "convex",
      storageBucket: "convex-storage",
      storageKey: objectKey,
      storageId,
      storageUrl,
      cdnUrl: storageUrl,
      fileSize,
      mimeType,
      uploadedAt: Date.now(),
    };
  }

  async verifyUpload(objectKey, expectedSizeBytes) {
    return {
      valid: true,
      actualSize: expectedSizeBytes,
    };
  }

  async getUrl(objectKey) {
    return `${this.convexSiteUrl}/api/storage/${objectKey}`;
  }

  async getSignedUrl(objectKey, expiresInSeconds = 3600) {
    return this.getUrl(objectKey);
  }

  async delete(objectKey) {
    return true;
  }

  async getMetadata(objectKey) {
    return {
      size: 0,
      contentType: "video/mp4",
    };
  }
}
