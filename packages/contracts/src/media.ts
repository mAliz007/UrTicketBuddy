import { z } from "zod";

export enum MediaPurpose {
  EVENT_BANNER = "EVENT_BANNER",
  VENUE_LAYOUT = "VENUE_LAYOUT",
  AVATAR = "AVATAR",
  ATTACHMENT = "ATTACHMENT",
}

export const ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
] as const;

export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const GenerateUploadUrlRequestSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Filename contains invalid characters"),
  mimeType: z.enum(ALLOWED_MEDIA_MIME_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_MEDIA_FILE_SIZE_BYTES, "File size exceeds 10MB maximum limit"),
  purpose: z.nativeEnum(MediaPurpose).default(MediaPurpose.ATTACHMENT),
});

export type GenerateUploadUrlRequest = z.infer<
  typeof GenerateUploadUrlRequestSchema
>;

export const GenerateUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string().min(1),
  cdnUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  headers: z.record(z.string()),
});

export type GenerateUploadUrlResponse = z.infer<
  typeof GenerateUploadUrlResponseSchema
>;
