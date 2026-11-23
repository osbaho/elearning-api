# -*- coding: utf-8 -*-
import os

target_dirs = [
    r'C:\Oscar\Curso Arco en C',
    r'c:\Oscar\ArcoC\docs\guiones'
]

for d in target_dirs:
    os.makedirs(d, exist_ok=True)

# -------------------------------------------------------------
# GUION MODULO 1
# -------------------------------------------------------------
g1 = '''# GUIONES DE PRODUCCIÓN - MÓDULO 1: INTRODUCCIÓN, HISTORIA Y FUNDAMENTOS DE RADIACIÓN

**ESTILO VISUAL GLOBAL (Para el generador de video AI):**
*   **Avatar:** "Dra. Nova". Mujer profesional de 35 años, cabello recogido, bata médica blanca plomada con collarín protector de tiroides visible y dosímetro personal. Expresión empática, autoritaria y de rigor clínico.
*   **Estética / Escenografía:** Quirófano hiperrealista con iluminación "Cinematic Dark" (penumbra ambiental con acentos de neón cyan y azul profundo). Interfaz holográfica (HUD) flotando en el aire. Equipo de Arco en C moderno visible en el fondo con desenfoque estético (bokeh).
*   **Tipo de plano predominante:** Plano Medio a Plano Pecho, con sutiles movimientos de cámara (slow tracking pan/tilt) para dar máximo dinamismo a la síntesis de video con IA.

---

## VIDEO 1: Bienvenida, Historia y los Pilares S.E.R.
**Duración Estimada:** 2:30 minutos  
**Objetivo:** Introducir la importancia del curso, la historia de los rayos X (Wilhelm Röntgen) y presentar el marco operativo S.E.R. (Seguridad, Eficiencia, Responsabilidad).

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | *Plano General a Plano Medio*. Quirófano futurista oscuro iluminado en cyan. Dra. Nova de pie junto a un Arco en C desenfocado. | Sonríe cálidamente y extiende la mano en señal de bienvenida formal. | Letrero 3D flotante: "CURSO DE FORMACIÓN EN ARCO EN C // MASTER CLASS". | "Bienvenidos, colegas. Soy la Dra. Nova. Hoy inician su camino para dominar una de las herramientas más poderosas y complejas de la cirugía moderna: el equipo de fluoroscopía intraoperatoria o Arco en C." |
| **0:25 - 0:55** | *Plano Medio Corto*. Iluminación cenital con leve viñeta oscura. | Gesticulación abierta y pausada; mira fijamente a la cámara. | Imagen histórica holográfica: radiografía de la mano de Anna Bertha Röntgen con su anillo de bodas (1895). | "En 1895, Wilhelm Röntgen descubrió los rayos X al capturar la mano de su esposa. Desde entonces, la radioscopía transformó la medicina: nos permite reducir fracturas complejas, implantar prótesis y guiar catéteres en tiempo real a través de incisiones milimétricas... pero toda revolución tiene un costo invisible." |
| **0:55 - 1:30** | *Corte a Plano Medio*. Movimiento lateral sutil (slow tracking). | Desliza su mano derecha en el aire revelando tres pilares luminosos en pantalla. | Letras holográficas tridimensionales: **S . E . R .** (Seguridad // Eficiencia // Responsabilidad). | "Ese costo es la radiación ionizante. Para operarla con excelencia clínica sin poner en riesgo nuestra salud, este curso se fundamenta en los tres pilares del sistema S.E.R.: Seguridad, Eficiencia y Responsabilidad." |
| **1:30 - 2:05** | *Plano Detalle / Pecho*. Enfoque centrado. El fondo adquiere un matiz esmeralda tenue. | Enumera con los dedos con precisión profesional. | Pulso de luz en **'S'**: Dosímetro personal y chalecos plomados. Pulso en **'E'**: Colimador ajustado e imagen nítida al primer intento. Pulso en **'R'**: Maniobra suave del arco sin colisiones ni contaminar el campo estéril. | "Seguridad: proteger tu organismo, al paciente y al equipo de quirófano. Eficiencia: obtener la proyección diagnóstica perfecta al primer intento con la menor dosis posible. Y Responsabilidad: custodiar la integridad mecánica y estéril de un equipo altamente sofisticado." |
| **2:05 - 2:30** | *Plano General*. Arco en C visible en todo su esplendor. | Señala hacia la interfaz inferior y sonríe. | Icono interactivo pulsante: "Descarga Lectura Módulo 1 (PDF)". | "Antes de entrar al primer simulador interactivo, revisa la lectura académica del Módulo 1. ¡Comencemos este entrenamiento de élite!" |

---

## VIDEO 2: Profundización: Física del Rayo X, Densidades y Normativa (Res. 1811)
**Duración Estimada:** 3:00 minutos  
**Objetivo:** Explicar cómo se generan los rayos X en el tubo de vacío (70 kV), la diferencia entre radiopaco y radiolúcido, las unidades Gray vs. Sievert y los límites legales para POE.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano Medio*. Ambiente de sala de control radiológico con monitores duales activos. | Brazos cruzados al inicio; asiente con firmeza y mira a la cámara. | Modelo 3D transparente del tubo de rayos X: cátodo, ánodo de tungsteno rotatorio y haz emergente. | "Para protegernos con criterio científico, debemos entender la física del haz. Un Arco en C produce rayos X aplicando alta tensión —típicamente 70.000 voltios o 70 kilovoltios— en un tubo al vacío. Los electrones viajan a velocidad vertiginosa del cátodo al ánodo de tungsteno, liberando energía en forma de fotones ionizantes." |
| **0:35 - 1:15** | *Zoom in a Primer Plano*. | Levanta una mano simulando sostener una muestra ósea. | Gráfico comparativo de densidades: aire (negro), músculo (gris), hueso cortical (blanco) e implante de titanio (blanco puro brillante). | "Al atravesar el cuerpo, los tejidos atenúan el haz según su densidad. El aire o gas deja pasar los rayos casi intactos: se denomina 'radiolúcido' y se ve oscuro. En contraste, el hueso cortical o el material de osteosíntesis absorben fuertemente los fotones: son 'radiopacos' y se observan de un blanco brillante." |
| **1:15 - 2:00** | *Plano Medio*. Interfaz con gráficos dosimétricos en azul institucional. | Desplaza un panel holográfico con gráficos de física médica. | Fórmulas: "1 Gray (Gy) = 1 J/kg (Dosis Física Absorbida)" vs. "1 Sievert (Sv) = Gy x Q (Efecto Biológico)". Tabla de equivalencias: 100 rem = 1 Sv; 1 mSv = 100 mrem = 1.000 µSv. | "En dosimetría manejamos dos conceptos vitales: el Gray mide la dosis absorbida física, es decir, 1 Joule de energía depositado por kilogramo de tejido. El Sievert, en cambio, mide la dosis equivalente biológica, ponderando el daño biológico real. Recordemos la equivalencia: 1 Sievert equivale a 100 Rem, y 1 milisievert equivale a 100 milirem." |
| **2:00 - 2:35** | *Plano Pecho*. Contexto comparativo clínico según evidencia de AO Trauma. | Gesto de comparación con ambas manos en balanza. | Escala comparativa de dosis AO Trauma: 1 Rx Tórax = 0.1 mSv // 1 TAC Cráneo = 1.5 mSv (15 tórax) // 1 TAC Corporal = 9.9 mSv (100 tórax). | "Para dimensionar el impacto, la evidencia de AO Trauma nos recuerda que una radiografía de tórax aporta 0.1 milisieverts; una tomografía de cráneo equivale a 15 radiografías de tórax, y una tomografía de cuerpo entero equivale a casi 100 placas de tórax juntas." |
| **2:35 - 3:00** | *Plano General*. Se ilumina la insignia de regulación internacional. | Señala el dosímetro en su solapa. | Texto: "Límite Ocupacional POE (Res. 1811 / ICRP): 20 mSv/año" vs. "Público General: 1 mSv/año". | "Bajo la Resolución 1811 de Colombia y los consensos del OIEA y la ICRP, el límite anual para el Personal Ocupacionalmente Expuesto es de 20 milisieverts al año, frente a solo 1 milisievert para el público. Dominar estos conceptos te protege a ti y a todo el quirófano. ¡Avanza a tu evaluación formativa!" |

---

## VIDEO RECOPILATORIO: Repaso General del Módulo 1
**Duración Estimada:** 1:45 minutos  
**Objetivo:** Consolidar en menos de dos minutos los fundamentos de generación, densidades, unidades dosimétricas y límites de radiación.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | *Primer Plano (Close Up).* Iluminación vibrante en tonos cyan y dorado de triunfo. | Sonrisa cálida, aplaude con energía una vez. | Emblema flotante: "MÓDULO 1: PILARES Y FÍSICA DOMINADOS". | "¡Excelente trabajo completando la etapa inicial del Módulo 1! Has sentado las bases científicas del comportamiento de la radiación en quirófano." |
| **0:25 - 1:05** | *Corte a Plano Medio*. Cámara estática con fondo estilizado. | Enumera con rapidez y autoridad usando las manos. | 4 cuadros holográficos rápidos: 1. Wilhelm Röntgen (1895). 2. Tubo 70 kV (Cátodo -> Ánodo). 3. Radiopaco (Blanco) vs. Radiolúcido (Negro). 4. 20 mSv/año POE. | "Recapitulemos los puntos no negociables: Recordamos el legado de Röntgen en 1895; aprendimos que los rayos X se generan a alta tensión en tubos al vacío de 70 kilovoltios; diferenciamos tejidos radiopacos como el hueso de los radiolúcidos como el aire, y comprendimos que el Sievert mide el riesgo biológico real." |
| **1:05 - 1:45** | *Plano Americano a Plano General*. El Arco en C del fondo se alista para el siguiente módulo. | Asiente decidida, da un paso lateral hacia la cabecera del equipo. | Texto holográfico: "PRÓXIMO: MÓDULO 2 // ALARA, SCATTER Y DOSIMETRÍA AO TRAUMA". | "Con la física clara y el límite legal de 20 milisieverts interiorizado, en el Módulo 2 pasaremos a la trinchera del quirófano: el principio ALARA, la dispersión del paciente y la regla de oro 'Hug the intensifier'. ¡Nos vemos en el Módulo 2!" |
'''

# -------------------------------------------------------------
# GUION MODULO 2
# -------------------------------------------------------------
g2 = '''# GUIONES DE PRODUCCIÓN - MÓDULO 2: ALARA, DOSIMETRÍA Y PROTECCIÓN OPERATIVA

**ESTILO VISUAL GLOBAL (Para el generador de video AI):**
*   **Avatar:** "Dra. Nova". Mujer profesional de 35 años, bata médica blanca plomada, gafas de protección radiológica de 0.15 mm Pb eq., protector tiroideo y dosímetro.
*   **Estética / Escenografía:** Quirófano quirúrgico de trauma hiperrealista oscuro con acentos de luces cyan y azul cobalto. Interfaz holográfica de física médica y scatter dinámico.
*   **Tipo de plano:** Plano Medio a Plano Pecho, paneos laterales dinámicos y primeros planos de advertencia clínica.

---

## VIDEO 1: El Principio ALARA y Equipamiento de Protección Personal (EPP)
**Duración Estimada:** 2:45 minutos  
**Objetivo:** Explicar el principio ALARA, la atenuación del EPP plomado (mandil 16x/4x, tiroides 2.5x, gafas 70%), el límite ICRP 118 para cristalino (20 mSv/año) y las telas protectoras de bario (Cha 2020).

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano Medio*. Quirófano en penumbra con acento cyan. Cierra con firmeza el velcro de su protector tiroideo. | Mira a cámara con semblante seguro y se ajusta las gafas plomadas. | Texto flotante en neón: "PRINCIPIO A.L.A.R.A. // AS LOW AS REASONABLY ACHIEVABLE". | "En radioprotección quirúrgica, nuestra ley suprema es ALARA: mantener la dosis tan baja como sea razonablemente alcanzable. Cada fotón que no recibes es salud preservada para tu carrera." |
| **0:35 - 1:15** | *Dolly Lateral Lento*. | Levanta tres dedos secuencialmente señalando cada vector de protección. | 3 iconos holográficos 3D: 1. Cronómetro (Tiempo en pulsos), 2. Regla 1/d² (Distancia), 3. Escudo de plomo (Blindaje). | "ALARA descansa en tres pilares: Tiempo, Distancia y Blindaje. En tiempo: jamás pises el pedal en continuo; usamos fluoroscopía pulsada. En distancia: duplicar tu distancia del haz reduce la radiación a una cuarta parte gracias a la ley del inverso del cuadrado." |
| **1:15 - 2:00** | *Plano Pecho (Close-Up)*. Resalta el EPP de la Dra. Nova. | Señala su mandil plomado, luego su cuello y sus gafas. | Gráfico de atenuación: Mandil (16x frontal / 4x lateral) // Cuello (2.5x reducción; 85% de carcinomas papilares prevenibles) // Gafas (0.15 mm Pb eq. = 70% atenuación; Límite ICRP 118: 20 mSv/año). | "Hablemos de blindaje con datos duros: El mandil plomado atenúa 16 veces la dosis frontal y 4 veces la lateral. El collarín tiroideo reduce 2.5 veces adicionales, protegiendo una glándula donde el 85% de los carcinomas papilares son inducidos por radiación. Y con la norma ICRP 118, el límite del cristalino ocular bajó de 150 a 20 milisieverts al año: las gafas plomadas de 0.15 milímetros de plomo atenúan el 70% del haz, evitando cataratas prematuras." |
| **2:00 - 2:45** | *Plano Medio a General*. Muestra muestras de telas quirúrgicas modernas. | Sostiene una muestra de tela flexible grisácea. | Infografía científica: "Dose Reduction Fiber (DRF) BaSO4 - Cha et al. (2020) // Reducción 25.3% a 93.6% sin artefactos". Advertencia en rojo: "Guantes plomados (60-64% a 55 kV) NO justifican meter las manos en el haz directo". | "Además del plomo tradicional, la ciencia reciente de Cha et al. (2020) demostró que las fibras de sulfato de bario de 0.1 milímetros plomo equivalente reducen entre 25% y 93% la dosis en órganos sensibles del paciente sin alterar la calidad diagnóstica. Y una advertencia crítica: los guantes plomados atenúan el 60%, pero jamás sustituyen la técnica: ¡mantén siempre tus manos fuera del haz directo usando pinzas instrumentales!" |

---

## VIDEO 2: Profundización: Física del Scatter, AO Trauma "Hug the Intensifier" y Dosimetría Real
**Duración Estimada:** 3:15 minutos  
**Objetivo:** Detallar la distribución de scatter (80/20/2 de AO Trauma), el riesgo del lado del tubo (25x torso), la regla "Hug the intensifier", la desmitificación de la regla de los 3 pies (Shuler 2013) y la alerta verbal "Screening!".

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:40** | *Plano Americano*. Arco en C en posición estándar (tubo emisor abajo, intensificador arriba). Paciente holográfico en camilla. | Apunta al paciente con la mano abierta. | Flujo de partículas cuánticas: 100 fotones impactan al paciente. 80 se absorben (rojo), 10 a 20 rebotan caóticamente (amarillo), 2 llegan al intensificador (cyan). | "En cirugía, el haz primario casi nunca impacta al equipo. Nuestro peligro real es la radiación dispersa o scatter. La evidencia de AO Trauma revela una proporción exacta: de cada 100 fotones que salen del tubo, el 80% es absorbido por el paciente, solo el 2% llega al detector para formar la imagen, y entre el 10% y 20% sale rebotado en todas direcciones, siendo la fuente número uno de irradiación para el cirujano y su equipo." |
| **0:40 - 1:25** | *Corte a Plano Medio*. El Arco en C gira a proyección lateral. Tubo emisor al lado del cirujano (simulación incorrecta). | Gesto enérgico de desaprobación con la mano. | Marcador térmico de radiación: Torso = "25x más radiación" // Cuello = "3 a 4x más radiación". | "Observen este error crítico: al rotar a proyección lateral, colocarse del lado del tubo emisor expone tu torso a 25 veces más radiación dispersa y tu cuello a 3 a 4 veces más que si te ubicas del lado del detector. Por eso la AO Trauma acuñó la regla de oro internacional: 'Hug the intensifier!' — ¡Abraza el intensificador! Permanece siempre del lado del detector y lo más lejos posible del tubo emisor." |
| **1:25 - 2:10** | *Plano Detalle / Pecho*. Enfoque en distancias del quirófano. | Da un paso atrás midiendo distancias. | Diagrama dosimétrico (Shuler et al. 2013): A 1 pie (30 cm) = Gónadas 12x más que tiroides (270 mrem). A 3 pies (91 cm) = 10 mrem gonadales aún detectables. A 6 pies (1.8 m) = 0 mrem. Asistente quirúrgico: a 10 cm del haz vs. Cirujano a >90 cm. | "Cuidado con la antigua y falsa 'regla de los 3 pies'. En 2013, Shuler et al. demostraron con dosímetros de alta sensibilidad de 1 milirem que a 3 pies aún hay radiación gonadal detectable de 10 milirem tras exposiciones quirúrgicas. La zona de cero radiación se alcanza a los 6 pies (1.8 metros). El blindaje personal es obligatorio siempre. Además, recuerda que el asistente quirúrgico suele estar a escasos 10 centímetros del haz, recibiendo mucha más dosis que el cirujano principal que opera a más de 90 centímetros." |
| **2:10 - 3:15** | *Plano General*. El Arco en C emite un pulso sonoro controlado. | Hace el gesto de pisar el pedal con el pie mientras alza la voz de mando con autoridad. | Gráfica de pulsos: "1 segundo continuo = 15 a 25 cuadros pulsados (ahorro del 60% de dosis)". Texto gigante: "¡DISPARO! // SCREENING!". | "Para finalizar: usa adquisición pulsada; 1 segundo continuo equivale a 15 o 25 cuadros pulsados con una fracción del daño biológico. Y nunca pises el pedal en silencio: establece la disciplina de quirófano gritando enérgicamente ¡Disparo! o ¡Screening! para que nadie del equipo quirúrgico se acerque desprevenido. ¡Lleva estos principios al simulador!" |

---

## VIDEO RECOPILATORIO: Repaso General del Módulo 2
**Duración Estimada:** 1:45 minutos  
**Objetivo:** Consolidar en un formato ágil la regla 'Hug the intensifier', la distribución 80/20/2, el EPP y la alerta de disparo.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | *Plano Medio Corto*. Iluminación dinámica de triunfo con acentos cyan. | Sonrisa empática, asiente con satisfacción. | Insignia holográfica: "MAESTRÍA EN ALARA Y RADIOPROTECCIÓN AO". | "¡Módulo 2 superado con honores! Acaban de dominar los principios que diferencian a un operador improvisado de un profesional de clase mundial." |
| **0:25 - 1:10** | *Dolly Lateral a Plano Americano*. | Enumera de manera contundente y ejecutiva. | 4 cuadros síntesis: 1. Dispersión 80% paciente / 20% scatter / 2% imagen. 2. 'Hug the intensifier!' (Tubo al torso = 25x). 3. EPP completo (Mandil 16x, tiroides 2.5x, gafas 20 mSv/año). 4. Alerta verbal '¡Disparo!'. | "Grabemos esto a fuego: El paciente genera el 80% de absorción y hasta 20% de dispersión; protégete siempre del lado del intensificador: 'Hug the intensifier'. Mandil, tiroides y gafas plomadas son innegociables. La seguridad total se alcanza a los 6 pies, no a los 3. Y antes de cada imagen: adquisición pulsada y aviso verbal en voz alta." |
| **1:10 - 1:45** | *Plano General*. El Arco en C resalta sus articulaciones mecánicas en el fondo. | Se retira las gafas plomadas con elegancia y sonríe. | Letrero 3D: "PRÓXIMO: MÓDULO 3 // ANATOMÍA DEL FLUOROSCOPIO Y CINEMÁTICA 8-DoF". | "Protección dominada. Ahora es momento de tomar el control físico de la máquina. En el Módulo 3 desglosaremos la anatomía del fluoroscopio y la cinemática avanzada de 8 grados de libertad. ¡Nos vemos en el siguiente nivel!" |
'''

# -------------------------------------------------------------
# GUION MODULO 3
# -------------------------------------------------------------
g3 = '''# GUIONES DE PRODUCCIÓN - MÓDULO 3: ANATOMÍA DEL FLUOROSCOPIO Y CINEMÁTICA QUIRÚRGICA

**ESTILO VISUAL GLOBAL (Para el generador de video AI):**
*   **Avatar:** "Dra. Nova". Mujer profesional de 35 años, bata médica blanca plomada, estilo docente técnico y de liderazgo en ingeniería biomédica quirúrgica.
*   **Estética / Escenografía:** Taller de bioingeniería y quirófano híbrido oscuro. Modelos 3D transparentes y esquemas cinemáticos con líneas vectoriales de coordenadas (X, Y, Z).
*   **Tipo de plano:** Plano Medio, Dollys suaves hacia el equipo, planos detalle de frenos mecánicos y consolas de adquisición.

---

## VIDEO 1: Componentes Críticos del Arco en C y Modos de Adquisición
**Duración Estimada:** 2:45 minutos  
**Objetivo:** Enseñar los 4 bloques anatómicos del equipo (tubo, colimador, intensificador/FPD, consola dual), los movimientos mecánicos y la penalización de dosis por magnificación.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano Americano*. Dra. Nova de pie junto a un Arco en C desmontado holográficamente en sus bloques cardinales. | Presenta los bloques del equipo señalando cada sección. | Holograma flotante señalando: 1. Tubo de rayos X (base inferior), 2. Colimador de diafragma iris, 3. Intensificador de imagen / Panel Plano (FPD), 4. Estación de trabajo con doble monitor. | "Bienvenidos al Módulo 3. Para mandar sobre una máquina en quirófano, primero debemos conocer sus entrañas. Un Arco en C consta de cuatro componentes cardinales: el generador y tubo de rayos X, el colimador de apertura variable, el detector de imagen —sea intensificador clásico o panel plano digital FPD— y la consola de control con monitores duales." |
| **0:35 - 1:20** | *Zoom in a Plano Pecho*. | Toca el colimador virtual con los dedos simulando cerrarlo. | Animación del haz de radiación: colimación reduciendo el área a la mitad, cortando la penumbra periférica y aumentando el contraste óseo. | "El colimador no es solo un accesorio de seguridad: es tu mejor herramienta diagnóstica. Al cerrar las láminas de plomo sobre la zona exacta de interés, eliminas radiación dispersa periférica. ¿El resultado? Menos dosis para el paciente y una imagen con mucho mayor contraste óseo." |
| **1:20 - 2:05** | *Plano Medio Corto*. Consola dual con dos pantallas médicas de alta resolución. | Señala la pantalla izquierda y luego la derecha. | Pantalla izquierda = "LIVE IMAGE (Tiempo real)", Pantalla derecha = "LAST IMAGE HOLD (LIH)". Demostración de Magnificación: 32 cm (Dosis base) -> 16 cm (Dosis x2) -> 11 cm (Dosis x3). | "En la consola médica, la pantalla izquierda muestra la imagen en vivo durante el disparo, y la derecha retiene la 'Última Imagen Congelada' o Last Image Hold, permitiendo que el cirujano planifique sin irradiar. Pero cuidado extremo con la magnificación electrónica: cuando reduces el campo de 32 centímetros a 16 u 11 centímetros para 'hacer zoom', el equipo eleva automáticamente los miliamperios hasta un 300% para compensar brillo. ¡Usa magnificación solo cuando sea estrictamente indispensable!" |
| **2:05 - 2:45** | *Plano General*. El gantry C rota suavemente. | Acompaña el giro del arco con la mano. | Diagrama de arcos Isocéntricos (el centro anatómico no se desplaza en rotación) vs. No Isocéntricos (requieren reajuste de altura al rotar). | "Finalmente, distingue si tu equipo es isocéntrico o no isocéntrico. Un equipo isocéntrico mantiene la estructura anatómica en el centro exacto al pasar de AP a lateral. En uno no isocéntrico, deberás compensar altura manualmente para no perder la imagen. ¡Revisa el PDF del módulo y prepárate para la cinemática robótica!" |

---

## VIDEO 2: Profundización: Cinemática Moderna de 8 Grados de Libertad (8-DoF) y Optimización ALARA
**Duración Estimada:** 3:15 minutos  
**Objetivo:** Explicar el modelado cinemático avanzado de 8-DoF (Shao et al. 2014: 3 GDL base móvil + 5 GDL arco), el control CLIK y la optimización del cono de rayos X para alejar el haz de las manos del cirujano.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | *Plano Medio*. Quirófano oscuro con vectores tridimensionales proyectados en el piso y el equipo. | Camina alrededor de la base móvil del equipo. | Vectores de movimiento en la base: Traslación X (A0), Traslación Y (A1), Rotación Yaw (A2). En el gantry: Vertical (A3), Telescópico (A4), Swivel (A5), Inclinación angular (A6), Orbital (A7). | "Históricamente, los manuales hablaban de 4 o 5 palancas mecánicas sueltas. Hoy, la ciencia biomédica de Shao et al. (2014) modela el Arco en C como un manipulador robótico redundante de 8 Grados de Libertad (8-DoF): 3 grados en la base móvil mediante traslación planar y rotación, y 5 grados en el brazo gantry: elevación vertical, extensión telescópica, pivoteo, inclinación angular y rotación orbital." |
| **0:45 - 1:30** | *Zoom a Primer Plano*. | Expresión analítica y de alta precisión técnica. | Diagrama matemático elegante: Algoritmo CLIK (*Closed-Loop Inverse Kinematics*) con pseudoinversa jacobiana evitando singularidades mecánicas en quirófanos congestionados. | "¿Por qué modelar 8 grados de libertad? Porque los quirófanos de trauma están saturados de mesas de tracción, torres de laparoscopia y personal. El modelado de 8-DoF resuelve la cinemática inversa en lazo cerrado (algoritmo CLIK), permitiendo mover el equipo sin colisiones ni singularidades mecánicas, alcanzando cualquier proyección angulada en el espacio 3D." |
| **1:30 - 2:25** | *Plano Americano*. Simulación de cono de radiación volumétrico en 3D entre el tubo y el intensificador. | Señala las manos de un cirujano virtual cerca del campo. | Cono de rayos X tridimensional. Un vector aleja activamente el haz cónico de las manos del cirujano optimizando la función de costo: min(shiftRot) / max(norm(MH)). | "Pero el avance más revolucionario de Shao et al. es la optimización geométrica ALARA: el haz de rayos X se modela como un cono matemático tridimensional. Mediante algoritmos de seguimiento óptico, el sistema calcula la posición exacta de las manos del cirujano y ajusta la angulación del cono para maximizar la distancia entre el haz directo y las manos del operador sin perder la alineación anatómica." |
| **2:25 - 3:15** | *Plano General*. Nova de frente con el equipo en reposo estético. | Asiente con autoridad y confianza. | Texto interactivo: "Simulador de Cinemática 8-DoF // Práctica Activa". | "Dominar estos 8 ejes te permite colocar el equipo en la pose deseada al primer intento, evitando disparos de tanteo y cuidando las manos del equipo quirúrgico. ¡Demuestra tu destreza en la práctica de cinemática del Módulo 3!" |

---

## VIDEO RECOPILATORIO: Repaso General del Módulo 3
**Duración Estimada:** 1:35 minutos  
**Objetivo:** Sintetizar en un minuto y medio los componentes, la penalización de magnificación, los 8 GDL y la optimización de manos.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | *Primer Plano (Close Up).* Luces cyan y doradas celebrando el progreso. | Sonríe y aplaude con energía. | Trofeo digital del Módulo 3 activándose. | "¡Excelente! Has dominado el corazón mecánico y cinemático del Arco en C. Ya no eres un simple operador de palancas: entiendes la física vectorial de tu equipo." |
| **0:25 - 1:00** | *Plano Medio*. | Resume con 3 movimientos clave de brazos. | 3 puntos rápidos: 1. Tubo, Colimador, FPD y LIH. 2. Advertencia Zoom 300% dosis. 3. Cinemática 8-DoF y protección de manos. | "Puntos vitales para el quirófano: Cierra siempre el colimador para ganar nitidez y recortar dosis; confía en el Last Image Hold para planificar; nunca abuses del zoom electrónico, y piensa en el equipo como un sistema cinemático de 8 grados de libertad para esquivar obstáculos y proteger las manos del cirujano." |
| **1:00 - 1:35** | *Plano Americano a General*. | Señala al frente motivando al estudiante. | Pantalla gigante encendiéndose: "MÓDULO 4: PROYECCIONES DE PELVIS Y MIEMBRO INFERIOR // CASOS AO TRAUMA". | "Con la máquina dominada, entramos a las patologías clínicas reales. En el Módulo 4 aprenderemos las proyecciones traumatológicas de pelvis, fémur, rodilla y tobillo bajo estándares AO Trauma. ¡Nos vemos en el quirófano!" |
'''

# -------------------------------------------------------------
# GUION MODULO 4
# -------------------------------------------------------------
g4 = '''# GUIONES DE PRODUCCIÓN - MÓDULO 4: PELVIS Y MIEMBRO INFERIOR (CASOS CLÍNICOS AO TRAUMA)

**ESTILO VISUAL GLOBAL (Para el generador de video AI):**
*   **Avatar:** "Dra. Nova". Mujer profesional de 35 años, bata médica plomada, guantes estériles colocados y actitud de cirujana traumatóloga en quirófano de alta complejidad.
*   **Estética / Escenografía:** Quirófano de trauma ortopédico hiperrealista oscuro con mesa de tracción ortopédica, iluminación "Cinematic Dark" y monitores quirúrgicos de alto contraste mostrando fracturas óseas reales.
*   **Tipo de plano:** Plano Medio a Primer Plano, rotaciones ortogonales dinámicas y detalles de implantes de osteosíntesis.

---

## VIDEO 1: Pelvis y Fémur Proximal (Enclavado Cefalomedular y Mesa de Tracción)
**Duración Estimada:** 2:50 minutos  
**Objetivo:** Enseñar el montaje en mesa de tracción, el manejo de la alta masa tisular de la cadera, las proyecciones AP y axial, y la colocación centro-centro del tornillo cefálico (AO Trauma Estación 3).

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano Americano*. Quirófano ortopédico oscuro. Dra. Nova junto a una mesa de tracción con paciente traumatológico holográfico. | Señala la cadera y pelvis del paciente con precisión anatómica. | Anillo pélvico y fémur proximal resaltados en color ámbar. El Arco en C ingresa entre las piernas del paciente en ángulo de 45°. | "Bienvenidos al Módulo 4. Entramos a la trinchera del trauma ortopédico: la pelvis y el fémur proximal. Aquí nos enfrentamos a la mayor masa tisular del cuerpo humano, lo que exige técnica impecable para no saturar al equipo ni sobre-irradiar al paciente." |
| **0:35 - 1:20** | *Dolly Circular Lento*. | Gesticulación explicativa sobre la mesa de tracción. | Modelo 3D de mesa de tracción: tracción longitudinal y rotación interna de la pierna para corregir anteversión del cuello femoral. | "En fracturas trocantéricas y de cuello femoral según el protocolo de la Estación 3 de AO Trauma, el paciente se ubica en mesa de tracción ortopédica. El Arco en C entra generalmente entre las piernas del paciente para permitir una rotación sin colisiones entre la proyección Anteroposterior y la proyección Axial o Lateral verdadera." |
| **1:20 - 2:05** | *Plano Pecho (Close-Up)*. Pantalla radiológica dual de cadera. | Señala el centro de la cabeza femoral en la radiografía. | Imagen radioscópica de enclavado trocantérico: Tornillo cefálico perfectamente alineado en 'Centro-Centro' en AP y Lateral. Resalte de la cortical para evitar *Cut-Out*. | "Observen el estándar de oro en enclavado endomedular: en la proyección AP, la clavija y el tornillo cefálico deben quedar en el tercio inferior o central del cuello; en la proyección lateral, deben ubicarse estrictamente en el centro de la cabeza femoral. Esta posición 'Centro-Centro' previene la catástrofe mecánica del *cut-out* o corte de la cabeza femoral. Centra siempre primero antes de disparar." |
| **2:05 - 2:50** | *Plano General*. Arco en C con el intensificador pegado al muslo del paciente. | Acompaña el detector hacia el paciente sin tocar los campos estériles. | Gráfica de dosis: "Detector pegado al paciente = Mayor campo de visión + Menor dosis cutánea de entrada". | "Y recuerden la regla de física operativa: mantengan el intensificador de imagen tan pegado al paciente como lo permita el campo estéril. Esto maximiza el campo de visión anatómico y reduce sustancialmente la dosis en la piel del paciente. ¡Revisen los diagramas en el PDF y vayamos a rodilla y tobillo!" |

---

## VIDEO 2: Profundización: Rodilla, Tobillo y Puntería Láser (Shuler 2013 y Proyección de Mortaja AO)
**Duración Estimada:** 3:15 minutos  
**Objetivo:** Explicar las proyecciones ortogonales distales, el impacto de la puntería láser (Shuler 2013: 39% rodilla / 29% tobillo), la proyección de mortaja a 15-20° de rotación interna (AO Estación 4) y la utilidad del escaneo 3D.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | *Plano Medio*. Quirófano enfocado en extremidad distal (rodilla, tibia y tobillo). | Sostiene una articulación de rodilla y tobillo holográfica en sus manos. | Líneas ortogonales a 90° exactos marcando AP pura y Lateral estricta. | "Al descender hacia rodilla, diáfisis tibial y tobillo, el grosor tisular disminuye, pero la exigencia de alineación geométrica se multiplica. La regla cardinal es la ortogonalidad: un solo plano miente; requerimos una proyección AP pura y una Lateral a 90 grados exactos." |
| **0:45 - 1:35** | *Zoom a Primer Plano*. | Gesto de precisión visual apuntando una cruz láser. | Guía láser del Arco en C proyectando una cruz sobre la piel. Gráfico científico: Shuler et al. (2013) // Reducción de tiempo: Rodilla (-39%), Tobillo (-29%). Gráfico de cadera obesa: Sin reducción (0%). | "¿Funciona la puntería láser en Arco en C? El ensayo clínico de Shuler et al. (2013) resolvió este debate con rigor: en rodilla y tobillo, la guía láser redujo el tiempo de fluoroscopía un 39% y un 29% respectivamente, logrando imágenes centradas en menos intentos gracias a relieves óseos superficiales palpables como la rótula y los maléolos. En cadera de pacientes obesos, en cambio, la ausencia de relieves óseos anuló el beneficio del láser. ¡Aprovecha el láser siempre en articulaciones periféricas!" |
| **1:35 - 2:25** | *Plano Medio Corto*. Pantalla mostrando articulación del tobillo. | Rota su pie y mano suavemente hacia adentro en 15 a 20 grados. | Proyección AP estándar (peroné superpuesto sobre tibia) vs. **Proyección de Mortaja (Mortise View)** con rotación interna de 15° a 20° (espacio claro tibioperoneo y astragalino perfectamente abierto sin superposiciones). | "En tobillo, la AO Trauma (Estación 4) destaca una proyección insustituible: la Proyección de Mortaja. Si disparas una AP simple, el maléolo peroneo se superpone sobre la tibia. Debes rotar la pierna o el Arco en C internamente entre 15 y 20 grados. Solo así se abre el espacio claro articular astragalino y tibioperoneo, permitiendo evaluar la reducción anatómica de la sindesmosis." |
| **2:25 - 3:15** | *Plano General*. El Arco en C realiza una rotación cónica 3D sobre el tobillo. | Asiente con satisfacción clínica. | Escaneo 3D intraoperatorio: Reconstrucción volumétrica revelando un tornillo intraarticular inadvertido en 2D. | "Y en fracturas articulares complejas de pilón tibial o calcáneo, la fluoroscopía 3D intraoperatoria permite detectar penetraciones de tornillos en el espacio articular antes del cierre de piel que las radiografías 2D clásicas ocultan. ¡Apliquen esta perla clínica en el simulador de miembro inferior!" |

---

## VIDEO RECOPILATORIO: Repaso General del Módulo 4
**Duración Estimada:** 1:40 minutos  
**Objetivo:** Consolidar en formato sintético los puntos clave de cadera centro-centro, láser periférico, mortaja a 15-20° y ortogonalidad estricta.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | *Primer Plano (Close Up).* Iluminación quirúrgica en cyan y dorado de victoria. | Sonrisa enérgica y gesto de aprobación. | Emblema flotante: "MIEMBRO INFERIOR Y TRAUMA AO // COMPLETADO". | "¡Espectacular! Han completado el módulo más demandante en volumen quirúrgico de cualquier hospital de trauma." |
| **0:25 - 1:05** | *Plano Medio*. | Resume con autoridad profesional. | 4 imágenes flash: 1. Fémur Centro-Centro en mesa de tracción. 2. Láser efectivo en rodilla (-39%) y tobillo (-29%). 3. Mortaja de tobillo a 15°-20° de rotación interna. 4. Escaneo 3D detectando penetración articular. | "Repasemos las perlas clínicas: En cadera, colocación estrictamente 'Centro-Centro' del tornillo cefálico para evitar cut-out. En rodilla y tobillo, usa la guía láser para ahorrar hasta 39% de tiempo de radiación. En tobillo, rotación interna de 15 a 20 grados para la verdadera proyección de mortaja. Y en fracturas articulares complejas, el escaneo 3D intraoperatorio evita reoperaciones." |
| **1:05 - 1:40** | *Plano Americano a General*. | Señala al frente con gran motivación. | Letrero 3D: "PRÓXIMO: MÓDULO 5 // MIEMBRO SUPERIOR, COLUMNA Y CASOS ESPECIALES". | "De la cintura para abajo están certificados. En nuestro último módulo entraremos a la precisión milimétrica del miembro superior, húmero, muñeca y la delicada cirugía de columna. ¡Nos vemos en la recta final!" |
'''

# -------------------------------------------------------------
# GUION MODULO 5
# -------------------------------------------------------------
g5 = '''# GUIONES DE PRODUCCIÓN - MÓDULO 5: MIEMBRO SUPERIOR, COLUMNA Y CASOS ESPECIALES

**ESTILO VISUAL GLOBAL (Para el generador de video AI):**
*   **Avatar:** "Dra. Nova". Mujer profesional de 35 años, bata médica plomada, postura dinámica de máxima concentración quirúrgica y excelencia en alta especialidad.
*   **Estética / Escenografía:** Quirófano de microcirugía y neurocirugía de columna hiperrealista oscuro. Proyecciones holográficas de extremidades superiores finas (huesos del carpo, radio distal) y columna vertebral 3D.
*   **Tipo de plano:** Plano Medio a Plano Pecho, dolly lateral suave, planos detalle en micro-estructuras óseas y advertencias de bioseguridad.

---

## VIDEO 1: Húmero Proximal, Radio Distal y Alerta Crítica de Mini C-Arm (AO Estaciones 1 & 2)
**Duración Estimada:** 2:50 minutos  
**Objetivo:** Enseñar el posicionamiento en hombro/húmero, la detección de tornillos en radio distal (DRUJ y tendón EPL), y alertar sobre el incremento de dosis x10 al apoyar las manos en el receptor del Mini C-arm (Vosbikian 2014).

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano General a Plano Medio*. Quirófano oscuro con paciente en silla de playa holográfica. | Extiende los brazos indicando amplitud espacial. | Esqueleto holográfico brillante de miembro superior completo (hombro, brazo, antebrazo y mano). | "Bienvenidos al quinto y último módulo de nuestro curso. Hemos llegado a las zonas de mayor movilidad y refinamiento geométrico del cuerpo humano: el miembro superior y la columna vertebral. Aquí el desafío no es el grosor del tejido, sino la precisión milimétrica en espacios reducidos." |
| **0:35 - 1:20** | *Plano Medio Corto*. Hombro y húmero proximal bajo radioscopía. | Imita la abducción y rotación del hombro con la mano. | AO Trauma Estación 1: Húmero proximal en silla de playa. Proyección AP y en 'Y' de escápula. Entrada del clavo endomedular anterógrado y tornillos calcar inferomediales sin penetración articular. | "En húmero proximal según la Estación 1 de AO Trauma, con el paciente en posición de silla de playa, la proyección AP y la vista en 'Y' de escápula son esenciales para guiar el enclavado anterógrado. Debemos verificar que los tornillos cefálicos y del calcar sustenten la reducción sin perforar la superficie articular de la cabeza humeral." |
| **1:20 - 2:05** | *Dolly Lateral a Primer Plano*. Articulación de la muñeca y radio distal. | Realiza una pronación y supinación de muñeca. | AO Trauma Estación 2: Radio distal. Placa volar. Proyecciones oblicuas a 20°-30°. Detección de tornillo invadiendo la Articulación Radiocubital Distal (DRUJ) y tornillo bicortical largo irritando el tendón Extensor Largo del Pulgar (EPL). | "En radio distal (Estación 2 de AO Trauma), una placa volar mal controlada puede causar desastres funcionales. Requerimos proyecciones laterales puras y oblicuas de pronosupinación a 20 y 30 grados para descartar dos errores clásicos: tornillos que penetren en la articulación radiocubital distal (DRUJ) o tornillos bicorticales demasiado largos que sobresalgan dorsalmente en la corredera del tendón Extensor Largo del Pulgar (EPL), provocando su rotura tardía." |
| **2:05 - 2:50** | *Plano Pecho (Advertencia Crítica de Bioseguridad)*. Mini C-arm holográfico. | Expresión muy seria, señalando con firmeza el receptor de imagen. | Señal de peligro en rojo neón: Vosbikian et al. (2014) // "Usar el intensificador del Mini C-arm como mesa de mano aumenta la dosis a la mano del cirujano DIEZ VECES (x10)". | "Y atención a una alerta crítica de bioseguridad: en cirugía de mano y muñeca es muy común el uso del Mini C-arm. Vosbikian et al. (2014) y Kaplan et al. (2016) demostraron que los cirujanos cometen el grave error de usar el receptor del Mini C-arm como mesa para apoyar la mano del paciente, ¡multiplicando por DIEZ la dosis directa de radiación a las manos del cirujano! Jamás apoyes la extremidad sobre el detector y mantén tus dedos fuera del haz usando instrumental largo." |

---

## VIDEO 2: Profundización: Columna Vertebral, Dosimetría Espinal (Lee 2012) y Cirugía 3D
**Duración Estimada:** 3:15 minutos  
**Objetivo:** Explicar el paralelaje en columna, la dosimetría real en columna (mama mayor scatter, manos x20 directa), el giro de cabeza a 90° (Lee et al. 2012) y la detección de tornillos transpediculares mediante arcos 3D/O-Arm.

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:45** | *Plano Americano*. Dra. Nova contemplando una columna vertebral 3D completa iluminada por segmentos. | Señala los segmentos cervical, dorsal y lumbar. | Columna iluminada: Platillos vertebrales y pedículos alineados simétricamente. | "Si la traumatología es geometría, la cirugía de columna es arquitectura de máxima precisión. Aquí un milímetro de desviación en un tornillo transpedicular puede comprometer la médula espinal o las raíces nerviosas. La fluoroscopía es literalmente los ojos del cirujano de columna." |
| **0:45 - 1:35** | *Zoom a Primer Plano*. | Gesto de alineación simétrica midiendo con las palmas. | Proyección AP de columna lumbar: platillos vertebrales sin doble contorno (paralelos al haz central) y apófisis espinosa equidistante entre ambos pedículos vertebrales ("ojos de la vértebra"). | "Para colocar tornillos pediculares, la proyección AP debe estar perfectamente paralela a los platillos vertebrales terminales, sin doble línea de contorno. Las apófisis espinosas deben ubicarse exactamente en la línea media y los pedículos perfectamente simétricos. En proyección lateral, el colimador debe cerrarse al máximo para mitigar el velo de scatter en la densa región lumbar." |
| **1:35 - 2:25** | *Plano Medio Corto*. Datos dosimétricos de columna (Spine Journal). | Gesto de giro de cabeza a 90 grados hacia el lado contrario de la camilla. | Estudio de Lee et al. (2012, Spine): 1. Mama recibe la mayor dosis dispersa. 2. Manos reciben radiación directa 20 veces mayor que cualquier órgano. 3. Giro de cabeza a 90° reduce drásticamente la dosis a córnea y tiroides cuando no hay gafas plomadas disponibles. | "En columna, las dosis son especialmente altas. El riguroso estudio dosimétrico de Lee et al. (2012) en la revista Spine demostró que el tejido mamario es el órgano más expuesto a la radiación dispersa, y que la dosis directa a las manos del cirujano es más de 20 veces mayor que a cualquier órgano interno. Lee et al. propusieron una maniobra clínica brillante: si en una urgencia no tienes gafas plomadas, simplemente girar la cabeza 90 grados alejándola del paciente en el momento del disparo reduce drásticamente la dosis a la córnea y la tiroides." |
| **2:25 - 3:15** | *Plano General*. Arco en C 3D / O-Arm realizando una reconstrucción tomográfica de columna. | Asiente con satisfacción tecnológica. | Reconstrucción axial 3D mostrando un tornillo transpedicular que perforó la cortical medial hacia el canal raquídeo, invisible en la proyección 2D estándar. | "Finalmente, en deformidades o fijaciones complejas de columna, los sistemas de Arco en C 3D y navegación intraoperatoria permiten comprobar la indemnidad del canal medular antes de que el paciente salga del quirófano, garantizando un desenlace quirúrgico perfecto. ¡Estás listo para el simulador final de columna!" |

---

## VIDEO RECOPILATORIO: Cierre del Curso y Despedida
**Duración Estimada:** 2:00 minutos  
**Objetivo:** Felicitar al alumno, integrar los conceptos cardinales de todo el programa y dejarlo listo para el Examen Final de Certificación (90% requerido).

| Tiempos | Escenografía & Cámara (Prompt Visual) | Acción del Avatar (Dra. Nova) | Pantallas / Elementos Holográficos (B-Roll) | Audio / Locución (Texto para Text-to-Speech) |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 - 0:35** | *Plano General (Hero Shot).* Quirófano espectacularmente iluminado. El Arco en C resplandece en el fondo con luces cyan y oro. | Camina al centro, aplaude con orgullo y muestra gran satisfacción docente. | Los 5 emblemas holográficos de los módulos orbitando en círculo: Fundamentos, ALARA, Anatomía 8-DoF, Miembro Inferior, Miembro Superior & Columna. | "¡Lo has logrado! Has completado el recorrido formativo más exhaustivo y actualizado en operación y radioprotección de Arco en C. Desde la física cuántica de Röntgen hasta la cinemática de 8 grados de libertad y los estándares de AO Trauma." |
| **0:35 - 1:15** | *Plano Medio*. | Enumera con autoridad y calidez profesional. | Montaje rápido: 1. Pilares S.E.R. 2. Scatter 80/20/2 y 'Hug the intensifier'. 3. Mandil, tiroides y gafas plomadas (20 mSv/año). 4. Cinemática 8-DoF y protección de manos. 5. Ortogonalidad pura en extremidades y columna. | "Lleva siempre estos principios grabados en tu práctica diaria: Sistema S.E.R. (Seguridad, Eficiencia, Responsabilidad). Tubo emisor siempre abajo. Permanece pegado al intensificador. Colima para ganar contraste y recortar dosis. Manos siempre fuera del haz. Adquisición pulsada y aviso verbal antes de cada disparo." |
| **1:15 - 1:40** | *Plano Pecho (Conexión cercana).* | Mano al pecho, mirada directa y sincera a la cámara. | Efecto de desvanecimiento suave de la tecnología, dejando un halo de luz cálido. | "Operar con maestría el fluoroscopio te convierte en el guardián invisible de la salud de todo el quirófano y en el mejor aliado del paciente sobre la mesa quirúrgica." |
| **1:40 - 2:00** | *Plano Medio Corto (Despedida final).* | Sonríe con confianza, da un paso atrás y saluda formalmente. | Letrero 3D imponente encendiéndose en dorado: \"EXAMEN FINAL DE CERTIFICACIÓN // APROBACIÓN MÍNIMA 90%\". | "Ahora tienes un último desafío: el Examen Final de Certificación. Necesitas un 90% para obtener tu constancia con firma criptográfica y código QR verificable. Confía en tu entrenamiento, lee con rigor cada caso... ¡Mucho éxito y nos vemos en quirófano!" |
'''

modules_content = {
    'guion_modulo_1.md': g1,
    'guion_modulo_2.md': g2,
    'guion_modulo_3.md': g3,
    'guion_modulo_4.md': g4,
    'guion_modulo_5.md': g5,
}

for fname, content in modules_content.items():
    for base_dir in target_dirs:
        out_path = os.path.join(base_dir, fname)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Wrote {out_path} ({len(content)} chars)')

print('\nALL 5 SCRIPTS UPDATED AND SYNCHRONIZED SUCCESSFULLY IN BOTH LOCATIONS!')
