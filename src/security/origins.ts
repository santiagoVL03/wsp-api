/** Sin `CORS_ORIGINS` solo se permite el panel de desarrollo. */
const DEFAULT_ORIGINS = ['http://localhost:3000'];

/**
 * Lee `CORS_ORIGINS` (lista separada por comas) y devuelve los orígenes que
 * pueden llamar a la API desde un navegador. En producción hay que poner el
 * dominio real del panel: `https://admin.alaynart.com`.
 */
export function allowedOrigins(raw?: string): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : DEFAULT_ORIGINS;
}
