import { z } from "zod";

export const userRoleSchema = z.enum(["citizen", "lawyer", "manager", "finance", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userProfileSchema = z.object({
  id: z.uuid(),
  role: userRoleSchema,
  fullName: z.string().min(1),
  email: z.email().optional(),
  phone: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
