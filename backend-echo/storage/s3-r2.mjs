import fs from "node:fs";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BaseStorageProvider } from "./interface.mjs";

export class S3R2StorageProvider extends BaseStorageProvider {
  constructor(config = {}) {
    super();
    this.providerName = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
    this.bucket =
      config.bucket ||
      process.env.R2_BUCKET ||
      process.env.S3_BUCKET ||
      "hyperframes-videos";

    const accountId = process.env.R2_ACCOUNT_ID;
    const endpoint =
      config.endpoint ||
      process.env.R2_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    const region = config.region || process.env.S3_REGION || "auto";
    const accessKeyId =
      config.accessKeyId ||
      process.env.R2_ACCESS_KEY_ID ||
      process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey =
      config.secretAccessKey ||
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.S3_SECRET_ACCESS_KEY;

    this.publicCdnUrl =
      config.publicUrl ||
      process.env.R2_PUBLIC_URL ||
      process.env.S3_PUBLIC_URL ||
      "";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `Cloud Storage Error: Missing credentials for ${this.providerName.toUpperCase()}. Please set ${
          this.providerName === "r2"
            ? "R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY"
            : "S3_ACCESS_KEY_ID & S3_SECRET_ACCESS_KEY"
        }.`,
      );
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(localFilePath, objectKey, options = {}) {
    const stats = fs.statSync(localFilePath);
    const fileSize = stats.size;
    const mimeType = options.contentType || "video/mp4";

    // Stream the file instead of reading entire buffer into memory
    const fileStream = fs.createReadStream(localFilePath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: fileStream,
      ContentLength: fileSize,
      ContentType: mimeType,
      Metadata: options.metadata || {},
    });

    const response = await this.client.send(command);
    const etag = response.ETag?.replace(/"/g, "");

    // Resolve URL: use CDN/Public URL if configured, otherwise signed URL
    let cdnUrl = undefined;
    let storageUrl = undefined;

    if (this.publicCdnUrl) {
      const cleanBase = this.publicCdnUrl.replace(/\/$/, "");
      cdnUrl = `${cleanBase}/${objectKey}`;
      storageUrl = cdnUrl;
    } else {
      // Default to time-limited signed URL (1 hour)
      storageUrl = await this.getSignedUrl(objectKey, 3600);
    }

    return {
      storageProvider: this.providerName,
      storageBucket: this.bucket,
      storageKey: objectKey,
      storageUrl,
      cdnUrl,
      fileSize,
      mimeType,
      etag,
      uploadedAt: Date.now(),
    };
  }

  async verifyUpload(objectKey, expectedSizeBytes) {
    try {
      const meta = await this.getMetadata(objectKey);
      if (expectedSizeBytes && Math.abs(meta.size - expectedSizeBytes) > 1024) {
        return {
          valid: false,
          actualSize: meta.size,
          error: `Size mismatch: expected ${expectedSizeBytes} bytes, found ${meta.size} bytes`,
        };
      }
      return {
        valid: true,
        actualSize: meta.size,
      };
    } catch (err) {
      return {
        valid: false,
        actualSize: 0,
        error: err.message,
      };
    }
  }

  async getSignedUrl(objectKey, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return await awsGetSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async getUrl(objectKey) {
    if (this.publicCdnUrl) {
      return `${this.publicCdnUrl.replace(/\/$/, "")}/${objectKey}`;
    }
    return this.getSignedUrl(objectKey, 3600);
  }

  async delete(objectKey) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      await this.client.send(command);
      return true;
    } catch (e) {
      console.warn(
        `[Storage Warning] Failed to delete object ${objectKey}:`,
        e.message,
      );
      return false;
    }
  }

  async getMetadata(objectKey) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    const res = await this.client.send(command);
    return {
      size: res.ContentLength || 0,
      contentType: res.ContentType || "video/mp4",
      etag: res.ETag?.replace(/"/g, ""),
      lastModified: res.LastModified,
    };
  }
}
