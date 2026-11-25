# GUIONES DE PRODUCCIÓN HEYGEN VIDEO AGENT — MÓDULO 4: PROYECCIONES DE PELVIS Y MIEMBRO INFERIOR

> **Configuración Global para HeyGen Video Agent:**
> * **Formato y relación de aspecto:** `16:9` horizontal (Full HD 1080p).
> * **Presentadora única (A-Roll):** **Dra. Nova** (*Custom Avatar* ya configurado en HeyGen), narrando y demostrando en solitario para máxima consistencia visual y de voz en una sola generación.
> * **Público objetivo:** Todo el equipo de quirófano ortopédico (instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos en radiología, residentes y cirujanos). Lenguaje claro, práctico y libre de tecnicismos oscuros sin explicar.
> * **Regla de siglas en inglés:** Toda sigla o expresión clave en inglés se desarrolla primero en inglés y se explica inmediatamente en español antes de continuar.
> * **Visuales (B-Roll y Gráficos):** Imágenes y clips de archivo **libres de derechos de autor** (quirófano ortopédico, mesa de tracción, proyecciones radiológicas esquemáticas de cadera, rodilla y tobillo) junto a animaciones limpias 2D/3D y *lower-thirds* en español. Paleta: azul marino oscuro, cian médico y acentos ámbar/verde.
> * **Duración objetivo:** ~3:05 a 3:20 minutos por video (~455–495 palabras de locución).

---

## Mapa del Módulo 4 (3 Videos + 3 Minijuegos)

| Paso | Tipo | Título | Duración aprox. | Minijuego vinculado / Mecánica clave |
| :--- | :--- | :--- | :--- | :--- |
| `m4_v1` | Video 1 | Pelvis, Cadera y Enclavado Cefalomedular (AO Estación 3) | 3:20 min | Prepara para `m4_s1` (**Estación Cadera AO 3**) |
| `m4_s1` | Minijuego 1 | Estación Cadera (AO 3) (`M04_MG1_HipTractionAO3`) | — | Mesa de tracción a 45°, detector pegado y tornillo Centro-Centro |
| `m4_v2` | Video 2 | Rodilla, Diáfisis Femoral y Puntería Láser (Shuler 2013) | 3:05 min | Prepara para `m4_s2` (**Ortogonalidad y Láser**) |
| `m4_s2` | Minijuego 2 | Ortogonalidad y Láser (`M04_MG2_KneeLaserAlignment`) | — | Láser sobre rótula, rotación manual de extremidad y 90° |
| `m4_v3` | Video 3 | Tobillo, Proyección de Mortaja (AO Estación 4) y Control 3D | 3:15 min | Prepara para `m4_s3` (**Mortaja y Barrido 3D**) |
| `m4_s3` | Minijuego 3 | Mortaja y Barrido 3D (`M04_MG3_AnkleMortise3D`) | — | Rotación interna 15°–20°, sindesmosis y detección 3D CBCT |

---

# VIDEO 1 (`m4_v1`): Pelvis, Cadera y Enclavado Cefalomedular (AO Estación 3)
* **Archivo destino:** `M04_V01_Pelvis_Cadera.mp4`
* **Duración estimada:** ~3:20 minutos (~490 palabras)
* **Objetivo pedagógico:** Explicar por qué pelvis y cadera representan el pico máximo de dispersión en ortopedia, cómo montar el arco en C a 45° en mesa de tracción sin chocar con los postes, cómo proteger al equipo en la vista axial translateral y cómo verificar el criterio Centro-Centro en el tornillo cefálico (AO Estación 3).
* **Siglas y términos en inglés explicados:** `ABC`, `BMI`, `AP`, `Hug the Intensifier`, `Cut-Out`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 20 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" en planos medios y primeros planos con tono concentrado, pedagógico y claro para cirujanos, instrumentadores quirúrgicos, auxiliares de enfermería y tecnólogos en radiología.
Estilo visual: quirófano de traumatología moderno en azul marino oscuro, cian médico y acentos ámbar/verde para guías anatómicas. Alterna a la Dra. Nova con B-roll libre de copyright de cirugía ortopédica y animaciones esquemáticas limpias de cadera, mesa de tracción y Arco en C con textos breves en español.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta títulos, indicaciones visuales ni textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — El reto de la mayor densidad corporal en ortopedia
Visual: Plano medio de Dra. Nova, pasando a un gráfico anatómico limpio de la pelvis y cadera mostrando gran masa muscular y un medidor de dispersión más alto que en otras zonas del cuerpo.
Texto en pantalla: "PELVIS Y CADERA: Zona de máxima dispersión | A 1 pie = 12x dosis gonadal vs. tiroidea"
Locución exacta:
"Bienvenidos al Módulo cuatro. Ahora aplicamos todo lo aprendido en las cirugías de miembro inferior, que concentran el mayor volumen en urgencias. Empezamos por la pelvis y la cadera... la región que genera los picos más altos de radiación dispersa de todo el quirófano. Como aquí se acumula la masa muscular y ósea más gruesa del cuerpo, especialmente en pacientes con alto BMI —siglas en inglés de Body Mass Index, el índice de masa corporal—, el sistema ABC, Automatic Brightness Control o Control Automático de Brillo, sube automáticamente la potencia del tubo. Además, a solo treinta centímetros de la cadera la radiación en la zona pélvica es doce veces mayor que en la tiroides. Por eso el equipo debe usar siempre su blindaje completo."

ESCENA 2 — Montaje en mesa de tracción ortopédica (AO Estación 3)
Visual: Esquema cenital animado de una mesa de tracción con ambas piernas separadas y el Arco en C entrando entre ellas en ángulo oblicuo de 45 grados, alternando libremente entre vista frontal y axial sin chocar con los postes.
Texto en pantalla: "MESA DE TRACCIÓN (AO Estación 3): Entrada a 45° entre piernas · Rotación interna 15°"
Locución exacta:
"En una fractura de cadera tratada con clavo cefalomedular, según la Estación tres de AO Trauma, colocamos al paciente en mesa de tracción ortopédica con tracción longitudinal y unos quince grados de rotación interna de la pierna... así corregimos la inclinación natural del cuello femoral. ¿Por dónde entra el Arco en C? Siempre entre las piernas del paciente, en un ángulo oblicuo de cuarenta y cinco grados. Este truco mecánico permite alternar con suavidad entre la vista frontal AP —anteroposterior— y la vista axial lateral de cadera sin que el brazo choque contra los soportes metálicos de la mesa."

ESCENA 3 — Posición segura en axial de cadera y receptor pegado a la piel
Visual: Animación de la vista axial (arco inclinado casi horizontal a 15°): equipo médico posicionado del lado del receptor, y flecha acercando el detector plano lo máximo posible al muslo.
Texto en pantalla: "AXIAL DE CADERA: Equipo al lado del detector (Hug the Intensifier) + Receptor pegado al muslo"
Locución exacta:
"Al pasar a la proyección axial o lateral de cadera, el arco se inclina casi horizontalmente... unos quince grados respecto al suelo. En ese instante, aplica sin excepción la regla inglesa Hug the Intensifier —abraza el intensificador—: todo el equipo que permanezca cerca debe ubicarse del lado del receptor y nunca frente al tubo emisor. Y en la proyección frontal con tubo debajo de la camilla, baja el detector lo más cerca posible del muslo sin contaminar el campo estéril: así amplías el campo visual y reduces la dosis en la piel del paciente."

ESCENA 4 — La regla biomecánica Centro-Centro del tornillo cefálico
Visual: Doble diagrama radiológico limpio (vista AP y vista Lateral verdadera de la cabeza femoral) mostrando un tornillo cefálico centrado con una diana verde en "Centro-Centro", comparado con un tornillo alto con alerta roja de fallo.
Texto en pantalla: "CRITERIO AO TRAUMA: Posición CENTRO-CENTRO (AP + Lateral) evita el Cut-Out"
Locución exacta:
"¿Qué busca ver exactamente el cirujano en los monitores? El criterio de oro en enclavado de cadera se llama posición Centro-Centro. En la proyección anteroposterior, el tornillo debe avanzar por el centro o tercio ligeramente inferior del cuello del fémur. Y en la lateral verdadera, debe quedar exactamente en el centro geométrico de la cabeza femoral. Esta posición evita el temido cut-out... palabra en inglés que describe cuando el tornillo corta hacia arriba y rompe el hueso articular obligando a reoperar."

ESCENA 5 — Cierre y llamado al Minijuego 1
Visual: Dra. Nova mirando a cámara con seguridad e invitando al primer reto práctico del módulo.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 1 — ESTACIÓN CADERA (AO 3)"
Locución exacta:
"Ya sabes cómo entrar a cuarenta y cinco grados, proteger al equipo en la vista axial y validar la posición Centro-Centro. Entra ahora al minijuego Estación Cadera para montar la mesa de tracción y ubicar el tornillo sin errores. ¡Nos vemos en el segundo video!"
```

### Solo Locución Limpia (`m4_v1`)
> Bienvenidos al Módulo cuatro. Ahora aplicamos todo lo aprendido en las cirugías de miembro inferior, que concentran el mayor volumen en urgencias. Empezamos por la pelvis y la cadera... la región que genera los picos más altos de radiación dispersa de todo el quirófano. Como aquí se acumula la masa muscular y ósea más gruesa del cuerpo, especialmente en pacientes con alto BMI —siglas en inglés de Body Mass Index, el índice de masa corporal—, el sistema ABC, Automatic Brightness Control o Control Automático de Brillo, sube automáticamente la potencia del tubo. Además, a solo treinta centímetros de la cadera la radiación en la zona pélvica es doce veces mayor que en la tiroides. Por eso el equipo debe usar siempre su blindaje completo.
>
> En una fractura de cadera tratada con clavo cefalomedular, según la Estación tres de AO Trauma, colocamos al paciente en mesa de tracción ortopédica con tracción longitudinal y unos quince grados de rotación interna de la pierna... así corregimos la inclinación natural del cuello femoral. ¿Por dónde entra el Arco en C? Siempre entre las piernas del paciente, en un ángulo oblicuo de cuarenta y cinco grados. Este truco mecánico permite alternar con suavidad entre la vista frontal AP —anteroposterior— y la vista axial lateral de cadera sin que el brazo choque contra los soportes metálicos de la mesa.
>
> Al pasar a la proyección axial o lateral de cadera, el arco se inclina casi horizontalmente... unos quince grados respecto al suelo. En ese instante, aplica sin excepción la regla inglesa Hug the Intensifier —abraza el intensificador—: todo el equipo que permanezca cerca debe ubicarse del lado del receptor y nunca frente al tubo emisor. Y en la proyección frontal con tubo debajo de la camilla, baja el detector lo más cerca posible del muslo sin contaminar el campo estéril: así amplías el campo visual y reduces la dosis en la piel del paciente.
>
> ¿Qué busca ver exactamente el cirujano en los monitores? El criterio de oro en enclavado de cadera se llama posición Centro-Centro. En la proyección anteroposterior, el tornillo debe avanzar por el centro o tercio ligeramente inferior del cuello del fémur. Y en la lateral verdadera, debe quedar exactamente en el centro geométrico de la cabeza femoral. Esta posición evita el temido cut-out... palabra en inglés que describe cuando el tornillo corta hacia arriba y rompe el hueso articular obligando a reoperar.
>
> Ya sabes cómo entrar a cuarenta y cinco grados, proteger al equipo en la vista axial y validar la posición Centro-Centro. Entra ahora al minijuego Estación Cadera para montar la mesa de tracción y ubicar el tornillo sin errores. ¡Nos vemos en el segundo video!

---

# VIDEO 2 (`m4_v2`): Rodilla, Diáfisis Femoral y Puntería Láser (Shuler 2013)
* **Archivo destino:** `M04_V02_Rodilla_Laser.mp4`
* **Duración estimada:** ~3:05 minutos (~455 palabras)
* **Objetivo pedagógico:** Explicar la regla de ortogonalidad estricta a 90° en diáfisis femoral y rodilla, cómo lograr una lateral condilar verdadera moviendo suavemente la pierna del paciente en vez de la máquina, y la evidencia científica del ensayo de Shuler et al. (2013) sobre dónde sí funciona y dónde no la puntería láser.
* **Siglas y términos en inglés explicados:** `AP`, `BMI`, `ALARA`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 5 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" con tono cercano, didáctico y claro para instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos en radiología y cirujanos.
Estilo visual: estética quirúrgica moderna (azul oscuro, cian y verde láser). Alterna a la Dra. Nova con B-roll libre de copyright de cirugía ortopédica de rodilla o pierna y animaciones geométricas limpias de planos ortogonales a 90 grados y puntería láser.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta títulos, indicaciones visuales ni textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — La ley de oro: un solo plano siempre miente
Visual: Plano medio de Dra. Nova seguido de una animación 3D de un fémur o tibia fracturados: desde vista frontal el hueso parece alineado, pero al girar 90 grados a vista lateral aparece completamente desplazado.
Texto en pantalla: "LEY ORTOPÉDICA: Un plano miente · Siempre exigir vistas ortogonales a 90° (AP + Lateral)"
Locución exacta:
"Al bajar hacia el fémur medio y la rodilla, el grosor del cuerpo disminuye, pero aparece una trampa diagnóstica muy frecuente. En traumatología repetimos una ley sagrada: un solo plano miente. Una fractura o un clavo intramedular pueden verse perfectamente alineados en la vista AP —anteroposterior—, pero estar completamente desplazados o fuera del hueso cuando tomas la vista lateral. Por eso siempre exigimos dos proyecciones ortogonales... es decir, separadas exactamente noventa grados entre sí."

ESCENA 2 — Lateral verdadera de rodilla: mover al paciente, no la máquina
Visual: Gráfico animado mostrando los dos cóndilos de la rodilla desfasados que se superponen como una sola silueta nítida cuando una mano enguantada gira suavemente la pierna del paciente sin mover el Arco en C.
Texto en pantalla: "LATERAL CONDILAR VERDADERA: Girar suavemente la pierna del paciente, no el equipo pesado"
Locución exacta:
"Para obtener una lateral verdadera de rodilla, el criterio de calidad es muy claro: los dos cóndilos del fémur deben superponerse exactamente uno encima del otro, como si fueran una sola silueta. Muchas veces vemos al equipo mover una y otra vez la pesada máquina gastando disparos innecesarios. En lugar de forzar el arco, es mucho más rápido y seguro que el cirujano o su ayudante giren unos milímetros la pierna del paciente de forma manual. Así alineas ambos cóndilos sin perder tiempo ni sumar dosis."

ESCENA 3 — Puntería láser: cuándo sí ahorra radiación (Shuler et al., 2013)
Visual: Animación de una cruz láser proyectada sobre la rótula en rodilla (marcando -39% tiempo y -35% error de centro), comparada en pantalla dividida con una cadera voluminosa donde el láser falla (0% beneficio).
Texto en pantalla: "EVIDENCIA SHULER (2013): Rodilla -39% tiempo (-35% desvío) | Cadera obesa: Sin beneficio"
Locución exacta:
"Aquí entra un recurso práctico que todo tecnólogo e instrumentador debe aprovechar: la puntería láser del Arco en C. Antes de pisar el pedal, muchos equipos proyectan una cruz de luz sobre la piel para indicar el centro exacto del haz. El ensayo clínico de Shuler y colaboradores demostró que en la rodilla la guía láser reduce el tiempo de radiación en un treinta y nueve por ciento y mejora la puntería al primer intento. ¿Por qué funciona tan bien en la rodilla? Porque la rótula y los relieves del fémur se palpan directo bajo la piel. En cambio, en la cadera de pacientes con obesidad —con alto BMI, Body Mass Index o índice de masa corporal—, la capa profunda de grasa impide palpar referencias y el láser no reduce los disparos... allí manda la anatomía de los reparos pélvicos."

ESCENA 4 — Trabajo coordinado bajo principio ALARA
Visual: B-roll libre de copyright de equipo quirúrgico coordinado en quirófano, con un resumen visual limpio de 3 pasos: 1) Láser en rótula, 2) Rotar pierna, 3) Confirmar AP + Lateral.
Texto en pantalla: "ALARA (As Low As Reasonably Achievable): Menos disparos de tanteo = Cirugía más ágil"
Locución exacta:
"Cuando combinas puntería láser en rodilla, ajuste suave de la pierna y verificación estricta a noventa grados, cumples al pie de la letra el principio ALARA —As Low As Reasonably Achievable, tan bajo como sea razonablemente posible— y reduces la cirugía varios minutos."

ESCENA 5 — Cierre y llamado al Minijuego 2
Visual: Dra. Nova sonriendo e invitando al segundo minijuego del módulo.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 2 — ORTOGONALIDAD Y LÁSER"
Locución exacta:
"Ahora pon en práctica esta precisión en el minijuego Ortogonalidad y Láser: decide cuándo confiar en la cruz láser, gira suavemente la extremidad para superponer los cóndilos y valida el hueso en ambos planos. ¡Nos vemos en el tercer video!"
```

### Solo Locución Limpia (`m4_v2`)
> Al bajar hacia el fémur medio y la rodilla, el grosor del cuerpo disminuye, pero aparece una trampa diagnóstica muy frecuente. En traumatología repetimos una ley sagrada: un solo plano miente. Una fractura o un clavo intramedular pueden verse perfectamente alineados en la vista AP —anteroposterior—, pero estar completamente desplazados o fuera del hueso cuando tomas la vista lateral. Por eso siempre exigimos dos proyecciones ortogonales... es decir, separadas exactamente noventa grados entre sí.
>
> Para obtener una lateral verdadera de rodilla, el criterio de calidad es muy claro: los dos cóndilos del fémur deben superponerse exactamente uno encima del otro, como si fueran una sola silueta. Muchas veces vemos al equipo mover una y otra vez la pesada máquina gastando disparos innecesarios. En lugar de forzar el arco, es mucho más rápido y seguro que el cirujano o su ayudante giren unos milímetros la pierna del paciente de forma manual. Así alineas ambos cóndilos sin perder tiempo ni sumar dosis.
>
> Aquí entra un recurso práctico que todo tecnólogo e instrumentador debe aprovechar: la puntería láser del Arco en C. Antes de pisar el pedal, muchos equipos proyectan una cruz de luz sobre la piel para indicar el centro exacto del haz. El ensayo clínico de Shuler y colaboradores demostró que en la rodilla la guía láser reduce el tiempo de radiación en un treinta y nueve por ciento y mejora la puntería al primer intento. ¿Por qué funciona tan bien en la rodilla? Porque la rótula y los relieves del fémur se palpan directo bajo la piel. En cambio, en la cadera de pacientes con obesidad —con alto BMI, Body Mass Index o índice de masa corporal—, la capa profunda de grasa impide palpar referencias y el láser no reduce los disparos... allí manda la anatomía de los reparos pélvicos.
>
> Cuando combinas puntería láser en rodilla, ajuste suave de la pierna y verificación estricta a noventa grados, cumples al pie de la letra el principio ALARA —As Low As Reasonably Achievable, tan bajo como sea razonablemente posible— y reduces la cirugía varios minutos.
>
> Ahora pon en práctica esta precisión en el minijuego Ortogonalidad y Láser: decide cuándo confiar en la cruz láser, gira suavemente la extremidad para superponer los cóndilos y valida el hueso en ambos planos. ¡Nos vemos en el tercer video!

---

# VIDEO 3 (`m4_v3`): Tobillo, Proyección de Mortaja (AO Estación 4) y Control 3D
* **Archivo destino:** `M04_V03_Tobillo_Mortaja_3D.mp4`
* **Duración estimada:** ~3:15 minutos (~470 palabras)
* **Objetivo pedagógico:** Explicar la diferencia entre AP simple de tobillo y la Proyección de Mortaja a 15°–20° de rotación interna (AO Estación 4) para evaluar la sindesmosis, el ahorro del láser en tobillo (-29% según Shuler 2013) y el valor del escaneo 3D CBCT intraoperatorio para detectar tornillos intraarticulares antes del cierre.
* **Siglas y términos en inglés explicados:** `AP`, `Mortise View`, `CBCT`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 15 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" con tono cercano, didáctico y de precisión quirúrgica para todo el personal de quirófano (instrumentadores, auxiliares de enfermería, tecnólogos y cirujanos).
Estilo visual: estética quirúrgica moderna (azul marino, cian y ámbar). Combina a la Dra. Nova con animaciones anatómicas limpias del tobillo (tibia, peroné, astrágalo y sindesmosis), gráficos de rotación a 15–20 grados y reconstrucción 3D multiplanar, más B-roll libre de copyright de quirófano.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta títulos, indicaciones visuales ni textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — El engaño de la vista AP simple en el tobillo
Visual: Plano medio de Dra. Nova y luego gráfico comparativo del tobillo: en AP recta el peroné se superpone sobre el borde de la tibia ocultando una separación; en rotación interna se abre un espacio claro limpio.
Texto en pantalla: "TOBILLO (AO Estación 4): En AP simple, el peroné se superpone y oculta lesiones"
Locución exacta:
"En este tercer video del Módulo cuatro cerramos el miembro inferior bajando al tobillo y al pie. Aunque aquí los huesos son superficiales y se necesita poca radiación para atravesarlos, el tobillo esconde una trampa anatómica clásica. Si tomas únicamente una proyección AP —anteroposterior— recta, la sombra del peroné se monta encima de la tibia. Esa superposición puede esconder una separación peligrosa entre ambos huesos, conocida como lesión de la sindesmosis."

ESCENA 2 — La Proyección de Mortaja (15° a 20° de rotación interna)
Visual: Animación clara de un pie girando hacia adentro entre 15 y 20 grados mientras el espacio articular entre tibia, peroné y astrágalo se abre simétrico y nítido en el monitor.
Texto en pantalla: "PROYECCIÓN DE MORTAJA (Mortise View): Rotación interna de 15° a 20° -> Despeja sindesmosis"
Locución exacta:
"Para resolverlo, la Estación cuatro de AO Trauma exige la Proyección de Mortaja... llamada en inglés Mortise View, en alusión a un encaje mecánico preciso. ¿Cómo se logra en quirófano? Simplemente rotando la pierna del paciente entre quince y veinte grados hacia adentro... o compensando con el giro del arco si el pie no puede moverse. Con esos quince a veinte grados de rotación interna se despeja por completo el espacio claro entre la tibia y el peroné, permitiendo comprobar que la articulación del tobillo encaja perfectamente sin desplazamientos."

ESCENA 3 — Puntería láser en tobillo (Shuler et al., 2013)
Visual: Animación de cruz láser apuntando entre ambos maléolos del tobillo con indicador de ahorro: -29% de tiempo de radiación y -38% de error de centrado.
Texto en pantalla: "LÁSER EN TOBILLO (Shuler 2013): -29% tiempo de fluoroscopia · -38% desviación del centro"
Locución exacta:
"¿Y funciona aquí el puntero láser? ¡Por supuesto! Como los maléolos interno y externo del tobillo se palpan con facilidad debajo de la piel, el estudio de Shuler demostró que centrar con la guía láser en el tobillo reduce el tiempo de exposición en un veintinueve por ciento y mejora el centrado en casi un treinta y ocho por ciento desde el primer disparo."

ESCENA 4 — Escaneo 3D CBCT en fracturas articulares complejas
Visual: Animación de un Arco en C ejecutando un giro motorizado suave alrededor de un tobillo o calcáneo; luego un corte 3D revela la punta de un tornillo invadiendo el cartílago que no se veía en la placa plana 2D.
Texto en pantalla: "CBCT 3D (Cone-Beam Computed Tomography): Reduce reoperaciones de 15–20% a <2%"
Locución exacta:
"Finalmente, en fracturas complejas que afectan directamente la superficie articular —como el pilón tibial o el hueso calcáneo del talón—, una radiografía plana en dos dimensiones puede engañar incluso al ojo más experto. Estudios de AO Trauma muestran que hasta uno de cada cinco tornillos mal ubicados dentro de una articulación pasan invisibles en dos dimensiones. Por eso hoy utilizamos el barrido CBCT... siglas en inglés de Cone-Beam Computed Tomography, o tomografía computarizada de haz cónico en tres dimensiones. Con un giro rápido antes de suturar la piel, el equipo muestra cortes milimétricos que permiten corregir cualquier tornillo a tiempo, bajando las reoperaciones a menos del dos por ciento."

ESCENA 5 — Cierre y llamado al Minijuego 3
Visual: Dra. Nova mirando a cámara con entusiasmo, invitando al último minijuego del Módulo 4.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 3 — MORTAJA Y BARRIDO 3D"
Locución exacta:
"Ahora aplica lo aprendido en el minijuego Mortaja y Barrido tres D: alinea el láser sobre los maléolos, ajusta los quince a veinte grados de rotación interna y detecta un tornillo intraarticular oculto en el escaneo volumétrico antes del cierre. ¡Nos vemos en el Módulo cinco!"
```

### Solo Locución Limpia (`m4_v3`)
> En este tercer video del Módulo cuatro cerramos el miembro inferior bajando al tobillo y al pie. Aunque aquí los huesos son superficiales y se necesita poca radiación para atravesarlos, el tobillo esconde una trampa anatómica clásica. Si tomas únicamente una proyección AP —anteroposterior— recta, la sombra del peroné se monta encima de la tibia. Esa superposición puede esconder una separación peligrosa entre ambos huesos, conocida como lesión de la sindesmosis.
>
> Para resolverlo, la Estación cuatro de AO Trauma exige la Proyección de Mortaja... llamada en inglés Mortise View, en alusión a un encaje mecánico preciso. ¿Cómo se logra en quirófano? Simplemente rotando la pierna del paciente entre quince y veinte grados hacia adentro... o compensando con el giro del arco si el pie no puede moverse. Con esos quince a veinte grados de rotación interna se despeja por completo el espacio claro entre la tibia y el peroné, permitiendo comprobar que la articulación del tobillo encaja perfectamente sin desplazamientos.
>
> ¿Y funciona aquí el puntero láser? ¡Por supuesto! Como los maléolos interno y externo del tobillo se palpan con facilidad debajo de la piel, el estudio de Shuler demostró que centrar con la guía láser en el tobillo reduce el tiempo de exposición en un veintinueve por ciento y mejora el centrado en casi un treinta y ocho por ciento desde el primer disparo.
>
> Finalmente, en fracturas complejas que afectan directamente la superficie articular —como el pilón tibial o el hueso calcáneo del talón—, una radiografía plana en dos dimensiones puede engañar incluso al ojo más experto. Estudios de AO Trauma muestran que hasta uno de cada cinco tornillos mal ubicados dentro de una articulación pasan invisibles en dos dimensiones. Por eso hoy utilizamos el barrido CBCT... siglas en inglés de Cone-Beam Computed Tomography, o tomografía computarizada de haz cónico en tres dimensiones. Con un giro rápido antes de suturar la piel, el equipo muestra cortes milimétricos que permiten corregir cualquier tornillo a tiempo, bajando las reoperaciones a menos del dos por ciento.
>
> Ahora aplica lo aprendido en el minijuego Mortaja y Barrido tres D: alinea el láser sobre los maléolos, ajusta los quince a veinte grados de rotación interna y detecta un tornillo intraarticular oculto en el escaneo volumétrico antes del cierre. ¡Nos vemos en el Módulo cinco!

---

## Especificación de Minijuegos del Módulo 4 (Unity WebGL — `Modulo04`)

### 1. `m4_s1` — Minijuego 1: Estación Cadera (AO 3) (`M04_MG1_HipTractionAO3`, `Modulo04`, Fase 1)
* **Premisa clínica:** Enclavado cefalomedular de fémur proximal en mesa de tracción ortopédica (Estación 3 AO Trauma).
* **Mecánica en Unity (3 pasos):**
  1. **Montaje de mesa y acceso:** Colocar el Arco en C entrando entre las piernas a 45° con tubo debajo de la mesa y fijar el detector pegado al muslo (respetando $\text{SSD} \ge 30\text{ cm}$).
  2. **Transición AP → Axial Translateral:** Rotar hacia la vista axial (~15° del suelo) asegurándose de trasladar al equipo quirúrgico del lado del intensificador (*Hug the Intensifier*).
  3. **Colocación Centro-Centro:** Ajustar trayectoria y longitud de la clavija/tornillo cefálico evaluando AP (centro-inferior) y Lateral (centro geométrico de la cabeza femoral) evitando la zona superior de *cut-out*.
* **Códigos de error (`RecordError`):**
  * `HT_TABLE_POST_COLLISION`: Ingresó el arco con ángulo incorrecto chocando con los postes de tracción.
  * `HT_TRANSLATERAL_TUBE_SIDE`: Permaneció del lado del tubo emisor durante la proyección axial de cadera.
  * `HT_CUTOUT_RISK`: Ubicó el tornillo cefálico excéntrico o superior con alto riesgo de *cut-out*.

### 2. `m4_s2` — Minijuego 2: Ortogonalidad y Láser (`M04_MG2_KneeLaserAlignment`, `Modulo04`, Fase 2)
* **Premisa clínica:** Aplicación selectiva de puntería láser (Shuler 2013) y obtención de lateral condilar verdadera en rodilla/diáfisis femoral.
* **Mecánica en Unity (3 fases):**
  1. **Decisión de puntería láser:** Usar la cruz láser sin irradiar sobre rótula/cóndilos en rodilla, y decidir NO confiar ciegamente en el láser cuando se presenta un caso de cadera en paciente con alto IMC.
  2. **Superposición condilar:** Corregir una lateral oblicua de rodilla eligiendo rotar manualmente la extremidad del paciente en lugar de desplazar todo el brazo en C.
  3. **Validación ortogonal a 90°:** Descubrir en el plano lateral un desplazamiento oculto en la vista AP y corregir la reducción en $\le 4$ disparos.
* **Códigos de error (`RecordError`):**
  * `KL_BLIND_SHOT_NO_LASER`: Disparó tanteando en rodilla sin aprovechar el centrado con puntería láser.
  * `KL_RELIED_ON_LASER_OBESE_HIP`: Confiaba únicamente en referencia externa láser en cadera obesa ignorando reparos anatómicos.
  * `KL_SINGLE_PLANE_ERROR`: Dio por aprobada una reducción verificando únicamente la vista AP sin lateral a 90°.

### 3. `m4_s3` — Minijuego 3: Mortaja y Barrido 3D (`M04_MG3_AnkleMortise3D`, `Modulo04`, Fase 3)
* **Premisa clínica:** Osteosíntesis de tobillo, sindesmosis (AO Estación 4) y fracturas articulares de pilón tibial/calcáneo con control 3D CBCT.
* **Mecánica en Unity (3 pasos):**
  1. **Centrado láser + Mortaja:** Centrar el haz entre los maléolos con láser y rotar internamente el tobillo entre 15° y 20° para abrir el espacio claro sindesmótico y detectar una diástasis oculta en AP simple.
  2. **Escaneo CBCT 3D:** Ante una fractura de calcáneo/pilón tibial que luce aceptable en 2D, iniciar el barrido rotacional 3D (180°–200°) verificando despeje de obstáculos.
  3. **Detección en cortes MPR:** Revisar los cortes axiales/coronales para señalar y retirar el tornillo que perfora la articulación subastragalina antes de cerrar piel.
* **Códigos de error (`RecordError`):**
  * `AM_INVALID_MORTISE_ANGLE`: Evaluó la sindesmosis con AP pura (0°) o rotación fuera del rango 15°–20°.
  * `AM_MISSED_3D_SCREW`: Confiaba en 2D o no señaló el tornillo intraarticular en el volumen CBCT.
