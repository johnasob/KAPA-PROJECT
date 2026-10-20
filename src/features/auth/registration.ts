import { z } from "zod";

export const registrationSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Escribe tu nombre.")
    .max(80, "Usa máximo 80 caracteres."),
  email: z.string().trim().pipe(z.email("Ingresa un correo válido.")),
  password: z
    .string()
    .min(12, "Usa al menos 12 caracteres.")
    .max(128, "Usa máximo 128 caracteres."),
});
export type Registration = z.infer<typeof registrationSchema>;
