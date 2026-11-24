import {
  redactSensitiveData,
  isSensitiveField,
  sanitizeUrl,
  LogRedactionInterceptor,
} from "./log-redaction.interceptor";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, throwError } from "rxjs";

describe("LogRedactionInterceptor & redactSensitiveData", () => {
  it("should sanitize sensitive query parameters from URLs", () => {
    expect(
      sanitizeUrl("/api/v1/auth/callback?token=my-secret-jwt&state=123"),
    ).toBe("/api/v1/auth/callback?token=%5BREDACTED%5D&state=123");
    expect(sanitizeUrl("/api/v1/events?page=1&pageSize=20")).toBe(
      "/api/v1/events?page=1&pageSize=20",
    );
  });
  it("should detect sensitive field names case-insensitively with hyphens/underscores", () => {
    expect(isSensitiveField("password")).toBe(true);
    expect(isSensitiveField("Password")).toBe(true);
    expect(isSensitiveField("password_hash")).toBe(true);
    expect(isSensitiveField("passwordHash")).toBe(true);
    expect(isSensitiveField("access-token")).toBe(true);
    expect(isSensitiveField("accessToken")).toBe(true);
    expect(isSensitiveField("refreshToken")).toBe(true);
    expect(isSensitiveField("authorization")).toBe(true);
    expect(isSensitiveField("Authorization")).toBe(true);
    expect(isSensitiveField("cookie")).toBe(true);
    expect(isSensitiveField("Cookie")).toBe(true);
    expect(isSensitiveField("token")).toBe(true);
    expect(isSensitiveField("qrToken")).toBe(true);
    expect(isSensitiveField("qr_payload")).toBe(true);
    expect(isSensitiveField("secret")).toBe(true);
    expect(isSensitiveField("masterTicketSecret")).toBe(true);
    expect(isSensitiveField("email")).toBe(false);
    expect(isSensitiveField("id")).toBe(false);
  });

  it("should redact sensitive fields in flat and deeply nested objects", () => {
    const sensitivePayload = {
      email: "user@example.com",
      password: "secretPassword123!",
      passwordHash: "$2a$10$hashedpass",
      tokens: {
        accessToken: "jwt.access.token",
        refreshToken: "jwt.refresh.token",
        token: "generic-token",
      },
      headers: {
        authorization: "Bearer secret-token",
        cookie: "session_id=12345",
      },
      qr: {
        qrToken: "hmac-qr-token-abc",
        qrPayload: "encrypted-payload-data",
        seed: "seed-value",
        hmac: "hmac-sha256-signature",
      },
      publicData: {
        eventId: "event-123",
        amountMinor: 5000,
      },
    };

    const redacted = redactSensitiveData(sensitivePayload);

    expect(redacted.email).toBe("user@example.com");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.passwordHash).toBe("[REDACTED]");
    expect(redacted.tokens.accessToken).toBe("[REDACTED]");
    expect(redacted.tokens.refreshToken).toBe("[REDACTED]");
    expect(redacted.tokens.token).toBe("[REDACTED]");
    expect(redacted.headers.authorization).toBe("[REDACTED]");
    expect(redacted.headers.cookie).toBe("[REDACTED]");
    expect(redacted.qr.qrToken).toBe("[REDACTED]");
    expect(redacted.qr.qrPayload).toBe("[REDACTED]");
    expect(redacted.qr.seed).toBe("[REDACTED]");
    expect(redacted.qr.hmac).toBe("[REDACTED]");
    expect(redacted.publicData.eventId).toBe("event-123");
    expect(redacted.publicData.amountMinor).toBe(5000);
  });

  it("should handle arrays, primitives, and null/undefined values cleanly", () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
    expect(redactSensitiveData("plain string")).toBe("plain string");
    expect(redactSensitiveData(42)).toBe(42);

    const arrayInput = [
      { id: 1, password: "pw1" },
      { id: 2, token: "tok2" },
    ];
    const redactedArray = redactSensitiveData(arrayInput);
    expect(redactedArray[0].password).toBe("[REDACTED]");
    expect(redactedArray[1].token).toBe("[REDACTED]");
  });

  it("should intercept execution and log requests successfully", (done) => {
    const interceptor = new LogRedactionInterceptor();
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          url: "/api/v1/auth/login",
          headers: { authorization: "Bearer xyz" },
          body: { password: "plainPassword" },
        }),
        getResponse: () => ({
          statusCode: 200,
        }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ accessToken: "sensitive-token", user: { id: "1" } }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toBeDefined();
      },
      complete: () => {
        done();
      },
    });
  });

  it("should intercept execution and log errors when call handler throws", (done) => {
    const interceptor = new LogRedactionInterceptor();
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "GET",
          url: "/api/v1/fail",
        }),
        getResponse: () => ({
          statusCode: 500,
        }),
      }),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => throwError(() => new Error("Boom")),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      error: (err) => {
        expect(err.message).toBe("Boom");
        done();
      },
    });
  });
});
