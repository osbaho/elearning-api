# GUIONES DE PRODUCCIÓN HEYGEN VIDEO AGENT — MÓDULO 2: RIESGOS, DOSIS Y PROTECCIÓN OPERATIVA

> **Configuración Global para HeyGen Video Agent:**
> * **Formato y relación de aspecto:** `16:9` horizontal (Full HD 1080p).
> * **Presentadora única (A-Roll):** **Dra. Nova** (*Custom Avatar* ya configurado en HeyGen). Sin otros avatares parlantes para garantizar estabilidad y fluidez en una sola generación.
> * **Público objetivo:** Equipo completo de quirófano (instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos en radiología, residentes y cirujanos ortopédicos). Lenguaje riguroso pero claro, cercano y accionable para todo el personal de sala.
> * **Regla de siglas en inglés:** Cada sigla en inglés se desarrolla primero en inglés y se explica de inmediato en español antes de continuar.
> * **Visuales (B-Roll y Gráficos):** Imágenes y clips de archivo **libres de derechos de autor** (quirófano ortopédico, arco en C, personal con blindaje plomado) combinados con gráficos animados 2D/3D limpios y *lower-thirds* en español. Paleta institucional: azul marino oscuro, cian médico y acentos ámbar/rojo para alertas.
> * **Duración objetivo:** ~3:10 a 3:30 minutos por video (~460–510 palabras de locución).

---

## Mapa del Módulo 2 (3 Videos + 3 Minijuegos)

| Paso | Tipo | Título | Duración aprox. | Minijuego vinculado / Mecánica clave |
| :--- | :--- | :--- | :--- | :--- |
| `m2_v1` | Video 1 | Efectos Biológicos, Principio ALARA y Límites 2026 | 3:15 min | Prepara para `m2_s1` (**Centinela Dosimétrico**) |
| `m2_s1` | Minijuego 1 | Centinela Dosimétrico (`M02_MG1_DoseSentinel`) | — | Tablero de dosimetría activa y medidas ALARA en vivo |
| `m2_v2` | Video 2 | Blindaje EPP, Control de Calidad y Protección Gestacional | 3:15 min | Prepara para `m2_s2` (**Escáner de Blindaje**) |
| `m2_s2` | Minijuego 2 | Escáner de Blindaje (`M02_MG2_ShieldInspector`) | — | Detección de fisuras, EPP gestacional y mantas DRF |
| `m2_v3` | Video 3 | Física del Scatter, "Hug the Intensifier" y Protocolo 5-P | 3:20 min | Prepara para `m2_s3` (**Zona Segura 5-P**) |
| `m2_s3` | Minijuego 3 | Zona Segura 5-P (`M02_MG3_ScatterZone5P`) | — | Ubicación del equipo en lateral, perímetro 2 m y voz de disparo |

---

# VIDEO 1 (`m2_v1`): Efectos Biológicos, Principio ALARA y Límites 2026
* **Archivo destino:** `M02_V01_ALARA_Limites.mp4`
* **Duración estimada:** ~3:15 minutos (~475 palabras)
* **Objetivo pedagógico:** Explicar a todo el equipo de quirófano el riesgo biológico real (determinístico vs. estocástico), el principio ALARA, los límites actualizados ICRP 118 para el cristalino (20 mSv/año) y la diferencia entre dosimetría pasiva y activa en tiempo real.
* **Siglas en inglés explicadas:** `MIPO`, `ALARA`, `ICRP`, `TLD`, `OSL`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 15 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" en planos medios y primeros planos con tono cálido, profesional, cercano y de autoridad clínica, dirigido a todo el personal de quirófano (instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos y médicos).
Estilo visual: estética médica moderna en tonos azul marino oscuro, cian y blanco, con alertas en ámbar y rojo. Alterna a la Dra. Nova en pantalla con videos e imágenes de archivo sin copyright (quirófano de ortopedia, equipo de rayos X portátil, personal con gafas y delantales plomados) y gráficos animados explicativos claros.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta los títulos de escena, las indicaciones visuales ni los textos en pantalla. Respeta pausas breves donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — La verdad invisible en el quirófano de ortopedia
Visual: Plano medio de Dra. Nova en un entorno de quirófano moderno con iluminación azul cian sutil. Transición a B-roll de archivo de un equipo quirúrgico realizando osteosíntesis mínimamente invasiva bajo arco en C.
Texto en pantalla: "MÓDULO 2 · VIDEO 1: RIESGO BIOLÓGICO Y PRINCIPIO ALARA"
Locución exacta:
"Bienvenidos al Módulo dos. Si trabajas en un quirófano de traumatología, ya sea como cirujano, instrumentador quirúrgico, auxiliar de enfermería o tecnólogo, este módulo es vital para cuidar tu salud a largo plazo. Hoy operamos fracturas a través de incisiones diminutas. Técnicas como MIPO, por sus siglas en inglés Minimally Invasive Plate Osteosynthesis —es decir, fijación de placas con mínima invasión— nos obligan a guiarnos por imágenes en vivo con el Arco en C. Y entre menos abrimos la piel, más tiempo dependemos de los rayos X."

ESCENA 2 — Daño determinístico frente a daño estocástico
Visual: Gráfico animado limpio dividido en dos columnas con iconografía médica: a la izquierda una piel y un ojo bajo el título "Determinístico (Con umbral)"; a la derecha una cadena de ADN y glándula tiroides bajo "Estocástico (Acumulativo)".
Texto en pantalla: "DETERMINÍSTICO (Umbral: >0.5 Gy ojo / >2 Gy piel) | ESTOCÁSTICO (Probabilidad acumulativa)"
Locución exacta:
"¿Por qué debemos respetar cada segundo de disparo? Porque la radiación produce dos tipos de daño biológico. Primero, el daño determinístico: ocurre cuando superamos un límite físico claro, y entre mayor es la dosis, más grave es la lesión... como quemaduras en la piel o cataratas en los ojos. Segundo, el daño estocástico: aquí no existe un umbral seguro. Cada pequeña exposición acumulada en el ADN aumenta con los años la probabilidad de desarrollar enfermedades como cáncer de tiroides o leucemia. La buena noticia es que podemos controlar ambos riesgos."

ESCENA 3 — La tríada del principio ALARA
Visual: Dra. Nova en pantalla y luego animación limpia con tres íconos secuenciales: un cronómetro (Tiempo), una cinta métrica con onda decreciente 1/d² (Distancia) y un escudo protector (Blindaje).
Texto en pantalla: "PRINCIPIO ALARA: As Low As Reasonably Achievable (Tiempo · Distancia · Blindaje)"
Locución exacta:
"Todo el mundo de la radioprotección se resume en una sigla internacional: ALARA. En inglés significa As Low As Reasonably Achievable, y en español quiere decir: tan bajo como sea razonablemente posible. Para lograrlo, tú y tu equipo controlan tres llaves maestras. Primera, el tiempo: jamás pisar el pedal de forma continua... disparamos en pulsos breves y precisos. Segunda, la distancia: gracias a la ley del inverso del cuadrado, si das apenas dos pasos atrás duplicando tu distancia al paciente, la radiación que recibes cae a la cuarta parte. Y tercera, el blindaje: usar siempre barreras plomadas completas."

ESCENA 4 — Nuevos límites para tus ojos (ICRP 118 y Resolución 1811)
Visual: B-roll de archivo de un profesional de la salud colocándose gafas protectoras laterales, acompañado de un medidor gráfico animado que baja de 150 a 20.
Texto en pantalla: "ICRP 118: Límite en cristalino bajó de 150 a 20 mSv/año | Límite general POE: 20 mSv/año"
Locución exacta:
"Atención especial al cuidado de tus ojos. La ICRP, siglas en inglés de International Commission on Radiological Protection —la Comisión Internacional de Protección Radiológica— revisó la evidencia médica y descubrió que el cristalino del ojo desarrolla cataratas con dosis mucho menores de lo que se creía... apenas medio gray acumulado. Por eso, la publicación ICRP ciento dieciocho redujo el límite anual permitido para los ojos en un ochenta y siete por ciento: bajó de ciento cincuenta a solo veinte milisieverts al año, igualando el límite global anual de cuerpo entero exigido por la Resolución dieciocho once para todo trabajador expuesto."

ESCENA 5 — Dosímetros pasivos frente a dosimetría activa en tiempo real
Visual: Comparativa en gráfico animado: a la izquierda un dosímetro clásico de solapa con calendario mensual; a la derecha un monitor tipo semáforo (verde, amarillo, rojo) reaccionando al instante cuando alguien da un paso atrás.
Texto en pantalla: "TLD / OSL (Lectura mensual) vs. DOSIMETRÍA ACTIVA (Alerta en vivo -60% dosis)"
Locución exacta:
"Para vigilar esa dosis existen dos herramientas. Los dosímetros tradicionales tipo TLD, Thermoluminescent Dosimeter, u OSL, Optically Stimulated Luminescence —dosímetros termoluminiscentes o de luminiscencia óptica— son registros legales muy valiosos, pero se leen semanas después... te avisan cuando la exposición ya ocurrió. Hoy los quirófanos modernos suman la dosimetría activa inalámbrica: pequeños sensores que muestran en un monitor un semáforo en tiempo real. Si la barra pasa de verde a amarillo o rojo, basta con dar medio paso atrás en ese instante para corregir la postura y reducir tu dosis anual en más del sesenta por ciento."

ESCENA 6 — Cierre y llamado al Minijuego 1
Visual: Dra. Nova sonriendo con seguridad frente a un fondo limpio de quirófano, señalando hacia la interfaz de práctica.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 1 — CENTINELA DOSIMÉTRICO"
Locución exacta:
"Recuerda: el tiempo, la distancia y el monitoreo activo protegen tu vista y tu futuro profesional. Ahora entra al minijuego Centinela Dosimétrico para mantener el semáforo de radiación en verde durante la cirugía. ¡Nos vemos en el próximo video!"
```

### Solo Locución Limpia (`m2_v1` — opcional por si se pega en campo separado)
> Bienvenidos al Módulo dos. Si trabajas en un quirófano de traumatología, ya sea como cirujano, instrumentador quirúrgico, auxiliar de enfermería o tecnólogo, este módulo es vital para cuidar tu salud a largo plazo. Hoy operamos fracturas a través de incisiones diminutas. Técnicas como MIPO, por sus siglas en inglés Minimally Invasive Plate Osteosynthesis —es decir, fijación de placas con mínima invasión— nos obligan a guiarnos por imágenes en vivo con el Arco en C. Y entre menos abrimos la piel, más tiempo dependemos de los rayos X.
>
> ¿Por qué debemos respetar cada segundo de disparo? Porque la radiación produce dos tipos de daño biológico. Primero, el daño determinístico: ocurre cuando superamos un límite físico claro, y entre mayor es la dosis, más grave es la lesión... como quemaduras en la piel o cataratas en los ojos. Segundo, el daño estocástico: aquí no existe un umbral seguro. Cada pequeña exposición acumulada en el ADN aumenta con los años la probabilidad de desarrollar enfermedades como cáncer de tiroides o leucemia. La buena noticia es que podemos controlar ambos riesgos.
>
> Todo el mundo de la radioprotección se resume en una sigla internacional: ALARA. En inglés significa As Low As Reasonably Achievable, y en español quiere decir: tan bajo como sea razonablemente posible. Para lograrlo, tú y tu equipo controlan tres llaves maestras. Primera, el tiempo: jamás pisar el pedal de forma continua... disparamos en pulsos breves y precisos. Segunda, la distancia: gracias a la ley del inverso del cuadrado, si das apenas dos pasos atrás duplicando tu distancia al paciente, la radiación que recibes cae a la cuarta parte. Y tercera, el blindaje: usar siempre barreras plomadas completas.
>
> Atención especial al cuidado de tus ojos. La ICRP, siglas en inglés de International Commission on Radiological Protection —la Comisión Internacional de Protección Radiológica— revisó la evidencia médica y descubrió que el cristalino del ojo desarrolla cataratas con dosis mucho menores de lo que se creía... apenas medio gray acumulado. Por eso, la publicación ICRP ciento dieciocho redujo el límite anual permitido para los ojos en un ochenta y siete por ciento: bajó de ciento cincuenta a solo veinte milisieverts al año, igualando el límite global anual de cuerpo entero exigido por la Resolución dieciocho once para todo trabajador expuesto.
>
> Para vigilar esa dosis existen dos herramientas. Los dosímetros tradicionales tipo TLD, Thermoluminescent Dosimeter, u OSL, Optically Stimulated Luminescence —dosímetros termoluminiscentes o de luminiscencia óptica— son registros legales muy valiosos, pero se leen semanas después... te avisan cuando la exposición ya ocurrió. Hoy los quirófanos modernos suman la dosimetría activa inalámbrica: pequeños sensores que muestran en un monitor un semáforo en tiempo real. Si la barra pasa de verde a amarillo o rojo, basta con dar medio paso atrás en ese instante para corregir la postura y reducir tu dosis anual en más del sesenta por ciento.
>
> Recuerda: el tiempo, la distancia y el monitoreo activo protegen tu vista y tu futuro profesional. Ahora entra al minijuego Centinela Dosimétrico para mantener el semáforo de radiación en verde durante la cirugía. ¡Nos vemos en el próximo video!

---

# VIDEO 2 (`m2_v2`): Blindaje EPP, Control de Calidad y Protección Gestacional
* **Archivo destino:** `M02_V02_Blindaje_Gestacion.mp4`
* **Duración estimada:** ~3:15 minutos (~480 palabras)
* **Objetivo pedagógico:** Enseñar los factores reales de atenuación del delantal, collar tiroideo (con desinfección) y gafas laterales, el control de calidad contra grietas por mal doblado, el protocolo internacional para personal gestante y las telas reductoras de dosis de sulfato de bario (DRF).
* **Siglas en inglés explicadas:** `ICRP`, `DRF`, `ROI`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 15 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" hablando directo a cámara con tono empático, práctico y riguroso, pensado para instrumentadores quirúrgicos, auxiliares de enfermería, tecnólogos y cirujanos.
Estilo visual: quirófano moderno con iluminación azul cian y acentos ámbar/verde para indicadores de protección. Alterna a la Dra. Nova con videos e imágenes de archivo sin copyright (personal médico vistiendo delantal plomado, colgadores de mandiles, equipo quirúrgico en sala) y animaciones limpias en 2D/3D con textos breves en español.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta encabezados, descripciones visuales ni los textos en pantalla. Usa pausas naturales donde hay puntos suspensivos (...).

---

ESCENA 1 — Tu armadura en el quirófano: cuánto protege cada prenda
Visual: Plano medio de Dra. Nova acompañada de un gráfico anatómico animado que resalta pecho, cuello y ojos con porcentajes de protección.
Texto en pantalla: "BLINDAJE EPP: Mandil 16x frontal / 4x lateral · Collarín -88.9% · Gafas -90%"
Locución exacta:
"En el video anterior vimos la importancia del tiempo y la distancia. Ahora hablemos de tu tercera barrera: el Equipo de Protección Personal o EPP. Un delantal plomado estándar de cero coma cinco milímetros equivalente de plomo atenúa más del noventa y cinco por ciento del haz frontal... reduce la dosis dieciséis veces. Pero cuidado: si giras de lado hacia el equipo, esa protección cae a solo cuatro veces porque la radiación entra por las aberturas laterales de las axilas. Nunca le des la espalda ni el costado al Arco en C sin protección envolvente."

ESCENA 2 — Collar tiroideo, higiene y gafas con protección lateral
Visual: B-roll de archivo de personal colocándose protector tiroideo y gafas médicas, seguido de una animación limpia de limpieza/desinfección sobre un collarín tiroideo.
Texto en pantalla: "TIROIDES: -88.9% dosis (Desinfectar tras cada cirugía) | GAFAS 0.5–0.75 mm Pb + visera lateral"
Locución exacta:
"Dos prendas nunca pueden faltar junto al mandil. Primero, el collarín tiroideo bien ajustado al cuello, que bloquea casi el ochenta y nueve por ciento de la radiación hacia la glándula tiroides. Y un detalle clave para enfermería e instrumentación: como estos collares suelen compartirse entre turnos, deben limpiarse y desinfectarse después de cada cirugía para que no transmitan infecciones. Segundo, las gafas plomadas con viseras laterales: protegen tus ojos por los costados y reducen hasta un noventa por ciento la radiación que llega al cristalino."

ESCENA 3 — Cómo se destruye un mandil por dentro
Visual: Animación clara comparando un mandil doblado sobre una silla (mostrando grietas blancas/negras bajo rayos X) frente a un mandil colgado en una percha curva dedicada en la pared.
Texto en pantalla: "PROHIBIDO DOBLAR EL MANDIL · Escaneo anual + Colgar siempre en percha curva"
Locución exacta:
"Ahora un error cotidiano que vemos en casi todos los hospitales: terminar la cirugía, doblar el delantal por la mitad o tirarlo sobre una silla. Cada vez que doblas, enrollas o pisas un mandil, la lámina protectora interna se quiebra como un vidrio por dentro. Por fuera la tela se ve impecable, pero cuando lo escaneas bajo el Arco en C aparecen grietas negras por donde se fuga la radiación directo a tus órganos. La regla de oro es simple: cuelga siempre los delantales estirados en perchas curvas de pared y exige su inspección radiográfica una vez al año."

ESCENA 4 — Protocolo seguro para personal gestante en sala
Visual: Gráfico animado respetuoso y claro de una profesional de salud con doble delantal envolvente y dos sensores resaltados: uno en el cuello por fuera y otro en el abdomen debajo del plomo.
Texto en pantalla: "EMBARAZO (ICRP 84 / OIEA): Límite fetal 1 mSv · Doble mandil (1.0 mm Pb) · Dosímetro abdominal interno"
Locución exacta:
"¿Qué ocurre cuando una cirujana, instrumentadora o enfermera está embarazada? Muchas personas creen erróneamente que debe salir de todo servicio quirúrgico, pero la ciencia dice otra cosa. Bajo los estándares de la ICRP, International Commission on Radiological Protection, y las guías internacionales, una vez declarado el embarazo, el límite máximo para el bebé es de un milisievert durante toda la gestación. Con dos medidas claras puede trabajar segura: usar un delantal de maternidad o doble capa frontal de un milímetro de plomo... y portar un segundo dosímetro personal colocado debajo del mandil, a la altura del abdomen, para vigilar mes a mes que la barrera sea absoluta."

ESCENA 5 — Telas protectoras sin plomo: sulfato de bario DRF
Visual: Animación esquemática de una manta quirúrgica estéril colocada en el borde de la mesa junto al paciente, desviando partículas de dispersión sin tapar la zona del hueso.
Texto en pantalla: "TECNOLOGÍA DRF (Dose Reduction Fiber - BaSO4): Reduce scatter 25% a 93% sin artefactos"
Locución exacta:
"Para sumar una capa extra, hoy contamos con mantas estériles libres de plomo llamadas DRF. Por sus siglas en inglés, DRF significa Dose Reduction Fiber, es decir, fibra reductora de dosis fabricada con sulfato de bario. A diferencia del plomo rígido que mancha la radiografía, estas mantas dejan pasar la imagen limpia si están fuera del campo óseo, y reducen entre un veinticinco y un noventa y tres por ciento la radiación que rebota hacia las manos y el pecho del equipo. Solo colócalas alrededor de la ROI, sigla en inglés de Region of Interest —tu región de interés quirúrgica— sin tapar el hueso que vas a operar."

ESCENA 6 — Cierre y llamado al Minijuego 2
Visual: Dra. Nova con expresión amable y firme, invitando al siguiente ejercicio práctico.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 2 — ESCÁNER DE BLINDAJE"
Locución exacta:
"Cuidar tu armadura plomada, desinfectar el collarín y proteger a las compañeras gestantes es tarea de todo el equipo. Pon a prueba tu ojo clínico en el minijuego Escáner de Blindaje, detectando mandiles dañados y preparando la protección correcta antes de entrar a sala. ¡Te espero en el último video del módulo!"
```

### Solo Locución Limpia (`m2_v2`)
> En el video anterior vimos la importancia del tiempo y la distancia. Ahora hablemos de tu tercera barrera: el Equipo de Protección Personal o EPP. Un delantal plomado estándar de cero coma cinco milímetros equivalente de plomo atenúa más del noventa y cinco por ciento del haz frontal... reduce la dosis dieciséis veces. Pero cuidado: si giras de lado hacia el equipo, esa protección cae a solo cuatro veces porque la radiación entra por las aberturas laterales de las axilas. Nunca le des la espalda ni el costado al Arco en C sin protección envolvente.
>
> Dos prendas nunca pueden faltar junto al mandil. Primero, el collarín tiroideo bien ajustado al cuello, que bloquea casi el ochenta y nueve por ciento de la radiación hacia la glándula tiroides. Y un detalle clave para enfermería e instrumentación: como estos collares suelen compartirse entre turnos, deben limpiarse y desinfectarse después de cada cirugía para que no transmitan infecciones. Segundo, las gafas plomadas con viseras laterales: protegen tus ojos por los costados y reducen hasta un noventa por ciento la radiación que llega al cristalino.
>
> Ahora un error cotidiano que vemos en casi todos los hospitales: terminar la cirugía, doblar el delantal por la mitad o tirarlo sobre una silla. Cada vez que doblas, enrollas o pisas un mandil, la lámina protectora interna se quiebra como un vidrio por dentro. Por fuera la tela se ve impecable, pero cuando lo escaneas bajo el Arco en C aparecen grietas negras por donde se fuga la radiación directo a tus órganos. La regla de oro es simple: cuelga siempre los delantales estirados en perchas curvas de pared y exige su inspección radiográfica una vez al año.
>
> ¿Qué ocurre cuando una cirujana, instrumentadora o enfermera está embarazada? Muchas personas creen erróneamente que debe salir de todo servicio quirúrgico, pero la ciencia dice otra cosa. Bajo los estándares de la ICRP, International Commission on Radiological Protection, y las guías internacionales, una vez declarado el embarazo, el límite máximo para el bebé es de un milisievert durante toda la gestación. Con dos medidas claras puede trabajar segura: usar un delantal de maternidad o doble capa frontal de un milímetro de plomo... y portar un segundo dosímetro personal colocado debajo del mandil, a la altura del abdomen, para vigilar mes a mes que la barrera sea absoluta.
>
> Para sumar una capa extra, hoy contamos con mantas estériles libres de plomo llamadas DRF. Por sus siglas en inglés, DRF significa Dose Reduction Fiber, es decir, fibra reductora de dosis fabricada con sulfato de bario. A diferencia del plomo rígido que mancha la radiografía, estas mantas dejan pasar la imagen limpia si están fuera del campo óseo, y reducen entre un veinticinco y un noventa y tres por ciento la radiación que rebota hacia las manos y el pecho del equipo. Solo colócalas alrededor de la ROI, sigla en inglés de Region of Interest —tu región de interés quirúrgica— sin tapar el hueso que vas a operar.
>
> Cuidar tu armadura plomada, desinfectar el collarín y proteger a las compañeras gestantes es tarea de todo el equipo. Pon a prueba tu ojo clínico en el minijuego Escáner de Blindaje, detectando mandiles dañados y preparando la protección correcta antes de entrar a sala. ¡Te espero en el último video del módulo!

---

# VIDEO 3 (`m2_v3`): Física del Scatter, "Hug the Intensifier" y Protocolo 5-P
* **Archivo destino:** `M02_V03_Scatter_Protocolo5P.mp4`
* **Duración estimada:** ~3:20 minutos (~495 palabras)
* **Objetivo pedagógico:** Explicar el origen de la radiación dispersa (proporción 80/20/2 en el paciente), la configuración vertical correcta (tubo abajo), la regla internacional "Hug the Intensifier" en proyecciones laterales (25x torso), el perímetro real de 2 metros / 6 pies (desmitificando la regla de 3 pies) y el Checklist pre-disparo 5-P con aviso verbal obligatorio.
* **Siglas y términos en inglés explicados:** `Scatter`, `AP`, `Hug the Intensifier`, `Screening`.

## Prompt Maestro Listo para Copiar y Pegar en HeyGen Video Agent

```text
INSTRUCCIONES PARA HEYGEN VIDEO AGENT:
Crea un video educativo médico completo en español, en formato horizontal 16:9, de aproximadamente 3 minutos y 20 segundos.
Presentadora única: usa mi Custom Avatar "Dra. Nova" en planos claros con actitud de liderazgo docente, explicando con precisión y sencillez para cirujanos, instrumentadores, auxiliares de enfermería y tecnólogos.
Estilo visual: estética quirúrgica de alto contraste (azul oscuro, cian y zonas de calor rojo/ámbar para visualizar radiación). Usa animaciones esquemáticas claras del Arco en C junto a una mesa quirúrgica y clips de archivo libres de copyright de quirófanos ortopédicos.
REGLA CRÍTICA DE LOCUCIÓN: Lee únicamente el texto que aparece dentro de "Locución exacta" en cada escena. No leas en voz alta los títulos, las indicaciones visuales ni los textos en pantalla. Haz una pausa breve donde aparezcan puntos suspensivos (...).

---

ESCENA 1 — El verdadero foco de radiación: el paciente y el scatter
Visual: Animación 3D limpia del tubo debajo de la mesa enviando 100 rayos hacia un paciente: 80 se absorben en el cuerpo, 10 a 20 rebotan hacia afuera en amarillo (scatter) y solo 2 llegan al detector superior.
Texto en pantalla: "FÍSICA DEL SCATTER (80/20/2): 80% Absorbido · 10–20% Disperso (Scatter) · 2% Imagen"
Locución exacta:
"En este último video del Módulo dos vamos a revelar dónde nace el verdadero peligro dentro de la sala de cirugía. Casi nadie recibe el rayo directo del tubo: nuestro enemigo diario es el scatter... palabra en inglés que significa radiación dispersa o de rebote. Y el emisor principal de ese rebote no es la máquina, sino el propio paciente. De cada cien fotones que salen del tubo, ochenta son absorbidos por el cuerpo del paciente, solo dos logran atravesarlo para formar la radiografía en el monitor... y entre diez y veinte rebotan hacia todos los lados de la sala. Saber hacia dónde rebotan lo cambia todo."

ESCENA 2 — Posición vertical y la regla de oro "Hug the Intensifier"
Visual: Gráfico animado en dos partes: a la izquierda vista AP con tubo abajo (rebote hacia el suelo, seguro) vs tubo arriba (rebote directo a cara, peligro). A la derecha el arco rotado 90° en lateral mostrando zona roja del lado del tubo (25x torso) y zona azul segura del lado del receptor.
Texto en pantalla: "HUG THE INTENSIFIER = ¡Abraza el Intensificador! | Lado del Tubo = 25x más dosis en torso"
Locución exacta:
"Regla número uno en proyección AP —siglas de anteroposterior—: el tubo generador va siempre debajo de la camilla y el detector arriba. Así, la radiación que rebota en el paciente se dirige hacia el piso y la parte baja del delantal, lejos de tus ojos y tiroides. Pero atención cuando giramos el arco noventa grados para tomar una proyección lateral de fémur o cadera. La regla internacional de AO Trauma se llama en inglés Hug the Intensifier, que significa literalmente: ¡abraza el intensificador o quédate del lado del receptor! Si alguien del equipo se para del lado del tubo emisor en una lateral, su torso recibe veinticinco veces más radiación y su tiroides hasta cuatro veces más."

ESCENA 3 — Desmitificando los 3 pies y el perímetro de 2 metros
Visual: Diagrama circular visto desde arriba alrededor de la mesa quirúrgica: anillo interno a 30 cm (1 pie), anillo medio a 90 cm (3 pies, aún con alerta amarilla) y anillo externo de Zona Controlada a 2 metros (6 pies, verde seguro).
Texto en pantalla: "ZONA CONTROLADA: 2 METROS (6 PIES) | A 1 pie = 12x dosis gonadal | Sin EPP: fuera de 2 m"
Locución exacta:
"¿Y qué distancia es segura para quienes no están operando directamente la herida, como auxiliares circulantes o anestesiólogos? Durante años circuló el mito de que a tres pies —unos noventa centímetros— la radiación desaparecía. Estudios modernos demostraron que a tres pies todavía hay dispersión medible, especialmente en la zona pélvica, y que a apenas treinta centímetros del haz el asistente quirúrgico recibe diez veces más dosis que el cirujano. Por eso la normativa establece un perímetro controlado de dos metros... o seis pies. Toda persona dentro de esos dos metros debe vestir equipo plomado completo; quien no tenga blindaje debe dar un paso fuera del radio de dos metros antes del disparo."

ESCENA 4 — Pacientes voluminosos y uso prudente de la magnificación
Visual: Animación sencilla mostrando cómo al aumentar el grosor del paciente o activar el zoom en consola, el equipo eleva automáticamente la potencia y la nube de dispersión crece.
Texto en pantalla: "Mayor grosor tisular = Más scatter | Zoom electrónico = Hasta 2x dosis en piel"
Locución exacta:
"Antes de presionar el pedal, recuerda dos multiplicadores silenciosos. En pacientes con mayor volumen corporal, el arco sube automáticamente la potencia para lograr atravesar el tejido, duplicando la radiación dispersa hacia la sala: en esos casos da un paso adicional hacia atrás. Y evita usar el botón de magnificación o zoom electrónico sin necesidad real, porque para agrandar la imagen el equipo puede duplicar la dosis sobre la piel del paciente."

ESCENA 5 — El Checklist pre-disparo de 5 puntos (Protocolo 5-P)
Visual: Animación dinámica paso a paso que ilumina los 5 puntos de la regla mnemotécnica en español con íconos grandes y limpios.
Texto en pantalla: "PROTOCOLO 5-P: 1. Posición · 2. Proximidad · 3. Precisión · 4. Pulsado · 5. Proclamación (¡DISPARO!)"
Locución exacta:
"Para que nunca olvides estas normas bajo el estrés del quirófano, aplica siempre nuestro Checklist de las cinco P antes de cada disparo. Uno: Posición... tubo debajo de la camilla y equipo del lado del intensificador en lateral. Dos: Proximidad... detector lo más pegado posible al paciente. Tres: Precisión... centrar con puntero láser y cerrar el colimador al área exacta. Cuatro: Pulsado... consola configurada a cuatro u ocho pulsos por segundo, nunca continua. Y cinco: Proclamación... ¡jamás pises el pedal en silencio! Avisa siempre en voz alta diciendo ¡Disparo! —o Screening, término en inglés usado en muchos hospitales para indicar emisión activa— dando dos segundos para que todo el equipo se proteja o retroceda."

ESCENA 6 — Cierre y llamado al Minijuego 3
Visual: Dra. Nova mirando a cámara con firmeza y sonrisa de orgullo profesional, invitando al simulador final del módulo.
Texto en pantalla: "SIGUIENTE PASO: MINIJUEGO 3 — ZONA SEGURA 5-P"
Locución exacta:
"Cuando anuncias el disparo en voz alta y ordenas la sala, proteges a cada compañero del quirófano. Ahora entra al minijuego Zona Segura cinco P para ubicar al equipo del lado del receptor, despejar el perímetro de dos metros y comandar un disparo seguro. ¡Nos vemos en el Módulo tres!"
```

### Solo Locución Limpia (`m2_v3`)
> En este último video del Módulo dos vamos a revelar dónde nace el verdadero peligro dentro de la sala de cirugía. Casi nadie recibe el rayo directo del tubo: nuestro enemigo diario es el scatter... palabra en inglés que significa radiación dispersa o de rebote. Y el emisor principal de ese rebote no es la máquina, sino el propio paciente. De cada cien fotones que salen del tubo, ochenta son absorbidos por el cuerpo del paciente, solo dos logran atravesarlo para formar la radiografía en el monitor... y entre diez y veinte rebotan hacia todos los lados de la sala. Saber hacia dónde rebotan lo cambia todo.
>
> Regla número uno en proyección AP —siglas de anteroposterior—: el tubo generador va siempre debajo de la camilla y el detector arriba. Así, la radiación que rebota en el paciente se dirige hacia el piso y la parte baja del delantal, lejos de tus ojos y tiroides. Pero atención cuando giramos el arco noventa grados para tomar una proyección lateral de fémur o cadera. La regla internacional de AO Trauma se llama en inglés Hug the Intensifier, que significa literalmente: ¡abraza el intensificador o quédate del lado del receptor! Si alguien del equipo se para del lado del tubo emisor en una lateral, su torso recibe veinticinco veces más radiación y su tiroides hasta cuatro veces más.
>
> ¿Y qué distancia es segura para quienes no están operando directamente la herida, como auxiliares circulantes o anestesiólogos? Durante años circuló el mito de que a tres pies —unos noventa centímetros— la radiación desaparecía. Estudios modernos demostraron que a tres pies todavía hay dispersión medible, especialmente en la zona pélvica, y que a apenas treinta centímetros del haz el asistente quirúrgico recibe diez veces más dosis que el cirujano. Por eso la normativa establece un perímetro controlado de dos metros... o seis pies. Toda persona dentro de esos dos metros debe vestir equipo plomado completo; quien no tenga blindaje debe dar un paso fuera del radio de dos metros antes del disparo.
>
> Antes de presionar el pedal, recuerda dos multiplicadores silenciosos. En pacientes con mayor volumen corporal, el arco sube automáticamente la potencia para lograr atravesar el tejido, duplicando la radiación dispersa hacia la sala: en esos casos da un paso adicional hacia atrás. Y evita usar el botón de magnificación o zoom electrónico sin necesidad real, porque para agrandar la imagen el equipo puede duplicar la dosis sobre la piel del paciente.
>
> Para que nunca olvides estas normas bajo el estrés del quirófano, aplica siempre nuestro Checklist de las cinco P antes de cada disparo. Uno: Posición... tubo debajo de la camilla y equipo del lado del intensificador en lateral. Dos: Proximidad... detector lo más pegado posible al paciente. Tres: Precisión... centrar con puntero láser y cerrar el colimador al área exacta. Cuatro: Pulsado... consola configurada a cuatro u ocho pulsos por segundo, nunca continua. Y cinco: Proclamación... ¡jamás pises el pedal en silencio! Avisa siempre en voz alta diciendo ¡Disparo! —o Screening, término en inglés usado en muchos hospitales para indicar emisión activa— dando dos segundos para que todo el equipo se proteja o retroceda.
>
> Cuando anuncias el disparo en voz alta y ordenas la sala, proteges a cada compañero del quirófano. Ahora entra al minijuego Zona Segura cinco P para ubicar al equipo del lado del receptor, despejar el perímetro de dos metros y comandar un disparo seguro. ¡Nos vemos en el Módulo tres!

---

## Especificación de Minijuegos del Módulo 2 (Unity WebGL — `Modulo02`)

> *Regla común de la plataforma:* cada minijuego dura un mínimo de 30 s (`minSeconds`), evalúa aprobación con `score >= 70` (`+10` Puntos de Reserva con 0 errores, `+5` si aprueba con errores, `0` si reprueba) y reporta errores detallados `{ code, message, atSeconds }` vía `MinigameBase.RecordError`.

### 1. `m2_s1` — Minijuego 1: Centinela Dosimétrico (`M02_MG1_DoseSentinel`, `Modulo02`, Fase 1)
* **Premisa clínica:** El alumno supervisa un monitor de dosimetría activa inalámbrica en tiempo real (semáforo verde/ámbar/rojo para cirujano, instrumentador y cristalino) durante 3 escenarios quirúrgicos progresivos (enclavado MIPO tibial, reducción de pelvis, revisión prolongada).
* **Mecánica en Unity:**
  1. En cada escenario, un indicador muestra el modo de disparo actual (continuo vs. pulsos cortos), la distancia del equipo en pasos/metros y el acumulado en cristalino frente al umbral ICRP 118 (20 mSv/año).
  2. El jugador debe intervenir en vivo antes de que la barra llegue al rojo: cambiar de pedal continuo a ráfagas pulsadas (**Tiempo**), activar el retroceso de los ayudantes a 2 metros aplicando la ley $1/d^2$ (**Distancia**), y confirmar la transición de lectura pasiva mensual a biofeedback activo.
  3. **Modo Tutor:** Tras 2 errores en un mismo caso, Dra. Nova bloquea el pedal y explica paso a paso la ley $1/d^2$ y el umbral de 20 mSv/año para cristalino.
* **Códigos de error (`RecordError`):**
  * `DS_CONTINUOUS_EXPOSURE`: Mantuvo fluoroscopia continua disparando la dosis acumulada.
  * `DS_TOO_CLOSE`: No aplicó la retirada de distancia ($1/d^2$) cuando el semáforo pasó a ámbar/rojo.
  * `DS_OCULAR_THRESHOLD`: Superó el margen seguro proyectado para cristalino (ICRP 118) sin intervención.

### 2. `m2_s2` — Minijuego 2: Escáner de Blindaje (`M02_MG2_ShieldInspector`, `Modulo02`, Fase 2)
* **Premisa clínica:** Estación de alistamiento y control de calidad de EPP antes de iniciar la jornada en traumatología.
* **Mecánica en Unity (3 sub-etapas):**
  1. **Inspección y almacenamiento:** El alumno escanea 4 delantales plomados bajo el arco en C virtual; debe descartar los que presenten microfisuras por dobleces y enviar los íntegros a la percha curva de pared (nunca doblarlos sobre sillas).
  2. **Desinfección y equipamiento especial:** Debe desinfectar un collarín tiroideo compartido antes de asignarlo, equipar correctamente a una auxiliar/residente gestante (doble mandil envolvente de 1.0 mm Pb eq. + segundo dosímetro **debajo** del mandil en abdomen, límite 1 mSv) y ajustar gafas con protección lateral.
  3. **Telas DRF de sulfato de bario:** Colocar la manta estéril DRF alrededor de la zona quirúrgica (ROI) protegiendo las manos del equipo sin ocluir el hueso a operar.
* **Códigos de error (`RecordError`):**
  * `SI_CRACKED_APRON_APPROVED`: Aprobó o colgó mal un delantal con fisuras internas en el plomo.
  * `SI_THYROID_NOT_SANITIZED`: Asignó un protector tiroideo compartido sin desinfección previa.
  * `SI_GESTATION_DOSIMETER_OUTSIDE`: Colocó el segundo dosímetro fetal por fuera del delantal o omitió el doble blindaje.
  * `SI_DRF_BLOCKS_ROI`: Colocó la manta DRF tapando directamente el foco de fractura (ROI).

### 3. `m2_s3` — Minijuego 3: Zona Segura 5-P (`M02_MG3_ScatterZone5P`, `Modulo02`, Fase 3)
* **Premisa clínica:** Vista táctica 3D del quirófano con simulación de partículas de dispersión Compton (80/20/2) en tiempo real.
* **Mecánica en Unity (3 casos: AP de cadera, Lateral de fémur, Paciente con alto volumen tisular):**
  1. En el mapa de sala aparecen 4 integrantes (cirujano principal, primer ayudante a 10 cm, instrumentador y circulante sin EPP). Al girar a lateral, un mapa térmico muestra la asimetría 25x del lado del tubo.
  2. El jugador debe arrastrar/reubicar a los avatares al lado del intensificador (*Hug the Intensifier*), sacar al personal sin EPP fuera del perímetro controlado de 2 metros (6 pies), evitar la posición de tubo arriba y confirmar los 5 pasos del **Checklist 5-P** en orden culminando con el botón de alerta vocal **"¡DISPARO!"** antes de pisar el pedal.
* **Códigos de error (`RecordError`):**
  * `SZ_TUBE_SIDE_EXPOSURE`: Dejó al cirujano o ayudante del lado del tubo en lateral (25x dosis al torso).
  * `SZ_PERIMETER_BREACH`: Disparó con personal sin blindaje dentro del radio controlado de 2 metros (6 pies).
  * `SZ_SILENT_SHOT`: Pisó el pedal sin emitir previamente la proclamación verbal **"¡DISPARO!"**.
  * `SZ_CHECKLIST_ORDER`: Intentó disparar sin completar las verificaciones del Protocolo 5-P.
