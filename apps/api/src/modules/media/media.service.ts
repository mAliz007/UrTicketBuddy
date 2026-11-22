import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { loadEnv } from "@urticketbuddy/config";
import {
  ErrorCode,
  GenerateUploadUrlRequest,
  GenerateUploadUrlResponse,
  GenerateUploadUrlRequestSchema,
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE_BYTES,
} from "@urticketbuddy/contracts";

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly env = loadEnv();
  private readonly localStorageDir: string;

  constructor() {
    this.localStorageDir =
      process.env.MEDIA_STORAGE_DIR ||
      path.resolve(process.cwd(), "data", "media-storage");
    if (!fs.existsSync(this.localStorageDir)) {
      try {
        fs.mkdirSync(this.localStorageDir, { recursive: true });
      } catch (err) {
        this.logger.warn(
          `Could not create local media storage dir: ${this.localStorageDir}`,
        );
      }
    }
  }

  /**
   * Generates a pre-signed object-storage upload URL (S3 / OCI / Local)
   */
  async generateUploadUrl(
    dto: GenerateUploadUrlRequest,
  ): Promise<GenerateUploadUrlResponse> {
    const parseResult = GenerateUploadUrlRequestSchema.safeParse(dto);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      if (
        issue?.path?.includes("mimeType") ||
        !ALLOWED_MEDIA_MIME_TYPES.includes(dto.mimeType as any)
      ) {
        throw new BadRequestException({
          code: ErrorCode.INVALID_FILE_TYPE,
          message: `File type "${dto.mimeType}" is not allowed. Allowed types: ${ALLOWED_MEDIA_MIME_TYPES.join(", ")}`,
        });
      }
      if (
        issue?.path?.includes("fileSize") ||
        dto.fileSize > MAX_MEDIA_FILE_SIZE_BYTES
      ) {
        throw new BadRequestException({
          code: ErrorCode.FILE_TOO_LARGE,
          message: `File size exceeds the 10MB limit`,
        });
      }
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: issue?.message || "Invalid media upload request",
        details: parseResult.error.flatten(),
      });
    }

    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const fileId = crypto.randomUUID();
    const ext = path.extname(sanitizedFilename) || ".bin";
    const fileKey = `${dto.purpose.toLowerCase()}/${fileId}-${sanitizedFilename}`;

    const expiresInSeconds = 900; // 15 minutes
    const provider =
      process.env.STORAGE_PROVIDER || this.env.STORAGE_PROVIDER || "local";
    const cdnBaseUrl = (
      process.env.CDN_BASE_URL ||
      this.env.CDN_BASE_URL ||
      "http://localhost:3000/media"
    ).replace(/\/$/, "");
    const cdnUrl = `${cdnBaseUrl}/${fileKey}`;

    if (provider === "s3" || provider === "oci") {
      const s3Url = this.generateS3PresignedPutUrl({
        fileKey,
        mimeType: dto.mimeType,
        expiresInSeconds,
      });
      return {
        uploadUrl: s3Url,
        fileKey,
        cdnUrl,
        expiresInSeconds,
        headers: {
          "Content-Type": dto.mimeType,
        },
      };
    }

    // Local / Development provider
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = this.generateLocalToken(fileKey, expiresAt, dto.mimeType);
    const apiPort = this.env.API_PORT || 3000;
    const localHost = `http://localhost:${apiPort}`;
    const uploadUrl = `${localHost}/api/v1/media/upload/${fileKey}?token=${token}&expires=${expiresAt}`;

    return {
      uploadUrl,
      fileKey,
      cdnUrl,
      expiresInSeconds,
      headers: {
        "Content-Type": dto.mimeType,
      },
    };
  }

  /**
   * Generates SigV4 Pre-signed PUT URL for AWS S3 and OCI S3-Compatible Object Storage.
   */
  private generateS3PresignedPutUrl(params: {
    fileKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): string {
    const bucket =
      process.env.S3_BUCKET || this.env.S3_BUCKET || "urticketbuddy-media";
    const region = process.env.S3_REGION || this.env.S3_REGION || "us-east-1";
    const accessKeyId =
      process.env.S3_ACCESS_KEY_ID ||
      this.env.S3_ACCESS_KEY_ID ||
      "MOCK_ACCESS_KEY";
    const secretAccessKey =
      process.env.S3_SECRET_ACCESS_KEY ||
      this.env.S3_SECRET_ACCESS_KEY ||
      "MOCK_SECRET_KEY";

    const endpoint = process.env.S3_ENDPOINT || this.env.S3_ENDPOINT;
    let host: string;
    let pathPrefix = "";

    if (endpoint) {
      const url = new URL(endpoint);
      host = url.host;
      if (this.env.S3_FORCE_PATH_STYLE) {
        pathPrefix = `/${bucket}`;
      } else {
        host = `${bucket}.${host}`;
      }
    } else {
      host = `${bucket}.s3.${region}.amazonaws.com`;
    }

    const canonicalUri = `${pathPrefix}/${params.fileKey.split("/").map(encodeURIComponent).join("/")}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

    const queryParams: Record<string, string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": params.expiresInSeconds.toString(),
      "X-Amz-SignedHeaders": "host",
    };

    const sortedQuery = Object.keys(queryParams)
      .sort()
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`,
      )
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = "host";
    const payloadHash = "UNSIGNED-PAYLOAD";

    const canonicalRequest = [
      "PUT",
      canonicalUri,
      sortedQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const kDate = crypto
      .createHmac("sha256", "AWS4" + secretAccessKey)
      .update(dateStamp)
      .digest();
    const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
    const kService = crypto.createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();
    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    const scheme = endpoint?.startsWith("http://") ? "http" : "https";
    return `${scheme}://${host}${canonicalUri}?${sortedQuery}&X-Amz-Signature=${signature}`;
  }

  /**
   * Generates HMAC-SHA256 token for local upload verification
   */
  generateLocalToken(
    fileKey: string,
    expiresAt: number,
    mimeType: string,
  ): string {
    const secret =
      this.env.MASTER_TICKET_SECRET ||
      "dev-master-ticket-secret-32-chars-long-key";
    return crypto
      .createHmac("sha256", secret)
      .update(`${fileKey}:${expiresAt}:${mimeType}`)
      .digest("hex");
  }

  /**
   * Verifies local upload token and expiry
   */
  verifyLocalToken(
    fileKey: string,
    expiresAt: number,
    token: string,
    mimeType?: string,
  ): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return false;
    }
    // Check against allowed mime types or specific mimeType
    if (mimeType) {
      const expected = this.generateLocalToken(fileKey, expiresAt, mimeType);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
        return true;
      }
    }
    for (const allowedMime of ALLOWED_MEDIA_MIME_TYPES) {
      const expected = this.generateLocalToken(fileKey, expiresAt, allowedMime);
      if (
        expected.length === token.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Safely saves uploaded buffer to local storage directory
   */
  async saveLocalFile(
    fileKey: string,
    buffer: Buffer,
    token: string,
    expiresAt: number,
    contentType?: string,
  ): Promise<{ fileKey: string; size: number }> {
    if (!this.verifyLocalToken(fileKey, expiresAt, token, contentType)) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Invalid or expired media upload signature",
      });
    }

    if (buffer.length > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: ErrorCode.FILE_TOO_LARGE,
        message: "Uploaded file size exceeds 10MB limit",
      });
    }

    const safePath = path.resolve(this.localStorageDir, fileKey);
    if (!safePath.startsWith(path.resolve(this.localStorageDir))) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid file path traversal detected",
      });
    }

    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    await fs.promises.writeFile(safePath, buffer);

    return {
      fileKey,
      size: buffer.length,
    };
  }

  /**
   * Retrieves file from local media storage with path protection
   */
  getLocalFile(fileKey: string): { buffer: Buffer; mimeType: string } | null {
    const safePath = path.resolve(this.localStorageDir, fileKey);
    if (!safePath.startsWith(path.resolve(this.localStorageDir))) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid file path",
      });
    }

    if (!fs.existsSync(safePath)) {
      return null;
    }

    const buffer = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".svg") mimeType = "image/svg+xml";
    else if (ext === ".pdf") mimeType = "application/pdf";

    return { buffer, mimeType };
  }
}
