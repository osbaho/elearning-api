# GUIONES DE PRODUCCIÓN HEYGEN VIDEO AGENT — MÓDULO 3: ANATOMÍA DEL FLUOROSCOPIO Y CINEMÁTICA QUIRÚRGICA

> **Configuración Global para HeyGen Video Agent:**
> * **Formato y relación de aspecto:** `16:9` horizontal (Full HD 1080p).
> * **Presentadora única (A-Roll):** **Dra. Nova** (*Custom Avatar* ya configurado en HeyGen). Toda la conducción y demostración recae en ella para lograr estabilidad en una sola generación sin cambios de hablante.
> * **Público objetivo:** Equipo completo de quirófano (instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos en radiología, residentes y cirujanos ortopédicos). Explicaciones visuales, claras y prácticas sin perder rigor técnico.
> * **Regla de siglas en inglés:** Toda sigla o término clave en inglés se desarrolla primero en inglés y se explica enseguida en español antes de continuar.
> * **Visuales (B-Roll y Gráficos):** Videos e imágenes de archivo **libres de derechos de autor** (arcos en C, monitores médicos, salas quirúrgicas) junto a animaciones esquemáticas 2D/3D y *lower-thirds* en español. Paleta institucional: azul marino oscuro, cian médico, blanco y acentos ámbar/rojo para alertas.
> * **Duración objetivo:** ~3:15 a 3:25 minutos por video (~465–510 palabras de locución).

---

## Mapa del Módulo 3 (3 Videos + 3 Minijuegos)

| Paso | Tipo | Título | Duración aprox. | Minijuego vinculado / Mecánica clave |
| :--- | :--- | :--- | :--- | :--- |
| `m3_v1` | Video 1 | Anatomía del Arco, Receptores FPD vs. II e IA en Tiempo Real | 3:15 min | Prepara para `m3_s1` (**Arquitecto del Haz**) |
| `m3_s1` | Minijuego 1 | Arquitecto del Haz (`M03_MG1_HardwareOptics`) | — | Colimación, LIH, FPD vs II y compensación isocéntrica |
| `m3_v2` | Video 2 | Consolas Multi-Marca, SSD y Perlas de Exposición | 3:25 min | Prepara para `m3_s2` (**Maestro de Consola**) |
| `m3_s2` | Minijuego 2 | Maestro de Consola (`M03_MG2_ConsoleMaster`) | — | Pulsado por marca, SSD, Metal Mode y rejilla pediátrica |
| `m3_v3` | Video 3 | Cinemática 8-DoF, Palancas y Protocolo Verbal en Bucle Cerrado | 3:15 min | Prepara para `m3_s3` (**Navegador 8-DoF**) |
| `m3_s3` | Minijuego 3 | Navegador 8-DoF (`M03_MG3_KinematicsNavigator`) | — | Frenos por color, evitar colisiones y órdenes verbales exactas |

---

# VIDEO 1 (`m3_v1`): Anatomía del Arco, Receptores FPD vs. II e IA en Tiempo Real
* **Archivo destino:** `M03_V01_Anatomia_FPD_IA.mp4`
* **Duración estimada:** ~3:15 minutos (~470 palabras)
* **Objetivo pedagógico:** Presentar los cuatro bloques funcionales del Arco en C, el doble beneficio del colimador y del *Last Image Hold (LIH)*, el salto tecnológico de los tubos intensificadores de imagen (II) hacia los detectores de panel plano (FPD) asistidos por inteligencia artificial (*denoising*), y el concepto de isocentrismo y escaneo 3D CBCT.
* **Siglas en inglés explicadas:** `LIH`, `II`, `FPD`, `DQE`, `Deep Learning`, `Denoising`, `CBCT`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 15 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" en planos medios con actitud entusiasta, clara y didáctica, explicando tecnología quirúrgica para todo el equipo de sala (instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos y cirujanos).
Estilo visual: estética tecnológica médica limpia (azul oscuro, cian neón y blanco). Alterna a la Dra. Nova con clips de archivo libres de copyright de arcos en C y quirófanos modernos, junto a esquemas animados limpios en 2D/3D y textos clave en pantalla en español.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta los títulos, las indicaciones visuales ni los textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — Los cuatro bloques esenciales del Arco en C
Visual: Plano medio de Dra. Nova, seguido de una animación limpia que resalta las 4 partes de un Arco en C sobre un esquema moderno: 1) Tubo generador abajo, 2) Colimador de apertura variable, 3) Receptor arriba y 4) Torre móvil con dos monitores.
Texto en pantalla: "4 BLOQUES: 1. Tubo Emisor · 2. Colimador · 3. Receptor · 4. Monitores Duales"
Locución exacta:
"Bienvenidos al Módulo tres. Para colaborar con seguridad y rapidez alrededor del Arco en C, todo el equipo de quirófano debe conocer cómo funciona por dentro. Aunque cambien las marcas, todo equipo tiene cuatro bloques principales. Abajo, el tubo generador que produce los rayos X. Justo a su salida, el colimador... unas láminas de plomo que abren o cierran el tamaño del haz. Arriba, el receptor que captura la imagen. Y al lado, la estación móvil con sus dos monitores de visualización."

ESCENA 2 — El poder del colimador y la retención de imagen (LIH)
Visual: Animación comparativa de una radiografía ósea borrosa y amplia frente a una imagen colimada con borde oscuro estrecho y hueso muy nítido; luego muestra los dos monitores: izquierdo en vivo y derecho congelado.
Texto en pantalla: "COLIMACIÓN = Menos dosis + Mayor nitidez | LIH (Last Image Hold) = Planificar sin irradiar"
Locución exacta:
"Dos herramientas básicas de estos bloques ahorran muchísima radiación. Primero, cerrar el colimador alrededor de la fractura exacta: al recortar el haz evitas irradiar tejido sano y eliminas el velo grisáceo de dispersión, logrando un hueso mucho más nítido. Y segundo, aprovechar el monitor derecho, que funciona con la función LIH. Por sus siglas en inglés, LIH significa Last Image Hold... es decir, retención de la última imagen. Permite que cirujanos e instrumentadores analicen y midan la fractura todo el tiempo que necesiten sin seguir pisando el pedal."

ESCENA 3 — Del antiguo tubo intensificador (II) al panel plano (FPD)
Visual: Comparativa animada lado a lado: a la izquierda un receptor cilíndrico voluminoso con imagen circular deformada en los bordes; a la derecha un detector cuadrado ultradelgado con clavo ortopédico recto y nítido.
Texto en pantalla: "II (Image Intensifier) vs. FPD (Flat Panel Detector): 0% distorsión · -30% a -50% dosis"
Locución exacta:
"En los quirófanos verás dos generaciones de receptores. Los equipos clásicos usan un II, siglas en inglés de Image Intensifier... el tubo intensificador de imágenes. Es grande, ocupa bastante espacio sobre la camilla y tiende a curvar las líneas rectas en los bordes de la pantalla. En cambio, los equipos modernos incorporan un receptor FPD, del inglés Flat Panel Detector, o detector de panel plano. Es delgado, evita choques con el campo estéril, ofrece una imagen cuadrada sin ninguna distorsión geométrica y posee mayor DQE —Detective Quantum Efficiency, la eficiencia para transformar rayos en imagen—, reduciendo la dosis entre un treinta y un cincuenta por ciento."

ESCENA 4 — Inteligencia Artificial en vivo y reconstrucción 3D (CBCT)
Visual: Gráficos limpios de una señal con ruido granuloso volviéndose nítida en tiempo real a pocos pulsos por segundo, seguido de una animación de rotación orbital en 3D mostrando cortes tomográficos de un hueso.
Texto en pantalla: "IA Denoising (4–8 pps): -75% dosis | CBCT 3D: Cortes tomográficos en quirófano"
Locución exacta:
"Los equipos más actuales suman Inteligencia Artificial mediante redes de Deep Learning —aprendizaje profundo— enfocadas en el denoising, palabra en inglés para la limpieza del ruido visual. Gracias a esto, podemos trabajar a solo cuatro u ocho pulsos por segundo manteniendo una nitidez equivalente a la fluoroscopia continua y ahorrando hasta un setenta y cinco por ciento de radiación. Además, los arcos avanzados realizan escaneos CBCT, Cone-Beam Computed Tomography —tomografía computarizada de haz cónico— girando alrededor del paciente para mostrar cortes en tres dimensiones antes de cerrar la herida."

ESCENA 5 — ¿Qué significa que un arco sea isocéntrico?
Visual: Animación sencilla de un arco girando de vertical a horizontal mientras la articulación o fractura permanece quieta en el centro exacto del círculo, comparada con un arco común que se desplaza fuera de foco.
Texto en pantalla: "ARCO ISOCÉNTRICO: Mantiene el hueso centrado al girar de AP a Lateral"
Locución exacta:
"Por último, verifica siempre antes de empezar si tu arco en C es isocéntrico. En un equipo isocéntrico, el centro de giro coincide con el punto donde se cruzan los haces: cuando pasas de vista frontal a lateral, el hueso fracturado sigue en el centro de la pantalla sin mover la altura de la máquina. Si no es isocéntrico, habrá que reajustar la altura para no perder la imagen ni repetir disparos."

ESCENA 6 — Cierre y llamado al Minijuego 1
Visual: Dra. Nova mirando a cámara con entusiasmo y señalando hacia el ejercicio interactivo.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 1 — ARQUITECTO DEL HAZ"
Locución exacta:
"Ahora que conoces la anatomía interna del equipo y sus receptores, entra al minijuego Arquitecto del Haz. Allí ajustarás el colimador, usarás el congelamiento de imagen y compensarás un arco no isocéntrico sin desperdiciar un solo disparo. ¡Nos vemos en el segundo video!"
```

### Solo Locución Limpia (`m3_v1`)
> Bienvenidos al Módulo tres. Para colaborar con seguridad y rapidez alrededor del Arco en C, todo el equipo de quirófano debe conocer cómo funciona por dentro. Aunque cambien las marcas, todo equipo tiene cuatro bloques principales. Abajo, el tubo generador que produce los rayos X. Justo a su salida, el colimador... unas láminas de plomo que abren o cierran el tamaño del haz. Arriba, el receptor que captura la imagen. Y al lado, la estación móvil con sus dos monitores de visualización.
>
> Dos herramientas básicas de estos bloques ahorran muchísima radiación. Primero, cerrar el colimador alrededor de la fractura exacta: al recortar el haz evitas irradiar tejido sano y eliminas el velo grisáceo de dispersión, logrando un hueso mucho más nítido. Y segundo, aprovechar el monitor derecho, que funciona con la función LIH. Por sus siglas en inglés, LIH significa Last Image Hold... es decir, retención de la última imagen. Permite que cirujanos e instrumentadores analicen y midan la fractura todo el tiempo que necesiten sin seguir pisando el pedal.
>
> En los quirófanos verás dos generaciones de receptores. Los equipos clásicos usan un II, siglas en inglés de Image Intensifier... el tubo intensificador de imágenes. Es grande, ocupa bastante espacio sobre la camilla y tiende a curvar las líneas rectas en los bordes de la pantalla. En cambio, los equipos modernos incorporan un receptor FPD, del inglés Flat Panel Detector, o detector de panel plano. Es delgado, evita choques con el campo estéril, ofrece una imagen cuadrada sin ninguna distorsión geométrica y posee mayor DQE —Detective Quantum Efficiency, la eficiencia para transformar rayos en imagen—, reduciendo la dosis entre un treinta y un cincuenta por ciento.
>
> Los equipos más actuales suman Inteligencia Artificial mediante redes de Deep Learning —aprendizaje profundo— enfocadas en el denoising, palabra en inglés para la limpieza del ruido visual. Gracias a esto, podemos trabajar a solo cuatro u ocho pulsos por segundo manteniendo una nitidez equivalente a la fluoroscopia continua y ahorrando hasta un setenta y cinco por ciento de radiación. Además, los arcos avanzados realizan escaneos CBCT, Cone-Beam Computed Tomography —tomografía computarizada de haz cónico— girando alrededor del paciente para mostrar cortes en tres dimensiones antes de cerrar la herida.
>
> Por último, verifica siempre antes de empezar si tu arco en C es isocéntrico. En un equipo isocéntrico, el centro de giro coincide con el punto donde se cruzan los haces: cuando pasas de vista frontal a lateral, el hueso fracturado sigue en el centro de la pantalla sin mover la altura de la máquina. Si no es isocéntrico, habrá que reajustar la altura para no perder la imagen ni repetir disparos.
>
> Ahora que conoces la anatomía interna del equipo y sus receptores, entra al minijuego Arquitecto del Haz. Allí ajustarás el colimador, usarás el congelamiento de imagen y compensarás un arco no isocéntrico sin desperdiciar un solo disparo. ¡Nos vemos en el segundo video!

---

# VIDEO 2 (`m3_v2`): Consolas Multi-Marca, SSD y Perlas de Exposición
* **Archivo destino:** `M03_V02_Consolas_Exposicion.mp4`
* **Duración estimada:** ~3:25 minutos (~505 palabras)
* **Objetivo pedagógico:** Enseñar las reglas críticas de consola que salvan piel y reducen dosis: distancia foco-piel mínima (SSD), el costo del zoom electrónico, botones de baja dosis por fabricante (GE, Philips, Siemens, Ziehm) y prohibición del Modo Cine en trauma, corrección de la trampa del separador metálico (ABC/AERC y *Metal Mode*), y extracción de rejilla antidifusora en pediatría (*Image Gently*).
* **Siglas y términos en inglés explicados:** `SSD`, `FOV`, `CARE`, `ABC`, `AERC`, `Metal Mode`, `Image Gently`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 25 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" explicando con claridad, ritmo ágil y precisión práctica para instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos en radiología y cirujanos ortopedistas.
Estilo visual: interfaz médica moderna en azul oscuro, cian y alertas en rojo/ámbar. Combina planos de la Dra. Nova con B-roll libre de copyright de consolas médicas y quirófano ortopédico, más infografías animadas limpias con textos breves en español.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta títulos, indicaciones visuales ni textos en pantalla. Respeta pausas breves en puntos suspensivos (...).

---

ESCENA 1 — Distancia Foco-Piel (SSD) y la trampa del Zoom
Visual: Gráfico animado del tubo debajo de la camilla con una regla iluminada midiendo 30 cm hasta la piel del paciente (y 20 cm en mini arco), seguido de un botón de Zoom donde la barra de dosis sube de 100% a 300%.
Texto en pantalla: "SSD MÍNIMA: >= 30 cm Arco Estándar / >= 20 cm Mini Arco | ZOOM: Multiplica dosis hasta 300%"
Locución exacta:
"Tener un equipo moderno no sirve si operamos la consola en piloto automático. Hoy veremos las reglas de oro frente a los botones del Arco en C. Primera regla: cuida siempre la SSD, sigla en inglés de Source-to-Skin Distance, es decir, la distancia entre el tubo emisor y la piel del paciente. En arcos estándar debe medir al menos treinta centímetros —con su espaciador colocado—, y al menos veinte centímetros en mini arcos. Pegar el tubo a la piel puede causar quemaduras radiológicas. Segunda regla: cuidado con el zoom electrónico. Al reducir el campo visual —conocido como FOV, Field of View— de treinta y dos a once centímetros para ver más grande, la consola puede triplicar la dosis sobre la piel."

ESCENA 2 — Botones de baja dosis en consolas GE, Philips, Siemens y Ziehm
Visual: Cuatro tarjetas limpias animadas en pantalla mostrando los modos recomendados de cada fabricante y una señal de advertencia roja tachando el pedal de Cine.
Texto en pantalla: "GE: 4–8 pps | PHILIPS: 1/2 o 1/4 Dosis | SIEMENS: CARE | ZIEHM: SmartPulse | PROHIBIDO MODO CINE"
Locución exacta:
"En cualquier hospital verás cuatro grandes familias de consolas, y en todas debes activar el ahorro de dosis antes del primer disparo. En equipos GE OEC, selecciona cuatro u ocho pulsos por segundo: bajar a cuatro pulsos recorta la dosis al veinticinco por ciento. En sistemas Philips, activa Media Dosis o Cuarto de Dosis. En equipos Siemens, enciende la suite CARE —siglas de Combined Applications to Reduce Exposure, aplicaciones combinadas para reducir la exposición—, que inserta filtros de cobre y permite colimar sin irradiar. Y en Ziehm, elige SmartPulse para modular pulsos en nanosegundos. Pero sobre todo: jamás pisen en trauma ortopédico el pedal de Modo Cine... porque triplica la dosis en arcos móviles y la multiplica hasta cien veces en equipos fijos."

ESCENA 3 — La trampa del separador metálico en el control automático (ABC / AERC)
Visual: Animación clara de un separador metálico de acero entrando en el centro del hueso: un medidor de kilovoltios sube bruscamente al rojo saturando la imagen; luego se aparta el separador o se presiona "Metal Mode" y el medidor vuelve a verde.
Texto en pantalla: "TRAMPA DEL METAL: ABC (Automatic Brightness Control) dispara dosis x4 | Solución: Apartar, colimar o Metal Mode"
Locución exacta:
"Ahora una perla que todo instrumentador y cirujano debe detectar al instante: la trampa del separador metálico. Los equipos usan un sistema llamado ABC —Automatic Brightness Control, Control Automático de Brillo— o AERC —Automatic Exposure Rate Control, Control Automático de Tasa de Exposición— que ajusta solo la potencia según el grosor del cuerpo. Si colocas un separador de acero pesado justo en el centro de la imagen, el sensor cree que el paciente es sólido como el plomo y dispara la potencia al máximo, cuadruplicando la radiación dispersa hacia el equipo. La solución es inmediata: aparta el separador del centro antes del disparo, cierra el colimador o activa la tecla de Metal Mode, el modo para metal."

ESCENA 4 — Pediatría y manos delgadas: retirar la rejilla antidifusora
Visual: Animación limpia deslizando hacia afuera la rejilla extraíble del receptor antes de tomar una imagen de brazo infantil o muñeca, mostrando una caída del 50–60% en dosis.
Texto en pantalla: "CAMPAÑA IMAGE GENTLY: Niños y mano/muñeca -> Retirar rejilla antidifusora (-50% a -60% dosis)"
Locución exacta:
"Y una maniobra mecánica clave respaldada por la campaña internacional Image Gently —que en inglés significa tomar imágenes con suavidad, pensada para proteger a niños—: frente al detector viene montada una rejilla antidifusora de plomo para filtrar rebotes en cuerpos grandes. Pero en pacientes pediátricos o en extremidades muy delgadas como mano y muñeca, casi no hay dispersión. Dejar la rejilla puesta obliga al arco a duplicar la radiación solo para atravesarla. Al retirar esa rejilla desmontable reduces la dosis entre un cincuenta y un sesenta por ciento sin perder nitidez."

ESCENA 5 — Cierre y llamado al Minijuego 2
Visual: Dra. Nova con sonrisa profesional invitando a practicar en la consola del simulador.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 2 — MAESTRO DE CONSOLA"
Locución exacta:
"Dominar estos botones y evitar las trampas del metal o de la rejilla te convierte en un verdadero protector de tu sala. Entra ahora al minijuego Maestro de Consola para configurar equipos de distintas marcas, corregir un separador metálico y adaptar el arco a un paciente pediátrico. ¡Nos vemos en el tercer video!"
```

### Solo Locución Limpia (`m3_v2`)
> Tener un equipo moderno no sirve si operamos la consola en piloto automático. Hoy veremos las reglas de oro frente a los botones del Arco en C. Primera regla: cuida siempre la SSD, sigla en inglés de Source-to-Skin Distance, es decir, la distancia entre el tubo emisor y la piel del paciente. En arcos estándar debe medir al menos treinta centímetros —con su espaciador colocado—, y al menos veinte centímetros en mini arcos. Pegar el tubo a la piel puede causar quemaduras radiológicas. Segunda regla: cuidado con el zoom electrónico. Al reducir el campo visual —conocido como FOV, Field of View— de treinta y dos a once centímetros para ver más grande, la consola puede triplicar la dosis sobre la piel.
>
> En cualquier hospital verás cuatro grandes familias de consolas, y en todas debes activar el ahorro de dosis antes del primer disparo. En equipos GE OEC, selecciona cuatro u ocho pulsos por segundo: bajar a cuatro pulsos recorta la dosis al veinticinco por ciento. En sistemas Philips, activa Media Dosis o Cuarto de Dosis. En equipos Siemens, enciende la suite CARE —siglas de Combined Applications to Reduce Exposure, aplicaciones combinadas para reducir la exposición—, que inserta filtros de cobre y permite colimar sin irradiar. Y en Ziehm, elige SmartPulse para modular pulsos en nanosegundos. Pero sobre todo: jamás pisen en trauma ortopédico el pedal de Modo Cine... porque triplica la dosis en arcos móviles y la multiplica hasta cien veces en equipos fijos.
>
> Ahora una perla que todo instrumentador y cirujano debe detectar al instante: la trampa del separador metálico. Los equipos usan un sistema llamado ABC —Automatic Brightness Control, Control Automático de Brillo— o AERC —Automatic Exposure Rate Control, Control Automático de Tasa de Exposición— que ajusta solo la potencia según el grosor del cuerpo. Si colocas un separador de acero pesado justo en el centro de la imagen, el sensor cree que el paciente es sólido como el plomo y dispara la potencia al máximo, cuadruplicando la radiación dispersa hacia el equipo. La solución es inmediata: aparta el separador del centro antes del disparo, cierra el colimador o activa la tecla de Metal Mode, el modo para metal.
>
> Y una maniobra mecánica clave respaldada por la campaña internacional Image Gently —que en inglés significa tomar imágenes con suavidad, pensada para proteger a niños—: frente al detector viene montada una rejilla antidifusora de plomo para filtrar rebotes en cuerpos grandes. Pero en pacientes pediátricos o en extremidades muy delgadas como mano y muñeca, casi no hay dispersión. Dejar la rejilla puesta obliga al arco a duplicar la radiación solo para atravesarla. Al retirar esa rejilla desmontable reduces la dosis entre un cincuenta y un sesenta por ciento sin perder nitidez.
>
> Dominar estos botones y evitar las trampas del metal o de la rejilla te convierte en un verdadero protector de tu sala. Entra ahora al minijuego Maestro de Consola para configurar equipos de distintas marcas, corregir un separador metálico y adaptar el arco a un paciente pediátrico. ¡Nos vemos en el tercer video!

---

# VIDEO 3 (`m3_v3`): Cinemática 8-DoF, Palancas y Protocolo Verbal en Bucle Cerrado
* **Archivo destino:** `M03_V03_Cinematica_ProtocoloVerbal.mp4`
* **Duración estimada:** ~3:15 minutos (~480 palabras)
* **Objetivo pedagógico:** Enseñar el código de colores de las palancas y frenos mecánicos, el modelo cinemático de 8 grados de libertad (Shao et al., 2014) y el algoritmo CLIK para evitar colisiones y proteger las manos del cirujano, el aporte de la puntería láser y el protocolo universal de órdenes verbales estandarizadas (Yeo et al., 2013).
* **Siglas y términos en inglés explicados:** `Wig-Wag`, `8-DoF`, `CLIK`, `ALARA`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 15 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" explicando con dinamismo, precisión y lenguaje accesible para instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos y cirujanos.
Estilo visual: quirófano moderno con gráficos vectoriales 3D superpuestos sobre un Arco en C (flechas de movimiento por colores, cono geométrico de haz y tarjetas de comandos verbales). Usa B-roll libre de copyright de quirófanos ortopédicos y animaciones limpias en azul marino, cian, amarillo, naranja y verde.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta los títulos, indicaciones visuales ni textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — El código de colores de las palancas del Arco en C
Visual: Plano medio de Dra. Nova, pasando a una animación 3D limpia del Arco en C donde se iluminan cuatro frenos con flechas de movimiento: azul (orbital), amarillo (wig-wag), naranja (horizontal) y verde (vertical).
Texto en pantalla: "PALANCAS: Azul Orbital · Amarillo Wig-Wag · Naranja Horizontal · Verde Vertical"
Locución exacta:
"En este tercer video del Módulo tres vamos a mover esta máquina con precisión quirúrgica y sin chocar con el campo estéril. Todos los arcos en C codifican sus movimientos en palancas y frenos de colores. El freno azul controla el movimiento orbital, deslizando la curva de la C para pasar de frente a lateral. La palanca amarilla maneja el Wig-Wag... término en inglés que describe un balanceo lateral suave del brazo sobre su pivote. La palanca naranja extiende o retrae el cuello de forma horizontal. Y el mando verde sube o baja la columna verticalmente."

ESCENA 2 — De cuatro palancas a ocho grados de libertad (8-DoF)
Visual: Animación esquemática mostrando ejes de coordenadas en la base con ruedas (3 movimientos sobre el suelo) más los 5 ejes del brazo semicircular (total 8 ejes).
Texto en pantalla: "MODELO 8-DoF (Eight Degrees of Freedom): 3 en base móvil + 5 en brazo gantry"
Locución exacta:
"Aunque hablemos de cuatro palancas principales, la ingeniería moderna demostró en estudios como el de Shao y colaboradores que el Arco en C se comporta en realidad como un robot de ocho grados de libertad... conocido en inglés como 8-DoF, siglas de Eight Degrees of Freedom. Son tres movimientos de la base rodante sobre el piso, más cinco movimientos del brazo curvo. Comprender esos ocho ejes evita quedar bloqueado contra la camilla cuando la sala está llena de mesas, cables y torres."

ESCENA 3 — Navegación anti-colisión (CLIK) y protección geométrica de manos
Visual: Gráfico animado en un quirófano con obstáculos donde un brazo virtual sortea una torre quirúrgica e inclina ligeramente el cono de rayos X para alejar el haz directo de las manos del cirujano manteniendo el hueso en el centro.
Texto en pantalla: "CLIK (Closed-Loop Inverse Kinematics): Esquivar colisiones y alejar el haz de las manos"
Locución exacta:
"Para mover esos ocho ejes sin choques, la robótica quirúrgica aplica un método llamado CLIK... por sus siglas en inglés Closed-Loop Inverse Kinematics, o cinemática inversa en lazo cerrado. En términos simples, este criterio calcula cómo combinar varios movimientos para llegar al ángulo deseado sin tocar el campo estéril. Y algo aún más valioso: permite inclinar unos pocos grados el cono de radiación manteniendo la fractura centrada, pero alejando activamente el haz primario de los dedos del cirujano."

ESCENA 4 — Puntería láser y protocolo verbal estandarizado (Yeo et al.)
Visual: Animación de un puntero láser proyectando una cruz verde sobre una extremidad, seguido de una comparativa visual: "Órdenes ambiguas: 12 disparos" vs "Orden exacta: 6 disparos (-54% tiempo)".
Texto en pantalla: "PROTOCOLO VERBAL: Lineal (Dirección + cm) | Rotacional (Movimiento + Dirección + Grados) -> -54% tiempo"
Locución exacta:
"Sin embargo, el mejor hardware falla si el equipo no habla el mismo idioma. Estudios clínicos muestran que más del treinta por ciento de los disparos repetidos ocurren por órdenes vagas como 'muévelo un poquito' o 'gíralo hacia mí'. En cambio, el protocolo verbal estandarizado ordena dos fórmulas exactas. Para traslaciones lineales: dirección anatómica más distancia en centímetros... por ejemplo, 'desplazamiento horizontal, diez centímetros hacia caudal'. Y para giros: nombre del movimiento más dirección anatómica más grados exactos... por ejemplo, 'rotación orbital, quince grados hacia craneal'. Combinado con puntería láser, este lenguaje reduce el tiempo de alineación a más de la mitad y corta los disparos de doce a seis."

ESCENA 5 — Cierre y llamado al Minijuego 3
Visual: Dra. Nova mirando a cámara con seguridad, despidiendo el módulo y señalando el último reto práctico.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 3 — NAVEGADOR 8-DoF"
Locución exacta:
"Recuerda: colores claros en las palancas, trayectoria libre de colisiones y órdenes verbales exactas en centímetros y grados. Ahora entra al minijuego Navegador ocho D-o-F para guiar el arco en un quirófano congestionado y emitir comandos sin ambigüedades. ¡Nos vemos en el Módulo cuatro!"
```

### Solo Locución Limpia (`m3_v3`)
> En este tercer video del Módulo tres vamos a mover esta máquina con precisión quirúrgica y sin chocar con el campo estéril. Todos los arcos en C codifican sus movimientos en palancas y frenos de colores. El freno azul controla el movimiento orbital, deslizando la curva de la C para pasar de frente a lateral. La palanca amarilla maneja el Wig-Wag... término en inglés que describe un balanceo lateral suave del brazo sobre su pivote. La palanca naranja extiende o retrae el cuello de forma horizontal. Y el mando verde sube o baja la columna verticalmente.
>
> Aunque hablemos de cuatro palancas principales, la ingeniería moderna demostró en estudios como el de Shao y colaboradores que el Arco en C se comporta en realidad como un robot de ocho grados de libertad... conocido en inglés como 8-DoF, siglas de Eight Degrees of Freedom. Son tres movimientos de la base rodante sobre el piso, más cinco movimientos del brazo curvo. Comprender esos ocho ejes evita quedar bloqueado contra la camilla cuando la sala está llena de mesas, cables y torres.
>
> Para mover esos ocho ejes sin choques, la robótica quirúrgica aplica un método llamado CLIK... por sus siglas en inglés Closed-Loop Inverse Kinematics, o cinemática inversa en lazo cerrado. En términos simples, este criterio calcula cómo combinar varios movimientos para llegar al ángulo deseado sin tocar el campo estéril. Y algo aún más valioso: permite inclinar unos pocos grados el cono de radiación manteniendo la fractura centrada, pero alejando activamente el haz primario de los dedos del cirujano.
>
> Sin embargo, el mejor hardware falla si el equipo no habla el mismo idioma. Estudios clínicos muestran que más del treinta por ciento de los disparos repetidos ocurren por órdenes vagas como 'muévelo un poquito' o 'gíralo hacia mí'. En cambio, el protocolo verbal estandarizado ordena dos fórmulas exactas. Para traslaciones lineales: dirección anatómica más distancia en centímetros... por ejemplo, 'desplazamiento horizontal, diez centímetros hacia caudal'. Y para giros: nombre del movimiento más dirección anatómica más grados exactos... por ejemplo, 'rotación orbital, quince grados hacia craneal'. Combinado con puntería láser, este lenguaje reduce el tiempo de alineación a más de la mitad y corta los disparos de doce a seis.
>
> Recuerda: colores claros en las palancas, trayectoria libre de colisiones y órdenes verbales exactas en centímetros y grados. Ahora entra al minijuego Navegador ocho D-o-F para guiar el arco en un quirófano congestionado y emitir comandos sin ambigüedades. ¡Nos vemos en el Módulo cuatro!

---

## Especificación de Minijuegos del Módulo 3 (Unity WebGL — `Modulo03`)

### 1. `m3_s1` — Minijuego 1: Arquitecto del Haz (`M03_MG1_HardwareOptics`, `Modulo03`, Fase 1)
* **Premisa clínica:** Laboratorio de óptica y receptores del Arco en C.
* **Mecánica en Unity (3 fases):**
  1. **Diagnóstico de receptor:** Comparar dos imágenes de un clavo recto en monitor: identificar cuál presenta distorsión en corsé (*pincushion*) / en S (II antiguo) frente a cuál corresponde al FPD (0% distorsión, campo cuadrado).
  2. **Colimación + LIH:** El jugador debe ajustar el colimador iris sobre la fractura antes de disparar y congelar el fotograma en el monitor derecho (*Last Image Hold*) para medir la reducción sin volver a pisar el pedal.
  3. **Compensación no isocéntrica:** Al rotar 90° en un arco no isocéntrico de prueba, el hueso sale del eje vertical; el jugador debe compensar altura antes de repetir el disparo.
* **Códigos de error (`RecordError`):**
  * `HO_RECEPTOR_MISMATCH`: Confundió las características geométricas o dosimétricas de II y FPD.
  * `HO_UNCOLLIMATED_SHOT`: Disparó con las láminas del colimador abiertas en exceso reduciendo el contraste óseo.
  * `HO_UNNECESSARY_LIVE_FLUORO`: Mantuvo exposición activa en lugar de planificar sobre la pantalla LIH.
  * `HO_ISOCENTER_HEIGHT_LOST`: Rotó a lateral en equipo no isocéntrico sin compensar altura.

### 2. `m3_s2` — Minijuego 2: Maestro de Consola (`M03_MG2_ConsoleMaster`, `Modulo03`, Fase 2)
* **Premisa clínica:** Dominio de consolas hospitalarias reales y protección del paciente en consola.
* **Mecánica en Unity (3 casos progresivos):**
  1. **Consola Multi-Marca + SSD:** Según la consola asignada aleatoriamente (GE OEC, Philips, Siemens o Ziehm), seleccionar la tasa pulsada de baja dosis correcta (4–8 pps / Media Dosis / CAREFilter / SmartPulse), verificar espaciador $\text{SSD} \ge 30\text{ cm}$ y evitar el pedal de Modo Cine y el zoom digital.
  2. **Trampa del Separador Metálico (ABC):** En osteosíntesis abierta, un separador de Hohmann entra al centro del haz llevando el ABC al rojo; el jugador debe desplazarlo/colimar o activar **Metal Mode** antes de exponer.
  3. **Caso Pediátrico (*Image Gently*):** Paciente de 6 años con fractura de muñeca; desmontar la rejilla antidifusora del detector, verificar $\text{SSD} \ge 20\text{ cm}$ (si es mini arco) y fijar 1–4 pps.
* **Códigos de error (`RecordError`):**
  * `CM_CINE_MODE_USED`: Activó el Modo Cine en trauma ortopédico (300% dosis).
  * `CM_SSD_VIOLATION`: Disparó con distancia foco-piel inferior al mínimo reglamentario (30 cm / 20 cm).
  * `CM_ABC_METAL_OVERDRIVE`: Disparó con el separador metálico centrado en el ABC sin colimar ni activar Metal Mode.
  * `CM_PEDIATRIC_GRID_LEFT_IN`: Mantuvo la rejilla antidifusora puesta en paciente pediátrico/extremidad delgada.

### 3. `m3_s3` — Minijuego 3: Navegador 8-DoF (`M03_MG3_KinematicsNavigator`, `Modulo03`, Fase 3)
* **Premisa clínica:** Maniobra espacial en quirófano congestionado y comunicación estandarizada (Shao 2014 + Yeo 2013).
* **Mecánica en Unity (3 misiones):**
  1. **Palancas cromáticas:** Desbloquear la palanca correcta por color (Azul Orbital, Amarillo Wig-Wag, Naranja Horizontal, Verde Vertical) para sortear una mesa auxiliar sin colisionar con el campo estéril.
  2. **Protección geométrica de manos:** En un escenario con manos cerca del campo, ajustar la angulación redundante del cono de haz para apartar el haz primario de los dedos manteniendo centrada la fractura.
  3. **Bucle cerrado verbal:** Construir órdenes exactas (Movimiento + Dirección Anatómica + Magnitud en cm o grados) rechazando distractores ambiguos hasta alinear la proyección solicitada en $\le 6$ disparos.
* **Códigos de error (`RecordError`):**
  * `KN_WRONG_BRAKE_COLOR`: Liberó una palanca mecánica incorrecta para el movimiento pedido.
  * `KN_STERILE_COLLISION`: Movió el arco provocando choque con la camilla o torre quirúrgica.
  * `KN_HANDS_IN_PRIMARY_BEAM`: No optimizó la angulación del haz exponiendo los dedos al cono primario.
  * `KN_AMBIGUOUS_COMMAND`: Emitió una orden coloquial sin dirección anatómica o magnitud métrica/angular.
