import 'dotenv/config';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as cookie from 'cookie';

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb, run, get, saveDb, getPgPool } from './server/config/db.js';
import { globalLimiter } from './server/middleware/rateLimiter.js';

import authRoutes from './server/routes/auth.js';
import examRoutes from './server/routes/exam.js';
import adminRoutes from './server/routes/admin.js';
import progressRoutes from './server/routes/progress.js';
import simulatorRoutes from './server/routes/simulator.js';
import { COURSE_STEPS } from './server/config/curriculum.js';

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(o => o.trim());

const app = express();
// Detrás de un proxy inverso (nginx, balanceador, Docker con gateway) define TRUST_PROXY
// (p. ej. "1" = un salto) para que req.ip sea la IP real del cliente.
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy);
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cookieParser());

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const parseFn = cookie.parseCookie || cookie.parse;
  const cookies = parseFn ? parseFn(cookieHeader) : {};
  const token = cookies.token || socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Authentication error: Invalid or expired token'));
    socket.user = decoded;
    next();
  });
});

// ─── Healthcheck Endpoints (DevOps / K8s / Cloud Probes) ─────────────────────
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com"],
        imgSrc:      ["'self'", "data:", "blob:"],
        mediaSrc:    ["'self'", "blob:"],
        connectSrc:  ["'self'", ...ALLOWED_ORIGINS],
        frameSrc:    ["'self'"],
        workerSrc:   ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
// Sin express.static: el backend es solo API. ArcoC/public contiene las fuentes Markdown de las
// lecturas y herramientas de compilación, que no deben publicarse; el contenido del curso lo
// sirve Next.js (client/public) detrás de la sesión (client/src/proxy.js).
app.use('/api', globalLimiter);

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', examRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/simulator', simulatorRoutes);

// Test isolation endpoint (strictly disabled in production)
// G-3: Requiere el secret si TEST_RESET_SECRET está configurado con valor no local
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test-reset', async (req, res) => {
    const testSecret = process.env.TEST_RESET_SECRET;
    const providedSecret = req.headers['x-test-secret'] || req.body?.secret;
    if (testSecret && testSecret !== 'test-reset-secret-local') {
      if (!providedSecret || providedSecret !== testSecret) {
        return res.status(403).json({ error: 'Forbidden: x-test-secret header required.' });
      }
    }

    try {
      const email = req.body?.email || 'student@test.com';
      if (email === 'admin@admin.com') {
        const passwordToSet = req.body?.password || 'test-admin-password';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(passwordToSet, salt);
        await run('UPDATE students SET password = ? WHERE email = ?', [hash, 'admin@admin.com']);
        return res.json({ success: true, email: 'admin@admin.com' });
      }
      const student = await get('SELECT id, face_descriptor, email FROM students WHERE email = ?', [email]);
      if (student) {
        const isOnboarded = req.body?.is_onboarded !== undefined ? (req.body.is_onboarded ? 1 : 0) : 1;
        const defaultDescriptor = JSON.stringify(Array(128).fill(0.05));
        const faceDesc = isOnboarded === 1 ? (student.face_descriptor || defaultDescriptor) : null;
        const reservePoints = req.body?.reserve_points !== undefined ? req.body.reserve_points : 150;
        const examAttempts = req.body?.exam_attempts !== undefined ? req.body.exam_attempts : 0;
        const examScore = req.body?.exam_score !== undefined ? req.body.exam_score : null;

        await run(
          'UPDATE students SET exam_score = ?, exam_attempts = ?, reserve_points = ?, is_onboarded = ?, face_descriptor = ?, proctoring_incidents = 0, focus_violations = 0, exam_in_progress = 0, exam_question_ids = NULL WHERE id = ?',
          [examScore, examAttempts, reservePoints, isOnboarded, faceDesc, student.id]
        );
        if (typeof req.body?.name === 'string' && req.body.name.trim()) {
          await run('UPDATE students SET name = ? WHERE id = ?', [req.body.name.trim(), student.id]);
        }
        if (req.body?.id_number) {
          await run('UPDATE students SET id_number = ?, institution = ?, cohort = ? WHERE id = ?', [
            req.body.id_number,
            req.body.institution || 'Hospital Universitario',
            req.body.cohort || 'Promoción 1',
            student.id
          ]);
        }
        await run('DELETE FROM course_progress WHERE student_id = ?', [student.id]);
        await run('DELETE FROM exam_logs WHERE student_id = ?', [student.id]);
        await run('DELETE FROM simulator_attempts WHERE student_id = ?', [student.id]);
        await run('DELETE FROM video_views WHERE student_id = ?', [student.id]);

        // Opcional para pruebas: marcar curso completo
        if (req.body?.complete_course) {
          for (const step of COURSE_STEPS) {
            await run('INSERT OR IGNORE INTO course_progress (student_id, module_id, status) VALUES (?, ?, ?)', [student.id, step, 'completed']);
          }
        }

        // Opcional para pruebas: marcar examen aprobado
        if (req.body?.pass_exam) {
          const finalScore = req.body?.exam_score !== undefined ? req.body.exam_score : 95;
          const nowIso = new Date().toISOString();
          const { calculateVerificationCode } = await import('./server/utils/certificate.js');
          const certCode = calculateVerificationCode(student.id, student.email, finalScore, nowIso);
          await run(`
            INSERT INTO course_progress (student_id, module_id, status, completed_at, certificate_code)
            VALUES (?, 'exam', 'completed', ?, ?)
          `, [student.id, nowIso, certCode]);
          await run('UPDATE students SET exam_score = ? WHERE id = ?', [finalScore, student.id]);
        }

        return res.json({ success: true, studentId: student.id });
      }

      // Si el estudiante no existe, crearlo para pruebas de onboarding y estudiante nuevo
      const passwordToSet = req.body?.password || 'student123';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(passwordToSet, salt);
      const nameToSet = req.body?.name || 'Dr. Nuevo Estudiante';
      const usernameToSet = req.body?.username || email.split('@')[0];
      const reservePoints = req.body?.reserve_points !== undefined ? req.body.reserve_points : 0;
      const isOnboarded = req.body?.is_onboarded !== undefined ? (req.body.is_onboarded ? 1 : 0) : 0;
      const defaultDescriptor = JSON.stringify(Array(128).fill(0.05));
      const faceDesc = isOnboarded === 1 ? defaultDescriptor : null;

      await run(
        `INSERT INTO students (name, username, password, email, role, reserve_points, is_onboarded, face_descriptor) VALUES (?, ?, ?, ?, 'student', ?, ?, ?)`,
        [nameToSet, usernameToSet, hash, email, reservePoints, isOnboarded, faceDesc]
      );
      const created = await get('SELECT id, face_descriptor, email FROM students WHERE email = ?', [email]);
      return res.json({ success: true, studentId: created.id, created: true });
    } catch (err) {
      console.error('Error in test-reset:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// SPA fallback replaced with 404 since UI is now in Next.js
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Not found (API only)' });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.io (Proctoring Heartbeats) ──────────────────────────────────────
const activeExams = new Map();

io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔌 Client connected: ${socket.id}`);
  }

  const authenticatedStudentId = socket.user?.id;

  socket.on('start_exam', () => {
    activeExams.set(socket.id, { 
      studentId: authenticatedStudentId, 
      lastHeartbeat: Date.now(),
      faceDetected: true,
      isMatch: true,
      violationCount: 0
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📝 Exam started for student ${authenticatedStudentId} on socket ${socket.id}`);
    }
  });

  socket.on('proctoring_heartbeat', ({ faceDetected, isMatch } = {}) => {
    const session = activeExams.get(socket.id);
    if (session) {
      session.lastHeartbeat = Date.now();
      session.faceDetected = !!faceDetected;
      // null/undefined: el cliente no pudo evaluar la identidad (sin descriptor registrado) → no penaliza
      session.isMatch = isMatch === undefined || isMatch === null ? true : !!isMatch;
    }
  });

  // El cliente cierra la supervisión al enviar el examen o salir de él; sin esto el monitor
  // interpretaría el fin de los latidos como pérdida de señal y suspendería al estudiante.
  socket.on('end_exam', () => {
    activeExams.delete(socket.id);
  });

  socket.on('disconnect', () => {
    activeExams.delete(socket.id);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    }
  });
});

// Heartbeat & Biometric Integrity Monitor (Runs every 10 seconds)
const proctoringMonitorInterval = setInterval(() => {
  const now = Date.now();
  for (const [socketId, session] of activeExams.entries()) {
    const elapsed = now - session.lastHeartbeat;

    // F-3: Advertencia temprana a los 15s (antes de la suspensión a los 30s)
    if (elapsed > 15000 && elapsed <= 30000 && !session.warningSent) {
      session.warningSent = true;
      io.to(socketId).emit('proctoring_warning', {
        reason: 'Señal de cámara débil o intermitente. Verifica tu conexión y que el rostro sea visible.'
      });
    }

    // 1. Detección de pérdida de latidos de red (> 30 segundos sin señal)
    if (elapsed > 30000) {
      console.warn(`🚨 Proctoring fallido para estudiante ${session.studentId}. Pérdida de latido de red.`);
      run('UPDATE students SET proctoring_incidents = proctoring_incidents + 1 WHERE id = ?', [session.studentId])
        .catch(err => console.error(err));
      run('INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)', [session.studentId, 'PROCTORING_EXPIRED', 'Pérdida de señal o desconexión por más de 30s'])
        .catch(err => console.error(err));
      // La suspensión cierra el intento en el servidor: ya no se puede enviar por la API
      run('UPDATE students SET exam_in_progress = 0 WHERE id = ?', [session.studentId])
        .catch(err => console.error(err));

      io.to(socketId).emit('exam_suspended', { reason: 'Pérdida prolongada de conexión con la cámara de supervisión (Heartbeat lost)' });
      activeExams.delete(socketId);
      continue;
    }

    // 2. Verificación biométrica activa: ausencia de rostro o no coincidencia facial
    if (session.faceDetected === false || session.isMatch === false) {
      session.violationCount = (session.violationCount || 0) + 1;
      const reason = !session.faceDetected 
        ? 'Rostro no detectado frente a la cámara' 
        : 'Identidad facial no coincide con el perfil registrado';
      
      console.warn(`⚠️ Infracción de proctoring estudiante ${session.studentId}: ${reason} (Ciclo ${session.violationCount}/3)`);

      // 3 ciclos de 10s = 30 segundos continuos de infracción confirmada
      if (session.violationCount >= 3) {
        console.error(`🚨 Examen suspendido definitivamente para estudiante ${session.studentId}: ${reason}`);
        run('UPDATE students SET proctoring_incidents = proctoring_incidents + 1 WHERE id = ?', [session.studentId])
          .catch(err => console.error(err));
        run('INSERT INTO exam_logs (student_id, event_type, detail) VALUES (?, ?, ?)', [session.studentId, 'PROCTORING_SUSPENDED', reason])
          .catch(err => console.error(err));
        run('UPDATE students SET exam_in_progress = 0 WHERE id = ?', [session.studentId])
          .catch(err => console.error(err));

        io.to(socketId).emit('exam_suspended', { reason });
        activeExams.delete(socketId);
      }
    } else {
      // Si el estado biométrico vuelve a ser válido, se resetea la tolerancia de gracia
      session.violationCount = 0;
      session.warningSent = false; // resetear advertencia si la señal vuelve
    }
  }
}, 10000);

// ─── Start ───────────────────────────────────────────────────────────────────
let runningServer;
initDb().then(() => {
  runningServer = server.listen(PORT, () => {
    console.log(`\n🏥 C-Arm Master MVP → http://localhost:${PORT}`);
    console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
  });
}).catch(err => {
  console.error('❌ Error initializing database:', err);
  process.exit(1);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  if (proctoringMonitorInterval) clearInterval(proctoringMonitorInterval);
  activeExams.clear();
  if (runningServer) {
    runningServer.close(() => {
      console.log('✅ HTTP server closed.');
      const pgPool = getPgPool();
      if (pgPool) {
        pgPool.end(() => {
          console.log('✅ PostgreSQL pool closed.');
          process.exit(0);
        });
      } else {
        // Persist SQLite to disk before exiting (M-01)
        saveDb().then(() => {
          console.log('✅ SQLite database saved to disk.');
          process.exit(0);
        }).catch(() => process.exit(0));
      }
    });
  } else {
    process.exit(0);
  }
  
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
