import { Test, TestingModule } from "@nestjs/testing";
import {
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaPurpose } from "@urticketbuddy/contracts";

describe("MediaController", () => {
  let controller: MediaController;
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: {
            generateUploadUrl: jest.fn().mockResolvedValue({
              uploadUrl:
                "http://localhost:3000/api/v1/media/upload/event_banner/mock.png",
              fileKey: "event_banner/mock.png",
              cdnUrl: "http://localhost:3000/media/event_banner/mock.png",
              expiresInSeconds: 900,
              headers: { "Content-Type": "image/png" },
            }),
            saveLocalFile: jest.fn().mockResolvedValue({
              fileKey: "event_banner/mock.png",
              size: 1024,
            }),
            getLocalFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("generateUploadUrl", () => {
    it("should delegate to mediaService.generateUploadUrl", async () => {
      const dto = {
        filename: "test.png",
        mimeType: "image/png" as const,
        fileSize: 1024,
        purpose: MediaPurpose.EVENT_BANNER,
      };

      const result = await controller.generateUploadUrl(dto);
      expect(result).toBeDefined();
      expect(service.generateUploadUrl).toHaveBeenCalledWith(dto);
      expect(result.fileKey).toBe("event_banner/mock.png");
    });
  });

  describe("handleLocalUpload", () => {
    it("should throw BadRequestException if token is missing", async () => {
      const mockReq = {} as any;
      await expect(
        controller.handleLocalUpload(
          "event_banner",
          "file.png",
          "",
          "12345",
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should save file buffer and return fileKey and size", async () => {
      const stream = (async function* () {
        yield Buffer.from("chunk1");
        yield Buffer.from("chunk2");
      })();
      const mockReq = Object.assign(stream, {
        headers: { "content-type": "image/png" },
      }) as any;

      const result = await controller.handleLocalUpload(
        "event_banner",
        "mock.png",
        "valid-token",
        "1234567890",
        mockReq,
      );

      expect(result.fileKey).toBe("event_banner/mock.png");
      expect(service.saveLocalFile).toHaveBeenCalled();
    });
  });

  describe("serveMedia", () => {
    it("should throw NotFoundException if file does not exist", async () => {
      jest.spyOn(service, "getLocalFile").mockReturnValue(null);
      const mockReq = { headers: {} } as any;
      const mockRes = {} as any;

      await expect(
        controller.serveMedia(
          "event_banner",
          "non-existent.png",
          mockReq,
          mockRes,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return HTTP 304 if If-None-Match matches ETag", async () => {
      const fileBuffer = Buffer.from("sample-image-content");
      jest.spyOn(service, "getLocalFile").mockReturnValue({
        buffer: fileBuffer,
        mimeType: "image/png",
      });

      // MD5 of sample-image-content
      const expectedEtag = `"${crypto.createHash("md5").update(fileBuffer).digest("hex")}"`;

      const mockReq = { headers: { "if-none-match": expectedEtag } } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as any;

      await controller.serveMedia("event_banner", "test.png", mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_MODIFIED);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should set CDN cache headers and return file buffer", async () => {
      const fileBuffer = Buffer.from("sample-image-content");
      jest.spyOn(service, "getLocalFile").mockReturnValue({
        buffer: fileBuffer,
        mimeType: "image/png",
      });

      const setHeaders: Record<string, string> = {};
      const mockReq = { headers: {} } as any;
      const mockRes = {
        setHeader: jest.fn((k, v) => {
          setHeaders[k] = v;
        }),
        send: jest.fn(),
      } as any;

      await controller.serveMedia("event_banner", "test.png", mockReq, mockRes);
      expect(setHeaders["Cache-Control"]).toBe(
        "public, max-age=86400, stale-while-revalidate=3600",
      );
      expect(setHeaders["Content-Type"]).toBe("image/png");
      expect(setHeaders["ETag"]).toBeDefined();
      expect(setHeaders["X-Cache-Status"]).toBe("HIT-LOCAL-ORIGIN");
      expect(mockRes.send).toHaveBeenCalledWith(fileBuffer);
    });
  });
});
