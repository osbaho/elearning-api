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
    subgraph CLIENT["🖥️ Frontend — Next.js 14+ (App Router) :3000"]
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
├── playwright.config.js           # Configuración de pruebas E2E
├── .env.example                   # Plantilla de variables de entorno backend
│
├── docs/
│   └── guiones/                   # Guiones técnicos audiovisuales para generación IA (Módulos 1-5)
│
├── public/
│   ├── documents/                 # Fuentes en Markdown (Lecturas 1-5, Guía Rápida de Bolsillo, convert.js)
│   └── images/                    # Archivos fuente del Atlas Radiológico (Módulos 1-5)
│
├── scripts/
│   └── enrich_lecturas_with_images.py # Script de automatización de inyección de imágenes clínicas
│
├── server/
│   ├── config/
│   │   └── db.js                  # Abstracción dual SQLite/PostgreSQL y migraciones
│   ├── middleware/
│   │   ├── auth.js                # Validación de JWT (cookies y headers) y rol admin
│   │   └── rateLimiter.js         # Rate limiting global y login limiter
│   ├── routes/
│   │   ├── auth.js                # Rutas de login, logout, me, descriptor, onboarding
│   │   ├── exam.js                # Preguntas, inicio, comodines, calificación, verificación
│   │   ├── progress.js            # Marcado de pasos con validación secuencial
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
│   ├── next.config.mjs            # Configuración de Next.js
│   ├── .env.example               # Plantilla de variables de entorno frontend
│   ├── public/
│   │   ├── models/                # Modelos pre-entrenados de Face-API.js
│   │   ├── documents/             # PDFs oficiales compilados (Lecturas 1-5 y Guía Rápida de Bolsillo)
│   │   └── images/                # Atlas Radiológico clínico AO Trauma (Módulos 1-5)
│   └── src/
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
│       │   ├── SimulatorView.js   # Puente interactivo para simuladores Unity + Atlas Radiológico modal
│       │   └── ProtectedRoute.js  # Guardián de rutas por autenticación y rol
│       ├── context/
│       │   ├── AuthContext.js     # Estado reactivo global de usuario
│       │   └── ToastContext.js    # Notificaciones accesibles (ARIA live)
│       ├── hooks/
│       │   └── useProctoring.js   # Hook para cámara, face-api y WebSockets
│       └── lib/
│           └── courseConfig.js    # Configuración de los 25 pasos del curso con títulos clínicos
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

---

## 4. Flujos de Autenticación y Sesión

* **Tokens JWT:** Firmados con clave de 32+ caracteres (`JWT_SECRET`) y vigencia de 12 horas.
* **Entrega de Cookies Seguras:** La cookie de autenticación (`token`) se emite con directivas `HttpOnly; SameSite=lax; Path=/`. En entornos de producción activa `Secure=true`.
* **Timing-Attack Resilience:** En caso de que un correo electrónico no exista en la base de datos, el backend ejecuta un hash simulado mediante `bcrypt.compare` contra una cadena predeterminada, neutralizando la enumeración de usuarios por discrepancias en tiempos de respuesta.
* **Socket Authentication:** El handshake de WebSockets extrae e inspecciona automáticamente la cookie HTTP mediante el parser tolerante a versiones de Node.js, impidiendo la apertura de canales de proctoring a clientes sin token válido.

---

## 5. Estructura del Curso y Secuencialidad

El programa académico consta de **5 módulos temáticos**, cada uno subdividido en **5 pasos estrictos (25 pasos en total)**:
1. `mX_v1`: Video 1 (Fundamentación teórica y física aplicada).
2. `mX_s1`: Minijuego interactivo 1 (Práctica de parámetros, angulaciones y estaciones AO Trauma).
3. `mX_v2`: Video 2 (Profundización técnica, cinemática robótica y radioprotección avanzada).
4. `mX_s2`: Minijuego interactivo 2 (Optimización de dosis, colimación y destreza operativa).
5. `mX_vr`: Video Recopilatorio (Síntesis de cierre y preparación para evaluación).

### Enforce de Secuencialidad Backend
El endpoint `POST /api/progress/:moduleId` valida en el servidor la lista ordenada `ALL_STEPS`. Para marcar cualquier paso `n`, el paso `n-1` debe existir previamente en estado `'completed'` en `course_progress`. El módulo `'exam'` está protegido contra marcado manual: solo el endpoint `/api/submit-exam` puede otorgarlo tras calificar formalmente con puntaje ≥ 90%.

### Control de Visualización en Videos ([`VideoPlayer.js`](file:///c:/Oscar/ArcoC/client/src/components/VideoPlayer.js))
* **Detección de Adelanto No Autorizado (Anti-Scrubbing):** Si el estudiante intenta saltar a una marca de tiempo superior a la observada de forma continua (+2 segundos de tolerancia), el reproductor revierte inmediatamente el cursor al tiempo máximo visto legítimamente y muestra una advertencia visual.
* **Condición de Finalización:** El callback `onComplete` únicamente se dispara cuando el usuario ha reproducido al menos el **90%** de la duración del video de forma continua.

---

## 6. Simulador y Puntos de Reserva

Los estudiantes acumulan **Puntos de Reserva** al realizar actividades prácticas en los minijuegos interactivos. Estos puntos se utilizan como moneda de canje para activar comodines de ayuda durante el examen final.

### Reglas de Negocio en Servidor ([`server/routes/exam.js`](file:///c:/Oscar/ArcoC/server/routes/exam.js))
1. **Límite por Evento:** Máximo 100 puntos por llamada.
2. **Techo Global:** Máximo acumulable de 500 Puntos de Reserva por estudiante.
3. **Validación de Fuente:** El parámetro `source` debe corresponder a un módulo práctico válido (`m[1-5]_(s1|s2)`).
4. **Idempotencia de Puntos:** Si el módulo indicado en `source` ya figura como completado en `course_progress`, el servidor rechaza la solicitud para evitar la recolección repetitiva de puntos en un mismo ejercicio.
5. **Comunicación WebGL Segura:** El componente [`SimulatorView.js`](file:///c:/Oscar/ArcoC/client/src/components/SimulatorView.js) valida los orígenes permitidos (`ALLOWED_SIMULATOR_ORIGINS`) en los eventos `window.postMessage`, evitando la inyección de puntajes desde dominios o iframes no autorizados.

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

    Estudiante->>UI: Clic en "Comenzar Examen"
    UI->>API: POST /api/start-exam
    API->>DB: Incrementa exam_attempts (+1)
    API-->>UI: { success: true }
    UI->>WS: emit('start_exam')
    UI->>API: GET /api/questions (Requiere 25 pasos en prod)
    API-->>UI: 10 preguntas aleatorias (Fisher-Yates)

    loop Durante el Examen
        UI->>WS: emit('proctoring_heartbeat', { faceDetected, isMatch })
        Note over WS: Monitor valida latido cada 10s.<br/>Si >15s sin señal: emit('proctoring_warning')<br/>Si >30s o 3 fallas: emit('exam_suspended')
        opt Comodín 50/50
            UI->>API: POST /api/use-wildcard { question_id }
            API->>DB: Debita 100 pts (Costo fijo en servidor)
            API-->>UI: { eliminate_options: ['a', 'c'], reservePoints: 50 }
        end
    end

    Estudiante->>UI: Clic en "Enviar Respuestas"
    UI->>API: POST /api/submit-exam { answers }
    API->>DB: Califica contra BD (Re-fetch, no confía en cliente)
    API->>DB: Transacción: Actualiza exam_score = MAX(actual, previo)
    alt Calificación >= 90%
        API->>DB: INSERT INTO course_progress (module_id = 'exam')
        API-->>UI: Aprobado (Habilita descarga de certificado)
    else Calificación < 90%
        API-->>UI: Reprobado (Muestra opciones de reintento si attempts < 3)
    end
```

### Reglas Críticas Implementadas:
* **Costo Inmutable del Comodín 50/50:** Fijado rígidamente en el servidor en **100 Puntos de Reserva**. Cualquier parámetro de costo enviado desde el navegador es descartado.
* **Límite de Intentos:** Restringido a un máximo de **3 intentos**. Superado este umbral, el endpoint `/api/start-exam` responde `403 Forbidden`.
* **Bloqueo de Reenvío Aprobado:** Si el estudiante ya posee el módulo `'exam'` aprobado en su historial, `/api/submit-exam` responde `409 Conflict`.
* **Calificación Atómica:** La evaluación se calcula únicamente en el servidor comparando las respuestas enviadas contra la base de datos. Se emplea `withTransaction` para garantizar que la nota máxima registrada sea `MAX(puntaje_actual, puntaje_previo)`.
* **Persistencia de Sesión Local:** La UI guarda las respuestas seleccionadas y opciones eliminadas en `sessionStorage` para resistir cierres accidentales o recargas de pestaña.

---

## 8. Sistema de Proctoring Biométrico (WebRTC + WebSockets)

La supervisión remota en tiempo real se orquesta entre [`useProctoring.js`](file:///c:/Oscar/ArcoC/client/src/hooks/useProctoring.js) y el monitor de latidos en [`server.js`](file:///c:/Oscar/ArcoC/server.js).

### Arquitectura de Supervisión
1. **Onboarding:** En `/onboarding`, el alumno captura su rostro. Face-API genera un descriptor facial (Float32Array de 128 elementos) que se almacena cifrado en base de datos.
2. **Carga Protegida:** Al iniciar el examen, el cliente consulta `GET /api/student/descriptor` para obtener su descriptor registrado en memoria.
3. **Bucle Local de Detección:** Cada 3 segundos, el navegador ejecuta `detectSingleFace().withFaceLandmarks().withFaceDescriptor()`.
4. **Verificación de Coincidencia:** Se calcula la distancia euclidiana entre el rostro detectado en vivo y el descriptor de referencia:
   $$\text{Distancia} < 0.6 \implies \text{Identidad Confirmada}$$
5. **Heartbeat WebSocket:** Se emite periódicamente el evento `'proctoring_heartbeat'` al backend con el estado de presencia e identidad.

### Tolerancia y Estados del Monitor en Servidor (Cada 10 segundos)
* **Advertencia Temprana (15 segundos):** Si transcurren más de 15 segundos sin recibir un latido (pero menos de 30s), el servidor emite `'proctoring_warning'`. La interfaz del estudiante despliega un banner de aviso preventivo en la barra lateral para corregir su conexión o postura.
* **Pérdida Crítica de Señal (30 segundos):** Si la desconexión supera los 30 segundos, se suspende el examen de forma permanente emitiendo `'exam_suspended'`, incrementando `proctoring_incidents` y registrando el evento `PROCTORING_EXPIRED`.
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
| **Ataque de Denegación de Servicio (DoS)** | Limitador global de 200 peticiones cada 15 min y límite de tamaño en bodies JSON fijado en `10kb`. |
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
```

### 2. Variables de Entorno del Frontend (`client/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_ENABLE_MOCK_CAMERA=false # Estrictamente false en producción
```

### 3. Docker Compose
El archivo [`docker-compose.yml`](file:///c:/Oscar/ArcoC/docker-compose.yml) compila e interconecta:
* **carm-backend:** Basado en `Dockerfile.backend` (Node.js Alpine).
* **carm-frontend:** Basado en `Dockerfile.frontend` (Next.js multi-stage build optimizado).

### 4. Healthchecks y Graceful Shutdown
* Rutas `/health` y `/api/health` disponibles para balanceadores de carga y sondas de liveness/readiness.
* El proceso captura señales `SIGTERM` y `SIGINT`, cerrando las conexiones HTTP, limpiando los sockets activos de proctoring y forzando la sincronización de la base de datos SQLite a disco antes de finalizar.

---

## 13. Suite de Pruebas Automatizadas (Playwright)

El proyecto cuenta con un conjunto integral de **51 pruebas E2E automatizadas** organizadas en **18 suites especializadas** ejecutadas con Playwright. Cubre tanto los flujos nominales de certificación como pruebas de caos, penetración, fuzzing de payloads, condiciones de carrera, resiliencia extrema, los dos grandes recorridos completos de usuario (estudiante en una sola sentada y aprendizaje espaciado en múltiples sesiones), la supervisión administrativa por promociones con evaluación del estándar institucional y el conjunto de herramientas de calidad de vida (QoL) y gobernanza ministerial:

```bash
# Ejecutar todas las 18 suites E2E (51 pruebas completas)
npx playwright test

# Ejecutar las herramientas de auditoría QoL y sellado criptográfico
npx playwright test tests/e2e/18-admin-qol-and-audit-tools.test.js

# Ejecutar la suite de administración por promociones y estándar IES
npx playwright test tests/e2e/17-admin-cohorts-and-compliance.test.js

# Ejecutar el recorrido completo de estudiante en una sola sentada
npx playwright test tests/e2e/15-student-single-sitting-flow.test.js

# Ejecutar el recorrido de aprendizaje espaciado (intervalos de 3 días)
npx playwright test tests/e2e/16-student-spaced-interaction-flow.test.js
```

### Matriz de Cobertura de Pruebas (51 Tests / 18 Suites)

| Suite | Archivo de Prueba | Escenarios Validados |
| :--- | :--- | :--- |
| **01** | **`01-course.test.js`** | Carga correcta del dashboard del curso tras login y verificación de landing page pública. |
| **02** | **`02-simulator.test.js`** | Comunicación interactiva con el simulador y acreditación correcta de Puntos de Reserva en UI y BD. |
| **03** | **`03-exam-locked.test.js`** | Bloqueo estricto del examen si el navegador no cuenta con acceso a una cámara web funcional. |
| **04** | **`04-exam-flow.test.js`** | Flujo completo de evaluación: inicio, carga de banco de preguntas, respuesta secuencial y calificación. |
| **05** | **`05-proctoring-block.test.js`** | Suspensión automática del examen ante eventos simulados de violación biométrica. |
| **06** | **`06-focus-loss.test.js`** | Despliegue del overlay protector y registro de telemetría forense cuando la ventana pierde el foco. |
| **07** | **`07-admin-dashboard.test.js`** | Aislamiento de rutas administrativas, bloqueo de estudiantes en `/admin`, renderizado de registros IES y descarga de constancias. |
| **08** | **`08-security-and-verify.test.js`** | Inmutabilidad del costo de comodines en servidor, secuencialidad estricta de pasos de curso y validación pública en `/api/verify/:code`. |
| **09** | **`09-auth-and-payload-chaos.test.js`** | **Caos de Autenticación y Payloads:** Inyecciones SQL (`' OR 1=1 --`), tipos malformados (objetos/arrays en login), tiempo constante anti-timing para correos inexistentes, tokens JWT truncados/falsificados/basura en cookies y headers, logout con expiración de cookies, validación estricta de descriptores biométricos (longitud != 128, NaN, IDs inexistentes) y verificación de cifrado AES-256-GCM en reposo. |
| **10** | **`10-simulator-and-points-chaos.test.js`** | **Integridad Financiera y Simulador:** Rechazo de puntos negativos, nulos, NaN o flotantes (`-50`, `0`, `999999`); bloqueo de path traversal en `source` (`../../etc/passwd`); bloqueo de doble otorgamiento por re-envío en módulos ya aprobados; tope global inviolable de 500 Puntos de Reserva; y descarte defensivo de eventos `postMessage` fraudulentos o provenientes de orígenes no autorizados en el visor del simulador. |
| **11** | **`11-exam-resilience-and-edge-cases.test.js`** | **Resiliencia de Examen y Límites:** Rechazo de respuestas vacías, arrays malformados, preguntas duplicadas o IDs inexistentes; cumplimiento estricto del límite fatal de 3 intentos descalificando reintentos con HTTP 403 Forbidden; bloqueo de re-evaluación para exámenes ya aprobados con HTTP 409 Conflict; y validación atómica en servidor para uso de comodines (rechazo con puntos insuficientes o IDs de pregunta no válidos). |
| **12** | **`12-proctoring-and-camera-edge-cases.test.js`** | **Anti-Cheat y Cámaras Virtuales:** Detección y bloqueo inmediato de streams de video falsificados (OBS Virtual Camera, ManyCam, vCam, Snap Camera) con despliegue de alerta en pantalla; rechazo y cierre de conexiones WebSocket de proctoring sin cookie JWT válida o con tokens corruptos; y escalamiento progresivo de advertencias visuales en el visor de examen antes del baneo definitivo. |
| **13** | **`13-verification-and-admin-chaos.test.js`** | **Fuzzing de Verificación y Paginación Admin:** Resistencia de la ruta pública de verificación ante payloads XSS (`<script>alert(1)</script>`), strings de 5000+ caracteres y secuencias SQLi; respuesta estructurada de certificados emitidos verificando firma y prefijo binario `%PDF-`; denegación estricta (`403 Forbidden`) para generación de certificados de alumnos sin curso o examen completado; y sanitización de parámetros de paginación admin (`page=-5`, `limit=99999999`, strings) con clampeo automático seguro. |
| **14** | **`14-frontend-resilience-and-video-scrubbing.test.js`** | **Resiliencia de UI y Anti-Adelanto de Video:** Interceptación y reversión automática de saltos temporales no autorizados en el reproductor de video educativo (`currentTime` scrub revertido al progreso real visto); preservación y restauración de respuestas marcadas en el examen tras recargas accidentales (`F5` o caída de pestaña) vía `sessionStorage`; y redirección forzada a `/login` al intentar navegar a rutas protegidas (`/course`, `/exam`, `/admin`) sin credenciales válidas. |
| **15** | **`15-student-single-sitting-flow.test.js`** | **Recorrido Integral en una Sola Sentada (UI/UX):** Flujo completo continuo de estudiante nuevo desde el registro inicial y primer login, redirección automática a Onboarding, diligenciamiento de datos de filiación y aceptación de Habeas Data, enrolamiento biométrico facial (128 flotantes cifrados AES-256-GCM), bienvenida al Quirófano Virtual (0%), interacción y ganancia de Puntos de Reserva en simulador en vivo, avance secuencial por los 25 pasos del curso, desbloqueo reactivo del examen final, uso de comodín 50/50 consumiendo puntos, aprobación con 100%, renderizado del banner de graduado y validación de descarga de certificado oficial con cabecera binaria `%PDF-`. Incluye 11 capturas de pantalla de la UI/UX. |
| **16** | **`16-student-spaced-interaction-flow.test.js`** | **Aprendizaje Espaciado Multisesión (UI/UX):** Simulación de un estudiante real a lo largo de un período de 27 días con intervalos de 3 días por sesión, avanzando a un ritmo del ~10% por sesión (2 a 3 pasos por interacción). En cada sesión se valida el cierre de sesión (`/api/logout`), la persistencia inmutable del progreso, los módulos aprobados y los puntos de reserva al reingresar por `/login`, la secuencialidad estricta (pasos posteriores bloqueados con candado), la finalización gradual de los módulos 1 al 5 y la graduación exitosa en la sesión 10 con examen aprobado y certificado generado. Incluye 7 capturas de pantalla de la experiencia visual. |
| **17** | **`17-admin-cohorts-and-compliance.test.js`** | **Gestión de Promociones, Correo de Inducción y Estándar IES:** Matriculación de estudiantes en promociones segregadas (*Promoción 1*, *Promoción 2*), verificación del despacho automático del correo de confirmación de matrícula con credenciales, fecha habilitada de inicio y guía de 5 pasos en `email_logs`; filtrado dinámico en tiempo real por cohorte en el panel administrativo; evaluación interactiva del Modal de Estándar IES demostrando rechazo fundamentado en estudiantes en curso y otorgamiento del veredicto *"CUMPLE EL ESTÁNDAR (Aval IES)"* para estudiantes graduados (6 criterios con check verde y código SHA-256); y exportación legal en archivo CSV para auditoría ministerial e IES con UTF-8 BOM. |
| **18** | **`18-admin-qol-and-audit-tools.test.js`** | **Herramientas de Calidad de Vida (QoL) y Auditoría Ministerial:** Descarga y validación binaria (`%PDF-`) del Acta Colectiva / Libro de Calificaciones IES con membrete formal y códigos QR; sellado y cierre criptográfico inmutable de promociones mediante hash SHA-256 (con bloqueo `409 Conflict` ante intentos de re-cierre); reenvío instantáneo de correos de inducción y guía operativa con trazabilidad forense; y detección de rezago académico (+7 días) con cálculo automático en UI y despacho de recordatorios personalizados. |

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
