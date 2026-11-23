import { GlobalHttpExceptionFilter } from "./http-exception.filter";
import { ArgumentsHost, HttpStatus, BadRequestException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { ErrorCode } from "@urticketbuddy/contracts";

describe("GlobalHttpExceptionFilter", () => {
  let filter: GlobalHttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalHttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      headers: {
        "x-request-id": "req-12345",
      },
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it("should map ThrottlerException to HTTP 429 with ErrorCode.TOO_MANY_REQUESTS and Retry-After header", () => {
    const exception = new ThrottlerException("Rate limit exceeded");

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.TOO_MANY_REQUESTS,
        message: "Rate limit exceeded",
        requestId: "req-12345",
      },
    });
  });

  it("should format standard NestJS HttpException correctly", () => {
    const exception = new BadRequestException({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Validation failed",
      details: [{ field: "email", error: "invalid" }],
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Validation failed",
        details: [{ field: "email", error: "invalid" }],
        requestId: "req-12345",
      },
    });
  });
});
