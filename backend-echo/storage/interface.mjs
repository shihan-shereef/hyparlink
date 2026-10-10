/**
 * BaseStorageProvider - Abstract contract for HyperFrames cloud storage providers.
 * All providers (S3/R2, Convex Storage, Local fallback) implement this interface.
 */
export class BaseStorageProvider {
  /**
   * Stream and upload a local file to cloud storage.
   * @param {string} localFilePath - Local path of the rendered MP4 file.
   * @param {string} objectKey - Predictable object key (e.g. workspaces/.../video.mp4).
   * @param {object} options - Upload options (contentType, metadata).
   * @returns {Promise<{
   *   storageKey: string,
   *   storageBucket?: string,
   *   storageUrl: string,
   *   cdnUrl?: string,
   *   fileSize: number,
   *   mimeType: string,
   *   etag?: string,
   *   uploadedAt: number
   * }>}
   */
  async upload(localFilePath, objectKey, options = {}) {
    throw new Error("Not implemented: upload()");
  }

  /**
   * Verify that an uploaded object exists and matches expected size.
   * @param {string} objectKey
   * @param {number} expectedSizeBytes
   * @returns {Promise<{ valid: boolean, actualSize: number, error?: string }>}
   */
  async verifyUpload(objectKey, expectedSizeBytes) {
    throw new Error("Not implemented: verifyUpload()");
  }

  /**
   * Get public or CDN streaming URL for an object.
   * @param {string} objectKey
   * @returns {Promise<string>}
   */
  async getUrl(objectKey) {
    throw new Error("Not implemented: getUrl()");
  }

  /**
   * Generate a time-limited signed URL for private access.
   * @param {string} objectKey
   * @param {number} expiresInSeconds
   * @returns {Promise<string>}
   */
  async getSignedUrl(objectKey, expiresInSeconds = 3600) {
    throw new Error("Not implemented: getSignedUrl()");
  }

  /**
   * Delete an object from storage.
   * @param {string} objectKey
   * @returns {Promise<boolean>}
   */
  async delete(objectKey) {
    throw new Error("Not implemented: delete()");
  }

  /**
   * Fetch object metadata.
   * @param {string} objectKey
   * @returns {Promise<{ size: number, contentType: string, etag?: string, lastModified?: Date }>}
   */
  async getMetadata(objectKey) {
    throw new Error("Not implemented: getMetadata()");
  }
}
