// Malla del curso. Las claves (key) deben coincidir con COURSE_STEPS en
// server/config/curriculum.js; el test e2e 19 verifica que ambas listas sean iguales.
//
// Cada módulo tiene 3 videos y 3 minijuegos intercalados (video → su minijuego): 30 pasos.
// Módulo 1 (contenido definitivo): videos generados con scripts/prepare-module-videos.ps1 en
// public/videos/modulo1/. Módulos 2–5: videos placeholder y minijuegos «en desarrollo» hasta que
// exista su contenido (lo que falta lo muestra el panel del admin: Preparación del lanzamiento).
export const courseModules = [
  {
    id: 1,
    title: "Módulo 1: Fundamentos de Fluoroscopía",
    pdfLink: "/documents/lectura_parte1.pdf",
    items: [
      { key: 'm1_v1', type: 'video', title: 'Video 1: Historia, Física y Pilares S.E.R.', description: 'Wilhelm Röntgen (1895), generación del haz a 70 kV y los pilares de Seguridad, Eficiencia y Responsabilidad.', icon: '🎥', iconClass: 'cyan', videoSrc: '/videos/modulo1/M01_V01_SER.mp4' },
      { key: 'm1_s1', type: 'interactive', title: 'Minijuego 1: Protocolo Cero', description: 'Identifica los componentes del arco en C, corrige su orientación y verifica frenos y equipo de protección antes del primer disparo.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m1_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm1_v2', type: 'video', title: 'Video 2: Densidades, Unidades y Normativa', description: 'Tejidos radiopacos vs radiolúcidos, Gray vs Sievert, escala AO Trauma y límite legal de 20 mSv/año (Res. 1811).', icon: '🎥', iconClass: 'cyan', videoSrc: '/videos/modulo1/M01_V02_Fisica.mp4' },
      { key: 'm1_s2', type: 'interactive', title: 'Minijuego 2: Maestro del Haz', description: 'Ajusta kVp, mA y colimación, y toma distancia del haz para lograr una exposición óptima con la mínima dispersión.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m1_s2', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm1_v3', type: 'video', title: 'Video 3: Geometría del Arco en C', description: 'Isocentro, ejes de rotación y proyecciones: la geometría para posicionar el arco con precisión desde el primer disparo.', icon: '🎥', iconClass: 'cyan', videoSrc: '/videos/modulo1/M01_V03_Geometria.mp4' },
      { key: 'm1_s3', type: 'interactive', title: 'Minijuego 3: Comando Isocentro', description: 'Ordena los movimientos del arco para alinear el isocentro y obtener la proyección que pide cada caso clínico.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m1_s3', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
    ]
  },
  {
    id: 2,
    title: "Módulo 2: Riesgos y Dosis",
    pdfLink: "/documents/lectura_parte2.pdf",
    items: [
      { key: 'm2_v1', type: 'video', title: 'Video 1: Efectos Biológicos, ALARA y Límites 2026', description: 'Daño determinístico vs estocástico, tríada ALARA, límite ocular ICRP 118 (20 mSv/año) y dosimetría activa en tiempo real.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm2_s1', type: 'interactive', title: 'Minijuego 1: Centinela Dosimétrico', description: 'Monitorea el semáforo de dosimetría activa y aplica tiempo pulsado y distancia (1/d²) para mantener las dosis bajo los límites ICRP 118.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m2_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm2_v2', type: 'video', title: 'Video 2: Blindaje EPP, Control y Gestación', description: 'Atenuación del mandil (16x/4x), collarín tiroideo (-88.9%) y desinfección, grietas por doblado, embarazo (1 mSv) y telas DRF.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm2_s2', type: 'interactive', title: 'Minijuego 2: Escáner de Blindaje', description: 'Detecta mandiles fisurados en fluoroscopia, equipa doble blindaje gestacional con dosímetro abdominal y posiciona mantas DRF fuera del ROI.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m2_s2', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm2_v3', type: 'video', title: 'Video 3: Scatter, "Hug the Intensifier" y Protocolo 5-P', description: 'Dispersión 80/20/2 en el paciente, tubo abajo, regla lateral (25x torso), perímetro de 2 metros (6 pies) y aviso verbal ¡Disparo!.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm2_s3', type: 'interactive', title: 'Minijuego 3: Zona Segura 5-P', description: 'Reubica al equipo del lado del intensificador, despeja el perímetro controlado de 2 metros y completa el Checklist 5-P antes de disparar.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m2_s3', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
    ]
  },
  {
    id: 3,
    title: "Módulo 3: Anatomía del Fluoroscopio",
    pdfLink: "/documents/lectura_parte3.pdf",
    items: [
      { key: 'm3_v1', type: 'video', title: 'Video 1: Anatomía del Arco, FPD vs. II e IA', description: 'Los 4 bloques, colimación y LIH, salto del intensificador II al panel plano FPD, IA Denoising a 4–8 pps, CBCT 3D e isocentrismo.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm3_s1', type: 'interactive', title: 'Minijuego 1: Arquitecto del Haz', description: 'Identifica distorsiones II vs FPD, cierra el colimador iris, planifica con LIH y compensa altura en equipos no isocéntricos.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m3_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm3_v2', type: 'video', title: 'Video 2: Consolas Multi-Marca, SSD y Perlas', description: 'Distancia foco-piel (SSD >= 30/20 cm), trampa del zoom (300%), modos GE/Philips/Siemens/Ziehm, Metal Mode y rejilla pediátrica.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm3_s2', type: 'interactive', title: 'Minijuego 2: Maestro de Consola', description: 'Configura dosis pulsada por marca sin Modo Cine, corrige la sobrecarga ABC de separadores metálicos y retira la rejilla en pediatría.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m3_s2', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm3_v3', type: 'video', title: 'Video 3: Cinemática 8-DoF y Protocolo Verbal', description: 'Palancas por color, modelo robótico 8-DoF y algoritmo CLIK anti-colisión, protección de manos y órdenes verbales exactas (Yeo 2013).', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm3_s3', type: 'interactive', title: 'Minijuego 3: Navegador 8-DoF', description: 'Libera frenos por color sin chocar, angula el cono lejos de las manos y emite comandos verbales métricos y angulares en <= 6 disparos.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m3_s3', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
    ]
  },
  {
    id: 4,
    title: "Módulo 4: Proyecciones Miembro Inferior",
    pdfLink: "/documents/lectura_parte4.pdf",
    items: [
      { key: 'm4_v1', type: 'video', title: 'Video 1: Pelvis, Cadera y Enclavado (AO Estación 3)', description: 'Mesa de tracción y entrada a 45°, masa tisular y ABC, regla lateral del receptor, detector pegado y tornillo Centro-Centro anti cut-out.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm4_s1', type: 'interactive', title: 'Minijuego 1: Estación Cadera (AO 3)', description: 'Ingresa el arco a 45° en mesa de tracción, protege al equipo en axial translateral y posiciona el tornillo cefálico Centro-Centro.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m4_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm4_v2', type: 'video', title: 'Video 2: Rodilla, Diáfisis y Puntería Láser (Shuler 2013)', description: 'Ortogonalidad estricta a 90°, lateral condilar rotando la pierna y evidencia clínica del láser (-39% rodilla vs 0% cadera obesa).', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm4_s2', type: 'interactive', title: 'Minijuego 2: Ortogonalidad y Láser', description: 'Aplica puntería láser donde es efectiva, alinea cóndilos rotando la extremidad del paciente y valida reducción en AP y Lateral a 90°.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m4_s2', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm4_v3', type: 'video', title: 'Video 3: Tobillo, Mortaja (AO Estación 4) y Control 3D', description: 'Proyección de mortaja a 15°-20° de rotación interna, sindesmosis, puntería láser (-29%) y escaneo CBCT 3D para tornillos articulares.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm4_s3', type: 'interactive', title: 'Minijuego 3: Mortaja y Barrido 3D', description: 'Despeja la mortaja tibioperonea a 15°-20°, ejecuta un barrido CBCT 3D e identifica tornillos intraarticulares antes del cierre.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m4_s3', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
    ]
  },
  {
    id: 5,
    title: "Módulo 5: Proyecciones Miembro Superior",
    pdfLink: "/documents/lectura_parte5.pdf",
    items: [
      { key: 'm5_v1', type: 'video', title: 'Video 1: Hombro, Húmero y Codo (AO Estación 1)', description: 'Silla de playa, AP verdadera de Grashey y vista en Y para tornillos calcar, y flexión de codo a 90° bajo haz vertical sin rotar el gantry.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm5_s1', type: 'interactive', title: 'Minijuego 1: Hombro y Codo Ortogonal', description: 'Obtén la vista de Grashey en silla de playa, descarta invasión de tornillos calcar y posiciona el codo a 90° en mesa radiolúcida.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m5_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm5_v2', type: 'video', title: 'Video 2: Radio Distal, Escafoides y Mini C-Arm', description: 'Oblicuas a 20°-30° (DRUJ y tendón EPL, AO Estación 2), escafoides, efecto mesa x10 en Mini C-Arm y mito de los guantes plomados.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm5_s2', type: 'interactive', title: 'Minijuego 2: Muñeca y Manos Fuera del Haz', description: 'Detecta tornillos en DRUJ y cortical dorsal EPL, posiciona el escafoides y opera el Mini C-Arm con mesa independiente y pinzas largas.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m5_s2', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm5_v3', type: 'video', title: 'Video 3: Columna Vertebral, Paralelaje y Cierre', description: 'Centrado vertebral anti-paralelaje, C7-T1, dosimetría espinal con giro cefálico 90° (Lee 2012), control 3D/O-Arm y cierre hacia el examen.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm5_s3', type: 'interactive', title: 'Minijuego 3: Desafío Espinal 3D', description: 'Centra la vértebra para eliminar el paralelaje, aplica giro de cabeza 90° en lateral y detecta en 3D tornillos invadiendo el canal medular.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m5_s3', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
    ]
  }
];

export const ALL_STEPS = courseModules.flatMap(mod => mod.items.map(item => item.key));

/** Datos de cada paso por su clave (título, tipo y módulo), para paneles y reportes. */
export const STEP_INFO = Object.fromEntries(
  courseModules.flatMap(mod => mod.items.map(item => [item.key, { ...item, moduleId: mod.id, moduleTitle: mod.title }]))
);
