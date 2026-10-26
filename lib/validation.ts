import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
  organization: z.string().trim().min(2, "Enter your organisation's name").max(120),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters"),
});

// --- API bodies -----------------------------------------------------------

export const installSchema = z.object({
  module: z.string().min(1),
  tenantId: z.string().trim().min(1).max(200),
  tenantName: z.string().trim().min(1).max(200),
});

export const embedTokenSchema = z.object({
  installationId: z.string().min(1),
  user: z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    /** "member" shows only the person's own view, e.g. a carer's Peak points. */
    role: z.enum(["manager", "member"]).default("manager"),
    personId: z.string().min(1).max(200).optional(),
  }),
});

export const inboundEventSchema = z.object({
  type: z.string().min(1).max(100),
  data: z.record(z.unknown()).default({}),
});
