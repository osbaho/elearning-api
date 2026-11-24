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
];
