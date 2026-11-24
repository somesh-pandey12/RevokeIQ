import { z } from "zod";

const password = z.string().min(8, "Password should be at least 8 characters long").max(100);

export const registerCompanySchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password,
  companyName: z.string().min(2).max(80),
});

export const registerCustomerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.email(),
  password,
  companySlug: z.string().min(2).max(60),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  companySlug: z.string().optional(),
});