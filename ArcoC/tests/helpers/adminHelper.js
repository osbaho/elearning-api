import { request as playwrightRequest } from '@playwright/test';

export const API = 'http://localhost:5000/api';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';
const TEST_SECRET = process.env.TEST_RESET_SECRET || 'test-reset-secret-local';

/**
 * Contexto de API propio (sus propias cookies). La API prioriza la cookie de sesión sobre el
 * header Authorization: si el admin y un estudiante compartieran contexto, la cookie del último
 * en iniciar sesión mandaría. Cada actor usa el suyo.
 */
export async function newApiContext() {
  return playwrightRequest.newContext({ extraHTTPHeaders: { 'x-test-secret': TEST_SECRET } });
}

/** Inicia sesión como administrador en un contexto nuevo y devuelve atajos get/post/patch. */
export async function adminSession() {
  const ctx = await newApiContext();
  await ctx.post(`${API}/test-reset`, { data: { email: 'admin@admin.com', password: ADMIN_PASSWORD } });
  const login = await ctx.post(`${API}/login`, { data: { email: 'admin@admin.com', password: ADMIN_PASSWORD } });
  if (!login.ok()) throw new Error(`Login de admin falló: ${login.status()}`);
  return {
    ctx,
    get: (path) => ctx.get(`${API}${path}`),
    post: (path, data = {}) => ctx.post(`${API}${path}`, { data }),
    patch: (path, data = {}) => ctx.patch(`${API}${path}`, { data }),
    dispose: () => ctx.dispose(),
  };
}

export function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Crea una promoción (o devuelve la existente si ya estaba). */
export async function ensureCohort(admin, { name, startsOn = null, endsOn = null }) {
  const res = await admin.post('/admin/cohorts', { name, startsOn, endsOn });
  if (res.status() === 201) return (await res.json()).cohort;
  const { cohorts } = await (await admin.get('/admin/cohorts')).json();
  return cohorts.find((c) => c.name === name);
}

/** Matricula a un estudiante y devuelve la respuesta del API (incluye activationUrl). */
export async function enrollStudent(admin, data) {
  const res = await admin.post('/admin/students', data);
  if (res.status() !== 201) throw new Error(`Matrícula falló: ${res.status()} ${await res.text()}`);
  return res.json();
}

export function tokenFromUrl(url) {
  return new URL(url).searchParams.get('token');
}

/** Fecha AAAA-MM-DD desplazada `days` días respecto de hoy (UTC; margen suficiente para las pruebas). */
export function isoDay(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
