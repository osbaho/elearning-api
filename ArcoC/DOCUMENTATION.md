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

---

## 1. Visión General y Arquitectura

El sistema opera bajo un modelo de desacoplamiento **Cliente-Servidor (BFF/API)**:

```mermaid
graph TB
    subgraph CLIENT["🖥️ Frontend — Next.js 16 (App Router) :3000"]
        AUTH_CTX["AuthContext (Cookie-driven)"]
        UI_PAGES["Páginas: /login · /onboarding · /course · /course/exam · /admin"]
        HOOK_PROCTORING["useProctoring() (face-api.js + socket.io-client)"]
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
│   └── prepare-module-videos.ps1  # Masters de un módulo → videos web (H.264 ~4 Mbps, faststart)
│
├── server/
│   ├── config/
│   │   ├── db.js                  # Abstracción dual SQLite/PostgreSQL y migraciones
│   │   ├── curriculum.js          # Malla de 26 pasos: fuente única de verdad del servidor
│   │   ├── simulatorCatalog.js    # Paso práctico → escena y fase del simulador Unity
│   │   └── reservePoints.js       # Regla 10/5/0 por fase y techo de 500 Puntos de Reserva
│   ├── middleware/
│   │   ├── auth.js                # Validación de JWT (cookies y headers) y rol admin
│   │   └── rateLimiter.js         # Rate limiting global y login limiter
│   ├── routes/
│   │   ├── auth.js                # Rutas de login, logout, me, descriptor, onboarding
│   │   ├── exam.js                # Preguntas, inicio, comodines, calificación, verificación
│   │   ├── progress.js            # Marcado de pasos con validación secuencial
│   │   ├── simulator.js           # Partidas del simulador Unity y resultados por fase
│   │   └── admin.js               # Dashboard de auditoría IES y descarga de constancias
│   ├── utils/
│   │   ├── certificate.js         # Generación de PDF (PDFKit) y validación pública
│   │   └── crypto.js              # Cifrado autenticado AES-256-GCM para biometría
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
│   │   ├── models/                # Modelos pre-entrenados de Face-API.js
│   │   ├── documents/             # PDFs oficiales compilados (Lecturas 1-5 y Guía Rápida de Bolsillo)
│   │   ├── images/                # Atlas Radiológico clínico AO Trauma (Módulos 1-5)
│   │   ├── videos/moduloN/        # Videos web por módulo (generados, fuera de git)
│   │   └── webgl/                 # Build WebGL del simulador Unity (generado, fuera de git)
│   └── src/
│       ├── proxy.js               # Sesión obligatoria para páginas del curso y contenido (videos, WebGL, PDF, imágenes)
│       ├── app/
│       │   ├── page.js            # Landing page institucional
│       │   ├── login/page.js      # Inicio de sesión con autenticación HttpOnly
│       │   ├── onboarding/page.js # Registro biométrico y formulario Habeas Data
│       │   ├── course/page.js     # Dashboard central del curso, selector de módulos y guía rápida
│       │   ├── course/practice/   # Rutas dinámicas para minijuegos interactivos
│       │   ├── course/exam/page.js# Interfaz del examen y panel de proctoring
│       │   └── admin/page.js      # Panel de auditoría para directores IES
│       ├── components/
│       │   ├── ModuleCard.js      # Tarjeta de módulo con estado visual
│       │   ├── VideoPlayer.js     # Reproductor con control de adelanto (scrubbing)
│       │   ├── SimulatorView.js   # Página de práctica: partidas, iframe del simulador Unity y Atlas Radiológico
│       │   └── ProtectedRoute.js  # Guardián de rutas por autenticación y rol
│       ├── context/
│       │   ├── AuthContext.js     # Estado reactivo global de usuario
│       │   └── ToastContext.js    # Notificaciones accesibles (ARIA live)
│       ├── hooks/
│       │   └── useProctoring.js   # Hook para cámara, face-api y WebSockets
│       └── lib/
│           └── courseConfig.js    # Configuración de los 26 pasos del curso (títulos, videos, íconos)
│
└── tests/
    ├── helpers/
    │   └── loginHelper.js         # Utilidad de login y reset para tests
    └── e2e/                       # 8 suites de pruebas Playwright automatizadas (15 tests)
```

---

## 3. Base de Datos y Persistencia Híbrida

La capa de datos ([`server/config/db.js`](file:///c:/Oscar/ArcoC/server/config/db.js)) implementa un wrapper agnóstico que permite alternar entre:
1. **SQLite (`sql.js`):** Utilizado por defecto en desarrollo local. Se carga en memoria para velocidad ultra-rápida y persiste automáticamente a `database.sqlite` mediante debounce y en el evento de *graceful shutdown*.
2. **PostgreSQL (`pg`):** Habilitado automáticamente cuando se define la variable `DATABASE_URL`. El conversor `convertSqlForPg` traduce dinámicamente placeholders (`?` a `$1, $2...`) y sintaxis de conflictos (`INSERT OR IGNORE` a `ON CONFLICT DO NOTHING`).

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
* `created_at`: Marca temporal de creación

#### 2. `course_progress`
Registra el avance individual por paso:
* `id` (INTEGER / SERIAL PRIMARY KEY)
* `student_id` (FOREIGN KEY -> students.id)
* `module_id`: Identificador del paso (ej: `'m1_v1'`, `'m1_s1'`, `'exam'`)
* `status`: `'completed'`
* `completed_at`: Marca temporal inmutable del primer completado
* Restricción: `UNIQUE(student_id, module_id)`

#### 3. `questions`
Banco de preguntas de opción múltiple (50 reactivos oficiales estandarizados según normativas OIEA, ICRP 118, ACHS y AO Trauma):
* `id` (INTEGER / SERIAL PRIMARY KEY)
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
* `timestamp`: Fecha y hora del suceso (se depuran registros con más de 30 días)

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

---

## 4. Flujos de Autenticación y Sesión

* **Tokens JWT:** Firmados con clave de 32+ caracteres (`JWT_SECRET`) y vigencia de 12 horas.
* **Entrega de Cookies Seguras:** La cookie de autenticación (`token`) se emite con directivas `HttpOnly; SameSite=lax; Path=/`. En entornos de producción activa `Secure=true`.
* **Timing-Attack Resilience:** En caso de que un correo electrónico no exista en la base de datos, el backend ejecuta un hash simulado mediante `bcrypt.compare` contra una cadena predeterminada, neutralizando la enumeración de usuarios por discrepancias en tiempos de respuesta.
* **Socket Authentication:** El handshake de WebSockets extrae e inspecciona automáticamente la cookie HTTP mediante el parser tolerante a versiones de Node.js, impidiendo la apertura de canales de proctoring a clientes sin token válido.

---

## 5. Estructura del Curso y Secuencialidad

El programa académico consta de **5 módulos temáticos** y **26 pasos obligatorios** en total. Claves: `mX_vN` = video, `mX_sN` = minijuego, `mX_vr` = video recopilatorio.

**Módulo 1 (contenido definitivo, 6 pasos):** cada video va seguido de su minijuego en el simulador Unity.

| Paso | Contenido | Archivo / Simulador |
| :--- | :--- | :--- |
| `m1_v1` | Video 1: Historia, Física y Pilares S.E.R. | `/videos/modulo1/M01_V01_SER.mp4` |
| `m1_s1` | Minijuego 1: Protocolo Cero | `Scene1`, fase 1 (`MG1_ProtocolZero`) |
| `m1_v2` | Video 2: Densidades, Unidades y Normativa | `/videos/modulo1/M01_V02_Fisica.mp4` |
| `m1_s2` | Minijuego 2: Maestro del Haz | `Scene1`, fase 2 (`MG2_BeamMaster`) |
| `m1_v3` | Video 3: Geometría del Arco en C | `/videos/modulo1/M01_V03_Geometria.mp4` |
| `m1_s3` | Minijuego 3: Comando Isocentro | `Scene1`, fase 3 (`MG3_IsocenterCommand`) |

**Módulos 2–5 (contenido en producción, 5 pasos cada uno):** `mX_v1` → `mX_s1` → `mX_v2` → `mX_s2` → `mX_vr`, con videos placeholder y prácticas "en desarrollo".

**Fuente única de verdad:** la lista ordenada vive en [`server/config/curriculum.js`](server/config/curriculum.js) (`COURSE_STEPS`, usada por progreso, examen, admin y correos) y en [`client/src/lib/courseConfig.js`](client/src/lib/courseConfig.js) (títulos, videos e íconos). El test E2E 19 falla si ambas listas difieren. Los totales (26) se calculan; no hay constantes "25" repartidas por el código.

### Enforce de Secuencialidad Backend
El endpoint `POST /api/progress/:moduleId` valida en el servidor la lista ordenada `COURSE_STEPS`. Para marcar cualquier paso `n`, el paso `n-1` debe existir previamente en estado `'completed'` en `course_progress`; repetir un paso ya completado responde éxito sin cambios. Los minijuegos con contenido en el simulador exigen además **al menos una partida terminada** (`simulator_attempts` con `status = 'completed'`). El módulo `'exam'` está protegido contra marcado manual: solo el endpoint `/api/submit-exam` puede otorgarlo tras calificar formalmente con puntaje ≥ 90%. Los conteos de avance (bloqueo del examen, estándar IES, CSV, recordatorios) solo cuentan pasos de la malla vigente.

### Control de Visualización en Videos ([`VideoPlayer.js`](file:///c:/Oscar/ArcoC/client/src/components/VideoPlayer.js))
* **Detección de Adelanto No Autorizado (Anti-Scrubbing):** Si el estudiante intenta saltar a una marca de tiempo superior a la observada de forma continua (+2 segundos de tolerancia), el reproductor revierte inmediatamente el cursor al tiempo máximo visto legítimamente y muestra una advertencia visual.
* **Condición de Finalización:** El callback `onComplete` únicamente se dispara cuando el usuario ha reproducido al menos el **90%** de la duración del video de forma continua. Si la API rechaza el registro, la página lo avisa con el motivo.
* **Tiempo mínimo en servidor (producción):** el bloqueo de adelanto ocurre en el navegador, así que la API no confía solo en él. Al primer *play*, el reproductor llama a `POST /api/progress/:moduleId/start` (queda en `video_views`). En producción, `POST /api/progress/:moduleId` de un video solo se acepta si desde ese inicio pasó el tiempo de verlo al 90 % a 2x, la velocidad máxima del reproductor, menos 5 s de margen: `⌊duración × 0,9 / 2 − 5⌋` segundos (73 s para el video 1 del módulo 1). Sin inicio registrado o antes de tiempo responde `403` con lo que falta. En desarrollo y en los tests no se aplica, para poder avanzar la malla sin esperar.
* **Duraciones:** viven en `VIDEO_DURATION_SECONDS` de [`server/config/curriculum.js`](server/config/curriculum.js). `scripts/prepare-module-videos.ps1` las imprime listas para copiar, y el test E2E 19 falla si algún video de la malla no tiene duración.

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
| `GET /api/simulator/steps/:stepId` | Disponibilidad del paso, escena/fase, partidas terminadas, puntos ganados en el minijuego y su tope (`maxPoints`). Una práctica sin simulador responde `200` con `available: false`; un paso inexistente, `404`. |
| `POST /api/simulator/attempts` | Crea una partida. Exige el paso previo completado; 404 si el paso no tiene simulador; 409 si el minijuego ya fue finalizado. |
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
Mapea cada paso práctico a `{ scene, phase, minSeconds }`. Hoy: `m1_s1 → Scene1/1`, `m1_s2 → Scene1/2`, `m1_s3 → Scene1/3`, todos con `minSeconds: 30` (ajústalo con datos reales de juego). Los pasos sin entrada muestran la práctica como "en desarrollo" y se pueden finalizar sin partida.

### Cómo incorporar el siguiente módulo (proceso repetible)
1. **Videos:** dejar los masters `M0N_V0k_Master_<Tema>.mp4` en la carpeta de masters y ejecutar `scripts/prepare-module-videos.ps1 -Module N -SourceDir <carpeta>`.
2. **Malla:** ajustar los pasos del módulo en `server/config/curriculum.js` (`COURSE_STEPS` y las duraciones que imprimió el script en `VIDEO_DURATION_SECONDS`) y en `client/src/lib/courseConfig.js` (`videoSrc: '/videos/moduloN/...'`).
3. **Unity:** crear la escena del módulo en el mismo proyecto, añadirla a Build Settings y fijar sus fases (1..n) en `CArmUIController`/escena.
4. **Catálogo:** registrar cada `mN_sK → { scene, phase, minSeconds }` en `simulatorCatalog.js`.
5. **Build:** en Unity, menú **CArm → Build WebGL para ArcoC** (genera `client/public/webgl`).
6. **Pruebas y documentación:** actualizar el test E2E 19 (malla esperada), ejecutar la suite y actualizar este documento.

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
    API->>DB: exam_attempts +1, exam_in_progress = 1, fija exam_question_ids (10 al azar)
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
* **Intento abierto obligatorio:** `/api/start-exam` abre el intento y fija su set de preguntas. Sin intento abierto, `/api/questions`, `/api/submit-exam` y `/api/use-wildcard` responden `409`. Así no se pueden ver preguntas sin consumir un intento ni enviar exámenes sin pasar por el límite de 3.
* **Set de preguntas fijo por intento:** recargar la página devuelve las mismas preguntas. `/api/submit-exam` exige responder exactamente ese set (no se pueden elegir preguntas) con opciones `a`–`d`, y la respuesta no revela qué preguntas fueron correctas.
* **Costo Inmutable del Comodín 50/50:** Fijado rígidamente en el servidor en **100 Puntos de Reserva**. Cualquier parámetro de costo enviado desde el navegador es descartado. Solo se puede usar dentro del intento y sobre una de sus preguntas.
* **Límite de Intentos:** Máximo **3 intentos**; cada clic en "Empezar Examen" consume uno (si había uno abierto, conserva sus preguntas). Superado el límite, `/api/start-exam` responde `403` y la página muestra el motivo sin iniciar.
* **Bloqueo de Reenvío Aprobado:** Si el estudiante ya aprobó, `/api/start-exam` y `/api/submit-exam` responden `409 Conflict`.
* **Malla completa en producción:** `/api/start-exam`, `/api/questions` y `/api/submit-exam` exigen los 26 pasos completados cuando `NODE_ENV=production`.
* **Calificación Atómica:** La evaluación se calcula únicamente en el servidor comparando las respuestas enviadas contra la base de datos. Se emplea `withTransaction` para garantizar que la nota máxima registrada sea `MAX(puntaje_actual, puntaje_previo)`.
* **Errores visibles:** si la API rechaza las preguntas o el inicio (curso incompleto, intentos agotados, sesión vencida, límite de peticiones), la página muestra el mensaje del servidor con opciones para reintentar o volver al curso.
* **Persistencia de Sesión Local:** La UI guarda las respuestas seleccionadas y opciones eliminadas en `sessionStorage` para resistir recargas; al cargar las preguntas del intento descarta las que no le pertenecen.

---

## 8. Sistema de Proctoring Biométrico (WebRTC + WebSockets)

La supervisión remota en tiempo real se orquesta entre [`useProctoring.js`](file:///c:/Oscar/ArcoC/client/src/hooks/useProctoring.js) y el monitor de latidos en [`server.js`](file:///c:/Oscar/ArcoC/server.js).

### Arquitectura de Supervisión
1. **Onboarding:** En `/onboarding`, el alumno captura su rostro. Face-API genera un descriptor facial (Float32Array de 128 elementos) que se almacena cifrado en base de datos.
2. **Carga Protegida:** Al iniciar el examen, el cliente consulta `GET /api/student/descriptor` para obtener su descriptor registrado en memoria.
3. **Bucle Local de Detección:** Cada 3 segundos, el navegador ejecuta `detectSingleFace().withFaceLandmarks().withFaceDescriptor()`.
4. **Verificación de Coincidencia:** Se calcula la distancia euclidiana entre el rostro detectado en vivo y el descriptor de referencia:
   $$\text{Distancia} < 0.6 \implies \text{Identidad Confirmada}$$
5. **Heartbeat WebSocket:** Con el primer latido real (cámara y modelos ya listos) el cliente emite `'start_exam'`, que abre la sesión de supervisión en el servidor; después envía `'proctoring_heartbeat'` cada 3 segundos con `{ faceDetected, isMatch }`. Si no hay descriptor registrado para comparar, `isMatch` viaja como `null` (identidad no evaluable, sin penalización). Tras una reconexión del socket se reabre la sesión.
6. **Fin de la supervisión:** al enviar el examen o salir de la página, el cliente emite `'end_exam'`; sin ello, el monitor interpretaría el fin de los latidos como pérdida de señal.

### Tolerancia y Estados del Monitor en Servidor (Cada 10 segundos)
* **Advertencia Temprana (15 segundos):** Si transcurren más de 15 segundos sin recibir un latido (pero menos de 30s), el servidor emite `'proctoring_warning'`. La interfaz del estudiante despliega un banner de aviso preventivo en la barra lateral para corregir su conexión o postura.
* **Pérdida Crítica de Señal (30 segundos):** Si la desconexión supera los 30 segundos, se suspende el examen de forma permanente emitiendo `'exam_suspended'`, incrementando `proctoring_incidents`, registrando el evento `PROCTORING_EXPIRED` y **cerrando el intento en el servidor** (ya no se puede enviar por la API).
* **Infracción de Identidad o Ausencia Facial:** Si se detecta ausencia de rostro o discrepancia biométrica, se incrementa un contador de violación (`violationCount`). Se requiere confirmar la infracción durante **3 ciclos continuos (30 segundos)** para suspender el examen definitivamente, previniendo falsos positivos por parpadeos o movimientos rápidos.
* **Detección de Cámaras Virtuales:** El hook inspecciona la etiqueta del dispositivo (`videoTrack.label`). Nombres asociados a OBS, Snap Camera, vCam o software emulador son bloqueados inmediatamente antes de permitir el inicio de la evaluación.

---

## 9. Certificación Digital y Verificación Pública

Al superar la evaluación final con un puntaje mínimo del **90%**, el estudiante se hace acreedor a la constancia académica oficial.

### Generación Dinámica en PDF ([`server/utils/certificate.js`](file:///c:/Oscar/ArcoC/server/utils/certificate.js))
* Construido con **PDFKit** en orientación horizontal (*landscape*), tamaño carta.
* Incluye marcos estilizados en colores institucionales, datos de identificación del estudiante, institución de procedencia (IES u hospital), puntaje final obtenido y fecha formal de emisión en español.
* Se transmite vía *streaming* directo al navegador sin almacenar archivos temporales en el disco duro del servidor.

### Hash Criptográfico y Código de Verificación
Cada certificado cuenta con una firma matemática determinística única:
$$\text{hashInput} = \text{studentId} + \text{"-"} + \text{email} + \text{"-"} + \text{exam\_score} + \text{"-"} + \text{completed\_at}$$
$$\text{VerificationCode} = \text{"CARM-"} + \text{SHA256}(\text{hashInput})[0..12].\text{toUpperCase}()$$

### Endpoint Público de Verificación
Terceros, empleadores o instituciones auditoras pueden validar la autenticidad de cualquier constancia a través de:
```http
GET /api/verify/CARM-XXXXXXXXXXXX
```
* **Respuesta Exitosa (200 OK):** Retorna validez, nombre del estudiante, institución, fecha de emisión, puntaje y documento de identidad enmascarado por privacidad (`••• 1234`).
* **Respuesta de Código Inválido (404 Not Found):** Informa que el código no corresponde a ningún certificado legítimo emitido por la plataforma.

---

## 10. Panel de Auditoría Administrativa (IES) y Gestión de Promociones

El panel administrativo ([`client/src/app/admin/page.js`](file:///c:/Oscar/ArcoC/client/src/app/admin/page.js)) proporciona a los directores de programa, comités curriculares e interventores del Ministerio de Educación y de Instituciones de Educación Superior (IES) una suite integral de supervisión, matriculación y trazabilidad legal:

```mermaid
graph TD
    ADMIN["👤 Administrador / Auditor IES"] -->|POST /api/admin/students| REGISTER["Matriculación por Promoción<br/>(Cohortes 1, 2, 3...)"]
    REGISTER -->|Automático| EMAIL_SVC["Servicio de Mensajería Institucional<br/>(emailService.js)"]
    EMAIL_SVC -->|Despacho| EMAIL_STUDENT["📧 Correo al Estudiante<br/>• Credenciales y fecha habilitada<br/>• Guía de 5 pasos para el estándar"]
    EMAIL_SVC -->|Trazabilidad Forense| EMAIL_LOGS["🗄️ Tabla email_logs<br/>Registro inmutable para requerimientos legales"]

    ADMIN -->|Filtro Reactivo| COHORTS_VIEW["Segmentación de Promociones<br/>(Pestañas + KPIs específicos)"]
    ADMIN -->|GET /api/admin/compliance/:id| AUDIT_MODAL["🔍 Modal de Estándar Institucional IES<br/>Evaluación de 6 Criterios Obligatorios"]
    AUDIT_MODAL --> VERDICT{"¿Cumple los 6 Criterios?"}
    VERDICT -->|Sí| VERDICT_PASS["🟢 CUMPLE EL ESTÁNDAR<br/>Aval IES Listo · Certificado QR Habilitado"]
    VERDICT -->|No| VERDICT_FAIL["🔴 NO CUMPLE EL ESTÁNDAR<br/>Desglose explícito de faltantes"]

    ADMIN -->|GET /api/admin/export-audit| CSV_EXPORT["📊 Exportación CSV Oficial<br/>UTF-8 BOM para Excel · 16 columnas reglamentarias"]
```

### 10.1 Gestión y Segmentación por Promociones (Cohortes)
* **Separación por Cohortes:** Los estudiantes son organizados en cohortes académicas (ej. *"Promoción 1"*, *"Promoción 2"*, etc.), permitiendo a la institución comparar grupos de residentes, médicos de planta y tecnólogos.
* **Métricas y KPIs Dinámicos:** Cada cohorte recalcula en tiempo real el total de matriculados, estudiantes con Aval IES Aprobado ($\ge 90\%$), alumnos en instrucción activa, promedio global de calificación e incidentes de integridad registrados.
* **Filtrado Reactivo y Búsqueda:** La interfaz permite alternar instantáneamente entre promociones o buscar en tiempo real por nombre, correo electrónico o documento de identidad.

### 10.2 Matriculación Automatizada y Correo de Inducción
Al registrar a un nuevo estudiante desde el formulario administrativo (`POST /api/admin/students`), el sistema ejecuta de forma automática:
1. Validación de no duplicidad de correo e inserción en la base de datos con asignación de cohorte y fecha de habilitación de acceso (`start_date`).
2. Cifrado unidireccional de la contraseña (o generación de clave provisional segura) mediante `bcryptjs`.
3. **Despacho Inmediato de Correo Institucional de Inducción:**
   * **Credenciales Oficiales:** URL de acceso, usuario, contraseña asignada y **fecha habilitada de ingreso**.
   * **Guía Operativa de 5 Pasos para el Cumplimiento del Estándar:**
     * **Paso 1 (Enrolamiento Biométrico):** Captura de documento legal y registro facial ante la *Dra. Nova (IA)* para supervisión continua durante las evaluaciones.
     * **Paso 2 (Ruta Curricular Secuencial):** Completitud obligatoria de los 5 módulos (25 pasos formativos) con protección anti-adelanto de video y lecturas en PDF.
     * **Paso 3 (Puntos de Reserva en Simulador):** Prácticas en el simulador cinemático y geométrico para obtener hasta 500 Puntos de Reserva comodín.
     * **Paso 4 (Evaluación Reglamentaria Final):** Presentación del examen de 50 preguntas bajo supervisión continua, exigiendo un **mínimo del 90%** y un **máximo de 3 intentos**.
     * **Paso 5 (Certificación Criptográfica):** Generación de la constancia oficial con código QR y validación pública HMAC-SHA256 ante el hospital y el Ministerio de Educación.
4. **Bitácora Forense (`email_logs`):** Cada despacho genera un registro con fecha, hora exacta, destinatario, promoción y estatus `'sent'`, disponible para consulta administrativa ante auditorías o reclamos legales.

### 10.3 Evaluación del Estándar Institucional IES (6 Criterios Obligatorios)
Al seleccionar a cualquier estudiante y pulsar **"🔍 Ver Estándar IES"**, la plataforma evalúa en servidor (`GET /api/admin/compliance/:studentId`) el cumplimiento riguroso de los **6 limitantes del estándar de acreditación**:

| Criterio | Código | Condición Reglamentaria | Estado Evaluado |
| :--- | :--- | :--- | :--- |
| **1. Identificación y Biometría** | `STD_BIO_ID` | Documento legal institucional y vector facial de 128 puntos registrado. | `is_onboarded == 1` && `id_number` válido && `face_descriptor` presente. |
| **2. Completitud Curricular** | `STD_CURRICULUM` | Aprobación del 100% de la malla (25 de 25 pasos obligatorios sin saltos). | `completedSteps >= 25` en tabla `course_progress`. |
| **3. Calificación en Examen** | `STD_EXAM_SCORE` | Aprobación con un puntaje mínimo del 90% (45 de 50 preguntas). | `exam_score >= 90`. |
| **4. Límite de Intentos** | `STD_MAX_ATTEMPTS` | Máximo 3 intentos de examen permitidos según reglamento IES. | `exam_attempts <= 3`. |
| **5. Integridad de Supervisión** | `STD_PROCTORING_INTEGRITY` | Tolerancia máxima de 5 incidencias acumuladas de cámara o foco. | `(proctoring_incidents + focus_violations) <= 5`. |
| **6. Emisión Criptográfica QR** | `STD_CRYPTO_CERT` | Código HMAC-SHA256 generado y trazable en base de datos. | Registro `'exam'` con `certificate_code` presente. |

* **Veredicto Institucional Categórico:**
  * 🟢 **CUMPLE EL ESTÁNDAR (Aval IES / Certificación Aprobada):** Habilita la expedición de actas formales y la descarga del certificado oficial en PDF con QR.
  * 🔴 **NO CUMPLE EL ESTÁNDAR:** Despliega una alerta forense con el listado explícito de los requisitos pendientes que el estudiante debe solventar antes de aspirar al aval institucional.

### 10.4 Exportación Oficial para Auditoría Ministerial (CSV)
El endpoint `GET /api/admin/export-audit?cohort=...` genera un archivo descargable con formato estandarizado que incluye:
* Codificación con **UTF-8 BOM (`\uFEFF`)** y delimitador de punto y coma (`;`), asegurando que Microsoft Excel en entornos hispanohablantes abra de forma nativa sin distorsión de tildes o caracteres especiales.
* **16 Columnas Oficiales de Auditoría:** `ID Estudiante`, `Nombre Completo`, `Correo Electrónico`, `Tipo Documento`, `Número Documento`, `Institución Hospitalaria`, `Promoción (Cohorte)`, `Fecha Habilitada Acceso`, `Pasos Curriculares (de 25)`, `Nota Examen (%)`, `Intentos Examen`, `Incidentes de Supervisión`, `Enrolamiento Biométrico`, `Cumple Estándar IES`, `Código Certificado QR` y `Fecha de Certificación`.

### 10.5 Herramientas de Calidad de Vida (QoL) y Auditoría Ministerial / IES
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

#### 3. Reenvío Inmediato de Credenciales y Guía Operativa
* **Endpoint:** `POST /api/admin/resend-email/:studentId`
* **Solución de Soporte Inmediata:** Botón directo en la tabla de estudiantes (**"✉️ Reenviar Guía"**) que dispara nuevamente el paquete completo de inducción (URL, credenciales, fecha habilitada y guía de 5 pasos), solventando al instante pérdidas de correo o problemas de spam reportados por el usuario, registrando cada intento en la bitácora forense `email_logs`.

#### 4. Semáforo de Rezago Académico (+7 Días) y Recordatorio Automatizado
* **Endpoint:** `POST /api/admin/send-reminder/:studentId`
* **Detección Preventiva de Deserción:** El sistema analiza en tiempo real la fecha de habilitación (`start_date`) y la última actividad del alumno. Si han transcurrido más de 7 días sin completar la malla curricular ni aprobar el examen, se asigna automáticamente una insignia de alerta visual: **"⚠️ Rezago (+7d)"**.
* **Acción en 1 Clic:** El administrador dispone del botón **"🔔 Recordatorio"** para despachar un correo institucional motivacional que resume los pasos pendientes para alcanzar el estándar IES y evitar la caducidad de su cupo.

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
# BIOMETRIC_ENCRYPTION_KEY=clave_de_32_bytes_para_aes_256_gcm
# Detrás de un proxy inverso (nginx, balanceador, gateway de Docker): número de saltos de confianza
# TRUST_PROXY=1
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
* **carm-backend:** basado en `Dockerfile.backend` (Node.js Alpine). Instala solo las dependencias de producción del backend con `npm ci --omit=dev --workspaces=false`: el workspace `client` queda fuera aunque `client/` llegue al contexto.
* **carm-frontend:** basado en `Dockerfile.frontend`, un build multi-etapa de Next.js. Instala el workspace con `npm ci --workspace=client` desde el `package-lock.json` de `ArcoC/`, el mismo que usan el desarrollo y las pruebas E2E. La salida `standalone` conserva la estructura del workspace (raíz en `/app`, la app en `client/`), así que la imagen arranca con `node client/server.js`.
* **`.dockerignore`:** deja fuera del contexto los `node_modules` y el `.next` del host, los `.env*` y las bases SQLite. Las dependencias se instalan dentro de la imagen y los secretos llegan en tiempo de ejecución.

### 4. Healthchecks y Graceful Shutdown
* Rutas `/health` y `/api/health` disponibles para balanceadores de carga y sondas de liveness/readiness.
* El proceso captura señales `SIGTERM` y `SIGINT`, cerrando las conexiones HTTP, limpiando los sockets activos de proctoring y forzando la sincronización de la base de datos SQLite a disco antes de finalizar.

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
* El lint del cliente (`npm --workspace=client run lint`) no analiza el build WebGL (`client/public/webgl/**`) ni los bundles minificados de terceros (`client/public/**/*.min.js`, como `workers/face-api.min.js`): no son código del proyecto. Ver `globalIgnores` en `client/eslint.config.mjs`.

### 6. Dependencias npm y Alertas de Seguridad (Dependabot)
Versiones clave: **Next.js 16.4.6** (con `eslint-config-next` 16.4.6) y **React 19.2.8**. En Next 16, la versión 16.4.1 corrige las alertas críticas y altas, y la 16.4.5 las moderadas. La serie 16.3 no recibió esos parches: su última versión, la 16.3.8, sigue afectada.

GitHub (Dependabot) revisa **dos** lockfiles en `ArcoC/`, y cada uno se instala por separado:

| Lockfile | Lo usa | Contenido |
| :--- | :--- | :--- |
| `package-lock.json` | `npm install` en `ArcoC/` (desarrollo y pruebas E2E), `Dockerfile.backend` y `Dockerfile.frontend` | Backend Express y el workspace `client` (frontend Next.js) |
| `public/documents/package-lock.json` | `convert.js` (compilación de las lecturas a PDF) | `md-to-pdf` y `puppeteer` |

* **El frontend no tiene lockfile propio.** `client/` es un workspace: sus dependencias se instalan y actualizan desde `ArcoC/` (por ejemplo, `npm install <paquete> --workspace=client`), y `Dockerfile.frontend` las instala del mismo lockfile con `npm ci --workspace=client`. Dentro de `client/`, npm también trabaja sobre el workspace raíz (`npm prefix` devuelve `ArcoC/`).
* **`node-fetch` forzado a `^2.7.0`** mediante `overrides` en el `package.json` de `ArcoC/`. npm solo aplica los `overrides` del `package.json` raíz, que cubren también al workspace `client`. `face-api.js` 0.22.2 (sin mantenimiento) depende de `@tensorflow/tfjs-core` 1.7.0, que fija `node-fetch ~2.1.2`, versión vulnerable. En el navegador tfjs no carga `node-fetch` y en Node usa el `fetch` nativo. No apliques `npm audit fix --force`, que propone bajar `face-api.js` a 0.20.0. Retira el override si se migra a un fork mantenido.
* **Revisión periódica:** `npm audit` en `ArcoC/` y en `public/documents/` (`npm audit --package-lock-only`). Prefiere `npm audit fix` y versiones menores o de parche. Antes de un salto mayor, lee sus notas; para Next, la guía de `node_modules/next/dist/docs/` (ver `client/AGENTS.md`).

---

## 13. Suite de Pruebas Automatizadas (Playwright)

El proyecto cuenta con un conjunto integral de **69 pruebas E2E automatizadas** organizadas en **21 suites especializadas** ejecutadas con Playwright. Cubre tanto los flujos nominales de certificación como pruebas de caos, penetración, fuzzing de payloads, condiciones de carrera, resiliencia extrema, los dos grandes recorridos completos de usuario (estudiante en una sola sentada y aprendizaje espaciado en múltiples sesiones), la supervisión administrativa por promociones con evaluación del estándar institucional y el conjunto de herramientas de calidad de vida (QoL) y gobernanza ministerial:

```bash
# Ejecutar todas las 21 suites E2E (69 pruebas completas)
npx playwright test

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

**Base de datos para la suite:** basta con una BD recién creada con `npm run seed`, que crea al administrador. Los estudiantes de prueba los crea `POST /api/test-reset` cuando se necesitan (`server.js`, solo fuera de producción). Un estudiante recién creado queda en el mismo estado que uno existente reiniciado: onboarding completo, 150 Puntos de Reserva y sin progreso ni intentos de examen. Las pruebas que necesitan otro punto de partida lo piden explícitamente: los recorridos 15 y 16 empiezan con `is_onboarded: 0` y `reserve_points: 0`. Así, la primera pasada sobre una BD nueva da el mismo resultado que las siguientes. No hay un script para sembrar estudiantes: se retiró `npm run seed:student`, que apuntaba a un archivo inexistente.

### Matriz de Cobertura de Pruebas (69 Tests / 21 Suites)

Las reglas que dependen del tiempo real (visualización mínima de videos y duración mínima de partidas) solo rigen con `NODE_ENV=production`, por eso no entran en esta suite, que corre en desarrollo. Se verifican arrancando la API en producción: un video sin inicio o completado de inmediato responde `403`, un resultado instantáneo `422`, y el uso legítimo se acepta (video a los 75 s, partida de 32 s).

| Suite | Archivo de Prueba | Escenarios Validados |
| :--- | :--- | :--- |
| **01** | **`01-course.test.js`** | Carga correcta del dashboard del curso tras login y verificación de landing page pública. |
| **02** | **`02-simulator.test.js`** | Partida simulada en la página de práctica (resultado igual al que reporta Unity) y acreditación de 10 Puntos de Reserva decidida por la API. |
| **03** | **`03-exam-locked.test.js`** | Bloqueo estricto del examen si el navegador no cuenta con acceso a una cámara web funcional. |
| **04** | **`04-exam-flow.test.js`** | Flujo completo de evaluación: inicio, carga de banco de preguntas, respuesta secuencial y calificación. |
| **05** | **`05-proctoring-block.test.js`** | Suspensión automática del examen ante eventos simulados de violación biométrica. |
| **06** | **`06-focus-loss.test.js`** | Despliegue del overlay protector y registro de telemetría forense cuando la ventana pierde el foco. |
| **07** | **`07-admin-dashboard.test.js`** | Aislamiento de rutas administrativas, bloqueo de estudiantes en `/admin`, renderizado de registros IES y descarga de constancias. |
| **08** | **`08-security-and-verify.test.js`** | Inmutabilidad del costo de comodines en servidor, secuencialidad estricta de pasos de curso y validación pública en `/api/verify/:code`. |
| **09** | **`09-auth-and-payload-chaos.test.js`** | **Caos de Autenticación y Payloads:** Inyecciones SQL (`' OR 1=1 --`), tipos malformados (objetos/arrays en login), tiempo constante anti-timing para correos inexistentes, tokens JWT truncados/falsificados/basura en cookies y headers, logout con expiración de cookies, validación estricta de descriptores biométricos (longitud != 128, NaN, IDs inexistentes) y verificación de cifrado AES-256-GCM en reposo. |
| **10** | **`10-simulator-and-points-chaos.test.js`** | **Integridad Financiera y Simulador:** Rechazo de puntos negativos, nulos, NaN o flotantes (`-50`, `0`, `999999`); bloqueo de path traversal en `source` (`../../etc/passwd`); bloqueo de doble otorgamiento por re-envío en módulos ya aprobados; tope global inviolable de 500 Puntos de Reserva; y descarte de mensajes `postMessage` con el formato real de Unity que no provienen del iframe del simulador (origen falso o la propia ventana), sin llamadas a la API. |
| **11** | **`11-exam-resilience-and-edge-cases.test.js`** | **Resiliencia de Examen y Límites:** Rechazo de respuestas vacías, arrays malformados, preguntas duplicadas o IDs inexistentes; cumplimiento estricto del límite fatal de 3 intentos descalificando reintentos con HTTP 403 Forbidden; bloqueo de re-evaluación para exámenes ya aprobados con HTTP 409 Conflict; y validación atómica en servidor para uso de comodines (rechazo con puntos insuficientes o IDs de pregunta no válidos). |
| **12** | **`12-proctoring-and-camera-edge-cases.test.js`** | **Anti-Cheat y Cámaras Virtuales:** Detección y bloqueo inmediato de streams de video falsificados (OBS Virtual Camera, ManyCam, vCam, Snap Camera) con despliegue de alerta en pantalla; rechazo y cierre de conexiones WebSocket de proctoring sin cookie JWT válida o con tokens corruptos; y escalamiento progresivo de advertencias visuales en el visor de examen antes del baneo definitivo. |
| **13** | **`13-verification-and-admin-chaos.test.js`** | **Fuzzing de Verificación y Paginación Admin:** Resistencia de la ruta pública de verificación ante payloads XSS (`<script>alert(1)</script>`), strings de 5000+ caracteres y secuencias SQLi; respuesta estructurada de certificados emitidos verificando firma y prefijo binario `%PDF-`; denegación estricta (`403 Forbidden`) para generación de certificados de alumnos sin curso o examen completado; y sanitización de parámetros de paginación admin (`page=-5`, `limit=99999999`, strings) con clampeo automático seguro. |
| **14** | **`14-frontend-resilience-and-video-scrubbing.test.js`** | **Resiliencia de UI y Anti-Adelanto de Video:** Interceptación y reversión automática de saltos temporales no autorizados en el reproductor de video educativo (`currentTime` scrub revertido al progreso real visto); preservación y restauración de respuestas marcadas en el examen tras recargas accidentales (`F5` o caída de pestaña) vía `sessionStorage`; y redirección forzada a `/login` al intentar navegar a rutas protegidas (`/course`, `/exam`, `/admin`) sin credenciales válidas. |
| **15** | **`15-student-single-sitting-flow.test.js`** | **Recorrido Integral en una Sola Sentada (UI/UX):** Flujo completo continuo de estudiante nuevo desde el registro inicial y primer login, redirección automática a Onboarding, diligenciamiento de datos de filiación y aceptación de Habeas Data, enrolamiento biométrico facial (128 flotantes cifrados AES-256-GCM), bienvenida al Quirófano Virtual (0%), interacción y ganancia de Puntos de Reserva en simulador en vivo, avance secuencial por los 26 pasos del curso (jugando una partida en cada minijuego del módulo 1), desbloqueo reactivo del examen final, uso de comodín 50/50 consumiendo puntos, aprobación con 100%, renderizado del banner de graduado y validación de descarga de certificado oficial con cabecera binaria `%PDF-`. Incluye 11 capturas de pantalla de la UI/UX. |
| **16** | **`16-student-spaced-interaction-flow.test.js`** | **Aprendizaje Espaciado Multisesión (UI/UX):** Simulación de un estudiante real a lo largo de un período de 27 días con intervalos de 3 días por sesión, avanzando a un ritmo del ~10% por sesión (2 a 3 pasos por interacción). En cada sesión se valida el cierre de sesión (`/api/logout`), la persistencia inmutable del progreso, los módulos aprobados y los puntos de reserva al reingresar por `/login`, la secuencialidad estricta (pasos posteriores bloqueados con candado), la finalización gradual de los módulos 1 al 5 (el módulo 1 con sus 3 videos y 3 partidas en el simulador) y la graduación exitosa en la sesión 10 con examen aprobado y certificado generado. Incluye 7 capturas de pantalla de la experiencia visual. |
| **17** | **`17-admin-cohorts-and-compliance.test.js`** | **Gestión de Promociones, Correo de Inducción y Estándar IES:** Matriculación de estudiantes en promociones segregadas (*Promoción 1*, *Promoción 2*), verificación del despacho automático del correo de confirmación de matrícula con credenciales, fecha habilitada de inicio y guía de 5 pasos en `email_logs`; filtrado dinámico en tiempo real por cohorte en el panel administrativo; evaluación interactiva del Modal de Estándar IES demostrando rechazo fundamentado en estudiantes en curso y otorgamiento del veredicto *"CUMPLE EL ESTÁNDAR (Aval IES)"* para estudiantes graduados (6 criterios con check verde y código SHA-256); y exportación legal en archivo CSV para auditoría ministerial e IES con UTF-8 BOM. |
| **18** | **`18-admin-qol-and-audit-tools.test.js`** | **Herramientas de Calidad de Vida (QoL) y Auditoría Ministerial:** Descarga y validación binaria (`%PDF-`) del Acta Colectiva / Libro de Calificaciones IES con membrete formal y códigos QR; sellado y cierre criptográfico inmutable de promociones mediante hash SHA-256 (con bloqueo `409 Conflict` ante intentos de re-cierre); reenvío instantáneo de correos de inducción y guía operativa con trazabilidad forense; y detección de rezago académico (+7 días) con cálculo automático en UI y despacho de recordatorios personalizados. |
| **19** | **`19-module1-simulator-integration.test.js`** | **Módulo 1 de punta a punta:** la malla del cliente coincide con `COURSE_STEPS` del servidor (26 pasos, módulo 1 = 3 videos + 3 minijuegos) y cada video tiene su duración registrada; los videos definitivos se sirven (con sesión) con soporte de rangos y *faststart*; un minijuego aporta como máximo 50 puntos; API del simulador (secuencia, escena/fase decididas por la API, niveles 10/5/0, idempotencia, fase y tiempo incoherentes rechazados, techo de 500, finalizar exige una partida, 409 tras finalizar, un estudiante no puede usar la partida de otro); contrato del iframe con un build simulado que habla el mismo protocolo que Unity (URL de lanzamiento, mensajes de otro intento ignorados, resultado registrado y acuse `phase-ack` devuelto al simulador); y, si existe `client/public/webgl`, el build real: Unity carga en el iframe, lee el lanzamiento y procesa el acuse en C#. |
| **20** | **`20-exam-integrity-and-proctoring.test.js`** | **Integridad del examen y proctoring en servidor:** sin intento abierto no hay preguntas, envío ni comodín (409); el set de preguntas es fijo por intento; se rechazan respuestas fuera de `a`–`d` o de otras preguntas; la calificación no revela qué respuestas fueron correctas y cierra el intento; quien ya aprobó no puede abrir otro; la página muestra el motivo real cuando la API rechaza las preguntas o el inicio (curso incompleto, 3 intentos agotados) en lugar de caerse; y, por WebSocket, la supervisión suspende sin rostro, cierra el intento en el servidor y no castiga a quien terminó con `end_exam`. |
| **21** | **`21-content-protection-and-video-watch.test.js`** | **Contenido protegido y visualización de videos:** sin sesión, videos, build WebGL, PDF e imágenes del curso responden `401` y abrir un PDF lleva al login; con sesión se sirven con `Cache-Control: private`; el backend ya no publica las fuentes Markdown de `ArcoC/public`; el inicio de reproducción se registra una sola vez, solo para videos y respetando la secuencia; y la página lo registra al reproducir. |

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

*C-Arm Master MVP — Versión 1.1.0. Documentación consolidada y actualizada al 6 de octubre de 2026.*
