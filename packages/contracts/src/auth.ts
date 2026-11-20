import { z } from "zod";
import { UserRole } from "./enums";

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(UserRole).optional().default(UserRole.CUSTOMER),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  organizerTenantId: z.string().uuid().optional().nullable(),
  createdAt: z.union([z.date(), z.string()]),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthResponseSchema = z.object({
  user: AuthUserSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const CreateGateStaffRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizerTenantId: z.string().uuid().optional(),
});

export type CreateGateStaffRequest = z.infer<
  typeof CreateGateStaffRequestSchema
>;

export const UpdateProfileRequestSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
