import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { database } from "../../lib/supabase";
import { errorMessage } from "../../lib/format";
import { Brand, Notice } from "../../components/ui";

const loginSchema = z.object({
  email: z.email("Ingresa un correo válido.").trim(),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
type Login = z.infer<typeof loginSchema>;

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const {
    register,
    handleSubmit,
    getValues,
    setError: fieldError,
    formState: { errors },
  } = useForm<Login>({ resolver: zodResolver(loginSchema) });

  async function login(values: Login) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } =
        await database().auth.signInWithPassword(values);
      if (authError) throw authError;
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reset() {
    const email = getValues("email").trim();
    if (!z.email().safeParse(email).success) {
      fieldError("email", { message: "Ingresa un correo válido." });
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resetError } = await database().auth.resetPasswordForEmail(
        email,
        { redirectTo: `${window.location.origin}/actualizar-clave` },
      );
      if (resetError) throw resetError;
      setMessage(
        "Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña. Ábrelo en este navegador.",
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-main">
          <span className="pill dark">
            <span className="status-dot" /> TU TALLER, CONECTADO
          </span>
          <h1>
            Grandes ideas.
            <br />
            Capas de <em>orden.</em>
          </h1>
          <p>
            Un espacio para construir, organizar y hacer crecer lo que creamos
            juntos.
          </p>
          <div className="layer-art" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
            <Layers3 size={64} strokeWidth={1} />
          </div>
        </div>
        <footer>
          <span>JOHN + SEBAS</span>
          <span>Hecho para KAPA 3D ↗</span>
        </footer>
      </section>
      <section className="auth-form-section">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <div className="icon-tile">
            <LockKeyhole size={22} />
          </div>
          <span className="eyebrow">ESPACIO DE TRABAJO</span>
          <h2>
            {mode === "login"
              ? "Qué bueno verte de nuevo."
              : "Recupera tu acceso."}
          </h2>
          <p>
            {mode === "login"
              ? "Ingresa con tu cuenta para continuar en KAPA 3D."
              : "Te enviaremos un enlace seguro a tu correo."}
          </p>
          <form
            onSubmit={
              mode === "login"
                ? handleSubmit(login)
                : (e) => {
                    e.preventDefault();
                    void reset();
                  }
            }
            noValidate
          >
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              {...register("email")}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <span id="email-error" className="field-error">
                {errors.email.message}
              </span>
            )}
            {mode === "login" && (
              <>
                <label htmlFor="password">Contraseña</label>
                <div className="password-input">
                  <input
                    id="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                    aria-invalid={!!errors.password}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      visible ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <span id="password-error" className="field-error">
                    {errors.password.message}
                  </span>
                )}
                <button
                  className="text-button forgot"
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                    setMessage(null);
                  }}
                >
                  Olvidé mi contraseña
                </button>
              </>
            )}
            {error && <Notice>{error}</Notice>}
            {message && <Notice type="success">{message}</Notice>}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "login"
                  ? "Ingresar al espacio"
                  : "Enviar enlace"}
              <ArrowRight size={18} />
            </button>
            {mode === "reset" && (
              <button
                type="button"
                className="text-button full"
                onClick={() => {
                  setMode("login");
                  setMessage(null);
                  setError(null);
                }}
              >
                Volver al inicio de sesión
              </button>
            )}
          </form>
          <div className="secure-note">
            <ShieldCheck size={17} />
            <span>Acceso exclusivo para los socios de KAPA 3D.</span>
          </div>
        </div>
        <div className="auth-bottom">
          KAPA 3D <span>·</span> Colombia <span>·</span> America/Bogota
        </div>
      </section>
    </div>
  );
}
