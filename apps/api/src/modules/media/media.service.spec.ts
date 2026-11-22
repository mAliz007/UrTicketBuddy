import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { MediaService } from "./media.service";
import { MediaPurpose, ErrorCode } from "@urticketbuddy/contracts";

describe("MediaService", () => {
  let service: MediaService;
  const testStorageDir = path.resolve(__dirname, "../../../test-media-storage");

  beforeAll(() => {
    process.env.MEDIA_STORAGE_DIR = testStorageDir;
    service = new MediaService();
  });

  afterAll(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  describe("generateUploadUrl", () => {
    it("should generate a valid pre-signed URL for local storage", async () => {
      const response = await service.generateUploadUrl({
        filename: "banner.png",
        mimeType: "image/png",
        fileSize: 1024 * 500, // 500KB
        purpose: MediaPurpose.EVENT_BANNER,
      });

      expect(response).toBeDefined();
      expect(response.uploadUrl).toContain(
        "/api/v1/media/upload/event_banner/",
      );
      expect(response.uploadUrl).toContain("token=");
      expect(response.uploadUrl).toContain("expires=");
      expect(response.fileKey).toMatch(
        /^event_banner\/[0-9a-f-]{36}-banner\.png$/,
      );
      expect(response.cdnUrl).toContain(response.fileKey);
      expect(response.expiresInSeconds).toBe(900);
      expect(response.headers["Content-Type"]).toBe("image/png");
    });

    it("should generate S3 SigV4 signed URL when provider is s3", async () => {
      const originalProvider = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = "s3";
      process.env.S3_BUCKET = "test-bucket";
      process.env.S3_REGION = "eu-west-1";

      const s3Service = new MediaService();
      const response = await s3Service.generateUploadUrl({
        filename: "layout.svg",
        mimeType: "image/svg+xml",
        fileSize: 2048,
        purpose: MediaPurpose.VENUE_LAYOUT,
      });

      expect(response.uploadUrl).toContain(
        "test-bucket.s3.eu-west-1.amazonaws.com",
      );
      expect(response.uploadUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
      expect(response.uploadUrl).toContain("X-Amz-Signature=");
      expect(response.fileKey).toContain("venue_layout/");

      process.env.STORAGE_PROVIDER = originalProvider;
    });

    it("should reject disallowed file types with INVALID_FILE_TYPE", async () => {
      await expect(
        service.generateUploadUrl({
          filename: "malicious.exe",
          mimeType: "application/x-msdownload" as any,
          fileSize: 1024,
          purpose: MediaPurpose.ATTACHMENT,
        }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.INVALID_FILE_TYPE,
        },
      });
    });

    it("should reject oversized files with FILE_TOO_LARGE", async () => {
      await expect(
        service.generateUploadUrl({
          filename: "huge-image.jpg",
          mimeType: "image/jpeg",
          fileSize: 15 * 1024 * 1024, // 15MB > 10MB limit
          purpose: MediaPurpose.EVENT_BANNER,
        }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.FILE_TOO_LARGE,
        },
      });
    });

    it("should reject invalid filenames with VALIDATION_ERROR", async () => {
      await expect(
        service.generateUploadUrl({
          filename: "bad filename with spaces & chars?.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          purpose: MediaPurpose.EVENT_BANNER,
        }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.VALIDATION_ERROR,
        },
      });
    });
  });

  describe("local file upload and retrieval", () => {
    it("should verify token and save uploaded file, then retrieve it", async () => {
      const fileKey = "avatar/test-user-avatar.png";
      const expiresAt = Math.floor(Date.now() / 1000) + 600;
      const token = service.generateLocalToken(fileKey, expiresAt, "image/png");
      const sampleData = Buffer.from("fake-png-binary-stream-data");

      const saveResult = await service.saveLocalFile(
        fileKey,
        sampleData,
        token,
        expiresAt,
        "image/png",
      );
      expect(saveResult.fileKey).toBe(fileKey);
      expect(saveResult.size).toBe(sampleData.length);

      const retrieved = service.getLocalFile(fileKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.mimeType).toBe("image/png");
      expect(retrieved?.buffer.toString()).toBe("fake-png-binary-stream-data");
    });

    it("should reject saving with invalid token", async () => {
      const fileKey = "avatar/attacker.png";
      const expiresAt = Math.floor(Date.now() / 1000) + 600;
      const badToken = "invalid-token-signature";
      const sampleData = Buffer.from("data");

      await expect(
        service.saveLocalFile(fileKey, sampleData, badToken, expiresAt),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject expired token", async () => {
      const fileKey = "avatar/expired.png";
      const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      const token = service.generateLocalToken(
        fileKey,
        pastExpiry,
        "image/png",
      );

      await expect(
        service.saveLocalFile(fileKey, Buffer.from("data"), token, pastExpiry),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should reject path traversal in fileKey", async () => {
      const fileKey = "../../escaped-file.png";
      const expiresAt = Math.floor(Date.now() / 1000) + 600;
      const token = service.generateLocalToken(fileKey, expiresAt, "image/png");

      await expect(
        service.saveLocalFile(fileKey, Buffer.from("data"), token, expiresAt),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
