import { z } from "zod";

import { CCAA_CODES } from "@/lib/ccaa";

export const loginSchema = z.object({
  email: z.string().email("Introduce un correo válido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});

export const registerSchema = z.object({
  email: z.string().email("Introduce un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const onboardingSchema = z.object({
  nombre: z.string().trim().min(2, "Dinos tu nombre").max(80, "Nombre demasiado largo"),
  ccaa: z.enum(CCAA_CODES, { message: "Elige tu comunidad autónoma" }),
  degreeId: z.string().uuid("Elige una titulación").nullable(),
});
