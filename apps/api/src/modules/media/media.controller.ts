import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import * as crypto from "crypto";
import { UserRole, ErrorCode } from "@urticketbuddy/contracts";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MediaService } from "./media.service";
import { GenerateUploadUrlDto } from "./dto/generate-upload-url.dto";

@Controller("media")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /**
   * POST /api/v1/media/upload-url
   * Request a signed object-storage pre-signed upload URL.
   * Accessible to authenticated users (ADMIN, ORGANIZER, CUSTOMER).
   */
  @Post("upload-url")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER, UserRole.CUSTOMER)
  async generateUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    return this.mediaService.generateUploadUrl(dto);
  }

  /**
   * PUT /api/v1/media/upload/:fileKey
   * Receives direct pre-signed PUT upload for local storage provider.
   * Bypasses standard auth via signed URL token verification.
   */
  @Public()
  @Put("upload/:purpose/:filename")
  @HttpCode(HttpStatus.OK)
  async handleLocalUpload(
    @Param("purpose") purpose: string,
    @Param("filename") filename: string,
    @Query("token") token: string,
    @Query("expires") expiresStr: string,
    @Req() req: Request,
  ) {
    if (!token || !expiresStr) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Missing upload signature token or expiry parameter",
      });
    }

    const fileKey = `${purpose}/${filename}`;
    const expires = parseInt(expiresStr, 10);
    const contentType = req.headers["content-type"] as string | undefined;

    // Read incoming stream into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    return this.mediaService.saveLocalFile(
      fileKey,
      buffer,
      token,
      expires,
      contentType,
    );
  }

  /**
   * GET /api/v1/media/:purpose/:filename
   * Serves public media assets with CDN and HTTP caching headers (ETag, Cache-Control, stale-while-revalidate).
   */
  @Public()
  @Get(":purpose/:filename")
  async serveMedia(
    @Param("purpose") purpose: string,
    @Param("filename") filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fileKey = `${purpose}/${filename}`;
    const file = this.mediaService.getLocalFile(fileKey);

    if (!file) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Media file "${fileKey}" not found`,
      });
    }

    // Generate ETag based on file content hash
    const etag = `"${crypto.createHash("md5").update(file.buffer).digest("hex")}"`;
    const ifNoneMatch = req.headers["if-none-match"];

    if (ifNoneMatch === etag) {
      return res.status(HttpStatus.NOT_MODIFIED).end();
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=3600",
    );
    res.setHeader("ETag", etag);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Cache-Status", "HIT-LOCAL-ORIGIN");

    return res.send(file.buffer);
  }
}
