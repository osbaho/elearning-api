import { test, expect } from '@playwright/test';
import {
  API, adminSession, newApiContext, ensureCohort, enrollStudent, tokenFromUrl, uniqueSuffix, isoDay,
} from '../helpers/adminHelper.js';

// Fase 1 (API): matrícula sin contraseñas, activación por enlace de un solo uso, estado de la
// cuenta, fechas de acceso de la promoción, restablecimiento de contraseña, importación CSV y
// bitácora del administrador.
test.describe('Matrícula, activación de cuentas y acceso por promoción', () => {
  let admin;
  test.beforeAll(async () => { admin = await adminSession(); });
  test.afterAll(async () => { await admin.dispose(); });

  test('La matrícula no lleva contraseña: el estudiante activa su cuenta con un enlace de un solo uso', async () => {
    const id = uniqueSuffix();
    const email = `activacion.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dra. Paula Activa', email, cohort: 'Promoción 1' });
    expect(enrolled.student).toMatchObject({ email, activated: false });
    expect(enrolled.activationUrl).toMatch(/\/activar\?token=/);
    expect(enrolled).not.toHaveProperty('tempPassword');

    const student = await newApiContext();
    // Sin activar no entra con ninguna contraseña (mismo mensaje que credenciales inválidas)
    const early = await student.post(`${API}/login`, { data: { email, password: 'Cualquiera123' } });
    expect(early.status()).toBe(401);
    expect((await early.json()).code).toBe('INVALID_CREDENTIALS');

    const token = tokenFromUrl(enrolled.activationUrl);
    const info = await student.get(`${API}/auth/token-info?purpose=activation&token=${encodeURIComponent(token)}`);
    expect(info.status()).toBe(200);
    const infoBody = await info.json();
    expect(infoBody.firstName).toBe('Paula'); // sin el título «Dra.»
    expect(infoBody.email).toMatch(/^ac.+@hospital\.org$/);
    expect(infoBody.email).not.toBe(email);

    // Un token de activación no sirve para restablecer, ni uno inventado para nada
    expect((await student.get(`${API}/auth/token-info?purpose=password_reset&token=${encodeURIComponent(token)}`)).status()).toBe(400);
    expect((await student.get(`${API}/auth/token-info?purpose=activation&token=${'x'.repeat(43)}`)).status()).toBe(400);

    expect((await student.post(`${API}/auth/activate`, { data: { token, password: 'corta' } })).status()).toBe(400);
    expect((await student.post(`${API}/auth/activate`, { data: { token, password: 'sololetras' } })).status()).toBe(400);
    const activate = await student.post(`${API}/auth/activate`, { data: { token, password: 'ClaveSegura2026' } });
    expect(activate.status()).toBe(200);
    const activated = await activate.json();
    expect(activated.loggedIn).toBe(true);
    expect(activated.student).toMatchObject({ email, isOnboarded: false });
    expect(activated.student.access.state).toBe('open');

    // La sesión queda abierta y el enlace ya no sirve
    expect((await student.get(`${API}/student/me`)).status()).toBe(200);
    const reuse = await student.post(`${API}/auth/activate`, { data: { token, password: 'OtraClave2026' } });
    expect(reuse.status()).toBe(410);
    expect((await reuse.json()).code).toBe('TOKEN_USED');

    // Correo de bienvenida registrado con su plantilla
    await expect.poll(async () => {
      const { logs } = await (await admin.get(`/admin/email-logs?studentId=${enrolled.student.id}`)).json();
      return logs.map((l) => `${l.template}:${l.status}`);
    }).toContainEqual(expect.stringMatching(/^induction_activation:(simulated|sent)$/));

    await student.dispose();
  });

  test('Desactivar corta la sesión abierta y el acceso; reactivar lo devuelve, todo con motivo en la bitácora', async () => {
    await admin.post('/test-reset', { email: 'student@test.com', password: 'student123' });
    const student = await newApiContext();
    const login = await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } });
    const studentId = (await login.json()).student.id;

    expect((await admin.post(`/admin/students/${studentId}/deactivate`, {})).status()).toBe(400);
    const deactivate = await admin.post(`/admin/students/${studentId}/deactivate`, { reason: 'Retiro voluntario del programa' });
    expect(deactivate.status()).toBe(200);
    expect((await admin.post(`/admin/students/${studentId}/deactivate`, { reason: 'Otra vez' })).status()).toBe(409);

    // La sesión que ya estaba abierta deja de funcionar de inmediato
    const me = await student.get(`${API}/student/me`);
    expect(me.status()).toBe(403);
    expect((await me.json()).code).toBe('ACCOUNT_DISABLED');
    const relogin = await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } });
    expect(relogin.status()).toBe(403);
    expect((await relogin.json()).code).toBe('ACCOUNT_DISABLED');

    // No se envían enlaces ni recordatorios a una cuenta desactivada
    expect((await admin.post(`/admin/students/${studentId}/access-link`, {})).status()).toBe(409);
    expect((await admin.post(`/admin/send-reminder/${studentId}`, {})).status()).toBe(409);

    expect((await admin.post(`/admin/students/${studentId}/reactivate`, { reason: 'Reintegro aprobado' })).status()).toBe(200);
    expect((await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } })).status()).toBe(200);

    const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${studentId}`)).json();
    const deactivation = actions.find((a) => a.action === 'student.deactivate');
    expect(deactivation.reason).toBe('Retiro voluntario del programa');
    expect(deactivation.adminName).toBeTruthy();
    expect(actions.find((a) => a.action === 'student.reactivate').details.previousReason).toBe('Retiro voluntario del programa');
    await student.dispose();
  });

  test('Las fechas de la promoción controlan el acceso: antes no entra, después queda en modo consulta', async () => {
    const id = uniqueSuffix();
    const future = await ensureCohort(admin, { name: `Futura ${id}`, startsOn: isoDay(30), endsOn: isoDay(120) });
    const closed = await ensureCohort(admin, { name: `Cerrada ${id}`, startsOn: isoDay(-120), endsOn: isoDay(-2) });
    expect(future.accessState).toBe('not_started');
    expect(closed.accessState).toBe('closed');

    const reset = await admin.post('/test-reset', { email: 'student@test.com', password: 'student123' });
    const studentId = (await reset.json()).studentId;
    const student = await newApiContext();

    // Promoción que aún no empieza: no puede iniciar sesión y se le dice desde cuándo
    expect((await admin.patch(`/admin/students/${studentId}`, { cohort: future.name, reason: 'Cambio de grupo' })).status()).toBe(200);
    const early = await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } });
    expect(early.status()).toBe(403);
    const earlyBody = await early.json();
    expect(earlyBody.code).toBe('ACCESS_NOT_STARTED');
    expect(earlyBody.error).toContain(future.name);

    // La fecha individual reemplaza el inicio de la promoción
    expect((await admin.patch(`/admin/students/${studentId}`, { startDate: isoDay(-1) })).status()).toBe(200);
    expect((await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } })).status()).toBe(200);

    // Promoción cerrada: entra en modo consulta, pero no registra avance, partidas ni examen
    expect((await admin.patch(`/admin/students/${studentId}`, { cohort: closed.name, startDate: null })).status()).toBe(200);
    const login = await student.post(`${API}/login`, { data: { email: 'student@test.com', password: 'student123' } });
    expect(login.status()).toBe(200);
    expect((await login.json()).student.access).toMatchObject({ state: 'closed', cohort: closed.name });
    for (const [path, data] of [['/progress/m1_v1', {}], ['/progress/m1_v1/start', {}], ['/simulator/attempts', { stepId: 'm1_s1' }], ['/start-exam', {}]]) {
      const res = await student.post(`${API}${path}`, { data });
      expect(res.status(), path).toBe(403);
      expect((await res.json()).code, path).toBe('COHORT_CLOSED');
    }

    // Mover de promoción queda en la bitácora con el antes y el después
    const { actions } = await (await admin.get(`/admin/actions?targetType=student&targetId=${studentId}`)).json();
    const move = actions.find((a) => a.action === 'student.move_cohort' && a.details.after.cohort === future.name);
    expect(move.reason).toBe('Cambio de grupo');
    expect(move.details.before.cohort).toBe('Promoción 1');
    await student.dispose();
    // Devuelve a student@test.com a su promoción para las demás pruebas
    await admin.post('/test-reset', { email: 'student@test.com', password: 'student123' });
  });

  test('Restablecer contraseña: misma respuesta exista o no el correo, y el cambio cierra las demás sesiones', async () => {
    // Estudiante propio (no se toca la contraseña de student@test.com, que usan las demás pruebas)
    const id = uniqueSuffix();
    const email = `restablecer.${id}@hospital.org`;
    const enrolled = await enrollStudent(admin, { name: 'Dr. Olvidadizo', email, cohort: 'Promoción 1' });
    const studentId = enrolled.student.id;
    const visitor = await newApiContext();

    // Sin activar, «olvidé mi contraseña» le envía un enlace de activación nuevo
    expect((await visitor.post(`${API}/auth/forgot-password`, { data: { email } })).status()).toBe(200);
    const link1 = await (await admin.post(`/admin/students/${studentId}/access-link`, { sendEmail: false })).json();
    expect(link1.purpose).toBe('activation');
    const oldSession = await newApiContext();
    expect((await oldSession.post(`${API}/auth/activate`, { data: { token: tokenFromUrl(link1.url), password: 'PrimeraClave1' } })).status()).toBe(200);

    // Activado: la respuesta es la misma exista o no el correo, y se encola un restablecimiento
    const unknown = await visitor.post(`${API}/auth/forgot-password`, { data: { email: `nadie.${id}@ningun.org` } });
    const known = await visitor.post(`${API}/auth/forgot-password`, { data: { email } });
    expect(unknown.status()).toBe(200);
    expect(known.status()).toBe(200);
    expect((await unknown.json()).message).toBe((await known.json()).message);
    await expect.poll(async () => {
      const { logs } = await (await admin.get(`/admin/email-logs?studentId=${studentId}`)).json();
      return logs.some((l) => l.template === 'password_reset');
    }).toBe(true);

    // El admin genera el enlace (ya tenía contraseña → restablecer) sin enviar correo
    const link2 = await (await admin.post(`/admin/students/${studentId}/access-link`, { sendEmail: false })).json();
    expect(link2.purpose).toBe('password_reset');
    expect(link2.emailStatus).toBeNull();
    const res = await visitor.post(`${API}/auth/reset-password`, { data: { token: tokenFromUrl(link2.url), password: 'NuevaClave2027' } });
    expect(res.status()).toBe(200);
    expect((await res.json()).loggedIn).toBe(false);

    // La sesión abierta antes del cambio queda cerrada; solo vale la contraseña nueva
    const old = await oldSession.get(`${API}/student/me`);
    expect(old.status()).toBe(401);
    expect((await old.json()).code).toBe('SESSION_REVOKED');
    expect((await visitor.post(`${API}/login`, { data: { email, password: 'PrimeraClave1' } })).status()).toBe(401);
    expect((await visitor.post(`${API}/login`, { data: { email, password: 'NuevaClave2027' } })).status()).toBe(200);
    await visitor.dispose();
    await oldSession.dispose();
  });

  test('Importación CSV: vista previa con errores por fila y matrícula solo de las filas válidas', async () => {
    const id = uniqueSuffix();
    const cohort = await ensureCohort(admin, { name: `Importada ${id}` });
    const existing = `ya.existe.${id}@hospital.org`;
    await enrollStudent(admin, { name: 'Ya Existe', email: existing, cohort: cohort.name });
    const csv = [
      'Nombre;Correo electrónico;Tipo documento;Número documento;Institución;Promoción',
      `Dra. Ana Uno;ana.${id}@hospital.org;CC;101;Hospital A;`,
      `Dr. Repetido;ana.${id}@hospital.org;CC;102;Hospital A;`,
      `Sin Correo;no-es-un-correo;CC;103;Hospital A;`,
      `Dr. Existente;${existing};CC;104;Hospital A;`,
      `Dra. Otra Promo;otra.${id}@hospital.org;CC;105;Hospital A;No existe ${id}`,
      `"Gómez, Luis";luis.${id}@hospital.org;Pasaporte;P-106;"Clínica ""El Bosque""";${cohort.name}`,
    ].join('\r\n');

    const dry = await admin.post('/admin/students/import', { csv, defaultCohort: cohort.name });
    expect(dry.status()).toBe(200);
    const preview = await dry.json();
    expect(preview.summary).toEqual({ total: 6, valid: 2, invalid: 4 });
    const byLine = Object.fromEntries(preview.rows.map((r) => [r.line, r]));
    expect(byLine[2].status).toBe('ok');
    expect(byLine[3].errors.join(' ')).toContain('repetido');
    expect(byLine[4].errors.join(' ')).toContain('correo electrónico válido');
    expect(byLine[5].errors.join(' ')).toContain('Ya existe');
    expect(byLine[6].errors.join(' ')).toContain('no existe');
    expect(byLine[7]).toMatchObject({ status: 'ok', name: 'Gómez, Luis', institution: 'Clínica "El Bosque"', idType: 'Pasaporte' });

    // La vista previa no crea nada
    const { students: before } = await (await admin.get(`/admin/students?cohort=${encodeURIComponent(cohort.name)}`)).json();
    expect(before).toHaveLength(1);

    const commit = await admin.post('/admin/students/import', { csv, defaultCohort: cohort.name, dryRun: false });
    expect(commit.status()).toBe(201);
    const result = await commit.json();
    expect(result.summary).toEqual({ total: 6, created: 2, skipped: 4 });
    const { students: after } = await (await admin.get(`/admin/students?cohort=${encodeURIComponent(cohort.name)}&status=pending`)).json();
    expect(after.map((s) => s.email).sort()).toEqual([existing, `ana.${id}@hospital.org`, `luis.${id}@hospital.org`].sort());

    const { actions } = await (await admin.get('/admin/actions?limit=20')).json();
    const importAction = actions.find((a) => a.action === 'student.import' && a.targetId === cohort.name);
    expect(importAction.details.created).toHaveLength(2);
    expect(importAction.details.skipped).toHaveLength(4);

    // Plantilla descargable
    const template = await admin.get('/admin/students/import/template');
    expect(template.headers()['content-type']).toContain('text/csv');
    expect(await template.text()).toContain('nombre;correo;tipo_documento');
  });

  test('Promociones: fechas validadas, nombre único y las selladas no se modifican', async () => {
    const id = uniqueSuffix();
    expect((await admin.post('/admin/cohorts', { name: `Mal ${id}`, startsOn: '2026-12-31', endsOn: '2026-01-01' })).status()).toBe(400);
    expect((await admin.post('/admin/cohorts', { name: `Mal ${id}`, startsOn: '2026-02-30' })).status()).toBe(400);
    const cohort = await ensureCohort(admin, { name: `Editable ${id}`, startsOn: '2026-01-15' });
    expect((await admin.post('/admin/cohorts', { name: `editable ${id}` })).status()).toBe(409);

    // Renombrar mueve a sus estudiantes con ella
    const enrolled = await enrollStudent(admin, { name: 'Dr. Renombrado', email: `renombre.${id}@hospital.org`, cohort: cohort.name });
    const renamed = await admin.patch(`/admin/cohorts/${cohort.id}`, { name: `Renombrada ${id}`, endsOn: '2027-06-30' });
    expect(renamed.status()).toBe(200);
    expect((await renamed.json()).cohort).toMatchObject({ name: `Renombrada ${id}`, startsOn: '2026-01-15', endsOn: '2027-06-30' });
    const detail = await (await admin.get(`/admin/students/${enrolled.student.id}`)).json();
    expect(detail.student.cohort).toBe(`Renombrada ${id}`);

    // Sellada: ni se edita ni admite matrículas
    expect((await admin.post(`/admin/cohorts/${encodeURIComponent(`Renombrada ${id}`)}/close`, {})).status()).toBe(200);
    expect((await admin.patch(`/admin/cohorts/${cohort.id}`, { endsOn: '2027-12-31' })).status()).toBe(409);
    expect((await admin.post('/admin/students', { name: 'Tarde', email: `tarde.${id}@hospital.org`, cohort: `Renombrada ${id}` })).status()).toBe(409);
  });
});
