import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { database } from "../../lib/supabase";
import { errorMessage } from "../../lib/format";
import { Notice, PageTitle } from "../../components/ui";

const schema = z
  .object({
    password: z.string().min(12, "Utiliza al menos 12 caracteres.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });
export function PasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function save(values: z.infer<typeof schema>) {
    setError(null);
    try {
      const { error: authError } = await database().auth.updateUser({
        password: values.password,
      });
      if (authError) throw authError;
      setDone(true);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="SEGURIDAD"
        title="Tu contraseña"
        description="Elige una contraseña única y segura para tu cuenta."
      />
      <section className="panel narrow">
        {done ? (
          <>
            <Notice type="success">
              Contraseña actualizada correctamente.
            </Notice>
            <button className="button primary" onClick={() => navigate("/")}>
              Continuar
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit(save)}>
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="field-error">{errors.password.message}</p>
            )}
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="field-error">{errors.confirm.message}</p>
            )}
            {error && <Notice>{error}</Notice>}
            <button className="button primary" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
