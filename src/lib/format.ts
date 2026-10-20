export const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(value));
export function errorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 0;
  if (code === "invalid_credentials")
    return "El correo o la contraseña no son correctos.";
  if (code === "email_not_confirmed")
    return "Confirma tu correo antes de ingresar.";
  if (code === "email_provider_disabled")
    return "El acceso por correo está deshabilitado. Pide al administrador que lo habilite.";
  if (code === "signup_disabled")
    return "El registro de usuarios está deshabilitado. Pide al administrador que lo active.";
  if (code === "user_already_exists" || code === "email_exists")
    return "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.";
  if (code === "PT422")
    return "El usuario debe confirmar su correo antes de habilitar su acceso.";
  if (code === "PT409")
    return "Los datos cambiaron. Actualiza la página antes de volver a intentar.";
  if (code === "42501" || status === 403)
    return "Tu usuario no tiene permiso para realizar esta operación.";
  if (code === "23514" || code === "22023" || code === "23502")
    return "Revisa los valores ingresados. La base de datos rechazó la operación.";
  if (code === "over_request_rate_limit" || status === 429)
    return "Demasiados intentos. Espera un momento antes de volver a intentar.";
  if (code === "weak_password")
    return "La contraseña no cumple los requisitos de seguridad del proyecto.";
  return "No se pudo completar la solicitud. Revisa tu conexión y la configuración de Supabase e intenta de nuevo.";
}
