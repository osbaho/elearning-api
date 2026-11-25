/**
 * Migraciones versionadas del esquema (SQLite y PostgreSQL).
 *
 * Cada migración se aplica una sola vez, dentro de una transacción, y queda registrada en
 * `schema_migrations`. Para cambiar el esquema, agrega una migración AL FINAL con el siguiente
 * número de versión; nunca edites ni reordenes una ya publicada (las bases existentes no la
 * volverían a ejecutar).
 *
 * `up(db)` recibe:
 *   db.run / db.get / db.all          consultas dentro de la transacción de la migración
 *   db.isPg                           true en PostgreSQL
 *   db.types.id / db.types.datetime   tipos de columna equivalentes en ambos motores
 *   db.columnExists(tabla, columna)
 *   db.addColumnIfMissing(tabla, columna, definición)
 */
export const MIGRATIONS = [
  {
    version: 1,
    name: 'esquema_base',
    // Esquema vigente antes de introducir las migraciones. Es idempotente: en una base que ya
    // lo tenía (creada por versiones anteriores) no cambia nada y solo se registra.
    async up(db) {
      const { id, datetime } = db.types;

      await db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id ${id},
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT UNIQUE,
          role TEXT DEFAULT 'student',
          reserve_points INTEGER DEFAULT 0,
          exam_score REAL DEFAULT NULL,
          exam_attempts INTEGER DEFAULT 0,
          focus_violations INTEGER DEFAULT 0,
          proctoring_incidents INTEGER DEFAULT 0,
          created_at ${datetime}
        )
      `);
      // Columnas que las versiones anteriores agregaban con ALTER TABLE
      await db.addColumnIfMissing('students', 'role', `TEXT DEFAULT 'student'`);
      await db.addColumnIfMissing('students', 'id_number', 'TEXT');
      await db.addColumnIfMissing('students', 'id_type', 'TEXT');
      await db.addColumnIfMissing('students', 'institution', 'TEXT');
      await db.addColumnIfMissing('students', 'is_onboarded', 'INTEGER DEFAULT 0');
      await db.addColumnIfMissing('students', 'face_descriptor', 'TEXT');
      await db.addColumnIfMissing('students', 'cohort', `TEXT DEFAULT 'Promoción 1'`);
      await db.addColumnIfMissing('students', 'start_date', 'TEXT');
      // Intento de examen en curso: lo abre /start-exam con su set de preguntas y lo cierra /submit-exam
      await db.addColumnIfMissing('students', 'exam_in_progress', 'INTEGER DEFAULT 0');
      await db.addColumnIfMissing('students', 'exam_question_ids', 'TEXT');

      await db.run(`
        CREATE TABLE IF NOT EXISTS course_progress (
          id ${id},
          student_id INTEGER,
          module_id TEXT NOT NULL,
          status TEXT DEFAULT 'completed',
          completed_at ${datetime},
          UNIQUE(student_id, module_id)
        )
      `);
      await db.addColumnIfMissing('course_progress', 'certificate_code', 'TEXT');

      await db.run(`
        CREATE TABLE IF NOT EXISTS questions (
          id ${id},
          category TEXT DEFAULT 'general',
          text TEXT NOT NULL,
          poison_text TEXT,
          option_a TEXT NOT NULL,
          option_b TEXT NOT NULL,
          option_c TEXT NOT NULL,
          option_d TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          wildcard_eliminates TEXT DEFAULT NULL
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS exam_logs (
          id ${id},
          student_id INTEGER,
          event_type TEXT,
          detail TEXT,
          timestamp ${datetime}
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id ${id},
          student_id INTEGER,
          recipient_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          body_content TEXT NOT NULL,
          sent_at ${datetime},
          status TEXT DEFAULT 'sent'
        )
      `);

      await db.run(`
        CREATE TABLE IF NOT EXISTS cohort_closures (
          id ${id},
          cohort_name TEXT UNIQUE NOT NULL,
          closed_at ${datetime},
          closed_by_admin_id INTEGER,
          cohort_seal_hash TEXT NOT NULL,
          total_students INTEGER,
          certified_students INTEGER
        )
      `);

      // Intentos del simulador Unity WebGL: uno por partida (1 paso práctico = 1 fase).
      // Guarda la telemetría que reporta Unity y los puntos que decidió la API.
      await db.run(`
        CREATE TABLE IF NOT EXISTS simulator_attempts (
          id TEXT PRIMARY KEY,
          student_id INTEGER NOT NULL,
          step_id TEXT NOT NULL,
          scene TEXT NOT NULL,
          phase INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'started',
          started_at TEXT NOT NULL,
          completed_at TEXT,
          score INTEGER,
          max_score INTEGER,
          passed INTEGER,
          error_count INTEGER,
          dose_msv REAL,
          time_seconds REAL,
          tier TEXT,
          points_awarded INTEGER
        )
      `);

      // Primer inicio de reproducción de cada video: en producción, un video solo se registra como
      // visto si desde aquí pasó el tiempo mínimo (curriculum.minWatchSecondsFor)
      await db.run(`
        CREATE TABLE IF NOT EXISTS video_views (
          id ${id},
          student_id INTEGER NOT NULL,
          step_id TEXT NOT NULL,
          started_at TEXT NOT NULL,
          UNIQUE(student_id, step_id)
        )
      `);

      await db.run('CREATE INDEX IF NOT EXISTS idx_course_progress_student ON course_progress(student_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_course_progress_cert ON course_progress(certificate_code)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_cohort_closures_name ON cohort_closures(cohort_name)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_exam_logs_student ON exam_logs(student_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_exam_logs_timestamp ON exam_logs(timestamp)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_students_cohort ON students(cohort)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_email_logs_student ON email_logs(student_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(recipient_email)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_simulator_attempts_student_step ON simulator_attempts(student_id, step_id)');
    },
  },
  {
    version: 2,
    name: 'matricula_y_cohortes',
    // Fase 1: promociones con fechas de acceso, estado de la cuenta, enlaces de activación y
    // restablecimiento, bitácora del administrador y cola de correo.
    async up(db) {
      const { id, datetime } = db.types;

      // Promociones (cohortes) como entidad. students.cohort sigue guardando el nombre, que es
      // la clave única de la promoción (lo usan filtros, acta, CSV y sellado).
      await db.run(`
        CREATE TABLE IF NOT EXISTS cohorts (
          id ${id},
          name TEXT UNIQUE NOT NULL,
          starts_on TEXT,
          ends_on TEXT,
          description TEXT,
          created_at ${datetime},
          created_by_admin_id INTEGER
        )
      `);
      await db.run(`UPDATE students SET cohort = 'Promoción 1' WHERE cohort IS NULL AND role != 'admin'`);
      // Una promoción por cada nombre ya usado, sin fechas: el acceso sigue sin restricción
      const used = await db.all(`
        SELECT DISTINCT cohort AS name FROM students WHERE role != 'admin' AND cohort IS NOT NULL
        UNION SELECT cohort_name AS name FROM cohort_closures
      `);
      const names = new Set(['Promoción 1', ...used.map((r) => r.name).filter(Boolean)]);
      for (const name of names) {
        await db.run('INSERT INTO cohorts (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [name]);
      }

      // Estado de la cuenta
      await db.addColumnIfMissing('students', 'is_active', 'INTEGER DEFAULT 1');
      await db.addColumnIfMissing('students', 'deactivated_at', 'TEXT');
      await db.addColumnIfMissing('students', 'deactivation_reason', 'TEXT');
      // Se incrementa al desactivar o cambiar la contraseña: invalida las sesiones abiertas
      await db.addColumnIfMissing('students', 'token_version', 'INTEGER DEFAULT 0');
      // NULL = cuenta creada por el admin que aún no se activó con su enlace
      await db.addColumnIfMissing('students', 'password_set_at', 'TEXT');
      await db.addColumnIfMissing('students', 'last_login_at', 'TEXT');
      // Las cuentas existentes ya tienen contraseña: quedan activadas
      await db.run(`
        UPDATE students
           SET password_set_at = COALESCE(CAST(created_at AS TEXT), CAST(CURRENT_TIMESTAMP AS TEXT))
         WHERE password_set_at IS NULL
      `);

      // Enlaces de un solo uso (activación y restablecimiento): solo se guarda el hash del token
      await db.run(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          id ${id},
          student_id INTEGER NOT NULL,
          purpose TEXT NOT NULL,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at ${datetime},
          created_by_admin_id INTEGER
        )
      `);
      await db.run('CREATE INDEX IF NOT EXISTS idx_auth_tokens_student ON auth_tokens(student_id, purpose)');

      // Bitácora de acciones del administrador: quién, cuándo, qué, sobre quién y por qué
      await db.run(`
        CREATE TABLE IF NOT EXISTS admin_actions (
          id ${id},
          admin_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id TEXT,
          reason TEXT,
          details TEXT,
          created_at ${datetime}
        )
      `);
      await db.run('CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON admin_actions(created_at)');

      // Cola de correo: estado real del envío, reintentos y contenido cifrado hasta enviarse
      await db.addColumnIfMissing('email_logs', 'template', 'TEXT');
      await db.addColumnIfMissing('email_logs', 'attempts', 'INTEGER DEFAULT 0');
      await db.addColumnIfMissing('email_logs', 'last_error', 'TEXT');
      await db.addColumnIfMissing('email_logs', 'provider_message_id', 'TEXT');
      await db.addColumnIfMissing('email_logs', 'next_attempt_at', 'TEXT');
      await db.addColumnIfMissing('email_logs', 'payload_encrypted', 'TEXT');
      await db.addColumnIfMissing('email_logs', 'created_by_admin_id', 'INTEGER');
      await db.run('CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status)');
      // Hasta esta versión ningún correo salía del servidor (solo se registraba): 'sent' no era cierto
      await db.run(`UPDATE email_logs SET status = 'simulated' WHERE status = 'sent'`);
      // Las inducciones anteriores guardaban la contraseña temporal en texto plano: se ocultan
      const withPasswords = await db.all(
        'SELECT id, body_content FROM email_logs WHERE body_content LIKE ?',
        ['%Contraseña Asignada:%']
      );
      for (const row of withPasswords) {
        const redacted = row.body_content.replace(/(Contraseña Asignada:<\/strong>)[^<]*/g, '$1 ••••••••');
        if (redacted !== row.body_content) {
          await db.run('UPDATE email_logs SET body_content = ? WHERE id = ?', [redacted, row.id]);
        }
      }
    },
  },
  {
    version: 3,
    name: 'intentos_de_examen',
    // Fase 2: historial de intentos del examen. Guarda las preguntas que vio el estudiante en cada
    // intento (los siguientes no las repiten) y su resultado, para la ficha del estudiante.
    // students.exam_in_progress / exam_question_ids siguen siendo el intento abierto.
    async up(db) {
      const { id } = db.types;
      await db.run(`
        CREATE TABLE IF NOT EXISTS exam_attempts (
          id ${id},
          student_id INTEGER NOT NULL,
          attempt_number INTEGER NOT NULL,
          question_ids TEXT NOT NULL,
          question_count INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'in_progress',
          score REAL,
          correct_count INTEGER,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          UNIQUE(student_id, attempt_number)
        )
      `);
      await db.run('CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id)');
    },
  },
  {
    version: 4,
    name: 'estudiantes_de_prueba',
    // Fase 3: cuentas de prueba para que el admin reproduzca casos. No cuentan en estadísticas,
    // actas, CSV ni sellos, y sus certificados no son verificables.
    async up(db) {
      await db.addColumnIfMissing('students', 'is_test', 'INTEGER DEFAULT 0');
    },
  },
  {
    version: 5,
    name: 'casos_reportados',
    // Fase 4: «Reportar un problema». El estudiante abre un caso desde cualquier paso; el admin
    // lo resuelve o lo rechaza con una respuesta, queda en la bitácora y se le avisa por correo.
    async up(db) {
      const { id } = db.types;
      await db.run(`
        CREATE TABLE IF NOT EXISTS support_cases (
          id ${id},
          student_id INTEGER NOT NULL,
          step_id TEXT,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          context TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TEXT NOT NULL,
          resolved_at TEXT,
          resolved_by_admin_id INTEGER,
          resolution TEXT
        )
      `);
      await db.run('CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases(status)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_support_cases_student ON support_cases(student_id)');
    },
  },
  {
    version: 6,
    name: 'reintentos_auditados',
    // Fase 4: el admin reabre un paso tras revisar el caso. Las partidas del minijuego reabierto
    // se anulan (no se borran) y el examen recibe intentos adicionales; todo queda en la bitácora.
    async up(db) {
      await db.addColumnIfMissing('simulator_attempts', 'voided_at', 'TEXT');
      await db.addColumnIfMissing('simulator_attempts', 'voided_by_admin_id', 'INTEGER');
      await db.addColumnIfMissing('simulator_attempts', 'void_reason', 'TEXT');
      await db.addColumnIfMissing('students', 'exam_bonus_attempts', 'INTEGER DEFAULT 0');
    },
  },
  {
    version: 7,
    name: 'detalle_de_errores',
    // Fase 4: qué hizo mal el estudiante en cada partida y en qué segundo (lo envía Unity).
    async up(db) {
      await db.addColumnIfMissing('simulator_attempts', 'error_detail', 'TEXT');
    },
  },
  {
    version: 8,
    name: 'bandeja_de_alertas',
    // Fase 5: las alertas del seguimiento llegan a una bandeja donde el admin decide qué hacer con
    // cada una (posponerla, descartarla o enviar un correo de refuerzo). Cada decisión queda con
    // quién la tomó y cuándo; las alertas que dejan de cumplirse se cierran solas.
    async up(db) {
      const { id } = db.types;
      await db.run(`
        CREATE TABLE IF NOT EXISTS alert_inbox (
          id ${id},
          student_id INTEGER NOT NULL,
          alert_code TEXT NOT NULL,
          alert_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          details TEXT,
          first_seen_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          postponed_until TEXT,
          decided_at TEXT,
          decided_by_admin_id INTEGER,
          decision_note TEXT,
          email_log_id INTEGER,
          resolved_at TEXT
        )
      `);
      await db.run('CREATE INDEX IF NOT EXISTS idx_alert_inbox_status ON alert_inbox(status)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_alert_inbox_student ON alert_inbox(student_id)');
      // Una sola entrada abierta por estudiante y alerta, también si dos revisiones corren a la vez
      await db.run(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_inbox_open ON alert_inbox(student_id, alert_key) WHERE status IN ('pending', 'postponed')"
      );
    },
  },
  {
    version: 9,
    name: 'plantillas_de_refuerzo',
    // Fase 5: el admin edita el texto del correo de refuerzo de cada tipo de alerta. Sin fila se
    // usa el texto original (config/reinforcementTemplates.js); borrar la fila lo restaura.
    async up(db) {
      await db.run(`
        CREATE TABLE IF NOT EXISTS reinforcement_templates (
          alert_code TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by_admin_id INTEGER
        )
      `);
    },
  },
  {
    version: 10,
    name: 'retomar_videos',
    // Fase 6: el video retoma donde lo dejó el estudiante, en cualquier dispositivo. Se guarda la
    // última posición y hasta dónde lo vio (el bloqueo de adelanto se mantiene con ese dato).
    async up(db) {
      await db.addColumnIfMissing('video_views', 'last_position_seconds', 'REAL');
      await db.addColumnIfMissing('video_views', 'max_watched_seconds', 'REAL');
      await db.addColumnIfMissing('video_views', 'position_updated_at', 'TEXT');
    },
  },
];
