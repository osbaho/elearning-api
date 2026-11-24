# 🏥 C-Arm Master MVP — Documentación Integral del Proyecto ("La Biblia")

Bienvenido a la documentación técnica y arquitectural oficial de **C-Arm Master**, una plataforma web de capacitación médica interactiva y simulación clínica enfocada en el **Manejo y Operación del Arco en C** y **Protección Radiológica**.

Esta guía documenta exhaustivamente la arquitectura del sistema, el modelo de datos, los flujos de seguridad y anti-fraude, la lógica de proctoring biométrico, las reglas de negocio y los procedimientos de despliegue.

---

## 📑 Tabla de Contenidos
1. [Visión General y Arquitectura](#1-visión-general-y-arquitectura)
2. [Estructura del Repositorio](#2-estructura-del-repositorio)
3. [Base de Datos y Persistencia Híbrida](#3-base-de-datos-y-persistencia-híbrida)
4. [Flujos de Autenticación y Sesión](#4-flujos-de-autenticación-y-sesión)
5. [Estructura del Curso y Secuencialidad](#5-estructura-del-curso-y-secuencialidad)
6. [Simulador y Puntos de Reserva](#6-simulador-y-puntos-de-reserva)
7. [Examen Final y Reglas de Negocio](#7-examen-final-y-reglas-de-negocio)
8. [Sistema de Proctoring Biométrico (WebRTC + WebSockets)](#8-sistema-de-proctoring-biométrico-webrtc--websockets)
9. [Certificación Digital y Verificación Pública](#9-certificación-digital-y-verificación-pública)
10. [Panel de Auditoría Administrativa (IES)](#10-panel-de-auditoría-administrativa-ies)
11. [Seguridad, Criptografía y Anti-Fraude](#11-seguridad-criptografía-y-anti-fraude)
12. [Infraestructura, Docker y Despliegue](#12-infraestructura-docker-y-despliegue)
13. [Suite de Pruebas Automatizadas (Playwright)](#13-suite-de-pruebas-automatizadas-playwright)
14. [Estándares Clínicos y Normativos 2026 (ACHS, ICRP 118, AO Trauma)](#14-estándares-clínicos-y-normativos-2026-achs-icrp-118-ao-trauma)
15. [Material Académico, Guiones Audiovisuales y Guía de Bolsillo](#15-material-académico-guiones-audiovisuales-y-guía-de-bolsillo)
16. [Flujo de Trabajo con Git (Ramas, Versiones y Limpieza)](#16-flujo-de-trabajo-con-git-ramas-versiones-y-limpieza)

---

## 1. Visión General y Arquitectura

El sistema opera bajo un modelo de desacoplamiento **Cliente-Servidor (BFF/API)**:

```mermaid
graph TB
    subgraph CLIENT["🖥️ Frontend — Next.js 16 (App Router) :3000"]
        AUTH_CTX["AuthContext (Cookie-driven)"]
        UI_PAGES["Páginas: /login · /onboarding · /course · /course/exam · /admin"]
        HOOK_PROCTORING["useProctoring() (@vladmandic/face-api + socket.io-client)"]
        SIM_VIEW["SimulatorView (postMessage Bridge)"]
    end

    subgraph BACKEND["⚙️ Backend — Express + Socket.IO :5000"]
        SERVER_MAIN["server.js (Middleware, Socket Server, Graceful Shutdown)"]
        AUTH_ROUTES["routes/auth.js (Login, Logout, /me, Onboarding)"]
        EXAM_ROUTES["routes/exam.js (Questions, Wildcards, Grading, Verify)"]
        PROG_ROUTES["routes/progress.js (Secuencialidad Estricta)"]
        ADMIN_ROUTES["routes/admin.js (Auditoría IES, Descarga Certificados)"]
        CRYPTO_UTIL["utils/crypto.js (AES-256-GCM para Biometría)"]
        CERT_UTIL["utils/certificate.js (PDFKit + Hash Determinístico)"]
    end

    subgraph STORAGE["🗄️ Capa de Datos Híbrida"]
        DB_LAYER["config/db.js (Abstracción Dual)"]
        SQLITE["SQLite (Local/Dev) — sql.js con persistencia debounced"]
        POSTGRES["PostgreSQL (Prod/Cloud) — Connection Pool (pg)"]
    end

    UI_PAGES -->|"REST (HttpOnly Cookies)"| SERVER_MAIN
    HOOK_PROCTORING -->|"WebSocket Heartbeats"| SERVER_MAIN
    SERVER_MAIN --> AUTH_ROUTES & EXAM_ROUTES & PROG_ROUTES & ADMIN_ROUTES
    AUTH_ROUTES & EXAM_ROUTES & PROG_ROUTES & ADMIN_ROUTES --> DB_LAYER
    DB_LAYER --> SQLITE
    DB_LAYER --> POSTGRES
    AUTH_ROUTES --> CRYPTO_UTIL
    EXAM_ROUTES --> CERT_UTIL
    ADMIN_ROUTES --> CERT_UTIL
```

### Principios Fundamentales:
* **Backend como Juez de la Verdad:** Ninguna regla de negocio, puntaje, cálculo de aprobación o costo de comodines se delega al cliente.
* **Privacidad Biométrica:** El reconocimiento facial se computa localmente en el navegador mediante descriptores matemáticos (vectores Float32Array de 128 dimensiones). No se transmiten fotos ni videos al servidor, y los descriptores se cifran en base de datos con **AES-256-GCM**.
* **Zero Trust ante Fraude:** Detección de pérdida de foco (`visibilitychange`/`blur`), detección de cámaras virtuales (OBS, vCam), verificación continua de identidad frente a la cámara web y trampa de inyección para modelos de IA (*Prompt Poisoning*).

---

## 2. Estructura del Repositorio

```text
ArcoC/
├── server.js                      # Punto de entrada del backend, Socket.IO y monitor
├── package.json                   # Dependencias raíz y workspaces
├── docker-compose.yml             # Orquestación de contenedores
├── Dockerfile.backend             # Imagen de producción Express
├── Dockerfile.frontend            # Imagen de producción Next.js
├── .dockerignore                  # Lo que no entra al contexto de build de Docker
├── playwright.config.js           # Configuración de pruebas E2E
├── .env.example                   # Plantilla de variables de entorno backend
│
├── docs/
│   └── guiones/                   # Guiones técnicos audiovisuales para generación IA (Módulos 1-5)
│
├── public/
│   ├── documents/                 # Fuentes en Markdown (Lecturas 1-5, Guía Rápida de Bolsillo, convert.js); no se publican por HTTP
│   └── images/                    # Archivos fuente del Atlas Radiológico (Módulos 1-5)
│
├── scripts/
│   ├── enrich_lecturas_with_images.py # Script de automatización de inyección de imágenes clínicas
│   ├── prepare-module-videos.ps1  # Masters de un módulo → videos web (H.264 ~4 Mbps, faststart)
│   └── pg-test/                   # PostgreSQL 16 desechable para la suite E2E (npm run test:pg)
│
├── server/
│   ├── config/
│   │   ├── db.js                  # Abstracción dual SQLite/PostgreSQL y ejecución de migraciones
│   │   ├── migrations.js          # Migraciones versionadas del esquema (tabla schema_migrations)
│   │   ├── curriculum.js          # Malla de 30 pasos: fuente única de verdad del servidor
│   │   ├── examRules.js           # Reglas del examen: preguntas por intento, nota mínima, intentos, comodín
│   │   ├── appUrls.js             # URL pública del frontend para los enlaces de correos (APP_PUBLIC_URL)
│   │   ├── simulatorCatalog.js    # Minijuego → escena y fase del simulador Unity, y si ya está en el build
│   │   └── reservePoints.js       # Regla 10/5/0 por fase y techo de 500 Puntos de Reserva
│   ├── middleware/
│   │   ├── auth.js                # Sesión: JWT + cuenta activa + versión de sesión; requireAdmin
│   │   └── rateLimiter.js         # Rate limiting global y login limiter
│   ├── routes/
│   │   ├── auth.js                # Login, logout, me, onboarding; activación y recuperación de contraseña
│   │   ├── exam.js                # Preguntas, inicio, comodines, calificación, verificación
│   │   ├── progress.js            # Marcado de pasos con validación secuencial
│   │   ├── simulator.js           # Partidas del simulador Unity y resultados por fase
│   │   ├── admin.js               # Listado, auditoría IES, CSV, PDF, sellado, reenvío y recordatorios
│   │   ├── adminManagement.js     # Promociones, matrícula (individual y CSV), edición, estado de cuentas, bitácora
│   │   ├── adminProgress.js       # Seguimiento del avance por promoción y ficha del estudiante
│   │   └── adminTestStudents.js   # Herramientas para estudiantes de prueba (reiniciar, llevar a un paso, copiar)
│   ├── utils/
│   │   ├── certificate.js         # Generación de PDF (PDFKit) y validación pública
│   │   ├── cohortActa.js          # Acta colectiva y libro de calificaciones por promoción (PDF)
│   │   ├── crypto.js              # Cifrado autenticado AES-256-GCM (biometría y cola de correo)
│   │   └── csv.js                 # Lectura del CSV de importación de estudiantes y plantilla
│   ├── services/
│   │   ├── emailService.js        # Plantillas: bienvenida con activación, restablecimiento, recordatorio
│   │   ├── mailer.js              # Cola de correo (email_logs), SMTP o modo simulado, reintentos
│   │   ├── authTokens.js          # Enlaces de un solo uso (activación y restablecimiento), solo su hash
│   │   ├── adminActions.js        # Bitácora de acciones del administrador (admin_actions)
│   │   ├── access.js              # Ventana de acceso según las fechas de la promoción
│   │   ├── examQuestions.js       # Preguntas de cada intento sin repetir las ya vistas
│   │   ├── preview.js             # Modo revisión del administrador (recorre el curso sin registrar nada)
│   │   ├── launchReadiness.js     # Qué falta para el lanzamiento: videos, minijuegos y banco de preguntas
│   │   ├── progressTracking.js    # Avance, mejor nivel por minijuego, última actividad, alertas y ficha
│   │   └── testStudents.js        # Estudiantes de prueba: exclusión de estadísticas y herramientas
│   └── scripts/
│       ├── seed.js                # Inicialización de cuenta de Administrador
│       ├── seed_50_questions.js   # Banco oficial de 50 preguntas médicas (actualizado a 2026/ACHS)
│       ├── check_db.js            # Utilidad de inspección de base de datos
│       └── reset_onboarding.js    # Utilidad de pruebas de onboarding
│
├── client/
│   ├── package.json               # Dependencias del cliente Next.js
│   ├── next.config.mjs            # Configuración de Next.js (caché privada del contenido del curso)
│   ├── .env.example               # Plantilla de variables de entorno frontend
│   ├── public/
│   │   ├── models/                # Modelos pre-entrenados de face-api (pesos originales de face-api.js)
│   │   ├── workers/               # Worker de proctoring y copia del build de @vladmandic/face-api (sección 8)
│   │   ├── documents/             # PDFs oficiales compilados (Lecturas 1-5 y Guía Rápida de Bolsillo)
│   │   ├── images/                # Atlas Radiológico clínico AO Trauma (Módulos 1-5)
│   │   ├── videos/moduloN/        # Videos web por módulo (generados, fuera de git)
│   │   └── webgl/                 # Build WebGL del simulador Unity (generado, fuera de git)
│   └── src/
│       ├── proxy.js               # Sesión obligatoria para páginas del curso y contenido (videos, WebGL, PDF, imágenes)
│       ├── app/
│       │   ├── page.js            # Landing page institucional
│       │   ├── globals.css        # Tema (variables CSS), componentes y clases utilitarias (ver sección 2.1)
│       │   ├── login/page.js      # Inicio de sesión con autenticación HttpOnly
│       │   ├── activar/           # Crear la contraseña con el enlace de bienvenida (/activar?token=)
│       │   ├── recuperar/         # «¿Olvidaste tu contraseña?»
│       │   ├── restablecer/       # Nueva contraseña con el enlace de recuperación (/restablecer?token=)
│       │   ├── onboarding/page.js # Registro biométrico y formulario Habeas Data
│       │   ├── course/page.js     # Dashboard central del curso, selector de módulos y guía rápida
│       │   ├── course/practice/   # Rutas dinámicas para minijuegos interactivos
│       │   ├── course/exam/page.js# Interfaz del examen y panel de proctoring
│       │   ├── admin/page.js      # Panel: auditoría IES y seguimiento del avance (pestañas)
│       │   ├── admin/_components/ # Promociones, gestión, importación CSV, bitácora, seguimiento y preparación del lanzamiento
│       │   └── admin/estudiantes/[id]/ # Ficha completa del estudiante
│       ├── components/
│       │   ├── ModuleCard.js      # Tarjeta de módulo con estado visual
│       │   ├── VideoPlayer.js     # Reproductor con control de adelanto (scrubbing)
│       │   ├── SimulatorView.js   # Página de práctica: partidas, iframe del simulador Unity y Atlas Radiológico
│       │   ├── ProtectedRoute.js  # Guardián de rutas por autenticación y rol
│       │   ├── PublicShell.js     # Marco de las páginas públicas de acceso
│       │   └── SetPasswordForm.js # Formulario de contraseña con enlace de un solo uso
│       ├── context/
│       │   ├── AuthContext.js     # Estado reactivo global de usuario
│       │   └── ToastContext.js    # Notificaciones accesibles (ARIA live)
│       ├── hooks/
│       │   └── useProctoring.js   # Hook para cámara, face-api y WebSockets
│       └── lib/
│           ├── courseConfig.js    # Configuración de los 30 pasos del curso (títulos, videos, íconos)
│           └── api.js             # Llamadas al API con sesión, descargas y formato de fechas
│
└── tests/
    ├── helpers/
    │   ├── loginHelper.js         # Utilidad de login y reset para tests
    │   ├── simulatorHelper.js     # Partidas del simulador y avance de pasos vía API
    │   └── adminHelper.js         # Sesión de admin en contexto propio, promociones y matrículas vía API
    └── e2e/                       # 29 suites Playwright (ver sección 13)
```

En la raíz del monorepo, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) corre el lint del cliente y la suite E2E sobre SQLite y PostgreSQL (ver sección 13).

### 2.1 Estilos del frontend
No hay Tailwind ni CSS por componente: todo el estilo vive en [`client/src/app/globals.css`](client/src/app/globals.css).
* **Tema:** variables en `:root` para colores (`--accent-cyan`, `--accent-red`…), fondos, bordes, radios y sombras.
* **Componentes:** clases propias como `.card`, `.btn`, `.admin-table`, `.modal-backdrop` y `.form-input`.
* **Utilidades:** clases cortas con la escala del proyecto en px, por ejemplo `.mt-8`, `.p-16`, `.gap-8`, `.flex-wrap`, `.grid-cols-5`, `.font-bold`, `.title-sm`, `.text-red`, `.input` y `.loader`. Van al final del archivo para ganar sobre los estilos de componente con la misma especificidad (p. ej. `.card` + `.p-16`).
* **Ninguna clase usada en el marcado debe faltar en el CSS.** Hasta noviembre de 2026 faltaban 109 (`flex-wrap`, `grid-cols-5`, `gap-*`, `mt-4`, `font-bold`, `input`…). Por eso el encabezado del panel se aplastaba, las tarjetas de indicadores se apilaban y los campos del admin salían sin estilo. Las que quedan sin definir son ganchos sin estilo propio (`tour-exam`, `tour-progress` para el recorrido guiado) o del estudiante que se revisarán en la Fase 6.
* **Contenedor ancho:** `.container-wide` (1440 px) para las páginas del admin, que tienen tablas anchas. `.container` no fija `z-index`: así no crea un contexto de apilamiento, y los modales (`z-index` 1050) quedan sobre el encabezado fijo (100).

---

## 3. Base de Datos y Persistencia Híbrida

La capa de datos ([`server/config/db.js`](file:///c:/Oscar/ArcoC/server/config/db.js)) implementa un wrapper agnóstico que permite alternar entre:
1. **SQLite (`sql.js`):** Utilizado por defecto en desarrollo local. Se carga en memoria para velocidad ultra-rápida y persiste automáticamente a `database.sqlite` mediante debounce y en el evento de *graceful shutdown*.
2. **PostgreSQL (`pg`):** Habilitado automáticamente cuando se define la variable `DATABASE_URL`. El conversor `convertSqlForPg` traduce los placeholders (`?` a `$1, $2...`); el resto del SQL se escribe en la sintaxis común a ambos motores (por ejemplo `INSERT ... ON CONFLICT (...) DO NOTHING`, nunca `INSERT OR IGNORE`, que solo existe en SQLite).

### Paridad entre SQLite y PostgreSQL
Producción usa PostgreSQL; desarrollo, SQLite. Para que el comportamiento sea el mismo:
* **Tipos:** `COUNT`/`SUM` (BIGINT) y `AVG`/`ROUND` (NUMERIC) llegan como números, igual que en SQLite (`types.setTypeParser` en `db.js`).
* **Fechas en UTC:** cada conexión arranca con `TimeZone=UTC` (parámetro `options` del pool) y las columnas `TIMESTAMP` se leen como UTC, sin depender de la zona horaria del servidor Node.
* **SQL portable:** `ROUND(x, 2)` solo existe para NUMERIC en PostgreSQL (se usa `ROUND(CAST(AVG(...) AS NUMERIC), 2)`) y toda columna no agregada debe ir en el `GROUP BY`. Estos dos casos hacían fallar `/api/admin/cohorts` en PostgreSQL.
* **SSL:** `DATABASE_SSL` = `disable` (red interna, como el Postgres de docker-compose), `require` (verifica el certificado) o `no-verify` (cifra sin verificar; valor por defecto). Si `DATABASE_URL` trae `sslmode`, ese valor manda.
* **Codificación UTF8:** los textos llevan tildes y emojis (asuntos y cuerpos de correo), así que la base de PostgreSQL debe ser UTF8. La imagen oficial de Docker la crea así; en Windows, `initdb` usa WIN1252 por defecto y rechaza esas filas. Al arrancar, el backend avisa en el log si la base no es UTF8.
* **Verificación:** la suite E2E corre en ambos motores (`npm run test:pg` y CI, ver sección 13).

### Migraciones versionadas ([`server/config/migrations.js`](server/config/migrations.js))
* Al arrancar, `initDb()` aplica en orden las migraciones pendientes: cada una se ejecuta **una sola vez**, dentro de una transacción, y queda registrada en `schema_migrations`. En PostgreSQL un candado (`pg_advisory_xact_lock`) evita que dos instancias que arrancan a la vez apliquen la misma.
* **Versión 1 (`esquema_base`)** es el esquema anterior a las migraciones. Es idempotente: en una base existente no cambia nada y solo se registra (verificado sobre una copia de la base de desarrollo: mismas filas y columnas en todas las tablas).
* **Para cambiar el esquema** agrega una migración al final de `MIGRATIONS` con el siguiente número; nunca edites ni reordenes una publicada, porque las bases existentes no la volverían a ejecutar. Cada migración recibe `db.run/get/all`, `db.types.id/datetime`, `db.columnExists()` y `db.addColumnIfMissing()`.
* `/api/health` informa `schemaVersion` (última migración aplicada) para confirmar tras un despliegue que el esquema está al día.

### Esquema Relacional de Tablas

#### 1. `students`
Almacena usuarios, credenciales, estado del curso y telemetría de integridad:
* `id` (INTEGER / SERIAL PRIMARY KEY)
* `name`, `username`, `email` (UNIQUE), `password` (hash bcrypt con 10 rondas de salt)
* `role`: `'student'` o `'admin'`
* `reserve_points`: Entero (0 - 500), saldo disponible para comodines
* `exam_score`: Calificación máxima alcanzada (0.00 - 100.00)
* `exam_attempts`: Contador de intentos de examen (máximo 3)
* `focus_violations`: Contador de veces que el usuario perdió el foco de pantalla
* `proctoring_incidents`: Contador de faltas biométricas confirmadas
* `is_onboarded`: Indicador booleano (0 o 1)
* `face_descriptor`: TEXT con el vector de 128 números **cifrado en AES-256-GCM**
* `id_number`, `id_type` (CC, CE, Pasaporte), `institution`: Datos institucionales
* `cohort`, `start_date`: Promoción y fecha habilitada de acceso (las registra el admin al matricular)
* `exam_in_progress`, `exam_question_ids`: Intento de examen abierto y su set de preguntas (el historial de intentos está en `exam_attempts`)
* `created_at`: Marca temporal de creación

#### 2. `course_progress`
Registra el avance individual por paso:
* `id` (INTEGER / SERIAL PRIMARY KEY)
* `student_id` (FOREIGN KEY -> students.id)
* `module_id`: Identificador del paso (ej: `'m1_v1'`, `'m1_s1'`, `'exam'`)
* `status`: `'completed'`
* `completed_at`: Marca temporal inmutable del primer completado
* `certificate_code`: En la fila `'exam'`, código de verificación del certificado, guardado al aprobar (indexado)
* Restricción: `UNIQUE(student_id, module_id)`

#### 3. `questions`
Banco de preguntas de opción múltiple (50 reactivos oficiales estandarizados según normativas OIEA, ICRP 118, ACHS y AO Trauma):
* `id` (INTEGER / SERIAL PRIMARY KEY). `npm run seed:questions` reemplaza el banco y reinicia la numeración, así que el oficial queda siempre con ids 1–50 en ambos motores (antes empezaba en 6 si la base ya tenía las 5 preguntas iniciales).
* `category`: Categoría médica (*Física y Espectro*, *Protección y Blindaje*, *Estándares ACHS y Operación*, *Tecnología FPD e IA*, *Anatomía y Proyecciones*, *Protocolos Quirúrgicos*)
* `text`: Enunciado de la pregunta clínica
* `poison_text`: Texto señuelo invisible para despistar agentes de IA
* `option_a`, `option_b`, `option_c`, `option_d`: Opciones de respuesta
* `correct_answer`: Letra correcta (`'a'`, `'b'`, `'c'`, `'d'`)
* `wildcard_eliminates`: Opciones incorrectas a descartar por el comodín 50/50 (ej: `'ac'`, `'b,d'`)

#### 4. `exam_logs`
Bitácora de auditoría forense del examen:
* `id` (INTEGER / SERIAL PRIMARY KEY)
* `student_id` (FOREIGN KEY -> students.id)
* `event_type`: `'EXAM_STARTED'`, `'EXAM_SUBMITTED'`, `'WILDCARD_USED'`, `'POINTS_EARNED'`, `'FOCUS_LOSS'`, `'PROCTORING_WARNING'`, `'PROCTORING_SUSPENDED'`, `'PROCTORING_EXPIRED'`
* `detail`: Descripción técnica detallada del evento
* `timestamp`: Fecha y hora del suceso. Se conservan siempre (son evidencia para auditorías); `EXAM_LOG_RETENTION_DAYS` permite borrar los más antiguos al arrancar

#### 5. `simulator_attempts`
Una fila por partida en el simulador Unity WebGL (1 paso práctico = 1 fase = 1 partida). La crea `POST /api/simulator/attempts` y la completa el resultado de la fase:
* `id` (TEXT PRIMARY KEY, UUID que viaja como `attempt` en la URL del iframe)
* `student_id`, `step_id` (ej: `'m1_s2'`), `scene`, `phase`
* `status`: `'started'` o `'completed'`; `started_at` / `completed_at` (ISO 8601, los fija el servidor)
* Telemetría reportada por Unity: `score`, `max_score`, `passed`, `error_count`, `dose_msv`, `time_seconds`
* Decisión del servidor: `tier` (`perfect` | `intermediate` | `failed`) y `points_awarded`
* Índice: `(student_id, step_id)`

#### 6. `video_views`
Primer inicio de reproducción de cada video por estudiante (`POST /api/progress/:id/start`). En producción es el punto desde el que se mide el tiempo mínimo de visualización:
* `id`, `student_id`, `step_id` (ej: `'m1_v2'`), `started_at` (ISO 8601, lo fija el servidor)
* Restricción: `UNIQUE(student_id, step_id)` (se conserva el primer inicio)

#### 7. `schema_migrations`
Migraciones aplicadas (ver *Migraciones versionadas*): `version` (PK), `name`, `applied_at`.

#### 8. `cohorts` (migración 2)
Promociones: `id`, `name` (UNIQUE; es lo que guarda `students.cohort`), `starts_on` y `ends_on` (AAAA-MM-DD, opcionales), `description`, `created_at`, `created_by_admin_id`. La migración creó una por cada nombre ya usado, sin fechas (el acceso siguió sin restricción).

#### 9. `auth_tokens` (migración 2)
Enlaces de un solo uso: `student_id`, `purpose` (`activation` | `password_reset`), `token_hash` (SHA-256 del token, UNIQUE; el token en claro nunca se guarda), `expires_at`, `used_at` (también marca los enlaces reemplazados por uno nuevo), `created_by_admin_id`.

#### 10. `admin_actions` (migración 2)
Bitácora del administrador: `admin_id`, `action`, `target_type` (`student` | `cohort` | `email`), `target_id`, `reason`, `details` (JSON con el antes y el después), `created_at`. Ver sección 10.4.

#### 11. `exam_attempts` (migración 3)
Historial de intentos del examen, una fila por intento:
* `student_id` y `attempt_number` (`UNIQUE` por estudiante; se numera con el máximo del historial + 1).
* `question_ids`: JSON con las preguntas que vio en ese intento. Los intentos siguientes evitan esas preguntas (sección 7).
* `question_count`.
* `status`:
  * `in_progress`: intento abierto.
  * `submitted`: calificado.
  * `suspended`: cerrado por el proctoring.
  * `abandoned`: el estudiante reinició el examen con un intento abierto; el nuevo intento conserva las mismas preguntas.
* `score` y `correct_count`, al calificar.
* `started_at` y `finished_at` (ISO 8601).

`students.exam_in_progress` y `exam_question_ids` siguen siendo el intento abierto. Los intentos anteriores a la migración no tienen fila.

#### Columna agregada por la migración 4
* `students.is_test` (0 por defecto): estudiante de prueba, excluido de estadísticas, actas, CSV, sellos y verificación de certificados (sección 10.12).

#### Columnas agregadas por la migración 2
* `students`: `is_active` (1 por defecto), `deactivated_at`, `deactivation_reason`, `token_version` (invalida sesiones), `password_set_at` (vacío = pendiente de activación; las cuentas existentes quedaron activadas), `last_login_at`.
* `email_logs`: `template`, `attempts`, `last_error`, `provider_message_id`, `next_attempt_at`, `payload_encrypted` (contenido cifrado hasta enviarse), `created_by_admin_id`. Estados: `queued`, `sent`, `simulated`, `failed` (sección 10.5).

---

## 4. Flujos de Autenticación y Sesión

* **Tokens JWT:** Firmados con clave de 32+ caracteres (`JWT_SECRET`) y vigencia de 12 horas. Llevan `tv`, la versión de sesión de la cuenta.
* **Sesión validada en cada petición ([`server/middleware/auth.js`](server/middleware/auth.js)):** además de la firma, `authenticateToken` comprueba en la base que la cuenta exista, esté activa (`is_active`) y que `tv` coincida con `students.token_version`. Desactivar la cuenta o cambiar la contraseña incrementa esa versión y **cierra todas las sesiones abiertas** (también el socket de proctoring). El rol se lee de la base, no del token.
* **Entrega de Cookies Seguras:** La cookie de autenticación (`token`) se emite con directivas `HttpOnly; SameSite=lax; Path=/`. En entornos de producción activa `Secure=true`.
* **Activación de cuenta (nunca se envían contraseñas):** el admin matricula y la cuenta queda *pendiente de activación* (`password_set_at` vacío, con el hash de un secreto aleatorio que nadie conoce). El estudiante recibe un enlace `/activar?token=…` (un solo uso, válido 7 días), crea su contraseña (`POST /api/auth/activate`) y entra directamente; si su promoción aún no empieza, la cuenta queda activada sin abrir sesión. En la base solo se guarda el hash SHA-256 del token (tabla `auth_tokens`).
* **Recuperar la contraseña:** `/recuperar` → `POST /api/auth/forgot-password` responde siempre lo mismo, exista o no el correo. A una cuenta sin activar le llega un enlace de activación nuevo; a una activada, uno de restablecimiento `/restablecer?token=…` (un solo uso, válido 1 hora) que termina en `POST /api/auth/reset-password` y cierra las demás sesiones. `GET /api/auth/token-info` valida el enlace antes de pedir la contraseña (muestra el nombre sin títulos y el correo enmascarado). Emitir un enlace invalida los anteriores del mismo tipo.
* **Política de contraseñas:** entre 8 y 128 caracteres, con letras y números (la aplican el servidor y el formulario).
* **Formularios con contraseña en `method="post"`:** login, activación, restablecimiento y recuperación. Si se envían antes de que la página cargue su JavaScript, la contraseña no queda en la URL (con el GET por defecto terminaba en el historial del navegador y en los registros del servidor).
* **Mensajes de inicio de sesión:** con credenciales incorrectas o una cuenta sin activar, el mismo mensaje genérico (`INVALID_CREDENTIALS`, con la pista de activar o recuperar la cuenta), para no revelar qué correos están inscritos. Con la contraseña correcta se explica el motivo del rechazo: cuenta desactivada (`ACCOUNT_DISABLED`) o promoción que aún no empieza (`ACCESS_NOT_STARTED`, con la fecha). Cada ingreso actualiza `last_login_at`.
* **Límites de frecuencia:** `/api/login`, 10 intentos fallidos por IP cada 15 min en producción; activación y recuperación, 20 solicitudes por IP cada 15 min.
* **Timing-Attack Resilience:** En caso de que un correo electrónico no exista en la base de datos, el backend ejecuta un hash simulado mediante `bcrypt.compare` contra una cadena predeterminada, neutralizando la enumeración de usuarios por discrepancias en tiempos de respuesta.
* **Socket Authentication:** El handshake de WebSockets extrae la cookie HTTP y aplica la misma validación de sesión que la API (cuenta activa y versión de sesión vigente), impidiendo la apertura de canales de proctoring a clientes sin sesión válida.

---

## 5. Estructura del Curso y Secuencialidad

El programa académico consta de **5 módulos temáticos** y **30 pasos obligatorios** en total: cada módulo tiene 3 videos y 3 minijuegos intercalados (`mX_v1` → `mX_s1` → `mX_v2` → `mX_s2` → `mX_v3` → `mX_s3`). Claves: `mX_vN` = video, `mX_sN` = minijuego. No hay video recopilatorio: los antiguos `mX_vr` se retiraron y no cuentan para el avance. Es la estructura de lanzamiento (decisión del 2026-11-24): la plataforma sale con los 5 módulos completos.

**Módulo 1 (contenido definitivo, 6 pasos):** cada video va seguido de su minijuego en el simulador Unity.

| Paso | Contenido | Archivo / Simulador |
| :--- | :--- | :--- |
| `m1_v1` | Video 1: Historia, Física y Pilares S.E.R. | `/videos/modulo1/M01_V01_SER.mp4` |
| `m1_s1` | Minijuego 1: Protocolo Cero | `Scene1`, fase 1 (`MG1_ProtocolZero`) |
| `m1_v2` | Video 2: Densidades, Unidades y Normativa | `/videos/modulo1/M01_V02_Fisica.mp4` |
| `m1_s2` | Minijuego 2: Maestro del Haz | `Scene1`, fase 2 (`MG2_BeamMaster`) |
| `m1_v3` | Video 3: Geometría del Arco en C | `/videos/modulo1/M01_V03_Geometria.mp4` |
| `m1_s3` | Minijuego 3: Comando Isocentro | `Scene1`, fase 3 (`MG3_IsocenterCommand`) |

**Módulos 2–5 (contenido en producción, 6 pasos cada uno):**
* Los videos 1 y 2 tienen título y guion (`docs/guiones/`). El video 3 todavía no tiene guion: los guiones de estos módulos siguen con 2 videos y un recopilatorio.
* Mientras no exista su contenido, los videos muestran un placeholder (duración `null` en `VIDEO_DURATION_SECONDS`).
* Los minijuegos tienen su escena y fase previstas en el catálogo del simulador (`Scene2`…`Scene5`, fases 1–3) con `ready: false`. La práctica se muestra «en desarrollo» (sección 6).
* El panel del admin lista lo que falta en **Preparación del lanzamiento** (sección 10.9).

**Fuente única de verdad:** la lista ordenada vive en [`server/config/curriculum.js`](server/config/curriculum.js) (`COURSE_STEPS`, usada por progreso, examen, admin y correos) y en [`client/src/lib/courseConfig.js`](client/src/lib/courseConfig.js) (títulos, videos e íconos). El test E2E 19 falla si ambas listas difieren. Los totales (30) se calculan; no hay constantes repartidas por el código (tampoco en el acta, el CSV, el panel admin ni los correos).

**Panel del estudiante (`/course`):** al entrar se abre el módulo del paso pendiente (el primero sin completar o, con la malla completa, el examen), con su tarjeta resaltada, y el botón **«Continuar donde quedé»** lleva hasta él. La tarjeta del examen distingue tres estados: *aprobado* (✅ con la nota), *no aprobado* (❌ con la nota y «Reintentar Examen» con los intentos restantes) y *sin intentos* (botón deshabilitado con aviso de contactar al administrador). Antes, una nota reprobatoria se mostraba como «✅ Aprobado (60%)» y deshabilitaba el examen.

### Enforce de Secuencialidad Backend
El endpoint `POST /api/progress/:moduleId` valida en el servidor la lista ordenada `COURSE_STEPS`. Para marcar cualquier paso `n`, el paso `n-1` debe existir previamente en estado `'completed'` en `course_progress`; repetir un paso ya completado responde éxito sin cambios. **Todo minijuego** exige además **al menos una partida terminada** (`simulator_attempts` con `status = 'completed'`). Antes, los minijuegos sin escena en el simulador se podían finalizar sin jugar. Uno pendiente no admite partidas en producción, así que ahí el estudiante no puede finalizarlo ni avanzar más allá (sección 6). El administrador es la excepción: en modo revisión abre cualquier paso y nada se registra (sección 10.11). El módulo `'exam'` está protegido contra marcado manual: solo el endpoint `/api/submit-exam` puede otorgarlo tras calificar formalmente con la nota mínima (90%). Los conteos de avance (bloqueo del examen, estándar IES, CSV, recordatorios) solo cuentan pasos de la malla vigente.

### Control de Visualización en Videos ([`VideoPlayer.js`](file:///c:/Oscar/ArcoC/client/src/components/VideoPlayer.js))
* **Detección de Adelanto No Autorizado (Anti-Scrubbing):** Si el estudiante intenta saltar a una marca de tiempo superior a la observada de forma continua (+2 segundos de tolerancia), el reproductor revierte inmediatamente el cursor al tiempo máximo visto legítimamente y muestra una advertencia visual.
* **Condición de Finalización:** El callback `onComplete` únicamente se dispara cuando el usuario ha reproducido al menos el **90%** de la duración del video de forma continua. Si la API rechaza el registro, la página lo avisa con el motivo.
* **Tiempo mínimo en servidor (producción):** el bloqueo de adelanto ocurre en el navegador, así que la API no confía solo en él. Al primer *play*, el reproductor llama a `POST /api/progress/:moduleId/start` (queda en `video_views`). En producción, `POST /api/progress/:moduleId` de un video solo se acepta si desde ese inicio pasó el tiempo de verlo al 90 % a 2x, la velocidad máxima del reproductor, menos 5 s de margen: `⌊duración × 0,9 / 2 − 5⌋` segundos (73 s para el video 1 del módulo 1). Sin inicio registrado o antes de tiempo responde `403` con lo que falta. En desarrollo y en los tests no se aplica, para poder avanzar la malla sin esperar.
* **Duraciones:** viven en `VIDEO_DURATION_SECONDS` de [`server/config/curriculum.js`](server/config/curriculum.js). `scripts/prepare-module-videos.ps1` las imprime listas para copiar. `null` marca un video pendiente: así lo cuenta la preparación del lanzamiento. El test E2E 19 exige que los del módulo 1 tengan duración.

---

## 6. Simulador y Puntos de Reserva

Los estudiantes acumulan **Puntos de Reserva** al jugar los minijuegos del simulador Unity WebGL (proyecto `Simulador_ArcoEnC_M01` del monorepo). Estos puntos se canjean por el comodín 50/50 en el examen final.

### Contrato Plataforma ↔ Simulador
La **API es la dueña de la correlación**: decide qué escena y fase juega cada paso y cuántos puntos vale cada resultado. Unity solo juega lo que se le indica y reporta hechos. Unity **nunca** llama a la API; habla con la página contenedora, que ya tiene la sesión del estudiante.

```
Página /course/practice/m1_s1 (SimulatorView.js)
  1. POST /api/simulator/attempts { stepId }          → { attemptId, scene, phase }
  2. <iframe src="/webgl/index.html?attempt=…&step=m1_s1&scene=Scene1&phase=1">   (mismo origen)
Unity WebGL (plantilla CArmEmbed + ScormBridge + ArcoEnC_SCORM.jslib)
  3. Carga escena y fase (WebLaunchContext / WebSceneRouter); el estudiante juega
  4. postMessage → { source: "carm-sim", v: 1, type: "phase-result", attemptId, stepId,
                     phase, score, maxScore, passed, errorCount, doseMsv, timeSeconds }
Página
  5. Acepta el mensaje solo si event.source es su iframe, el origen es el propio y
     attemptId/stepId coinciden → POST /api/simulator/attempts/:attemptId/result
API
  6. Valida, decide los puntos y responde { tier, pointsAwarded, reservePoints }
Página → Unity
  7. postMessage { source: "carm-host", v: 1, type: "phase-ack", tier, pointsAwarded, … }
     (la plantilla lo reenvía a ScormBridge.OnHostMessage y Dra. Nova muestra el resultado)
```

Otros mensajes del simulador: `ready` (Unity cargó) y `load-error`. Endpoints ([`server/routes/simulator.js`](server/routes/simulator.js)):

| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/simulator/steps/:stepId` | Estado del minijuego: escena y fase, partidas terminadas, puntos ganados y su tope (`maxPoints`). Campos de disponibilidad: `available` (la escena está en el build y se juega en Unity), `inDevelopment` (pendiente) y `canSimulate` (la API admite partidas: siempre fuera de producción, y en producción solo si está listo). Un paso inexistente responde `404`. |
| `POST /api/simulator/attempts` | Crea una partida. Exige el paso previo completado (403). Responde 404 si el paso no es un minijuego de la malla y 409 si ya fue finalizado o si es un minijuego pendiente en producción. |
| `POST /api/simulator/attempts/:id/result` | Registra el resultado de la fase y otorga los puntos. Responde `{ tier, pointsAwarded, reservePoints, stepPointsEarned, stepPointsMax, stepCapReached }`. |

### Regla de Puntos por Fase ([`server/config/reservePoints.js`](server/config/reservePoints.js))
| Resultado | Condición | Puntos |
| :--- | :--- | :--- |
| Perfecta | Aprobó, ≥ 70 % y 0 errores | **10** |
| Intermedia | Aprobó y ≥ 70 %, con errores | **5** |
| No aprobada | No aprobó, < 70 % o se agotó el tiempo | **0** |

El 70 % es el mismo `passScorePercent` de las `MinigameConfig` de Unity. "Perfecta" se mide por errores y no por puntaje, porque ProtocolZero y BeamMaster recortan a 100 sumas brutas mayores (se puede llegar a 100 con errores).

### Reglas de Negocio en Servidor
1. **Techo Global:** máximo 500 Puntos de Reserva por estudiante (la partida suma solo hasta el techo).
2. **Tope por minijuego (siempre):** un mismo minijuego aporta como máximo **50 puntos** (`MAX_POINTS_PER_PRACTICE_STEP`, 5 partidas perfectas). Después se puede seguir practicando: la partida se registra con 0 puntos y `stepCapReached: true`, y la página lo explica. Acota lo que se obtiene enviando resultados falsos a la API sin cambiar la regla 10/5/0. Con los 5 módulos completos, la suma de topes supera el techo de 500.
3. **Duración mínima de partida (producción):** un resultado solo se acepta si desde que la API creó el intento pasaron al menos `minSeconds` del catálogo (30 s; incluye la carga de Unity). Uno más rápido solo puede venir de un envío automatizado y responde `422`. En desarrollo no se aplica, para que la simulación y los tests sean inmediatos.
4. **Idempotencia:** reenviar el resultado de una partida devuelve el mismo registro con `duplicate: true` y no suma puntos.
5. **Correlación:** la fase reportada debe coincidir con la del intento (422) y el intento debe pertenecer al estudiante (404).
6. **Plausibilidad de tiempo:** el tiempo de juego reportado no puede superar el tiempo real transcurrido desde que el servidor creó el intento (+5 s de margen; 422).
7. **Sin puntos tras finalizar:** si el minijuego ya fue finalizado no se crean partidas ni se aceptan resultados (409).
8. **`/api/add-points` es solo de desarrollo y pruebas:** en producción responde 404. Exige `source` válido (paso práctico de la malla) y no completado.
9. **Comunicación WebGL segura:** el build se sirve desde el mismo origen (`client/public/webgl`), Unity publica con `targetOrigin` = su propio origen y `SimulatorView` descarta mensajes que no vengan de su iframe. No hacen falta variables `NEXT_PUBLIC_SIMULATOR_*`.

### Catálogo del Simulador ([`server/config/simulatorCatalog.js`](server/config/simulatorCatalog.js))
Cada uno de los 15 minijuegos de la malla tiene su entrada `{ scene, phase, minSeconds, minigameId, title, ready }`:
* **Módulo 1:** `m1_s1 → Scene1/1`, `m1_s2 → Scene1/2`, `m1_s3 → Scene1/3`, con `ready: true`.
* **Módulos 2–5:** `mN_sK → SceneN/K`, con `ready: false` hasta que su escena esté en el build.
* **`minSeconds`:** 30 en todos; se ajusta con datos reales de juego.

Cuando un minijuego tiene `ready: false`:
* **Práctica:** se muestra «Práctica en desarrollo» y nunca carga Unity.
* **En producción:** `POST /api/simulator/attempts` responde `409` y el paso no se puede finalizar.
* **En desarrollo y pruebas:** la API sí admite partidas, así que los botones de simulación (solo en desarrollo) permiten recorrer el curso completo.

La regla es una función pura, `attemptBlockReason(stepId, { production })`, que la suite 26 prueba en ambos entornos.

### Cómo incorporar el siguiente módulo (proceso repetible)
1. **Videos:** dejar los masters `M0N_V0k_Master_<Tema>.mp4` en la carpeta de masters y ejecutar `scripts/prepare-module-videos.ps1 -Module N -SourceDir <carpeta>`.
2. **Malla:** los pasos del módulo ya existen (6 por módulo). Reemplazar los `null` de `VIDEO_DURATION_SECONDS` en `server/config/curriculum.js` por las duraciones que imprimió el script, y en `client/src/lib/courseConfig.js` poner títulos, descripciones y `videoSrc: '/videos/moduloN/...'`.
3. **Unity:** crear la escena del módulo en el mismo proyecto, añadirla a Build Settings y fijar sus fases (1..3) en `CArmUIController`/escena.
4. **Catálogo:** en `simulatorCatalog.js`, ajustar `scene`, `minigameId` y `title` de cada `mN_sK` y poner `ready: true`.
5. **Build:** en Unity, menú **CArm → Build WebGL para ArcoC** (genera `client/public/webgl`).
6. **Pruebas y documentación:** ejecutar la suite y actualizar este documento. La tarjeta «Preparación del lanzamiento» del panel deja de listar el módulo.

### Atlas Radiológico y Casos Reales AO Trauma
[`SimulatorView.js`](file:///c:/Oscar/ArcoC/client/src/components/SimulatorView.js) incorpora un componente de **Atlas Clínico Intraoperatorio** contextualizado para cada estación de práctica:
* **Módulo 1:** Espectro, 5 densidades radiológicas y signos de fracturas ocultas (lipohemartrosis en codo, escafoides carpiano, Lisfranc).
* **Módulo 2:** Física de dispersión Compton (regla 80-20-2%), distancia de seguridad 2m/3m, cuidado de blindajes plomados y daño en cristalino (ICRP 118).
* **Módulo 3:** Geometría isocéntrica, control 3D intraoperatorio vs 2D y supresión de sobrecarga del ABC ante implantes masivos de osteosíntesis.
* **Módulo 4 (Miembro Inferior):** Posicionamiento en mesa de tracción ortopédica, punto de entrada cefalomedular y mortaja de tobillo a 15°-20° con rotación interna.
* **Módulo 5 (Miembro Superior y Columna):** Posición en silla de playa para húmero, inclinación tangencial de radio distal (11°-15°), control de tornillos dorsales sobre el tendón extensor largo del pulgar (EPL) y penetración en C7-T1.
Los alumnos pueden inspeccionar cualquiera de las referencias en modal de alta resolución directamente antes o durante la simulación técnica.

---

## 7. Examen Final y Reglas de Negocio

El examen final evalúa la competencia global en radioprotección y manejo del equipo.

```mermaid
sequenceDiagram
    autonumber
    actor Estudiante as Estudiante (Browser)
    participant UI as Exam Page
    participant WS as Socket.IO Server
    participant API as Express API
    participant DB as Base de Datos

    Estudiante->>UI: Clic en "Empezar Examen"
    UI->>UI: Enciende la cámara (si falla: aviso y NO se consume intento)
    UI->>API: POST /api/start-exam
    API->>DB: Transacción: exam_attempts +1, exam_in_progress = 1, fija exam_question_ids (10 que no haya visto) y registra el intento en exam_attempts
    API-->>UI: { success, questionCount, attemptsUsed, maxAttempts } (409 si ya aprobó · 403 sin intentos o curso incompleto en prod)
    UI->>API: GET /api/questions
    API-->>UI: Preguntas del intento abierto (409 si no hay intento)

    loop Durante el Examen
        UI->>WS: emit('start_exam') con el primer latido real, luego emit('proctoring_heartbeat') cada 3 s
        Note over WS: Monitor cada 10 s.<br/>Si >15 s sin señal: emit('proctoring_warning')<br/>Si >30 s o 3 ciclos sin rostro / identidad: emit('exam_suspended') y cierra el intento
        opt Comodín 50/50
            UI->>API: POST /api/use-wildcard { question_id }
            API->>DB: Debita 100 pts (solo dentro del intento y sobre sus preguntas)
            API-->>UI: { eliminate_options: ['a', 'c'], reservePoints: 50 }
        end
    end

    Estudiante->>UI: Clic en "Enviar Respuestas"
    UI->>WS: emit('end_exam') (fin de la supervisión)
    UI->>API: POST /api/submit-exam { answers }
    API->>DB: Exige el intento abierto y exactamente sus preguntas; califica contra BD
    API->>DB: Transacción: exam_score = MAX(actual, previo) y cierra el intento
    alt Calificación >= 90%
        API->>DB: INSERT INTO course_progress (module_id = 'exam')
        API-->>UI: Aprobado (Habilita descarga de certificado)
    else Calificación < 90%
        API-->>UI: Reprobado (puede reintentar si attempts < 3)
    end
```

### Reglas Críticas Implementadas:
* **Reglas en un solo lugar:** viven en [`server/config/examRules.js`](server/config/examRules.js) y cambiar un valor ahí actualiza todos los textos.
  * Valores: preguntas por intento (10), nota mínima (90%), intentos (3), costo del comodín (100 puntos) y tamaño del banco oficial (50).
  * Los usan el API, el estándar IES, el certificado, el acta y los correos.
  * `/api/student/me` (y el login) los entrega al frontend en `exam: { questionCount, passScore, wildcardCost, maxAttempts, attemptsUsed, attemptsLeft, inProgress, passed, history }`.
  * `history` es el historial de intentos, sin las preguntas: `{ number, status, score, questionCount, startedAt, finishedAt }`.
* **Sin preguntas repetidas entre intentos ([`server/services/examQuestions.js`](server/services/examQuestions.js)):** cada intento toma primero preguntas que el estudiante no vio en sus intentos anteriores (`exam_attempts.question_ids`).
  * Con el banco oficial de 50, los 3 intentos de 10 (30 preguntas) nunca repiten una.
  * Si el banco no alcanza (un banco menor, o intentos extra que conceda el admin), completa con las vistas hace más intentos.
  * El orden final es aleatorio. La selección es una función pura que la suite 26 prueba con bancos de 5, 25 y 50 preguntas.
* **Intento abierto obligatorio:** `/api/start-exam` abre el intento y fija su set de preguntas. Sin intento abierto, `/api/questions`, `/api/submit-exam` y `/api/use-wildcard` responden `409`. Así no se pueden ver preguntas sin consumir un intento ni enviar exámenes sin pasar por el límite de 3.
* **Set de preguntas fijo por intento:** recargar la página devuelve las mismas preguntas. `/api/submit-exam` exige responder exactamente ese set (no se pueden elegir preguntas) con opciones `a`–`d`, y la respuesta no revela qué preguntas fueron correctas.
* **Costo Inmutable del Comodín 50/50:** Fijado rígidamente en el servidor en **100 Puntos de Reserva**. Cualquier parámetro de costo enviado desde el navegador es descartado. Solo se puede usar dentro del intento y sobre una de sus preguntas.
* **Límite de Intentos:** Máximo **3 intentos**; cada clic en "Empezar Examen" consume uno. Si había uno abierto, el nuevo conserva sus preguntas y el anterior queda como `abandoned` en el historial. Antes de empezar, la página muestra los intentos usados y restantes; sin intentos lo explica y deshabilita el botón, y si se llama a la API igualmente, `/api/start-exam` responde `403`. El inicio corre en una transacción que bloquea la fila del estudiante (PostgreSQL): dos inicios simultáneos no consumen el mismo intento ni superan el límite. Al calificar, el intento queda `submitted` con su nota; si lo cierra el proctoring, `suspended`.
* **Perfil al día:** al iniciar y al enviar el examen, la página vuelve a pedir `/api/student/me`, así que al volver al curso la nota, el estado de aprobación y los intentos restantes son los reales sin recargar.
* **Bloqueo de Reenvío Aprobado:** Si el estudiante ya aprobó, `/api/start-exam` y `/api/submit-exam` responden `409 Conflict`.
* **Malla completa en producción:** `/api/start-exam`, `/api/questions` y `/api/submit-exam` exigen los 30 pasos completados cuando `NODE_ENV=production`.
* **Calificación Atómica:** La evaluación se calcula únicamente en el servidor comparando las respuestas enviadas contra la base de datos. Se emplea `withTransaction` para garantizar que la nota máxima registrada sea `MAX(puntaje_actual, puntaje_previo)`.
* **Errores visibles:** si la API rechaza las preguntas o el inicio (curso incompleto, intentos agotados, sesión vencida, límite de peticiones), la página muestra el mensaje del servidor con opciones para reintentar o volver al curso.
* **Persistencia de Sesión Local:** La UI guarda las respuestas seleccionadas y opciones eliminadas en `sessionStorage` para resistir recargas; al cargar las preguntas del intento descarta las que no le pertenecen.

---

## 8. Sistema de Proctoring Biométrico (WebRTC + WebSockets)

La supervisión remota en tiempo real se orquesta entre [`useProctoring.js`](file:///c:/Oscar/ArcoC/client/src/hooks/useProctoring.js) y el monitor de latidos en [`server.js`](file:///c:/Oscar/ArcoC/server.js).

### Arquitectura de Supervisión
1. **Onboarding:** En `/onboarding`, el alumno captura su rostro. face-api genera un descriptor facial (Float32Array de 128 elementos) que se almacena cifrado en base de datos.
2. **Carga Protegida:** Al iniciar el examen, el cliente consulta `GET /api/student/descriptor` para obtener su descriptor registrado en memoria.
3. **Bucle Local de Detección:** Cada 3 segundos, el Web Worker [`public/workers/proctoringWorker.js`](client/public/workers/proctoringWorker.js) ejecuta `detectSingleFace().withFaceLandmarks().withFaceDescriptor()` sobre un fotograma de la cámara. Si el worker no está disponible, lo hace el hilo principal.
4. **Verificación de Coincidencia:** Se calcula la distancia euclidiana entre el rostro detectado en vivo y el descriptor de referencia:
   $$\text{Distancia} < 0.6 \implies \text{Identidad Confirmada}$$
5. **Heartbeat WebSocket:** Con el primer latido real (cámara y modelos ya listos) el cliente emite `'start_exam'`, que abre la sesión de supervisión en el servidor; después envía `'proctoring_heartbeat'` cada 3 segundos con `{ faceDetected, isMatch }`. Si no hay descriptor registrado para comparar, `isMatch` viaja como `null` (identidad no evaluable, sin penalización). Tras una reconexión del socket se reabre la sesión.
6. **Fin de la supervisión:** al enviar el examen o salir de la página, el cliente emite `'end_exam'`; sin ello, el monitor interpretaría el fin de los latidos como pérdida de señal.

### Librería de Reconocimiento Facial y Modelos
* **Librería:** [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) **1.7.15** (MIT). Es un fork de `face-api.js` y sustituyó a `face-api.js` 0.22.2, sin mantenimiento desde 2020 y basada en TensorFlow.js 1.7. Trae TensorFlow.js 4.22 empaquetado y no tiene dependencias en tiempo de ejecución. Su repositorio está **archivado desde febrero de 2025** y 1.7.15 es la versión final. No hay un fork compatible con mantenimiento activo: el sucesor del mismo autor, `@vladmandic/human`, usa otros modelos y sus descriptores no son compatibles con los ya guardados.
* **Dónde se carga:**
  * **Hilo principal** (enrolamiento en `/onboarding` y respaldo de `useProctoring`): [`src/lib/faceApi.js`](client/src/lib/faceApi.js) importa la librería bajo demanda y solo en el navegador. Un import estático rompe el prerender de Next, porque el TensorFlow.js empaquetado no puede evaluarse en el servidor.
  * **Web Worker:** `proctoringWorker.js` carga con `importScripts` el archivo `public/workers/face-api.min.js`, que es una copia del build IIFE `node_modules/@vladmandic/face-api/dist/face-api.js`. Por eso la versión va fijada, sin `^`, en `client/package.json`. Si la cambias, actualiza la copia (sección 12.6).
* **Modelos** (`public/models/`): TinyFaceDetector, FaceLandmark68Net y FaceRecognitionNet, con los pesos originales de face-api.js. Son idénticos byte a byte a los que trae el paquete en `model/`; la única diferencia es que allí cada modelo va en un solo `.bin` y aquí en shards. El cargador acepta ambos formatos.
* **Backend de TensorFlow.js:** WebGL, el mismo que usaba la versión anterior.
* **Compatibilidad de descriptores:** el descriptor sigue siendo un vector de 128 floats calculado con el mismo modelo, así que los descriptores ya guardados (cifrados) siguen siendo comparables con el umbral de 0,6. En la migración se comparó la versión anterior con la nueva sobre 11 imágenes, en el hilo principal y en el worker real:
  * La distancia entre el descriptor antiguo y el nuevo de una misma imagen fue de 0,067 como máximo, y las distancias entre pares de imágenes cambiaron 0,027 como máximo.
  * Ninguna decisión `< 0,6` cambió en los 90 pares.
  * Con un descriptor registrado por la versión anterior, el worker devolvió los mismos `hasFace` y `match`.
  * En la app real, el enrolamiento por la interfaz produjo un descriptor a 0,001 del que calcula la versión anterior sobre el mismo fotograma.
  * Como referencia, variantes de una misma foto (espejo, más oscura, fotograma de webcam) llegan a 0,26 entre sí.

### Tolerancia y Estados del Monitor en Servidor (Cada 10 segundos)
* **Advertencia Temprana (15 segundos):** Si transcurren más de 15 segundos sin recibir un latido (pero menos de 30s), el servidor emite `'proctoring_warning'`. La interfaz del estudiante despliega un banner de aviso preventivo en la barra lateral para corregir su conexión o postura.
* **Pérdida Crítica de Señal (30 segundos):** Si la desconexión supera los 30 segundos, se suspende el examen de forma permanente emitiendo `'exam_suspended'`, incrementando `proctoring_incidents`, registrando el evento `PROCTORING_EXPIRED` y **cerrando el intento en el servidor** (ya no se puede enviar por la API). El intento se cierra y la incidencia se registra en la base **antes** de avisar al cliente: con PostgreSQL, que escribe de forma asíncrona, el aviso salía primero y el cliente alcanzaba a enviar el examen con el intento abierto.
* **Infracción de Identidad o Ausencia Facial:** Si se detecta ausencia de rostro o discrepancia biométrica, se incrementa un contador de violación (`violationCount`). Se requiere confirmar la infracción durante **3 ciclos continuos (30 segundos)** para suspender el examen definitivamente, previniendo falsos positivos por parpadeos o movimientos rápidos.
* **Detección de Cámaras Virtuales:** El hook inspecciona la etiqueta del dispositivo (`videoTrack.label`). Nombres asociados a OBS, Snap Camera, vCam o software emulador son bloqueados inmediatamente antes de permitir el inicio de la evaluación.

---

## 9. Certificación Digital y Verificación Pública

Al superar la evaluación final con la nota mínima (`EXAM_PASS_SCORE_PERCENT` en `examRules.js`, hoy **90%**), el estudiante se hace acreedor a la constancia académica oficial.

### Generación Dinámica en PDF ([`server/utils/certificate.js`](file:///c:/Oscar/ArcoC/server/utils/certificate.js))
* Construido con **PDFKit** en orientación horizontal (*landscape*), tamaño carta.
* Incluye marcos estilizados en colores institucionales, datos de identificación del estudiante, institución de procedencia (IES u hospital), puntaje final obtenido y fecha formal de emisión en español.
* Se transmite vía *streaming* directo al navegador sin almacenar archivos temporales en el disco duro del servidor.

### Hash Criptográfico y Código de Verificación
Cada certificado cuenta con una firma matemática determinística única:
$$\text{hashInput} = \text{studentId} + \text{"-"} + \text{email} + \text{"-"} + \text{exam\_score} + \text{"-"} + \text{completed\_at}$$
$$\text{VerificationCode} = \text{"CARM-"} + \text{SHA256}(\text{hashInput})[0..12].\text{toUpperCase}()$$

El código se calcula **una sola vez, al aprobar** (`/api/submit-exam`), y se guarda en `course_progress.certificate_code`. El PDF imprime y lleva en el QR **ese código guardado**, sin recalcularlo, así que siempre coincide con lo que valida `/api/verify`. Antes se recalculaba con `completed_at`, que en PostgreSQL vuelve como fecha y no como texto: el PDF mostraba otro código y su QR no validaba. La respuesta del PDF incluye el código en la cabecera `X-Verification-Code`; un registro antiguo sin código lo calcula y lo guarda en su primera descarga.

### Endpoint Público de Verificación
Terceros, empleadores o instituciones auditoras pueden validar la autenticidad de cualquier constancia a través de:
```http
GET /api/verify/CARM-XXXXXXXXXXXX
```
* **Respuesta Exitosa (200 OK):** Retorna validez, nombre del estudiante, institución, fecha de emisión, puntaje y documento de identidad enmascarado por privacidad (`••• 1234`).
* **Respuesta de Código Inválido (404 Not Found):** Informa que el código no corresponde a ningún certificado legítimo emitido por la plataforma.
* **Cuentas de prueba:** el certificado de un estudiante de prueba lleva la marca «CERTIFICADO DE PRUEBA — SIN VALIDEZ» y su código responde `404`, igual que uno inexistente (sección 10.12).

---

## 10. Panel de Auditoría Administrativa (IES) y Gestión de Promociones

El panel administrativo ([`client/src/app/admin/page.js`](file:///c:/Oscar/ArcoC/client/src/app/admin/page.js)) proporciona a los directores de programa, comités curriculares e interventores del Ministerio de Educación y de Instituciones de Educación Superior (IES) una suite integral de supervisión, matriculación y trazabilidad legal:

```mermaid
graph TD
    ADMIN["👤 Administrador / Auditor IES"] -->|POST /api/admin/students<br/>o importación CSV| REGISTER["Matriculación por Promoción<br/>(cuenta pendiente de activación)"]
    REGISTER -->|Enlace de un solo uso| EMAIL_SVC["Cola de correo<br/>(mailer.js + emailService.js)"]
    EMAIL_SVC -->|SMTP| EMAIL_STUDENT["📧 Correo al Estudiante<br/>• Enlace para crear su contraseña<br/>• Fecha de acceso y guía del curso"]
    EMAIL_SVC -->|Estado real y reintentos| EMAIL_LOGS["🗄️ Tabla email_logs<br/>queued · sent · simulated · failed"]
    ADMIN -->|Toda modificación| ACTIONS["🧾 Tabla admin_actions<br/>quién, qué, sobre quién, cuándo y por qué"]

    ADMIN -->|Filtro Reactivo| COHORTS_VIEW["Segmentación de Promociones<br/>(Pestañas + KPIs específicos)"]
    ADMIN -->|GET /api/admin/compliance/:id| AUDIT_MODAL["🔍 Modal de Estándar Institucional IES<br/>Evaluación de 6 Criterios Obligatorios"]
    AUDIT_MODAL --> VERDICT{"¿Cumple los 6 Criterios?"}
    VERDICT -->|Sí| VERDICT_PASS["🟢 CUMPLE EL ESTÁNDAR<br/>Aval IES Listo · Certificado QR Habilitado"]
    VERDICT -->|No| VERDICT_FAIL["🔴 NO CUMPLE EL ESTÁNDAR<br/>Desglose explícito de faltantes"]

    ADMIN -->|GET /api/admin/export-audit| CSV_EXPORT["📊 Exportación CSV Oficial<br/>UTF-8 BOM para Excel · 16 columnas reglamentarias"]
```

### 10.1 Promociones (Cohortes) con Fechas de Acceso
* **Entidad propia (tabla `cohorts`):** nombre único, fecha de inicio (`starts_on`), fecha de cierre (`ends_on`) y descripción. `students.cohort` guarda el nombre, así que renombrar una promoción mueve a sus estudiantes con ella. Gestión en **🗂️ Promociones** del panel (`GET/POST /api/admin/cohorts`, `PATCH /api/admin/cohorts/:id`); cada cambio queda en la bitácora.
* **Ventana de acceso ([`server/services/access.js`](server/services/access.js)):**
  * *Por iniciar*: antes de la fecha de inicio el estudiante no puede iniciar sesión y se le dice desde cuándo.
  * *Abierta*: entre inicio y cierre (ambos días incluidos), o siempre si la promoción no tiene fechas.
  * *Cerrada*: después del cierre entra en **modo consulta**: ve su avance y descarga su certificado, pero el API rechaza con `403 COHORT_CLOSED` el registro de videos, partidas del simulador e intentos de examen. El curso muestra un aviso.
  * Las fechas son de calendario en `APP_TIMEZONE` (por defecto `America/Bogota`). `students.start_date` (opcional) reemplaza el inicio de la promoción para un estudiante concreto; vacía, rige la promoción.
* **Selladas:** una promoción cerrada y sellada (10.8) ya no se edita, no admite matrículas y nadie entra ni sale de ella.
* **Métricas y KPIs Dinámicos:** por promoción, total de matriculados, pendientes de activación, desactivados, estudiantes con Aval IES aprobado ($\ge 90\%$), en instrucción, promedio de calificación e incidentes de integridad. Las promociones sin estudiantes también aparecen.
* **Filtrado Reactivo y Búsqueda:** por promoción, por estado de la cuenta (activas, pendientes de activación, desactivadas: `?status=`) y búsqueda en tiempo real por nombre, correo o documento.

### 10.2 Matrícula (Individual o por CSV) y Correo de Bienvenida
Al registrar a un estudiante (`POST /api/admin/students`, formulario **➕ Registrar Estudiante**):
1. Valida el correo (formato y no duplicado), el tipo de documento y la fecha individual opcional. Si la promoción no existe la crea sin fechas (y lo registra en la bitácora); en una promoción sellada responde `409`.
2. Crea la cuenta **pendiente de activación**: no se define ni se envía ninguna contraseña.
3. Emite un enlace de activación de un solo uso (7 días) y encola el **correo de bienvenida**: enlace para crear la contraseña, usuario, fecha de acceso y la guía del curso (módulos, pasos, minijuegos y Puntos de Reserva, reglas del examen y certificado, todo tomado de `curriculum.js` y `examRules.js`).
4. La respuesta incluye el enlace (`activationUrl`) para el admin: el panel lo muestra en un aviso con **Copiar enlace**, por si el correo no llega o el envío está en modo simulado.

**Importación masiva (📥 Importar CSV, `POST /api/admin/students/import`):** columnas `nombre` y `correo` (obligatorias), `tipo_documento`, `numero_documento`, `institucion`, `promocion` y `fecha_inicio`; separador `;` o `,`, comillas, BOM y cabeceras sin importar tildes ni mayúsculas ([`server/utils/csv.js`](server/utils/csv.js)). Primero valida (`dryRun`, por defecto) y muestra una vista previa con los errores de cada fila: correo inválido, repetido en el archivo, ya registrado, promoción inexistente o sellada. Luego matricula **solo las filas válidas**, en una transacción, y envía a cada una su enlace de activación. Máximo 500 filas por archivo (la ruta acepta cuerpos de hasta 2 MB; el resto del API, 10 kB). Plantilla en `GET /api/admin/students/import/template`.

### 10.3 Gestión de Estudiantes (⚙️ Gestionar)
Cada fila del listado muestra el estado de la cuenta (*Pendiente de activación*, *Desactivada*) y abre una ficha (`GET /api/admin/students/:id`) para:
* **Editar datos y cambiar de promoción** (`PATCH /api/admin/students/:id`): nombre, correo (único), documento, institución, promoción y fecha individual de acceso, con un motivo opcional. No se puede mover a nadie desde o hacia una promoción sellada.
* **Enviar enlace de acceso** (`POST /api/admin/students/:id/access-link`): si la cuenta no está activada, un enlace de activación nuevo; si lo está, uno para restablecer la contraseña. Invalida el anterior, lo envía por correo (`sendEmail: false` para no enviarlo) y se lo muestra al admin para copiarlo.
* **Desactivar** (`POST …/deactivate`, motivo obligatorio): corta el acceso de inmediato, incluidas las sesiones abiertas; no borra nada (avance, intentos e historial se conservan) y deja de recibir recordatorios. **Reactivar** (`POST …/reactivate`) lo devuelve.
* **Historial**: las acciones de los administradores sobre el estudiante y sus correos con el estado de cada uno.

### 10.4 Bitácora de Acciones del Administrador (`admin_actions`)
Toda modificación hecha desde el panel queda registrada con el administrador, la acción, el objetivo (estudiante, promoción o correo), el motivo y el detalle antes → después: crear y editar promociones, matricular (individual o CSV), editar datos, cambiar de promoción, desactivar, reactivar, generar enlaces de acceso, reenviar la guía, enviar recordatorios, reintentar correos y sellar promociones. Se consulta en **🧾 Bitácora de Acciones** (`GET /api/admin/actions`, filtrable por `targetType`/`targetId`) y en la ficha de cada estudiante. Nunca guarda enlaces ni contraseñas.

### 10.5 Correo: Cola, Estados Reales y SMTP ([`server/services/mailer.js`](server/services/mailer.js))
* **Cola persistente en `email_logs`:** cada correo se encola (`queued`) y un proceso del backend lo envía en segundos; si falla, lo reintenta con espera creciente (1, 5, 15 y 60 min) y tras 5 intentos queda `failed`, con el error visible en la bitácora y un botón **Reintentar** (`POST /api/admin/email-logs/:id/retry`).
* **Estados reales:** `sent` (entregado al servidor SMTP), `simulated` (modo sin SMTP: no salió), `queued` y `failed`. La migración 2 marcó como `simulated` los registros anteriores, que decían `sent` aunque ningún correo salía del servidor.
* **Sin secretos en la bitácora:** `body_content` guarda el HTML con los enlaces privados ocultos. El contenido real va cifrado (AES-256-GCM) en `payload_encrypted` y se borra al enviarse. La migración 2 ocultó también las contraseñas temporales que las inducciones anteriores habían guardado en texto plano.
* **Transporte:** `MAIL_TRANSPORT=smtp` con `SMTP_HOST`, `SMTP_PORT` (465 = TLS directo; 587 = STARTTLS), `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`. Sirve para cualquier proveedor (Amazon SES, Brevo, Postmark, Microsoft 365, Google Workspace…). Sin `SMTP_HOST` el modo es `log` (simulado). En producción el arranque avisa si no hay SMTP, y `/api/health` informa `mail: smtp | log`.
* **Plantillas ([`server/services/emailService.js`](server/services/emailService.js)):** bienvenida con enlace de activación (`induction_activation`), guía para cuentas ya activadas (`induction`), restablecimiento de contraseña (`password_reset`) y recordatorio de avance (`progress_reminder`). Los enlaces usan `APP_PUBLIC_URL`.

### 10.6 Evaluación del Estándar Institucional IES (6 Criterios Obligatorios)
Al seleccionar a cualquier estudiante y pulsar **"🔍 Ver Estándar IES"**, la plataforma evalúa en servidor (`GET /api/admin/compliance/:studentId`) el cumplimiento riguroso de los **6 limitantes del estándar de acreditación**:

| Criterio | Código | Condición Reglamentaria | Estado Evaluado |
| :--- | :--- | :--- | :--- |
| **1. Identificación y Biometría** | `STD_BIO_ID` | Documento legal institucional y vector facial de 128 puntos registrado. | `is_onboarded == 1` && `id_number` válido && `face_descriptor` presente. |
| **2. Completitud Curricular** | `STD_CURRICULUM` | Aprobación del 100% de la malla (30 de 30 pasos obligatorios sin saltos). | Pasos completados de `COURSE_STEPS` ≥ `TOTAL_COURSE_STEPS` en `course_progress`. |
| **3. Calificación en Examen** | `STD_EXAM_SCORE` | Nota mínima del 90% en intentos de 10 preguntas (`examRules.js`). | `exam_score >= EXAM_PASS_SCORE_PERCENT`. |
| **4. Límite de Intentos** | `STD_MAX_ATTEMPTS` | Máximo 3 intentos de examen permitidos según reglamento IES. | `exam_attempts <= 3`. |
| **5. Integridad de Supervisión** | `STD_PROCTORING_INTEGRITY` | Tolerancia máxima de 5 incidencias acumuladas de cámara o foco. | `(proctoring_incidents + focus_violations) <= 5`. |
| **6. Emisión Criptográfica QR** | `STD_CRYPTO_CERT` | Código HMAC-SHA256 generado y trazable en base de datos. | Registro `'exam'` con `certificate_code` presente. |

* **Veredicto Institucional Categórico:**
  * 🟢 **CUMPLE EL ESTÁNDAR (Aval IES / Certificación Aprobada):** Habilita la expedición de actas formales y la descarga del certificado oficial en PDF con QR.
  * 🔴 **NO CUMPLE EL ESTÁNDAR:** Despliega una alerta forense con el listado explícito de los requisitos pendientes que el estudiante debe solventar antes de aspirar al aval institucional.

### 10.7 Exportación Oficial para Auditoría Ministerial (CSV)
El endpoint `GET /api/admin/export-audit?cohort=...` genera un archivo descargable con formato estandarizado que incluye:
* Codificación con **UTF-8 BOM (`\uFEFF`)** y delimitador de punto y coma (`;`), asegurando que Microsoft Excel en entornos hispanohablantes abra de forma nativa sin distorsión de tildes o caracteres especiales.
* **16 Columnas Oficiales de Auditoría:** `ID Estudiante`, `Nombre Completo`, `Correo Electrónico`, `Tipo Documento`, `Número Documento`, `Institución Hospitalaria`, `Promoción (Cohorte)`, `Fecha Habilitada Acceso`, `Pasos Curriculares (de 26)`, `Nota Examen (%)`, `Intentos Examen`, `Incidentes de Supervisión`, `Enrolamiento Biométrico`, `Cumple Estándar IES`, `Código Certificado QR` y `Fecha de Certificación`.

### 10.8 Herramientas de Calidad de Vida (QoL) y Auditoría Ministerial / IES
Para satisfacer los más altos estándares de gobernanza académica y simplificar la gestión de directores de programa, se integran cuatro capacidades avanzadas:

#### 1. Acta Colectiva / Libro Oficial de Calificaciones IES (PDF)
* **Endpoint:** `GET /api/admin/cohort-acta/:cohort`
* **Generación Dinámica:** Desarrollado con `PDFKit` y `QRCode`, compila un documento institucional formal de múltiples páginas que incluye:
  * Membrete oficial de la Institución de Educación Superior y Ministerio de Salud/Educación.
  * Resumen estadístico de la cohorte: total de matriculados, número de graduados con aval, tasa de cumplimiento institucional, puntaje promedio y fecha de emisión.
  * Tabla exhaustiva de estudiantes: nombre, documento legal, estado de aprobación/rezago, nota porcentual obtenida, intentos y código criptográfico de certificación.
  * Código QR público escaneable que redirige a la URL de validación institucional.
  * Espacio formal para firmas y sellos del Director Académico, Comité de Radioprotección y Revisoría IES.

#### 2. Cierre y Sellado Criptográfico Inmutable de Promoción
* **Endpoint:** `POST /api/admin/cohorts/:cohort/close`
* **Garantía Forense Anti-Alteración:** Una vez finalizado el ciclo lectivo de una cohorte, el administrador ejecuta el cierre formal. El servidor genera un **Hash SHA-256 inmutable** concatenando los registros curriculares y notas de todos los matriculados junto con un timestamp de cierre, almacenándolo en la tabla `cohort_closures`.
* **Bloqueo de Modificaciones:** Cualquier intento de cerrar nuevamente responde con `409 Conflict`. El panel administrativo exhibe un candado dorado con el sello `Sello SHA-256: [hash]` y la fecha de sellado, imposibilitando la alteración retroactiva de calificaciones ante auditorías externas.

#### 3. Reenvío Inmediato de la Guía de Inducción
* **Endpoint:** `POST /api/admin/resend-email/:studentId`
* **Solución de Soporte Inmediata:** Botón directo en la tabla de estudiantes (**"✉️ Reenviar Guía"**) que reenvía el correo de bienvenida con la fecha de acceso y la guía del curso. Si la cuenta aún no se activó, incluye un enlace de activación nuevo (el anterior deja de servir); si ya se activó, recuerda cómo ingresar y cómo recuperar la contraseña. Nunca incluye contraseñas. Queda en `email_logs` y en la bitácora de acciones; no se envía a cuentas desactivadas.

#### 4. Semáforo de Rezago Académico (+7 Días) y Recordatorio Automatizado
* **Endpoint:** `POST /api/admin/send-reminder/:studentId`
* **Detección Preventiva de Deserción:** El sistema analiza en tiempo real la fecha de habilitación (`start_date`) y la última actividad del alumno. Si han transcurrido más de 7 días sin completar la malla curricular ni aprobar el examen, se asigna automáticamente una insignia de alerta visual: **"⚠️ Rezago (+7d)"**.
* **Acción en 1 Clic:** El administrador dispone del botón **"🔔 Recordatorio"** para despachar un correo institucional motivacional que resume los pasos pendientes para alcanzar el estándar IES y evitar la caducidad de su cupo. Cada envío queda en la bitácora de acciones con el avance del estudiante en ese momento; no se envía a cuentas desactivadas.

### 10.9 Preparación del Lanzamiento ([`server/services/launchReadiness.js`](server/services/launchReadiness.js))
La plataforma sale con los 5 módulos completos y el banco oficial de preguntas. `GET /api/admin/launch-readiness` (solo admin) devuelve `{ ready, checks }`, y cada verificación trae `id`, `label`, `ok`, `detail` y `pending`. Son tres:

| Verificación | Lista para el lanzamiento cuando… | Pendientes |
| :--- | :--- | :--- |
| `videos` | Los 15 videos tienen duración en `VIDEO_DURATION_SECONDS` | Los pasos con `null` |
| `minigames` | Los 15 minijuegos tienen `ready: true` en el catálogo | Los pasos aún no incluidos en el build |
| `question_bank` | El banco tiene al menos 50 preguntas (`count`, `target`) | Avisa si no alcanza para 3 intentos sin repetir |

* **En el panel:** la tarjeta **🚀 Preparación del lanzamiento** (`#launch-readiness`) muestra cada verificación y, con **Ver pendientes**, los pasos que faltan agrupados por módulo. Con todo listo queda en una línea.
* **Al arrancar en producción:** el servidor registra un aviso (`⚠️ Preparación del lanzamiento incompleta → …`) si algo falta.
* **Hoy faltan:** 12 videos y 12 minijuegos (módulos 2 a 5). La base de desarrollo tiene las 5 preguntas iniciales; `npm run seed:questions` carga el banco oficial.

### 10.10 Seguimiento del Avance y Ficha del Estudiante ([`server/services/progressTracking.js`](server/services/progressTracking.js))
El servidor calcula el seguimiento con lo que ya guarda la base: `course_progress`, `simulator_attempts`, `video_views` y `exam_attempts`. Antes el panel calculaba el avance en el navegador y solo con los primeros 100 estudiantes.

**Pestaña «📈 Seguimiento del avance»** (`GET /api/admin/progress?cohort=&search=&status=&alerts=1&page=&limit=`, hasta 200 por página). Usa los mismos filtros del panel y muestra por estudiante:
* **Avance:** pasos completados (de 30), porcentaje y paso actual. Si completó la malla, «Examen final»; si aprobó, «Certificado».
* **Alertas:** ver la tabla de abajo.
* **Una columna por minijuego** (15, agrupadas por módulo):
  * El mejor nivel obtenido: 10 perfecta, 5 intermedia, 0 no aprobada, «—» sin partidas.
  * ✓ si ya lo finalizó.
  * Al pasar el cursor, el detalle: mejor porcentaje, partidas y puntos.
  * El mejor resultado se elige por nivel y luego por porcentaje.
* **Puntos de Reserva.**
* **Última actividad:** la más reciente entre pasos completados, partidas, videos empezados, intentos del examen e ingreso a la plataforma.

El resumen (estudiantes, avance promedio, certificados y cuántos tienen alertas) cubre todo el filtro. «Solo con alertas» acota la lista, no los totales.

**Alertas.** Son avisos para el admin y no envían correos; la bandeja y el refuerzo aprobado por el admin llegan en la Fase 5. Solo aplican a cuentas activas, no certificadas y con la promoción abierta:

| Alerta | Cuándo |
| :--- | :--- |
| 🔑 Sin activar | La cuenta lleva 7 días o más sin activarse |
| 💤 Inactivo | 7 días o más sin actividad; si nunca empezó, se cuenta desde el inicio de su acceso |
| 🐢 Atrasado | Con fechas de promoción, su avance está más de 20 puntos por debajo del esperado según el tiempo transcurrido |
| ⏰ Cierre cercano | La promoción cierra en 7 días o menos |
| 🎮 Minijuego difícil | 3 o más partidas de un minijuego sin aprobar ninguna, y sin haberlo finalizado |
| 📝 Sin intentos de examen | Usó los 3 intentos sin aprobar |

Los umbrales están en `ALERT_RULES` (`progressTracking.js`).

**Ficha del estudiante** (`/admin/estudiantes/:id`, con datos de `GET /api/admin/students/:id/detail`). Se abre desde el nombre en el seguimiento o con **📋 Ficha** en la auditoría. Contiene:
* **Encabezado:** promoción, estado de la cuenta y de la promoción, documento, institución y fechas (matrícula, activación, último ingreso y ventana de acceso).
* **Resumen:** avance, paso actual, puntos, examen y última actividad, más las alertas.
* **Avance por módulo:**
  * Cada video: si lo vio o lo empezó, con fecha.
  * Cada minijuego: si lo finalizó, su mejor nivel, partidas y puntos.
  * **Ver partidas** muestra de cada partida el inicio, el estado, el puntaje, los errores, la dosis, el tiempo, el nivel y los puntos.
* **Examen:** historial de intentos (`exam_attempts`) con estado, nota y respuestas correctas, y el certificado si aprobó.
* **Incidencias de supervisión** (`exam_logs`), **correos** (`email_logs`) y **acciones del admin** sobre el estudiante.
* **Línea de tiempo:** todo lo anterior junto, de lo más reciente a lo más antiguo (hasta 300 eventos).


### 10.11 Modo Revisión del Administrador ([`server/services/preview.js`](server/services/preview.js))
El admin puede recorrer el curso como lo ve un estudiante, para reproducir lo que le reportan. Se entra con **👁️ Ver el curso (revisión)** en el panel o abriendo `/course` con la sesión de admin. Antes, el admin era redirigido al panel.

**En el curso:**
* Todos los pasos y el examen están desbloqueados y marcados «👁️ Revisión».
* Los videos se pueden adelantar y no registran inicio ni visto.
* No hay recorrido guiado ni barra de avance; en su lugar aparece un aviso con **← Volver al panel**.
* El encabezado cambia a **⚙️ Panel admin**.
* `ProtectedRoute` lo permite con `allowAdminPreview`, sin exigir el onboarding al admin.

**En las prácticas:**
* El admin juega cualquier minijuego, sin orden.
* Las partidas quedan registradas con su nivel (útil para reproducir un error), pero no suman Puntos de Reserva.
* No hay botón **Finalizar Práctica**.

**En el examen:** la página muestra las reglas vigentes y explica que no se presenta en este modo. Para probarlo de punta a punta hay que usar un estudiante de prueba.

**En la API**, cuando la petición es del admin:
* `POST /api/progress/:id` y `/start` responden `{ preview: true }` sin escribir nada.
* `POST /api/simulator/attempts` omite las verificaciones de secuencia y de minijuego finalizado. En producción, un minijuego que aún no está en el build sigue sin admitir partidas.
* El resultado de la partida se guarda con 0 puntos, sin entrada en `exam_logs`, y responde `preview: true`.
* `/api/start-exam`, `/api/questions`, `/api/submit-exam` y `/api/use-wildcard` responden `403` con `code: 'PREVIEW_MODE'`. Antes nada impedía que el admin presentara el examen.


### 10.12 Estudiantes de Prueba ([`server/services/testStudents.js`](server/services/testStudents.js))
Son cuentas para que el admin reproduzca lo que reporta un estudiante, por ejemplo para presentar el examen de punta a punta, cosa que el modo revisión no permite.

**Cómo se crean:**
* Al matricular, marcando **🧪 Estudiante de prueba** (`POST /api/admin/students` con `isTest: true`).
* Marcando una cuenta existente en **⚙️ Gestionar** (`PATCH /api/admin/students/:id` con `isTest`). El cambio queda en la bitácora.
* La cuenta se activa con su enlace, igual que cualquier otra. Se guarda en `students.is_test` (migración 4).

**Qué no cuentan:**
* Los indicadores del panel. La tabla los muestra con la marca **🧪 Prueba** y el total aclara «+N de prueba».
* El resumen del seguimiento (`summary.testStudents` dice cuántos se dejaron fuera).
* Las métricas de las promociones.
* El acta colectiva, el CSV de auditoría y el sello de la promoción.

**Certificados:** su certificado lleva la marca «CERTIFICADO DE PRUEBA — SIN VALIDEZ» y su código no se valida en `/api/verify/:code`.

**Herramientas de prueba** (en **⚙️ Gestionar**, solo para estas cuentas). Con un estudiante real responden `409 NOT_A_TEST_STUDENT`. Cada uso queda en la bitácora con su motivo:

| Herramienta | Endpoint | Efecto |
| :--- | :--- | :--- |
| ↺ Reiniciar | `POST /api/admin/students/:id/test-tools/reset` | Queda como recién matriculado: sin avance, partidas, videos, intentos del examen, registros de examen ni puntos |
| ⤳ Llevar a un paso | `.../test-tools/jump` `{ stepId }` | Reinicia y marca como completados los pasos anteriores a `stepId`. Con `'exam'`, la malla completa. Los minijuegos quedan finalizados sin partidas |
| ⎘ Copiar su estado | `.../test-tools/copy-from` `{ sourceStudentId \| sourceEmail }` | Reinicia y copia de otro estudiante sus pasos, partidas, videos empezados, intentos del examen, puntos y contadores de supervisión |

Al copiar el estado de otro estudiante:
* No se copia el código del certificado. Si el origen aprobó, la cuenta de prueba queda aprobada, pero sin un código verificable.
* Un intento del examen que estaba abierto se copia como abandonado.
* El estudiante de origen no cambia.

---

## 11. Seguridad, Criptografía y Anti-Fraude

### Capas de Blindaje Técnico

| Vector de Ataque | Mitigación Implementada |
| :--- | :--- |
| **Robo de Sesión (XSS / Token Theft)** | Tokens JWT resguardados exclusivamente en cookies con directiva `HttpOnly`. No accesibles mediante `document.cookie`. |
| **Fuerza Bruta en Autenticación** | `rateLimiter` en `/api/login` restringido a 10 intentos fallidos por ventana de 15 minutos por dirección IP. |
| **Ataque de Denegación de Servicio (DoS)** | Limitador global de 200 peticiones cada 15 min **por estudiante autenticado** (sin sesión, por IP; `TRUST_PROXY` detrás de un proxy) y límite de tamaño en bodies JSON fijado en `10kb`. |
| **Descarga de Contenido sin Sesión** | [`client/src/proxy.js`](client/src/proxy.js) exige la sesión también para `/videos`, `/webgl`, `/documents` e `/images` de `client/public`: un recurso cargado por la página recibe `401` y abrir un archivo en la pestaña lleva a `/login`. `next.config.mjs` los marca `Cache-Control: private` para que ninguna caché compartida los entregue. El backend ya no publica `ArcoC/public` (allí están las fuentes Markdown de las lecturas): es solo API. |
| **Sesión con Secreto Desconocido** | El proxy valida la cookie con el `JWT_SECRET` del backend; si falta en el entorno del frontend rechaza todo (antes usaba un secreto de respaldo conocido que permitía falsificar el acceso a las páginas). |
| **Avance sin Ver los Videos** | Además del bloqueo de adelanto en el navegador, en producción la API exige que desde el primer *play* haya pasado el tiempo mínimo de visualización (ver sección 5). |
| **Resultados Falsos del Simulador** | Puntos decididos en el servidor, tope de 50 por minijuego, duración mínima real de 30 s por partida en producción, coherencia de fase y tiempo, e idempotencia (ver sección 6). |
| **Inyección de Cabeceras / Clickjacking** | Configuración estricta de `Helmet` con políticas CSP, `X-Frame-Options: SAMEORIGIN` y `X-Content-Type-Options: nosniff`. |
| **Copia de Contenido a Modelos de IA** | Trampa de *Prompt Poisoning* mediante `poison_text` inyectado con atributos `aria-hidden` que desorienta a LLMs en caso de copia directa. |
| **Fuga de Foco en Examen** | Monitoreo en cliente de eventos `visibilitychange` y `window.blur`. Si el usuario abandona la pestaña, se superpone un telón de advertencia y se registra un incidente `FOCUS_LOSS`. |
| **Filtración de Datos Biométricos** | Módulo [`crypto.js`](file:///c:/Oscar/ArcoC/server/utils/crypto.js) cifra el vector facial con **AES-256-GCM** (clave derivada de 256 bits y vector de inicialización de 96 bits). |
| **Ejecución de Reset en Ambientes No-Test** | El endpoint de mantenimiento `/api/test-reset` exige la cabecera `x-test-secret` validada contra `TEST_RESET_SECRET` y se remueve por completo en compilaciones de producción. |

---

## 12. Infraestructura, Docker y Despliegue

La solución está preparada para despliegues contenerizados mediante Docker y Kubernetes:

### 1. Variables de Entorno del Backend (`.env`)
```bash
PORT=5000
NODE_ENV=development # 'production' al publicar
JWT_SECRET=supersecret1234567890supersecret_dev_only # Mínimo 32 caracteres
ALLOWED_ORIGINS=http://localhost:3000
TEST_RESET_SECRET=test-reset-secret-local
# Opcional para nube:
# DATABASE_URL=postgresql://usuario:pass@host:5432/carm_master?sslmode=require
# DATABASE_SSL=require            # SSL hacia PostgreSQL si la URL no trae sslmode: disable | require | no-verify (por defecto)
# BIOMETRIC_ENCRYPTION_KEY=clave_de_32_bytes_para_aes_256_gcm
# Detrás de un proxy inverso (nginx, balanceador, gateway de Docker): número de saltos de confianza
# TRUST_PROXY=1
# Otro archivo SQLite (p. ej. una base desechable para pruebas); por defecto ./database.sqlite
# SQLITE_PATH=./database.sqlite
# Retención de exam_logs en días; sin definir o 0 se conservan siempre (evidencia de auditoría)
# EXAM_LOG_RETENTION_DAYS=0

# URL pública del frontend para los enlaces de los correos (activación, restablecimiento, ingreso)
APP_PUBLIC_URL=http://localhost:3000
# Zona horaria de las fechas de acceso de las promociones
# APP_TIMEZONE=America/Bogota

# Correo (sección 10.5). Sin SMTP_HOST los correos quedan "simulated" (no salen).
# SMTP_HOST=smtp.proveedor.com
# SMTP_PORT=587                   # 465 = TLS directo; 587 = STARTTLS
# SMTP_SECURE=                    # true/false; por defecto true solo con el puerto 465
# SMTP_USER=usuario
# SMTP_PASS=contraseña
# MAIL_FROM="C-Arm Master <no-reply@midominio.com>"
# MAIL_TRANSPORT=smtp             # smtp | log (fuerza el modo)
# MAIL_QUEUE_INTERVAL_MS=10000    # cada cuánto revisa la cola
```
El límite global de la API (200 solicitudes / 15 min en producción) se cuenta **por estudiante autenticado** y, sin sesión, por IP. Así los estudiantes que comparten la red de un hospital no agotan un cupo común. Detrás de un proxy define `TRUST_PROXY` para que la IP sea la del cliente.

### 2. Variables de Entorno del Frontend (`client/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_ENABLE_MOCK_CAMERA=false # Estrictamente false en producción
JWT_SECRET=<el mismo valor que el backend> # Obligatorio: src/proxy.js valida la sesión de las páginas del curso y del contenido protegido
```
Sin el mismo `JWT_SECRET`, el proxy de Next rechaza la cookie: toda ruta protegida redirige a `/login` y el contenido del curso (videos, build WebGL, PDF, imágenes) responde `401`, aunque el login responda 200. Si la variable falta, el proxy registra un error y rechaza todo; ya no usa un secreto de respaldo. En Docker, `docker-compose.yml` se lo pasa al servicio `frontend` en tiempo de ejecución.

### 3. Docker Compose
El archivo [`docker-compose.yml`](file:///c:/Oscar/ArcoC/docker-compose.yml) compila e interconecta, con `ArcoC/` como contexto de build:
* **carm-db:** PostgreSQL 16. El backend se conecta por la red interna **sin SSL** (`DATABASE_SSL=disable`, valor por defecto en el compose). Antes intentaba SSL y no podía arrancar contra este contenedor («The server does not support SSL connections»). Con una base externa define `DATABASE_SSL=require` o `sslmode` en `DATABASE_URL`.
* **carm-backend:** basado en `Dockerfile.backend` (Node.js Alpine). Instala solo las dependencias de producción del backend con `npm ci --omit=dev --workspaces=false`: el workspace `client` queda fuera aunque `client/` llegue al contexto.
* **carm-frontend:** basado en `Dockerfile.frontend`, un build multi-etapa de Next.js. Instala el workspace con `npm ci --workspace=client` desde el `package-lock.json` de `ArcoC/`, el mismo que usan el desarrollo y las pruebas E2E. La salida `standalone` conserva la estructura del workspace (raíz en `/app`, la app en `client/`), así que la imagen arranca con `node client/server.js`.
* **`.dockerignore`:** deja fuera del contexto los `node_modules` y el `.next` del host, los `.env*` y las bases SQLite. Las dependencias se instalan dentro de la imagen y los secretos llegan en tiempo de ejecución.

### 4. Healthchecks y Graceful Shutdown
* Rutas `/health` y `/api/health` disponibles para balanceadores de carga y sondas de liveness/readiness. Informan además `database` (`sqlite` | `postgresql`) y `schemaVersion` (última migración aplicada).
* El proceso captura señales `SIGTERM` y `SIGINT`, cierra las conexiones HTTP y los sockets activos de proctoring, y con `closeDb()` escribe SQLite en disco de inmediato (o cierra el pool de PostgreSQL) antes de finalizar. Los scripts de `server/scripts/` también terminan con `closeDb()`: antes, el guardado diferido de SQLite (500 ms) podía perderse al salir y el pool de PostgreSQL dejaba el proceso abierto.

### 5. Contenido Multimedia y Build WebGL del Simulador
Los videos definitivos y el build de Unity son artefactos pesados: **no se versionan en git** (ver `.gitignore`) y se generan localmente antes de construir la imagen del frontend. `Dockerfile.frontend` copia `client/` (`.dockerignore` solo excluye `node_modules`, `.next` y los `.env*`), así que quedan incluidos en la imagen y Next.js los sirve desde el mismo origen que la plataforma, solo a estudiantes con sesión y con caché privada (ver sección 11).

* **Videos** (`client/public/videos/moduloN/`): requieren `ffmpeg` (`winget install Gyan.FFmpeg`).
  ```powershell
  .\scripts\prepare-module-videos.ps1 -Module 1 -SourceDir "C:\Oscar\Src_arcoenc\Video\Master"
  ```
  Genera H.264 1080p (~4 Mbps, CRF limitado) + AAC 160 kbps con *faststart* (el índice va al inicio y la reproducción arranca sin descargar el final). Para el módulo 1: 86,7 / 103,4 / 90,2 MB frente a 234 / 283 / 244 MB de los masters. Al final imprime las duraciones para copiarlas en `VIDEO_DURATION_SECONDS` (`server/config/curriculum.js`).
* **Build WebGL** (`client/public/webgl/`): abrir `Simulador_ArcoEnC_M01` (carpeta del monorepo) con **Unity 6000.6.10f1** (versión estándar del proyecto, con el módulo Web) y usar el menú **CArm → Build WebGL para ArcoC**, o por línea de comandos:
  ```powershell
  & "C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe" -batchmode -nographics -quit `
    -projectPath .\Simulador_ArcoEnC_M01 -buildTarget WebGL `
    -executeMethod CArmSimulator.EditorTools.ArcoCWebGLBuilder.BuildBatch -logFile build.log
  ```
  Usa la plantilla `Assets/WebGLTemplates/CArmEmbed` (canvas a pantalla completa y puente de mensajes con la plataforma). La compresión WebGL está desactivada, así que no se requieren cabeceras `Content-Encoding` especiales.
* Si prefieres versionarlos, usa Git LFS: GitHub rechaza archivos de más de 100 MB.
* **Banco oficial de preguntas:** una base nueva arranca con 5 preguntas de muestra. En producción hay que cargar las 50 oficiales una vez con `npm run seed:questions`; el script reemplaza el banco, así que no debe correrse con exámenes en curso. La tarjeta de preparación del lanzamiento (sección 10.9) y el aviso al arrancar lo verifican.
* El lint del cliente (`npm --workspace=client run lint`) no analiza el build WebGL (`client/public/webgl/**`) ni los bundles minificados de terceros (`client/public/**/*.min.js`, como `workers/face-api.min.js`): no son código del proyecto. Ver `globalIgnores` en `client/eslint.config.mjs`.

### 6. Dependencias npm y Alertas de Seguridad (Dependabot)
Versiones clave: **Next.js 16.4.6** (con `eslint-config-next` 16.4.6), **React 19.2.8** y **@vladmandic/face-api 1.7.15**. En Next 16, la versión 16.4.1 corrige las alertas críticas y altas, y la 16.4.5 las moderadas. La serie 16.3 no recibió esos parches: su última versión, la 16.3.8, sigue afectada.

GitHub (Dependabot) revisa **tres** lockfiles en `ArcoC/`, y cada uno se instala por separado:

| Lockfile | Lo usa | Contenido |
| :--- | :--- | :--- |
| `package-lock.json` | `npm install` en `ArcoC/` (desarrollo y pruebas E2E), `Dockerfile.backend` y `Dockerfile.frontend` | Backend Express y el workspace `client` (frontend Next.js) |
| `public/documents/package-lock.json` | `convert.js` (compilación de las lecturas a PDF) | `md-to-pdf` y `puppeteer` |
| `scripts/pg-test/package-lock.json` | `npm run test:pg` (la suite E2E sobre un PostgreSQL 16 desechable; lo instala solo la primera vez) | `embedded-postgres` |

* **El frontend no tiene lockfile propio.** `client/` es un workspace: sus dependencias se instalan y actualizan desde `ArcoC/` (por ejemplo, `npm install <paquete> --workspace=client`), y `Dockerfile.frontend` las instala del mismo lockfile con `npm ci --workspace=client`. Dentro de `client/`, npm también trabaja sobre el workspace raíz (`npm prefix` devuelve `ArcoC/`).
* **Reconocimiento facial: `@vladmandic/face-api` 1.7.15, con la versión fijada.** No tiene dependencias en tiempo de ejecución, así que ya no arrastra `node-fetch` ni necesita `overrides`. Sustituyó a `face-api.js` 0.22.2, cuyo `@tensorflow/tfjs-core` 1.7.0 fijaba `node-fetch ~2.1.2`, una versión vulnerable (ver sección 8). Ten en cuenta dos cosas:
  * `npm audit` no ve el TensorFlow.js 4.22 que va empaquetado. En la revisión periódica, consulta a mano los avisos de `@tensorflow/tfjs-core`.
  * El worker usa una copia del build en `client/public/workers/face-api.min.js`. Si cambias la versión (`npm install @vladmandic/face-api@<versión> --save-exact --workspace=client`), actualiza también la copia (desde `ArcoC/`):
    ```powershell
    Copy-Item node_modules\@vladmandic\face-api\dist\face-api.js client\public\workers\face-api.min.js
    ```
  El repositorio del fork está archivado y 1.7.15 es su versión final. Si aparece un fork mantenido que conserve los mismos modelos y el descriptor de 128 valores, conviene migrar a él.
* **Revisión periódica:** `npm audit` en `ArcoC/`, y en `public/documents/` y `scripts/pg-test/` (`npm audit --package-lock-only`). Prefiere `npm audit fix` y versiones menores o de parche. Antes de un salto mayor, lee sus notas; para Next, la guía de `node_modules/next/dist/docs/` (ver `client/AGENTS.md`).

### 7. Requisitos de Infraestructura: Servidor, Dominio y Correo
Guía para elegir proveedores con la arquitectura actual: un solo servidor con Docker (PostgreSQL, API Express y Next.js detrás de un proxy inverso con HTTPS), contenido del curso servido solo con sesión, proctoring por WebSocket y correo por SMTP. Precios y condiciones se verifican al contratar.

**Bases del dimensionamiento (medidas en el proyecto):**
* **Videos:** el módulo 1 (3 videos, unos 9,5 min, H.264 a ~4 Mbps) ocupa unos 280 MB. Con los 5 módulos de 3 videos y duraciones parecidas: unos **1,4 GB**.
* **Simulador:** build WebGL de **51 MB** sin comprimir; con Brotli en el proxy baja mucho. Modelos de reconocimiento facial: 7 MB. Imágenes y PDF: 13 MB.
* **Tráfico por estudiante que completa el curso:**
  * Entre **1,5 GB** (cada video visto una vez) y **3 GB** (visto dos veces), simulador incluido.
  * 100 estudiantes al mes ≈ 150–300 GB; 500 ≈ 0,75–1,5 TB.
* **Ancho de banda:** cada persona viendo video usa ~4 Mbps. 50 a la vez ≈ 200 Mbps; 200 a la vez ≈ 800 Mbps.
* **Correo:** de 5 a 10 por estudiante en todo el curso (bienvenida, recuperación, recordatorios). Son menos de 1.000 al mes aun con varias promociones.
* **Carga del servidor:**
  * Lo pesado es servir video.
  * El examen envía un latido por WebSocket cada 3 s por estudiante.
  * La detección facial corre en el navegador, no en el servidor.
* **Datos sensibles:** la base guarda el descriptor facial de cada estudiante (`students.face_descriptor`). Es un dato biométrico, sensible según la Ley 1581 de 2012. El disco y los respaldos deben ir cifrados y el acceso al servidor debe ser restringido.

#### Servidor
| | Mínimo (piloto, ~50 usuarios simultáneos) | Recomendado (producción, ~200 simultáneos y varias promociones) |
| :--- | :--- | :--- |
| **Tipo** | VPS o máquina en la nube con Linux (Ubuntu LTS 24.04 o 26.04), acceso root y Docker | Igual, con snapshots automáticos y opción de crecer sin migrar |
| **CPU / RAM** | 2 vCPU / 4 GB | 4 vCPU / 8 GB |
| **Disco** | 60 GB SSD, cifrado | 160 GB NVMe, cifrado (imágenes Docker, registros, respaldos locales y contenido nuevo) |
| **Tráfico mensual incluido** | 1 TB | 3–5 TB, o videos en un CDN (ver nota) |
| **Red** | IPv4 fija, puerto de 1 Gbps | Igual |
| **Base de datos** | PostgreSQL 16 en el mismo servidor (contenedor), con codificación **UTF8** | PostgreSQL 16 administrado (respaldos automáticos y restauración a un punto en el tiempo), o en el servidor con respaldos verificados |
| **Respaldos** | Base de datos fuera del servidor cada día, cifrada, con 7 días de retención. Contenido (videos, WebGL) al publicarlo | Diarios (30 días) más semanales; prueba de restauración cada trimestre |
| **Ubicación** | Latencia baja desde Colombia (menos de 100 ms): EE. UU. Este/Sur o una región en Sudamérica | Igual, en un país con protección de datos adecuada según la SIC (consultar su lista vigente) o con autorización expresa de los estudiantes. Acuerdo de tratamiento de datos (DPA) firmado |
| **Disponibilidad** | — | SLA de 99,9 % o más y un monitor de disponibilidad con alertas |
| **Entornos** | Solo producción | Producción y *staging*: otro servidor de 2 vCPU / 4 GB, o el mismo con un subdominio y una base aparte |

**Nota sobre el CDN:** hoy los videos los sirve la aplicación tras comprobar la sesión. Para servirlos desde un CDN hacen falta URLs firmadas, lo que requiere cambios en el código. Conviene planearlo si se esperan más de ~100 personas viendo video a la vez.

**Requisitos excluyentes del proveedor (si no los cumple, no sirve):**
1. **Procesos Node.js permanentes y WebSockets** (Socket.io del proctoring). Esto descarta el *hosting compartido* (cPanel/PHP) y las plataformas solo de archivos estáticos.
2. **Docker y disco persistente** para la base de datos y el contenido.
3. **Dominio propio con HTTPS:** los navegadores solo permiten usar la cámara (registro biométrico y proctoring) en sitios seguros.
4. **Salida a los puertos SMTP 587/465** hacia el proveedor de correo. Algunos proveedores la bloquean en cuentas nuevas: hay que confirmarla o pedir el desbloqueo.

**Configuración del servidor (no depende del proveedor):**
* Proxy inverso (Caddy o Nginx) con:
  * certificado automático;
  * WebSockets habilitados en `/socket.io`;
  * paso de las cabeceras `Range` para adelantar y retomar videos;
  * compresión (Brotli o gzip);
  * tipo MIME `application/wasm` para el simulador.
* Cortafuegos que solo deje abiertos los puertos 80, 443 y SSH (SSH con llave, sin contraseña).
* Actualizaciones automáticas de seguridad del sistema.
* Reloj sincronizado (NTP): las sesiones vencen y las promociones abren y cierran por fecha.

**Pendiente antes de producción:** los Dockerfiles usan `node:20-alpine`, sin soporte desde abril de 2026. El desarrollo y el CI ya corren en Node 26 (CI: `lts/*`), así que las imágenes deben pasar a esa misma versión.

**Preguntas para el proveedor de servidor:**
* ¿Permite Docker y procesos Node.js permanentes con WebSockets?
* ¿Cuánto tráfico mensual incluye y cuánto cuesta el excedente? ¿Qué velocidad tiene el puerto?
* ¿Permite conexiones salientes a los puertos 587 y 465?
* ¿Ofrece snapshots o respaldos automáticos? ¿En qué región se guardan?
* ¿En qué país están los centros de datos? ¿Firma un acuerdo de tratamiento de datos?
* ¿Qué SLA ofrece y cómo es el soporte (idioma, horario, canales)?

**Tipos de proveedor que suelen cumplirlo:** VPS en la nube (por ejemplo DigitalOcean, Akamai/Linode, Vultr, Hetzner o AWS Lightsail) o máquinas de nube pública (AWS, Azure, Google Cloud). El hosting compartido tradicional no sirve.

#### Dominio y DNS
| | Mínimo | Recomendado |
| :--- | :--- | :--- |
| **Dominio** | Uno propio (`.co`, `.com`) o un subdominio institucional (p. ej. `cursos.institucion.edu.co`) | Igual, con renovación automática, bloqueo de transferencia y 2FA en el registrador |
| **DNS** | Registros A/AAAA, CNAME y TXT editables | Además DNSSEC, registro CAA (que solo Let's Encrypt emita certificados) y TTL configurable |
| **Subdominios** | `cursos.` para la plataforma | Además `staging.` para pruebas y uno dedicado al envío de correo (p. ej. `notificaciones.`) |
| **Certificado** | Let's Encrypt automático (Caddy o Nginx) | Igual, con aviso si falla la renovación |

La plataforma y el API deben quedar en el **mismo dominio**, con `/api` y `/socket.io` detrás del proxy inverso: la sesión es una cookie que también valida el frontend. Si el dominio es institucional, el área de TI debe poder crear los registros SPF, DKIM y DMARC que pida el proveedor de correo.

#### Correo transaccional
| | Mínimo | Recomendado |
| :--- | :--- | :--- |
| **Envío** | Relevo SMTP con usuario y contraseña (STARTTLS 587 o TLS 465), que es lo que la plataforma ya usa | Además API HTTPS y *webhooks* de entrega, rebote y queja. Así la bitácora podría mostrar «entregado» o «rebotado»; hoy solo muestra «enviado» |
| **Autenticación del dominio** | SPF y DKIM del dominio remitente, y DMARC en `p=none` | DMARC alineado, que pasa a `quarantine` o `reject` tras un tiempo de monitoreo, y dominio de rebote (*return-path*) propio |
| **Remitente** | `no-reply@` de un dominio propio verificado | Subdominio dedicado al envío, que separa su reputación del correo de las personas |
| **Volumen** | Menos de 1.000 correos al mes: los planes gratuitos o de entrada suelen alcanzar | Margen para picos de matrícula masiva (p. ej. 500 en un día) y límites por minuto conocidos |
| **Entregabilidad** | IP compartida con buena reputación | Reputación comprobada hacia Microsoft 365/Exchange y Google Workspace (hospitales y universidades), lista de supresión y métricas por mensaje |
| **Registros** | Historial de envíos de 7 días o más | 30 días o más, con búsqueda por destinatario |
| **Cumplimiento** | Política de privacidad pública | Acuerdo de tratamiento de datos, certificaciones (ISO 27001 o SOC 2) y ubicación de los datos conocida |
| **Operación** | 2FA en la cuenta | Credenciales separadas para *staging* y producción, modo de prueba (*sandbox*) y soporte en español |

**Proveedores transaccionales que suelen cumplir el mínimo:** Amazon SES, Brevo, Postmark, Mailgun, SendGrid o Resend.

Microsoft 365 y Google Workspace restringen el SMTP con usuario y contraseña (exigen OAuth2 o contraseñas de aplicación) y tienen límites diarios bajos. Sirven, a lo sumo, para un piloto pequeño; para producción conviene un proveedor transaccional.

**Qué entregar para activar el correo en la plataforma:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` y la URL pública (`APP_PUBLIC_URL`). Ver la sección 10.5.

---

## 13. Suite de Pruebas Automatizadas (Playwright)

El proyecto cuenta con un conjunto integral de **112 pruebas E2E automatizadas** organizadas en **29 suites especializadas** ejecutadas con Playwright, sobre SQLite y sobre PostgreSQL. Cubre tanto los flujos nominales de certificación como pruebas de caos, penetración, fuzzing de payloads, condiciones de carrera, resiliencia extrema, los dos grandes recorridos completos de usuario (estudiante en una sola sentada y aprendizaje espaciado en múltiples sesiones), la supervisión administrativa por promociones con evaluación del estándar institucional y el conjunto de herramientas de calidad de vida (QoL) y gobernanza ministerial:

```bash
# Ejecutar todas las 29 suites E2E (112 pruebas) sobre la base de desarrollo (SQLite)
npx playwright test

# La misma suite sobre un PostgreSQL 16 desechable (sin Docker; detén antes los servidores de desarrollo)
npm run test:pg
npm run test:pg -- tests/e2e/22-base-platform-and-postgres-parity.test.js

# Ejecutar la integración del módulo 1 (malla, videos y contrato con el simulador)
npx playwright test tests/e2e/19-module1-simulator-integration.test.js

# Ejecutar las herramientas de auditoría QoL y sellado criptográfico
npx playwright test tests/e2e/18-admin-qol-and-audit-tools.test.js

# Ejecutar la suite de administración por promociones y estándar IES
npx playwright test tests/e2e/17-admin-cohorts-and-compliance.test.js

# Ejecutar el recorrido completo de estudiante en una sola sentada
npx playwright test tests/e2e/15-student-single-sitting-flow.test.js

# Ejecutar el recorrido de aprendizaje espaciado (intervalos de 3 días)
npx playwright test tests/e2e/16-student-spaced-interaction-flow.test.js
```

**Base de datos para la suite:** basta con una BD recién creada con `npm run seed`, que crea al administrador. Los estudiantes de prueba los crea `POST /api/test-reset` cuando se necesitan (`server.js`, solo fuera de producción). Un estudiante recién creado queda en el mismo estado que uno existente reiniciado: onboarding completo, 150 Puntos de Reserva y sin progreso ni intentos de examen. Las pruebas que necesitan otro punto de partida lo piden explícitamente: los recorridos 15 y 16 empiezan con `is_onboarded: 0` y `reserve_points: 0`. Así, la primera pasada sobre una BD nueva da el mismo resultado que las siguientes. No hay un script para sembrar estudiantes: se retiraron `npm run seed:student` y `npm run clear`, que apuntaban a archivos inexistentes. La corrida sobre PostgreSQL y el CI agregan `npm run seed:questions` (banco oficial con ids 1–50). La base de desarrollo acumula estudiantes de cada corrida (las suites 23 y 24 crean los suyos con correos únicos) y el listado del admin trae los 100 más recientes: por eso las pruebas buscan a un estudiante por correo y no por su posición en la lista.

**Tamaño del banco de preguntas:** la prueba de intentos sin repetir de la suite 26 lee el tamaño del banco desde `/api/admin/launch-readiness` y espera solo las repeticiones inevitables. Con el banco oficial (CI y `npm run test:pg`), los 3 intentos no comparten ninguna pregunta. Con las 5 preguntas iniciales de una base local, cada intento repite todas, que es lo correcto.

**Capturas de los recorridos 15 y 16:** se guardan en `tests/screenshots/`, que git ignora. Las de `public/screenshots/student-journey/` (versionadas, del recorrido anterior) ya no se modifican en cada corrida. Para renovarlas hay que pedirlo:
```powershell
$env:UPDATE_PUBLIC_SCREENSHOTS = '1'; npx playwright test tests/e2e/15-student-single-sitting-flow.test.js tests/e2e/16-student-spaced-interaction-flow.test.js
```

### Pruebas sobre PostgreSQL (`npm run test:pg`)
[`scripts/pg-test/run-e2e.mjs`](scripts/pg-test/run-e2e.mjs) levanta un **PostgreSQL 16 desechable** con el paquete `embedded-postgres` (la primera vez lo instala en `scripts/pg-test/node_modules`; no requiere Docker ni instalar nada en el sistema). Luego crea una base vacía, aplica migraciones y seeds (administrador y banco de 50 preguntas), corre Playwright con `DATABASE_URL` apuntando a ella y al terminar lo borra todo. Con `TEST_DATABASE_URL` usa otra base en lugar de levantar una.
* Los servidores de desarrollo deben estar detenidos: con `DATABASE_URL` definida (y en CI), `playwright.config.js` nunca reutiliza servidores ya abiertos, que usarían la base SQLite de desarrollo.
* Va en una carpeta aparte, con su propio `package.json`, para no sumar los binarios de PostgreSQL a las dependencias de la aplicación ni a sus imágenes Docker.
* La base se crea en UTF8 (como en producción) y su contraseña se genera al azar en cada ejecución: no hay credenciales fijas en el repositorio (GitGuardian marcaba la anterior, `postgres/postgres`).

### Integración Continua ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
En cada push a `main` y en cada pull request:
* **Lint del cliente** (`npm --workspace=client run lint`).
* **E2E sobre SQLite** (base nueva en el runner, con seeds) y **E2E sobre PostgreSQL** (`npm run test:pg`), en paralelo. Si fallan, se suben los artefactos de `test-results` (trazas de los reintentos).
* Las variables del workflow son exclusivas de prueba, no secretos de producción. Las pruebas que necesitan los videos definitivos o el build WebGL se omiten solas porque esos archivos no están en git.

### Matriz de Cobertura de Pruebas (96 Tests / 25 Suites)

Las reglas que dependen del tiempo real (visualización mínima de videos y duración mínima de partidas) solo rigen con `NODE_ENV=production`, por eso no entran en esta suite, que corre en desarrollo. Se verifican arrancando la API en producción: un video sin inicio o completado de inmediato responde `403`, un resultado instantáneo `422`, y el uso legítimo se acepta (video a los 75 s, partida de 32 s).

| Suite | Archivo de Prueba | Escenarios Validados |
| :--- | :--- | :--- |
| **01** | **`01-course.test.js`** | Carga correcta del dashboard del curso tras login y verificación de landing page pública. |
| **02** | **`02-simulator.test.js`** | Partida simulada en la página de práctica (resultado igual al que reporta Unity) y acreditación de 10 Puntos de Reserva decidida por la API. |
| **03** | **`03-exam-locked.test.js`** | Bloqueo estricto del examen si el navegador no cuenta con acceso a una cámara web funcional. |
| **04** | **`04-exam-flow.test.js`** | Flujo completo de evaluación: inicio, carga de banco de preguntas, respuesta secuencial y calificación. |
| **05** | **`05-proctoring-block.test.js`** | Suspensión automática del examen ante eventos simulados de violación biométrica. |
| **06** | **`06-focus-loss.test.js`** | Despliegue del overlay protector y registro de telemetría forense cuando la ventana pierde el foco. |
| **07** | **`07-admin-dashboard.test.js`** | Rutas administrativas: bloqueo de estudiantes en `/admin`, el admin entra a `/course` solo en modo revisión, renderizado de registros IES y descarga de constancias. |
| **08** | **`08-security-and-verify.test.js`** | Inmutabilidad del costo de comodines en servidor, secuencialidad estricta de pasos de curso y validación pública en `/api/verify/:code`. |
| **09** | **`09-auth-and-payload-chaos.test.js`** | **Caos de Autenticación y Payloads:** Inyecciones SQL (`' OR 1=1 --`), tipos malformados (objetos/arrays en login), tiempo constante anti-timing para correos inexistentes, tokens JWT truncados/falsificados/basura en cookies y headers, logout con expiración de cookies, validación estricta de descriptores biométricos (longitud != 128, NaN, IDs inexistentes) y verificación de cifrado AES-256-GCM en reposo. |
| **10** | **`10-simulator-and-points-chaos.test.js`** | **Integridad Financiera y Simulador:** Rechazo de puntos negativos, nulos, NaN o flotantes (`-50`, `0`, `999999`); bloqueo de path traversal en `source` (`../../etc/passwd`); bloqueo de doble otorgamiento por re-envío en módulos ya aprobados; tope global inviolable de 500 Puntos de Reserva; y descarte de mensajes `postMessage` con el formato real de Unity que no provienen del iframe del simulador (origen falso o la propia ventana), sin llamadas a la API. |
| **11** | **`11-exam-resilience-and-edge-cases.test.js`** | **Resiliencia de Examen y Límites:** Rechazo de respuestas vacías, arrays malformados, preguntas duplicadas o IDs inexistentes; cumplimiento estricto del límite fatal de 3 intentos descalificando reintentos con HTTP 403 Forbidden; bloqueo de re-evaluación para exámenes ya aprobados con HTTP 409 Conflict; y validación atómica en servidor para uso de comodines (rechazo con puntos insuficientes o IDs de pregunta no válidos). |
| **12** | **`12-proctoring-and-camera-edge-cases.test.js`** | **Anti-Cheat y Cámaras Virtuales:** Detección y bloqueo inmediato de streams de video falsificados (OBS Virtual Camera, ManyCam, vCam, Snap Camera) con despliegue de alerta en pantalla; rechazo y cierre de conexiones WebSocket de proctoring sin cookie JWT válida o con tokens corruptos; y escalamiento progresivo de advertencias visuales en el visor de examen antes del baneo definitivo. |
| **13** | **`13-verification-and-admin-chaos.test.js`** | **Fuzzing de Verificación y Paginación Admin:** Resistencia de la ruta pública de verificación ante payloads XSS (`<script>alert(1)</script>`), strings de 5000+ caracteres y secuencias SQLi; respuesta estructurada de certificados emitidos verificando firma y prefijo binario `%PDF-`; denegación estricta (`403 Forbidden`) para generación de certificados de alumnos sin curso o examen completado; y sanitización de parámetros de paginación admin (`page=-5`, `limit=99999999`, strings) con clampeo automático seguro. |
| **14** | **`14-frontend-resilience-and-video-scrubbing.test.js`** | **Resiliencia de UI y Anti-Adelanto de Video:** Interceptación y reversión automática de saltos temporales no autorizados en el reproductor de video educativo (`currentTime` scrub revertido al progreso real visto); preservación y restauración de respuestas marcadas en el examen tras recargas accidentales (`F5` o caída de pestaña) vía `sessionStorage`; y redirección forzada a `/login` al intentar navegar a rutas protegidas (`/course`, `/exam`, `/admin`) sin credenciales válidas. |
| **15** | **`15-student-single-sitting-flow.test.js`** | **Recorrido Integral en una Sola Sentada (UI/UX):** Flujo completo continuo de estudiante nuevo desde el registro inicial y primer login, redirección automática a Onboarding, diligenciamiento de datos de filiación y aceptación de Habeas Data, enrolamiento biométrico facial (128 flotantes cifrados AES-256-GCM), bienvenida al Quirófano Virtual (0%), interacción y ganancia de Puntos de Reserva en simulador en vivo, avance secuencial por los 30 pasos del curso (jugando una partida en cada minijuego), desbloqueo reactivo del examen final, uso de comodín 50/50 consumiendo puntos, aprobación con 100%, renderizado del banner de graduado y validación de descarga de certificado oficial con cabecera binaria `%PDF-`. Incluye 11 capturas de pantalla de la UI/UX. |
| **16** | **`16-student-spaced-interaction-flow.test.js`** | **Aprendizaje Espaciado Multisesión (UI/UX):** Simulación de un estudiante real a lo largo de un período de 27 días con intervalos de 3 días por sesión, avanzando a un ritmo del ~10% por sesión (3 pasos por interacción desde la tercera sesión). En cada sesión se valida el cierre de sesión (`/api/logout`), la persistencia inmutable del progreso, los módulos aprobados y los puntos de reserva al reingresar por `/login`, la secuencialidad estricta (pasos posteriores bloqueados con candado), la finalización gradual de los módulos 1 al 5 (cada uno con sus 3 videos y una partida en cada uno de sus 3 minijuegos) y la graduación exitosa en la sesión 10 con examen aprobado y certificado generado. Incluye 7 capturas de pantalla de la experiencia visual. |
| **17** | **`17-admin-cohorts-and-compliance.test.js`** | **Gestión de Promociones, Correo de Inducción y Estándar IES:** Matriculación de estudiantes en promociones segregadas (*Promoción 1*, *Promoción 2*, creada antes por API) sin contraseña, verificación del correo de bienvenida con enlace de activación en `email_logs` (plantilla `induction_activation`, estado `simulated` o `sent`) y del aviso con el enlace para el admin; filtrado dinámico en tiempo real por cohorte en el panel administrativo; evaluación interactiva del Modal de Estándar IES demostrando rechazo fundamentado en estudiantes en curso y otorgamiento del veredicto *"CUMPLE EL ESTÁNDAR (Aval IES)"* para estudiantes graduados (6 criterios con check verde y código SHA-256); y exportación legal en archivo CSV para auditoría ministerial e IES con UTF-8 BOM. |
| **18** | **`18-admin-qol-and-audit-tools.test.js`** | **Herramientas de Calidad de Vida (QoL) y Auditoría Ministerial:** Descarga y validación binaria (`%PDF-`) del Acta Colectiva / Libro de Calificaciones IES con membrete formal y códigos QR; sellado y cierre criptográfico inmutable de promociones mediante hash SHA-256 (con bloqueo `409 Conflict` ante intentos de re-cierre); reenvío instantáneo de correos de inducción y guía operativa con trazabilidad forense; y detección de rezago académico (+7 días) con cálculo automático en UI y despacho de recordatorios personalizados. |
| **19** | **`19-module1-simulator-integration.test.js`** | **Módulo 1 de punta a punta:** la malla del cliente coincide con `COURSE_STEPS` del servidor (30 pasos: 5 módulos de 3 videos + 3 minijuegos), los videos del módulo 1 tienen su duración registrada y cada minijuego tiene escena y fase en el catálogo; un minijuego pendiente responde «en desarrollo» con `canSimulate`; los videos definitivos se sirven (con sesión) con soporte de rangos y *faststart*; un minijuego aporta como máximo 50 puntos; API del simulador (secuencia, escena/fase decididas por la API, niveles 10/5/0, idempotencia, fase y tiempo incoherentes rechazados, techo de 500, finalizar exige una partida, 409 tras finalizar, un estudiante no puede usar la partida de otro); contrato del iframe con un build simulado que habla el mismo protocolo que Unity (URL de lanzamiento, mensajes de otro intento ignorados, resultado registrado y acuse `phase-ack` devuelto al simulador); y, si existe `client/public/webgl`, el build real: Unity carga en el iframe, lee el lanzamiento y procesa el acuse en C#. |
| **20** | **`20-exam-integrity-and-proctoring.test.js`** | **Integridad del examen y proctoring en servidor:** sin intento abierto no hay preguntas, envío ni comodín (409); el set de preguntas es fijo por intento; se rechazan respuestas fuera de `a`–`d` o de otras preguntas; la calificación no revela qué respuestas fueron correctas y cierra el intento; quien ya aprobó no puede abrir otro; la página muestra el motivo real cuando la API rechaza las preguntas (curso incompleto) en lugar de caerse; con los 3 intentos agotados la página lo explica y deshabilita el botón antes de empezar, y la API responde `403` si se la llama igualmente; y, por WebSocket, la supervisión suspende sin rostro, cierra el intento en el servidor y no castiga a quien terminó con `end_exam`. |
| **21** | **`21-content-protection-and-video-watch.test.js`** | **Contenido protegido y visualización de videos:** sin sesión, videos, build WebGL, PDF e imágenes del curso responden `401` y abrir un PDF lleva al login; con sesión se sirven con `Cache-Control: private`; el backend ya no publica las fuentes Markdown de `ArcoC/public`; el inicio de reproducción se registra una sola vez, solo para videos y respetando la secuencia; y la página lo registra al reproducir. |
| **22** | **`22-base-platform-and-postgres-parity.test.js`** | **Bases de la plataforma y paridad PostgreSQL** (corre igual en ambos motores): `/api/health` informa motor y `schemaVersion`; el código del certificado (cabecera `X-Verification-Code`) es el que valida `/api/verify` y no cambia al volver a descargarlo; `/api/admin/cohorts` responde con totales numéricos; el estándar IES y el CSV usan las reglas vigentes (`examRules.js`, 30 pasos) y no textos fijos («45/50», «de 25»); `/api/student/me` entrega las reglas del examen y los intentos restantes sin campos sensibles; en el curso, quien reprobó ve «❌ No aprobado» con su nota y puede reintentar con los intentos restantes, quien agotó los intentos ve el examen deshabilitado, quien aprobó ve «✅ Aprobado» con su nota; y «Continuar donde quedé» abre el módulo y resalta el paso pendiente. |
| **23** | **`23-enrollment-activation-and-access.test.js`** | **Matrícula, activación y acceso (API):** la matrícula no lleva contraseña y la cuenta pendiente no entra; el enlace de activación se valida (`token-info` con nombre sin títulos y correo enmascarado), rechaza contraseñas débiles, abre la sesión y no sirve dos veces; desactivar exige motivo, corta la sesión abierta y el login, bloquea enlaces y recordatorios, y reactivar lo devuelve, todo en la bitácora; las fechas de la promoción impiden entrar antes del inicio (la fecha individual lo reemplaza) y dejan el curso en modo consulta tras el cierre (progreso, partidas y examen → `403 COHORT_CLOSED`); «olvidé mi contraseña» responde igual exista o no el correo, envía activación o restablecimiento según el caso, y restablecer cierra las demás sesiones; la importación CSV valida fila por fila (repetidos, inválidos, existentes, promoción inexistente; comillas y `;`) y matricula solo las válidas; promociones con fechas validadas, nombre único, renombrado que arrastra a sus estudiantes y sellado que bloquea cambios y matrículas. |
| **24** | **`24-admin-management-and-account-pages.test.js`** | **Páginas de acceso y gestión del admin (interfaz):** activación desde `/activar` hasta el registro biométrico; enlaces inválidos o incompletos con indicaciones; «¿Olvidaste tu contraseña?» y `/restablecer` de punta a punta hasta iniciar sesión; cuenta desactivada que ve el motivo al entrar; aviso de modo consulta con la promoción cerrada; crear y editar promociones desde el panel; ficha **⚙️ Gestionar** (editar, cambiar de promoción con motivo, enlace de acceso, desactivar y reactivar, historial) y su reflejo en la bitácora general; importación CSV con vista previa y matrícula de las filas válidas; y filtro por estado de la cuenta. |
| **25** | **`25-smtp-delivery.test.js`** | **Entrega por SMTP real:** un servidor SMTP local (`smtp-server`) recibe lo que envía el transporte de la API con la configuración `SMTP_*`; comprueba la elección del modo (`smtp`/`log`) y del TLS según el puerto, la autenticación, remitente y destinatario, el asunto y que el enlace de activación llegue completo en HTML y texto, sin contraseñas; y que unas credenciales SMTP incorrectas hagan fallar el envío. |
| **26** | **`26-course-structure-and-exam-rotation.test.js`** | **Malla de lanzamiento y examen sin preguntas repetidas:** reglas puras (selección de preguntas con bancos de 50, 25 y 5: sin repetir mientras queden sin ver y completando con las del intento más antiguo; un minijuego pendiente no admite partidas en producción y sí fuera de ella; la lista de contenido pendiente coincide con la configuración); todo minijuego exige una partida terminada, también los pendientes; 3 intentos del examen sin preguntas repetidas (solo las inevitables si el banco es menor), el 4.º rechazado y el historial `exam.history` con sus notas; reiniciar un intento abierto conserva sus preguntas y deja el anterior como `abandoned`; `/api/admin/launch-readiness` (solo admin) y la tarjeta del panel; y la práctica de un minijuego pendiente, «en desarrollo», que solo se finaliza tras una partida simulada. |
| **27** | **`27-progress-tracking-and-student-detail.test.js`** | **Seguimiento del avance y ficha del estudiante:** reglas puras (fechas de ambos motores a ISO, mejor partida por nivel y luego por porcentaje, paso actual y cada alerta con sus excepciones: certificados, cuentas desactivadas y promociones que no están abiertas); `/api/admin/progress` con un estado conocido (avance 3/30, paso actual, mejor nivel y puntos por minijuego, alertas de minijuego difícil y de intentos agotados, «solo con alertas» sin cambiar los totales, paginación); `/api/admin/students/:id/detail` (30 pasos, partidas con su nivel, historial del examen, línea de tiempo ordenada, 404/400 y 403 para estudiantes); y en el panel, la pestaña de seguimiento y la ficha con sus partidas y su línea de tiempo. |
| **28** | **`28-admin-course-preview.test.js`** | **Modo revisión del administrador:** por API, el admin marca un paso fuera de orden y recibe `{ preview: true }` sin que cambie su avance; juega un minijuego fuera de orden, la partida se registra como perfecta con 0 puntos; y el examen (`/start-exam`, `/questions`, `/submit-exam`, `/use-wildcard`) responde 403 `PREVIEW_MODE`. En el navegador: entra al curso desde el panel, ve el aviso de revisión, los pasos y el examen desbloqueados, juega una partida simulada sin botón de finalizar y ve el aviso del examen en lugar del botón para empezar. |
| **29** | **`29-test-students.test.js`** | **Estudiantes de prueba:** se matriculan con `isTest` y se listan marcados, pero no cuentan en las métricas de la promoción, el resumen del seguimiento, el CSV ni el sello. Su certificado (con el estado copiado de un estudiante aprobado) no se valida en `/api/verify`, y el del estudiante real sí. Herramientas: con un estudiante real responden 409; llevar a `m2_v1` deja 6 pasos; copiar el estado de un estudiante con un video y una partida perfecta trae 2 pasos, la partida y sus puntos sin cambiar al origen; reiniciar vuelve a cero; todo queda en la bitácora con su motivo; se puede desmarcar la cuenta. En el panel: la marca y el indicador «+1 de prueba», y «Llevar a un paso» desde **⚙️ Gestionar**. |

---

## 14. Estándares Clínicos y Normativos 2026 (ACHS, ICRP 118, AO Trauma)

Esta sección consolida las directrices operativas, radiológicas y médico-legales actualizadas que rigen los contenidos teóricos, minijuegos prácticos y preguntas del examen final de la plataforma, fusionando los manuales de la Asociación Chilena de Seguridad (ACHS), los informes del Organismo Internacional de Energía Atómica (OIEA), las recomendaciones ICRP 118 y las directrices quirúrgicas de la AO Foundation.

### 14.1 Normativa ACHS y Seguridad Operacional en Pabellón
* **Distancia Foco-Piel (SSD - Source-to-Skin Distance):**
  * Para **arcos en C móviles estándar**, la distancia foco-piel mínima permitida es de **$\text{SSD} \ge 30\text{ cm}$** (espaciador físico cónico obligatorio instalado en el colimador).
  * Para **mini arcos en C** destinados exclusivamente a extremidades distales, la distancia mínima permitida es de **$\text{SSD} \ge 20\text{ cm}$**.
  * Incumplir la SSD incrementa la dosis en la piel del paciente de forma exponencial según la ley del inverso del cuadrado de la distancia ($I \propto 1/d^2$).
* **Zona Controlada de Quirófano (Perímetro de 2 Metros):**
  * Toda área ubicada dentro de un radio de **2 metros** alrededor del tubo de rayos X y del paciente se clasifica legalmente como **Zona Controlada**.
  * Queda estrictamente prohibida la permanencia de personal dentro de este radio sin blindaje plomado completo (delantal $\ge 0.5\text{ mm Pb}$, collar tiroideo $\ge 0.5\text{ mm Pb}$ y gafas con protección lateral).
  * En procedimientos prolongados se exige el uso de biombos móviles plomados ($\ge 1.0\text{ mm Pb}$) y la retirada del personal asistencial a $\ge 3\text{ metros}$ cuando no estén asistiendo activamente el campo estéril.

### 14.2 Consolas Específicas por Fabricante y Control de Adquisición
La formación de la plataforma capacita al personal en la nomenclatura y paneles físicos de las cuatro marcas principales del mercado hospitalario:

| Fabricante / Modelo | Controles Físicos Específicos | Modo Predeterminado Recomendado | Advertencias Operativas |
| :--- | :--- | :--- | :--- |
| **GE OEC 9800 / 9900 / Elite** | Botones de pulso en consola: `1 pps`, `2 pps`, `4 pps`, `8 pps`. Botón `Low Dose`. Pedal izquierdo fluoroscopia, pedal derecho Cine. | `4 pps` o `8 pps` con modo `Low Dose` activado. | Prohibido pisar pedal derecho (Cine) en traumatología rutinaria. |
| **Philips BV Endura / Pulsera / Zenition** | Botones táctiles `1/2 Dose` y `1/4 Dose`. Selector de fluoroscopia continua vs pulsada (`Pulse Rate`). | Pulsado `4 pps` o `8 pps` con `1/2 Dose` activado. | No utilizar modo sustracción vascular (DSA) en enclavados óseos. |
| **Siemens Cios Select / Alpha / Spin** | Paquete **CARE** (*Combined Applications to Reduce Exposure*) y filtración de cobre **CAREFilter** (0.1 a 0.3 mm Cu). | Modo CARE a `7.5 pps` o `3.75 pps`. | Monitorear el producto dosis-área (DAP) acumulado en pantalla. |
| **Ziehm Vision / Solo / FD** | Tecla **SmartDose** con modulación adaptativa **SmartPulse** (frecuencias escalonadas automáticas). | Modo ortopedia predeterminado con SmartPulse activo. | Evitar forzar kilovoltios manuales sin verificar colimación previa. |

> [!CAUTION]
> **Prohibición Taxativa del Modo Cine en Trauma Convencional:**
> El modo Cine / Fluorografía emite entre **10 y 20 veces más radiación por segundo** que la fluoroscopia pulsada estándar. Su utilización en reducciones de fracturas o enclavados intramedulares constituye mala práctica radiológica. Solo se justifica en angiografía con medio de contraste o embolizaciones vasculares críticas.

### 14.3 Actualización Tecnológica 2026 e ICRP 118
* **Publicación ICRP 118 — Radioprotección Ocular:**
  * La Comisión Internacional de Protección Radiológica redujo el umbral para opacidades del cristalino y cataratas radioinducidas de **2.0 Gy a 0.5 Gy**.
  * El límite ocupacional de dosis equivalente para el cristalino se redujo de 150 mSv/año a **20 mSv/año** (promediado en 5 años, sin superar 50 mSv en un solo año).
  * Exige la obligatoriedad de gafas plomadas ergonómicas de **0.5 mm Pb equivalente con protección lateral**, especialmente para el cirujano principal y el primer ayudante situados del lado del haz disperso.
* **Detectores de Panel Plano (FPD: a-Si / CMOS) vs Intensificadores de Imagen (II):**
  * **Distorsión Geométrica:** Los FPD poseen **0% distorsión geométrica**, eliminando el efecto cojín (*pincushion*) y la aberración de curvatura en los bordes.
  * **Eficiencia Cuántica de Detección (DQE):** DQE > 70-80% en FPD frente a 50-60% en intensificadores analógicos, permitiendo igual nitidez con 30-40% menos de dosis fotónica.
  * **Inmunidad Electromagnética:** Los FPD son inmunes a distorsiones en "S" causadas por campos magnéticos ambientales o motores de quirófano.
  * **Rango Dinámico:** Superior a 16 bits en FPD frente a 8-10 bits ópticos en tubos intensificadores, permitiendo visualizar simultáneamente tejidos blandos periarticulares y trabeculado óseo denso sin saturación.
* **Procesamiento de Imagen con IA en Tiempo Real (Deep Learning Denoising):**
  * Las plataformas quirúrgicas modernas (2026) incorporan redes convolucionales en GPU embebida que filtran el ruido cuántico en tiempo real.
  * Permiten operar rutinariamente a **4 - 8 pulsos por segundo (pps)** con una relación señal-ruido (SNR) y nitidez de bordes idéntica a adquisiciones continuas de 30 imágenes/segundo, reduciendo la dosis acumulada para el equipo quirúrgico en más de un **70%**.
* **Dosimetría Activa en Tiempo Real:**
  * Uso de monitores visuales en sala (ej. sistema RaySafe i3) con códigos de color (verde, amarillo, rojo) que alertan al cirujano y al instrumentador cuando entran en la pluma de dispersión secundaria.
  * Complementa legalmente al dosímetro personal pasivo termoluminiscente (TLD / OSLD) de lectura mensual.
* **Reconstrucción 3D Intraoperatoria (Cone-Beam CT):**
  * Adquisición rotacional de 180°-200° para generar volúmenes multiplanares intraoperatorios en fracturas intraarticulares complejas (meseta tibial, calcáneo, pelvis).
  * Reduce la tasa de reintervenciones posoperatorias por tornillos intraarticulares inadvertidos en fluoroscopia 2D de un 15-20% a menos del 2%.

### 14.4 Protocolos Quirúrgicos Especiales
* **1. Protocolo de Protección Gestacional en Quirófano:**
  * **Límite Fetal Estricto:** La dosis equivalente en la superficie abdominal de la profesional gestante no debe superar **1 mSv** durante todo el periodo de embarazo restante tras la declaración (ICRP 84 / OIEA).
  * **Blindaje Reforzado:** Uso de delantal plomado envolvente o doble capa frontal que garantice **1.0 mm Pb equivalente** sobre la pelvis y el abdomen.
  * **Dosimetría Dual:** Dosímetro habitual en tórax/cuello por fuera del delantal + **dosímetro abdominal adicional colocado bajo el delantal plomado** para monitoreo mensual del feto.
  * **Configuración Geométrica:** Tubo estrictamente ubicado bajo la mesa quirúrgica (el detector absorbe la radiación transmitida); la profesional debe ubicarse del lado del detector o a más de 2 metros del haz primario.
* **2. Protección Radiológica Pediátrica (*Image Gently*):**
  * **Extracción Obligatoria de la Rejilla Antidifusora (*Anti-Scatter Grid*):** En pacientes pediátricos (menores de 8 años o peso menor a 20 kg), la masa corporal reducida no genera volumen crítico de dispersión Compton. Retirar manualmente la rejilla reduce la dosis requerida entre un **50% y 60%** sin pérdida apreciable de contraste.
  * **Parámetros Específicos:** Ajuste de kVp bajo (50-65 kVp) y tasas ultra-bajas de pulso (1-4 pps).
* **3. Trampa del Control Automático de Brillo (ABC / AERC) y "Modo Metal":**
  * **El Fenómeno:** Al introducir placas masivas de titanio, clavos intramedulares de cobalto-cromo o prótesis articulares en el centro del campo de visión, el sensor del ABC detecta una caída abrupta de fotones e incrementa automáticamente el kilovoltaje y miliamperaje al máximo (80-110 kV, >4 mA), sobre-irradiando innecesariamente la piel y el tejido periférico circundante (*metal blinding*).
  * **Corrección Técnica:**
    1. Activar el botón **Metal Mode / Algoritmo de Supresión Metálica** en la consola del arco, el cual enmascara los píxeles de densidad metálica en el cálculo de brillo.
    2. Si el equipo no cuenta con este modo, **colimar estrechamente** hacia el hueso de interés sin centrar el sensor de brillo en la masa del implante metálico.

### 14.5 Checklist Pre-Exposición de 5 Puntos ("5-P")
Antes de cualquier disparo fluoroscópico en quirófano, el operador del arco debe verbalizar y verificar mentalmente la regla de las 5-P:

```mermaid
graph LR
    P1["1. Posición<br/>Tubo bajo mesa / Detector pegado"] --> P2["2. Proximidad<br/>SSD ≥ 30 cm"]
    P2 --> P3["3. Protección<br/>Plomados 0.5 mm / Gafas / Zona 2 m"]
    P3 --> P4["4. Pulsada<br/>4-8 pps / Modo Low Dose"]
    P4 --> P5["5. Pre-aviso<br/>¡Rayos! (2s antes del pedal)"]
```

1. **Posición:** Tubo emisor estrictamente bajo la mesa quirúrgica; detector plano o intensificador lo más próximo posible a la piel del paciente.
2. **Proximidad:** Distancia Foco-Piel mínima verificada ($\text{SSD} \ge 30\text{ cm}$ en arcos móviles).
3. **Protección:** Todo el personal dentro de la zona de 2 metros cuenta con delantal, protector tiroideo y gafas plomadas; biombos móviles desplegados.
4. **Pulsada:** Consola configurada en fluoroscopia pulsada baja (4 a 8 pps) con colimación colimada a la articulación objetivo.
5. **Pre-aviso:** Alerta verbal obligatoria (*"¡Rayos!"*) con 2 segundos de anticipación antes de presionar el pedal, permitiendo que el personal no esencial dé un paso hacia atrás o salga del perímetro.

---

## 15. Material Académico, Guiones Audiovisuales y Guía de Bolsillo

Para garantizar la formación integral de tecnólogos médicos, instrumentadores quirúrgicos, médicos residentes y cirujanos ortopedistas, el repositorio integra un ecosistema de material documental y audiovisual estandarizado:

### 15.1 Lecturas Maestras y Compilación a PDF Oficial
Las lecturas académicas residen en formato Markdown estructurado en `public/documents/` y se compilan automáticamente a formato PDF institucional de alta fidelidad tipográfica mediante el motor [`convert.js`](file:///c:/Oscar/ArcoC/public/documents/convert.js) (basado en `md-to-pdf` y Chromium sin cabeza):

| Documento Fuente | PDF de Distribución | Módulo Académico y Temática Central |
| :--- | :--- | :--- |
| `lectura_parte1.md` | `lectura_parte1.pdf` | **Módulo 1:** Física de la radiación ionizante, espectro electromagnético, interacción con la materia y densidades tisulares. |
| `lectura_parte2.md` | `lectura_parte2.pdf` | **Módulo 2:** Radioprotección en pabellón, ICRP 118, blindaje, dosimetría activa y normativa ACHS. |
| `lectura_parte3.md` | `lectura_parte3.pdf` | **Módulo 3:** Anatomía del arco en C, FPD vs II, IA Denoising, consolas de fabricante, trampa del ABC y pediatría. |
| `lectura_parte4.md` | `lectura_parte4.pdf` | **Módulo 4:** Proyecciones en miembro inferior, mesa de tracción, enclavado femoral, fracturas de tobillo y escaneo 3D. |
| `lectura_parte5.md` | `lectura_parte5.pdf` | **Módulo 5:** Proyecciones en miembro superior (húmero, radio distal), columna vertebral, paralelaje y alerta Mini C-arm. |
| `guia_rapida_bolsillo.md` | `guia_rapida_bolsillo.pdf` | **Guía Rápida de Bolsillo:** Tarjeta de referencia clínica condensada para uso intraoperatorio inmediato. |

### 15.2 Guía Rápida de Bolsillo (`guia_rapida_bolsillo.pdf`)
* Diseñada para impresión a doble cara y plastificado en tamaño bolsillo (A5 / media carta).
* Integra las tablas de angulaciones anatómicas esenciales, factores de técnica radiológica (kV/mA por región), checklist 5-P, atajos de consolas (GE, Philips, Siemens, Ziehm), y los protocolos de emergencia radiológica.
* **Acceso Directo en Plataforma:** Enlazada de forma prominente en la barra lateral del dashboard del curso ([`client/src/app/course/page.js`](file:///c:/Oscar/ArcoC/client/src/app/course/page.js)), permitiendo su descarga instantánea con un solo clic.

### 15.3 Guiones Técnicos para Producción Audiovisual con IA (`docs/guiones/`)
El directorio `docs/guiones/` contiene los libretos de producción técnica para la síntesis de videos educativos mediante modelos generativos audiovisuales (con estilo hiperrealista o animación médica 3D de grado quirúrgico):
* **Regla de Duración Estricta:** Ningún video supera los **8 minutos** de duración total (tiempos promedio entre 4:30 y 6:30 min) para garantizar retención cognitiva y evitar sobrecarga informativa.
* **Estructura Escénica:** Cada guion especifica locución en *voz en off* (audio en español neutro profesional), descripción visual detallada de planos de cámara, ángulos de quirófano, esquemas de dispersión de rayos X y superposiciones de texto clínico clave (*lower thirds*).
* **Escenas Críticas Incorporadas:**
  * Escena de Protección Gestacional y Dosimetría Abdominal en Módulo 2.
  * Demostración de FPD vs Intensificador de Imagen y Reducción con IA en Módulo 3.
  * Comparativa de Consolas de Fabricante (GE OEC, Philips, Siemens, Ziehm) en Módulo 3.
  * Demostración del "Modo Metal" y extracción de rejilla en pediatría (*Image Gently*) en Módulo 3.
  * Escenarios ortopédicos reales AO Trauma (fémur, rodilla, tobillo, húmero, radio, columna) en Módulos 4 y 5.

### 15.4 Pipeline de Compilación y Renderizado Documental
Para regenerar los PDFs oficiales tras cualquier modificación en los textos en Markdown:
```bash
# Compilar todos los documentos Markdown a PDF en client/public/documents/
node public/documents/convert.js
```
El script aplica reglas CSS de paginación para evitar cortes viudos en títulos, formatea tablas médicas con bordes cian de alto contraste y embebe las imágenes clínicas en resolución nativa para impresión profesional.

---

## 16. Flujo de Trabajo con Git (Ramas, Versiones y Limpieza)

Regla general: **cada rama tiene una sola función y desaparece cuando la cumple.** No se crean ramas «por si acaso».

### 16.1 Ramas
* **`main`** es la única rama permanente. Siempre debe estar verde: lint sin errores y la suite E2E pasando en SQLite y en PostgreSQL. De ella se despliega.
* **Ramas de trabajo:** una por propósito, de vida corta y con un nombre que diga para qué existen.

| Prefijo | Para | Ejemplo |
| :--- | :--- | :--- |
| `feature/` | Una funcionalidad o una fase del plan | `feature/fase-2-seguimiento` |
| `fix/` | Una corrección | `fix/main-tras-merge-5` |
| `docs/` | Solo documentación | `docs/flujo-git-e-infraestructura` |
| `chore/` | Mantenimiento: dependencias, CI, limpieza | `chore/node-24` |

* Las sesiones paralelas de Claude Code trabajan en ramas `claude/<nombre>` dentro de `.claude/worktrees/`. Siguen la misma regla: al fusionar su PR se borra la rama y se quita el worktree.

### 16.2 Ciclo de una rama
1. Partir de `main` actualizado (`git pull --ff-only`).
2. Commits con mensajes descriptivos en español (`tipo: resumen`), con `DOCUMENTATION.md` al día en el mismo trabajo.
3. Antes de fusionar, en `ArcoC/`, correr estos comandos (los mismos que el CI):
   * `npm ci`
   * `npm --workspace=client run lint`
   * `npm test` (SQLite)
   * `npm run test:pg` (PostgreSQL)

   Si hay otras sesiones trabajando, tomar antes el cerrojo compartido `%TEMP%\arcoc-e2e.lock`.
4. Fusionar en `main` (PR en GitHub o `git merge --no-ff` local) y subir.
5. **Podar:** borrar la rama local (`git branch -d`) y la remota (`git push origin --delete <rama>`), y quitar su worktree (`git worktree remove`, luego `git worktree prune`).

**Conflictos en `package-lock.json`:** no se elige una versión a mano. Se regenera con `npm install` y se comprueba con `npm ci`. El merge del PR #5 perdió así la dependencia `@vladmandic/face-api` y dejó `main` sin poder instalarse limpio hasta que se regeneró.

### 16.3 Respaldos y versiones
* **Trabajo no fusionado que vale la pena conservar:** antes de borrar la rama, crear una etiqueta anotada `git tag -a archive/<nombre> -m "<por qué se guarda>"` y subirla con `git push origin archive/<nombre>`. La rama se borra y el trabajo queda recuperable.
* **Hitos:** al cerrar cada fase se crea una etiqueta anotada `vX.Y.Z` sobre `main`, opcionalmente con una *GitHub Release* que resuma la fase. Sirve de punto de retorno.
* **Numeración:** se usa `0.x` mientras la plataforma no esté en producción. `v1.0.0` será el lanzamiento con los 5 módulos completos. La versión oficial es la etiqueta: el campo `version` de los `package.json` no se usa, porque no se publican en npm.

| Etiqueta | Hito |
| :--- | :--- |
| `v0.1.0` | Módulo 1 integrado con el simulador, protección de contenido y reglas anti-trampa |
| `v0.2.0` | Fase 0: paridad PostgreSQL, migraciones, CI y arreglos del estudiante (con los PR #3, #4 y #6) |
| `v0.3.0` | Fase 1: promociones, matrícula por enlace, gestión de cuentas, correo y bitácora. Incluye la migración a `@vladmandic/face-api` (PR #5) y la reparación de `main` tras ese merge |
| `v0.4.0` | Fase 2: malla de 30 pasos, todo minijuego con partida obligatoria, examen sin preguntas repetidas, preparación del lanzamiento, seguimiento del avance por promoción y ficha del estudiante |
| `v0.5.0` | Fase 3: modo revisión del administrador en el curso y estudiantes de prueba (fuera de estadísticas, actas, CSV, sellos y verificación; reiniciar, llevar a un paso y copiar el estado). Incluye la corrección de las clases CSS que faltaban |

### 16.4 Auditoría rápida
* `git branch -a` y `git worktree list`: fuera de una tarea en curso solo debe aparecer `main`.
* `git branch --merged main`: todo lo que aparezca, salvo `main`, se puede borrar.

### 16.5 Configuración recomendada en GitHub
La aplica el dueño del repositorio en *Settings*:
* **General → Pull Requests → Automatically delete head branches:** GitHub borra la rama al fusionar el PR.
* **Branches → protección de `main`** (cuando el CI pueda ejecutarse): exigir PR y checks en verde antes de fusionar.

---

*C-Arm Master MVP — v0.5.0 (Fase 3; numeración de versiones en la sección 16.3). Documentación consolidada y actualizada al 24 de noviembre de 2026.*
