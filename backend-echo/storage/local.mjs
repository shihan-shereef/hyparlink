import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BaseStorageProvider } from "./interface.mjs";

export class LocalStorageProvider extends BaseStorageProvider {
  constructor(config = {}) {
    super();
    this.baseDir =
      config.baseDir ||
      path.resolve(
        import.meta.dirname,
        "../../ai-composition-generator/storage",
      );
    this.publicBaseUrl =
      config.publicUrl ||
      process.env.BACKEND_PUBLIC_URL ||
      "";
    this.signingSecret =
      process.env.STORAGE_SIGNING_SECRET || "dev-storage-secret-key";

    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  getFilePath(objectKey) {
    // Prevent directory traversal
    const safeKey = path.normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.baseDir, safeKey);
  }

  async upload(localFilePath, objectKey, options = {}) {
    const destPath = this.getFilePath(objectKey);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Stream copy the file (large-file safe)
    await new Promise((resolve, reject) => {
      const read = fs.createReadStream(localFilePath);
      const write = fs.createWriteStream(destPath);
      read.on("error", reject);
      write.on("error", reject);
      write.on("finish", resolve);
      read.pipe(write);
    });

    const stats = fs.statSync(destPath);
    const fileSize = stats.size;
    const mimeType = options.contentType || "video/mp4";
    const etag = crypto
      .createHash("md5")
      .update(`${destPath}-${fileSize}-${stats.mtimeMs}`)
      .digest("hex");

    const cleanBase = this.publicBaseUrl.replace(/\/$/, "");
    const storageUrl = `${cleanBase}/storage/${objectKey}`;
    const cdnUrl = `${cleanBase}/cdn/${objectKey}`;

    return {
      storageProvider: "local",
      storageBucket: "local-storage",
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
    const targetPath = this.getFilePath(objectKey);
    if (!fs.existsSync(targetPath)) {
      return {
        valid: false,
        actualSize: 0,
        error: `Object not found at path: ${targetPath}`,
      };
    }

    const stats = fs.statSync(targetPath);
    if (expectedSizeBytes && Math.abs(stats.size - expectedSizeBytes) > 1024) {
      return {
        valid: false,
        actualSize: stats.size,
        error: `Size mismatch: expected ${expectedSizeBytes} bytes, found ${stats.size} bytes`,
      };
    }

    return {
      valid: true,
      actualSize: stats.size,
    };
  }

  async getSignedUrl(objectKey, expiresInSeconds = 3600) {
    const cleanBase = this.publicBaseUrl.replace(/\/$/, "");
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const hmac = crypto
      .createHmac("sha256", this.signingSecret)
      .update(`${objectKey}:${expires}`)
      .digest("hex");

    return `${cleanBase}/storage/${objectKey}?expires=${expires}&token=${hmac}`;
  }

  async getUrl(objectKey) {
    const cleanBase = this.publicBaseUrl.replace(/\/$/, "");
    return `${cleanBase}/storage/${objectKey}`;
  }

  async delete(objectKey) {
    const targetPath = this.getFilePath(objectKey);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return true;
    }
    return false;
  }

  async getMetadata(objectKey) {
    const targetPath = this.getFilePath(objectKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Object not found: ${objectKey}`);
    }
    const stats = fs.statSync(targetPath);
    return {
      size: stats.size,
      contentType: "video/mp4",
      etag: crypto
        .createHash("md5")
        .update(`${targetPath}-${stats.size}`)
        .digest("hex"),
      lastModified: stats.mtime,
    };
  }
}
