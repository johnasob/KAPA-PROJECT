import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { database } from "../../lib/supabase";
import { errorMessage } from "../../lib/format";
import { Notice } from "../../components/ui";
import { registrationSchema, type Registration } from "./registration";

export function RegistrationForm({ onLogin }: { onLogin: () => void }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Registration>({ resolver: zodResolver(registrationSchema) });

  async function submit(values: Registration) {
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setMessage(null);
    try {
      const { data, error: signupError } = await database().auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { display_name: values.display_name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signupError) throw signupError;
      if (!data.session)
        setMessage(
          "Revisa tu correo y confirma el registro para iniciar sesión. Si ya tenías cuenta, ingresa o recupera tu contraseña.",
        );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      submitting.current = false;
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate>
      <label htmlFor="registration-name">Nombre</label>
      <input
        id="registration-name"
        autoComplete="name"
        placeholder="Tu nombre"
        {...register("display_name")}
        aria-invalid={!!errors.display_name}
        aria-describedby={
          errors.display_name ? "registration-name-error" : undefined
        }
      />
      {errors.display_name && (
        <span id="registration-name-error" className="field-error">
          {errors.display_name.message}
        </span>
      )}
      <label htmlFor="registration-email">Correo electrónico</label>
      <input
        id="registration-email"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        {...register("email")}
        aria-invalid={!!errors.email}
        aria-describedby={errors.email ? "registration-email-error" : undefined}
      />
      {errors.email && (
        <span id="registration-email-error" className="field-error">
          {errors.email.message}
        </span>
      )}
      <label htmlFor="registration-password">Contraseña</label>
      <div className="password-input">
        <input
          id="registration-password"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Al menos 12 caracteres"
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password
              ? "registration-password-error"
              : "registration-password-hint"
          }
        />
        <button
          type="button"
          className="icon-button"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {errors.password ? (
        <span id="registration-password-error" className="field-error">
          {errors.password.message}
        </span>
      ) : (
        <small id="registration-password-hint" className="field-help">
          Usa una contraseña única de al menos 12 caracteres.
        </small>
      )}
      {error && <Notice>{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      <button
        className="button primary full"
        disabled={isSubmitting || !!message}
      >
        {isSubmitting ? "Creando tu cuenta…" : "Crear cuenta"}
        <ArrowRight size={18} />
      </button>
      <p className="auth-switch">
        ¿Ya tienes cuenta?{" "}
        <button
          className="text-button"
          type="button"
          onClick={onLogin}
          disabled={isSubmitting}
        >
          Iniciar sesión
        </button>
      </p>
    </form>
  );
}
