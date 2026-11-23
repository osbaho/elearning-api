// Malla del curso. Las claves (key) deben coincidir con COURSE_STEPS en
// server/config/curriculum.js; el test e2e 19 verifica que ambas listas sean iguales.
//
// Módulo 1 (contenido definitivo): cada video va seguido de su minijuego en Unity.
// Los videos se generan con scripts/prepare-module-videos.ps1 en public/videos/modulo1/.
// Módulos 2–5: videos placeholder hasta que exista su contenido definitivo.
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
      { key: 'm2_v1', type: 'video', title: 'Video 1: Principio ALARA y Blindaje EPP', description: 'Tiempo, distancia y blindaje: atenuación de mandil (16x/4x), tiroides (2.5x), gafas ICRP 118 (20 mSv) y telas DRF.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm2_s1', type: 'interactive', title: 'Minijuego 1', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m2_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm2_v2', type: 'video', title: 'Video 2: Scatter y Regla "Hug the Intensifier"', description: 'Física del scatter 80/20/2, riesgo lateral (25x torso), desmitificación de los 3 pies (Shuler 2013) y aviso verbal ¡Disparo!.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm2_s2', type: 'interactive', title: 'Minijuego 2', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m2_s2', linkText: 'Comenzar Práctica', completedText: 'Práctica Finalizada' },
      { key: 'm2_vr', type: 'video', title: 'Video Recopilatorio: Radioprotección de Quirófano', description: 'Repaso general de todo el módulo (máx 3 minutos).', icon: '📼', iconClass: 'purple', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
    ]
  },
  {
    id: 3,
    title: "Módulo 3: Anatomía del Fluoroscopio",
    pdfLink: "/documents/lectura_parte3.pdf",
    items: [
      { key: 'm3_v1', type: 'video', title: 'Video 1: Componentes y Modos de Adquisición', description: 'Tubo, colimador iris, FPD, consola dual LIH, arcos isocéntricos y penalización de dosis por magnificación.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm3_s1', type: 'interactive', title: 'Minijuego 1', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m3_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm3_v2', type: 'video', title: 'Video 2: Cinemática 8-DoF y Optimización ALARA', description: 'Modelado redundante de 8 grados de libertad (Shao et al. 2014), algoritmo CLIK y protección geométrica de manos.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm3_s2', type: 'interactive', title: 'Minijuego 2', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m3_s2', linkText: 'Comenzar Práctica', completedText: 'Práctica Finalizada' },
      { key: 'm3_vr', type: 'video', title: 'Video Recopilatorio: Anatomía y Control Robótico', description: 'Repaso general de todo el módulo (máx 3 minutos).', icon: '📼', iconClass: 'purple', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
    ]
  },
  {
    id: 4,
    title: "Módulo 4: Proyecciones Miembro Inferior",
    pdfLink: "/documents/lectura_parte4.pdf",
    items: [
      { key: 'm4_v1', type: 'video', title: 'Video 1: Pelvis y Fémur Proximal (AO Estación 3)', description: 'Mesa de tracción, manejo de masa tisular, proyecciones AP/axial y tornillo cefálico en posición centro-centro.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm4_s1', type: 'interactive', title: 'Minijuego 1', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m4_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm4_v2', type: 'video', title: 'Video 2: Rodilla, Tobillo y Puntería Láser (AO Estación 4)', description: 'Puntería láser (Shuler 2013), proyección de mortaja a 15°-20° de rotación interna y escaneo 3D intraoperatorio.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm4_s2', type: 'interactive', title: 'Minijuego 2', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m4_s2', linkText: 'Comenzar Práctica', completedText: 'Práctica Finalizada' },
      { key: 'm4_vr', type: 'video', title: 'Video Recopilatorio: Trauma de Miembro Inferior', description: 'Repaso general de todo el módulo (máx 3 minutos).', icon: '📼', iconClass: 'purple', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
    ]
  },
  {
    id: 5,
    title: "Módulo 5: Proyecciones Miembro Superior",
    pdfLink: "/documents/lectura_parte5.pdf",
    items: [
      { key: 'm5_v1', type: 'video', title: 'Video 1: Húmero, Radio Distal y Alerta Mini C-Arm', description: 'Silla de playa, tornillos de radio distal (DRUJ y tendón EPL), y advertencia sobre riesgo de manos en Mini C-arm.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm5_s1', type: 'interactive', title: 'Minijuego 1', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m5_s1', linkText: 'Comenzar Minijuego', completedText: 'Minijuego Finalizado' },
      { key: 'm5_v2', type: 'video', title: 'Video 2: Columna Vertebral y Dosimetría Espinal', description: 'Paralelaje vertebral, estudio Lee et al. (2012) en Spine, maniobra de giro de cabeza a 90° y detección 3D.', icon: '🎥', iconClass: 'cyan', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
      { key: 'm5_s2', type: 'interactive', title: 'Minijuego 2', description: 'Pon a prueba lo aprendido de forma práctica.', icon: '🎮', iconClass: 'green', linkHref: '/course/practice/m5_s2', linkText: 'Comenzar Práctica', completedText: 'Práctica Finalizada' },
      { key: 'm5_vr', type: 'video', title: 'Video Recopilatorio: Cierre Integral y Examen Final', description: 'Repaso general de todo el módulo (máx 3 minutos).', icon: '📼', iconClass: 'purple', videoSrc: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_URL || '/videos/placeholder.mp4' },
    ]
  }
];

export const ALL_STEPS = courseModules.flatMap(mod => mod.items.map(item => item.key));
