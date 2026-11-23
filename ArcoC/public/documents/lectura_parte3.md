# Módulo 3: Anatomía, Componentes y Cinemática del Fluoroscopio

## Abstract
**Resumen:** La ineficiencia en el manejo de la cinemática del Arco en C incrementa de manera proporcional los tiempos quirúrgicos y las dosis de fluoroscopia innecesarias. Este módulo detalla la anatomía funcional del intensificador de imágenes, describiendo sus componentes primarios y el código mecánico universal de sus desplazamientos. Adicionalmente, se discute el impacto del hardware paramétrico, como la colimación y la fluoroscopia pulsada, en la reducción objetiva de la dosis (Dose Area Product - DAP).

---

## 1. Introducción y el Desafío de la Comunicación Intraoperatoria
La anatomía del fluoroscopio moderno está diseñada bajo principios de ergonomía geométrica para posicionarse alrededor de la mesa quirúrgica sin invadir el campo estéril. Un dominio táctico de los seguros, palancas y cinemática del dispositivo permite mantener un flujo quirúrgico dinámico y seguro. 

Estudios multicéntricos revelan que la falta de estandarización comunicativa entre el cirujano y el tecnólogo de radiología es responsable de más del 30% de las exposiciones fallidas repetidas (*Kaplan et al., 2016*). Términos ambiguos como *"un poco hacia arriba"*, *"gíralo"* o *"muévelo"* provocan confusión y disparos innecesarios.

### 🗣️ Protocolo Universal de Comunicación Verbal (Yeo et al., 2013; Kaplan et al., 2016)
Avalado por la Asociación Canadiense de Tecnólogos en Radiología Médica y estudios de simulación quirúrgica (*Yeo et al., 2013*), toda instrucción intraoperatoria debe formularse bajo dos estructuras gramaticales estrictas:
1. **Comandos Lineales:** **Dirección anatómica + Distancia métrica precisa.**  
   * *Ejemplo correcto:* *"Caudal 5 centímetros"* o *"Desplazamiento horizontal 10 centímetros hacia el cirujano"*.
2. **Comandos Rotacionales:** **Término del movimiento + Dirección + Magnitud angular en grados.**  
   * *Ejemplo correcto:* *"Rotación orbital 15 grados hacia craneal"* o *"Wig-wag 10 grados a la derecha"*.

> **Impacto clínico comprobado:** La implementación de este vocabulario predeterminado reduce el tiempo para alinear círculos perfectos de **212 segundos a 97 segundos** (una disminución del **54%**) y corta el número de disparos radiográficos a la mitad (de **12 a 6 imágenes**) (*Yeo et al., 2013; Kaplan et al., 2016*).

---

## 2. Componentes Fundamentales y Geometría del Haz
1. **Tubo Emisor (Generador de Rayos X):** Aloja el cátodo (fuente de electrones) y el ánodo rotatorio (blanco de tungsteno/molibdeno). Emite el haz primario de radiación en forma de cono tridimensional divergente (*Shao et al., 2014*).
2. **Intensificador de Imágenes o Detector Flat Panel (FPD):** Convierte el patrón de rayos X atenuados en una imagen digital de alta resolución mediante capas de centelleo y fotodiodos de silicio amorfo.
3. **Gantry o Brazo en "C":** Estructura semicircular que mantiene la alineación colimada entre el tubo y el receptor.
4. **Colimador:** Diafragma mecánico de láminas de plomo que restringe el haz al área de estricto interés quirúrgico.
5. **Estación de Monitores y Procesamiento:** Consola con memoria de adquisición, curva gamma, inversión de escala de grises y pedales de exposición dual (fluoroscopia convencional y de alta resolución/cine).

### 2.1. Controles Operacionales de Consola y Distancia Foco-Piel (Estándar ACHS y Fabricantes Globales)
El manual de seguridad radiológica en fluoroscopia (*ACHS / Sector Salud*) y las guías de ingeniería biomédica establecen parámetros técnicos de obligado cumplimiento:
* **Distancia Foco-Piel Mínima (SSD - Source-to-Skin Distance):** La distancia foco-piel nunca debe ser inferior a **30 cm en Arcos en C móviles convencionales** ni inferior a **20 cm en Mini Arcos en C**. Disminuir la SSD por debajo de este umbral multiplica exponencialmente la densidad de dosis de entrada en piel (*Patient Entrance Skin Dose*), generando eritema transitorio temprano y quemaduras dérmicas inducidas por radiación.
* **Control de Fluoroscopia Pulsada y Dosis por Fabricantes:**
  * **Sistemas GE OEC:** Incorporan selectores fijos de **1, 2, 4 y 8 pps** (pulsos por segundo). Trabajar a 8 pps reduce la dosis al 40%, 4 pps al 25%, 2 pps al 20% y 1 pps al 15% en comparación con la fluoroscopia continua convencional (100%).
  * **Sistemas Philips (Veradius / Zenition):** Cuentan con opciones de **Media Dosis (50%)** y **Cuartos de Dosis (25%)**, que en combinación con la fluoroscopia pulsada permiten un control milimétrico de la radiación en imágenes estáticas de control.
  * **Sistemas Siemens Healthineers (Cios Alpha / Connect):** Incorporan la suite **CARE** (*Combined Applications to Reduce Exposure*). Destacan: **CAREFilter** (inserción automática de filtros de cobre de 0.1 a 0.3 mm Cu que absorben los fotones blandos no diagnósticos), **CAREProfile** (colimación virtual sobre la última imagen retenida sin emitir radiación) y pulsado variable desde 0.5 hasta 15 pps.
  * **Sistemas Ziehm Imaging (Solo / Vision / RFD):** Incorporan la plataforma **SmartDose** con tecnología **SmartPulse**, que modula el ancho del pulso en nanosegundos adaptándolo a la densidad anatómica y reduciendo la dosis pediátrica y en extremidades hasta en un 60%.
* **Alerta Crítica del Modo Cine:** En equipos móviles, el modo Cine (grabación continua a alta tasa de cuadros) triplica la tasa de dosis (~300% de la fluoroscopia normal), mientras que en arcos fijos de hemodinámica puede multiplicarla hasta **100 veces**. Su empleo en trauma ortopédico convencional debe evitarse estrictamente.

### 2.2. Evolución del Receptor de Imagen: Tubo Intensificador de Imagen (II) vs. Detector Flat Panel (FPD)
La transición del clásico tubo de vacío hacia los detectores de panel plano de estado sólido representa el salto cualitativo más importante de las últimas décadas en imagen quirúrgica:

* **Tubo Intensificador de Imagen (II) Clásico:**
  * *Estructura:* Tubo de vacío voluminoso de vidrio/metal, centellador de entrada de yoduro de cesio ($CsI:Na$), fotocátodo, lentes electrostáticas de alto voltaje (25-35 kV), ánodo acelerador y pantalla de fósforo de salida ($ZnCdS:Ag$) acoplada a cámara óptica.
  * *Limitaciones Intrínsecas:*
    1. **Distorsión en corsé / barrilete (*Pincushion Distortion*):** Proyección esférica a plano que curva las líneas rectas en la periferia de la imagen hasta en un 15-20%.
    2. **Distorsión geomagnética en "S":** Desviación del haz de electrones en el vacío por interferencia con el campo magnético de la Tierra y motores de la sala quirúrgica.
    3. **Viñeteado (*Vignetting*):** Pérdida progresiva de brillo y contraste del centro hacia los bordes.
    4. **Envejecimiento del Fósforo:** Pérdida irreversible de ganancia luminosa (~10% anual).
    5. **Volumen Físico Excesivo:** Gran tamaño que limita el espacio libre quirúrgico y favorece colisiones mecánicas.

* **Detector Flat Panel (FPD) de Estado Sólido (Estándar 2026):**
  * *Estructura:* Matriz activa de transistores de película delgada (TFT) de silicio amorfo ($a\text{-Si}$) o sensores CMOS, con centellador de $CsI:Tl$ de microestructuras en aguja depositado directamente sobre la matriz fotosensible.
  * *Ventajas Clínicas Determinantes:*
    1. **Distorsión Geométrica Cero:** Reconstrucción ortogonal perfecta en toda la superficie; un implante o clavo recto se visualiza matemáticamente recto en cualquier posición del monitor.
    2. **Campo Cuadrado 100% Útil:** Aprovecha un 25-30% más de superficie anatómica visible en comparación con el campo circular de los tubos tradicionales.
    3. **Eficiencia Cuántica de Detección (DQE) Superior:** DQE hasta 65% en bajas dosis frente a 30-40% en tubos II $\rightarrow$ **permite reducir la dosis de radiación al paciente y cirujano entre un 30% y un 50%**.
    4. **Rango Dinámico de 16 Bits:** Permite discernir simultáneamente hueso cortical, implantes metálicos y tejido blando sin saturación (*blooming*).
    5. **Perfil Ultra-Delgado:** Facilita el acceso ergonómico al campo quirúrgico y elimina el riesgo de colisiones con la camilla.

### 2.3. Algoritmos de Inteligencia Artificial (Deep Learning) para Denoising en Tiempo Real
En la fluoroscopia analógica continua, se requerían 25–30 cuadros por segundo para enmascarar el ruido cuántico de "nieve" visual. Hacia 2026, los arcos en C modernos integran coprocesadores de Inteligencia Artificial basados en redes neuronales convolucionales y transformadores en tiempo real:
* **Filtrado Espaciotemporal Adaptativo:** La IA identifica y suprime el ruido cuántico manteniendo los bordes óseos y los implantes con máxima nitidez.
* **Operación a Tasas Ultra-Bajas (4 a 8 pps):** Permite al cirujano trabajar a solo **4 u 8 pulsos por segundo** con una calidad diagnóstica percibida idéntica a la fluoroscopia continua de 30 fps, logrando una **reducción de dosis de radiación acumulada de hasta un 75%**.

### 2.4. Tomografía Intraoperatoria Cone-Beam 3D (CBCT) y Navegación Quirúrgica
Los arcos en C modernos de gama alta incorporan rotación orbital isocéntrica motorizada (de 180° a 200°) que ejecuta un barrido automatizado en 15-30 segundos:
* **Reconstrucción Volumétrica Multiplanar (MPR):** Genera cortes axiales, sagitales y coronales milimétricos en el quirófano con resolución isotrópica.
* **Certeza Intraoperatoria:** Detecta la penetración intraarticular oculta de tornillos o mala reducción en fracturas complejas de calcáneo, acetábulo, pilón tibial, radio distal y columna vertebral antes de despertar al paciente, reduciendo drásticamente las reoperaciones.

### 2.5. La Trampa del Separador Metálico y el Control Automático de Brillo (ABC / AERC)
El Control Automático de Exposición o Brillo (ABC/AERC) está diseñado para modular automáticamente el kilovoltaje (kVp) y el miliamperaje (mA) según el grosor del paciente. Sin embargo, en cirugía ortopédica abierta se presenta una trampa crítica:
* **El Fenómeno de Sobreestimulación (*Over-driving* del Tubo):** Cuando el asistente introduce un separador quirúrgico de acero denso (ej., separador de Hohmann o Bennett) en el centro del haz de rayos X, el sensor del ABC interpreta que el tejido es infinitamente grueso y **dispara el kilovoltaje y miliamperaje a su potencia máxima**.
* **Consecuencias Quirúrgicas:** Este disparo innecesario provoca el sobrecalentamiento prematuro del ánodo, calcina visualmente los bordes óseos circundantes (saturación blanca) y **cuadriplica la radiación dispersa hacia el equipo quirúrgico**.
* **Conducta Correctiva Inmediata:**
  1. Desplazar los separadores metálicos fuera del cono central de medición antes de pedalear.
  2. Ajustar el colimador iris para excluir los instrumentos metálicos fuera del campo visual.
  3. En consolas modernas, activar la tecla de **"Corrección de Metal" (*Metal Mode*)**, que bloquea el cálculo del ABC sobre el metal y ajusta la exposición en función del tejido óseo adyacente.

### 2.6. Extracción de la Rejilla Antidifusora (*Grid Extraction* / Pediatría - Campaña *Image Gently*)
Los arcos en C incorporan de fábrica una rejilla antidifusora (*anti-scatter grid*) montada frente al detector para filtrar los fotones dispersos antes de que formen la imagen:
* **La Paradoja en Pacientes Pequeños y Extremidades:** En pacientes pediátricos o en extremidades delgadas de adultos (mano, muñeca, dedos), el volumen tisular es tan pequeño que **la producción de radiación dispersa es insignificante**.
* **Penalización Innecesaria:** Mantener la rejilla puesta en estos casos absorbe fotones primarios útiles, obligando al generador a duplicar la dosis emitida para atravesar las láminas de plomo de la rejilla.
* **Impacto del Retiro Manual de la Rejilla:** La campaña internacional *Image Gently* exige **retirar manualmente la rejilla desmontable** (*Removable Grid*) en procedimientos pediátricos o de mano/pie. Esta sencilla maniobra mecánica **reduce la dosis de radiación entre un 50% y un 60%** sin pérdida perceptible de contraste ni resolución diagnóstica.

---

## 3. Cinemática del Equipo: Del Modelo Tradicional al Modelo Redundante de 8 Grados de Libertad (8-DoF)

### 3.1. Código Mecánico Convencional (Palancas y Frenos)
En la práctica manual habitual, el brazo en C se manipula liberando frenos axiales identificados por código de colores:
* 🔵 **Movimiento Orbital (Palanca Azul):** Deslizamiento angular del arco a lo largo de su propia curvatura (típicamente de -90° a +45° o hasta 130°). Permite pasar de Anteroposterior a Lateral sin mover la base del equipo.
* 🟡 **Rotación Angular / "Wig-Wag" (Palanca Amarilla):** Basculación lateral sobre el pivote de anclaje (típicamente $\pm 12.5^\circ$). Esencial para alinear el haz oblicuo al cuello femoral o mesetas tibiales inclinadas.
* 🟠 **Desplazamiento Horizontal (Palanca Naranja):** Extensión o retracción telescópica del cuello del arco en el plano transversal (rango de 20 cm) para ajuste fino sin desplazar las ruedas de la base.
* 🟢 **Elevación Vertical (Palanca Verde o Comando Eléctrico):** Ajuste de altura en columna central (recorrido típico de 45 cm) para adaptar la distancia fuente-paciente.

### 3.2. Modelado Cinemático Robótico Redundante (Shao et al., 2014)
La modelización tradicional considera al Arco en C como un brazo manipulador de **5 Grados de Libertad (A3–A7)**. Sin embargo, en salas de cirugía congestionadas con mesas quirúrgicas, torres de artroscopia y carros de anestesia, este modelo genera restricciones mecánicas y singularidades que impiden alcanzar proyecciones complejas sin colisionar con el entorno.

Para resolver esto, la ingeniería biomédica moderna modela el sistema como un **manipulador robótico redundante de 8 Grados de Libertad (8-DoF)** (*Shao et al., 2014*):
* **Base Móvil (3 DoF):** Dos traslaciones en el plano del suelo ($A_0, A_1$) y una rotación sobre el eje de gravedad ($A_2$).
* **Gantry / Brazo (5 DoF):** Elevación vertical ($A_3$), rotación axial swivel ($A_4$), extensión horizontal ($A_5$), basculación angular ($A_6$) y deslizamiento orbital ($A_7$).
* **Control Cinemático Inverso (CLIK):** Mediante el Jacobiano pseudoinverso y el Método de Proyección de Gradiente (**GPM**), el sistema resuelve la redundancia matemática, evitando singularidades y colisiones con el campo quirúrgico estéril (*Shao et al., 2014*).

### 3.3. Optimización Geométrica del Haz Cónico y Protección de las Manos
Modelando el haz de rayos X como un cono geométrico definido por el vértice en el foco emisor $A(x_0, y_0, z_0)$ y la directriz circular en el receptor ($r \approx 150\text{ mm}$, $d \approx 1000\text{ mm}$), los algoritmos de posicionamiento resuelven la función de costo:
$$f(O) = \min \left( \frac{\min(\text{shiftRot})}{\max(\|MH\|)} \right)$$
donde se **maximiza la distancia analítica entre el haz cónico de rayos X y las manos del cirujano ($H$)**, garantizando el principio ALARA y evitando que las manos penetren en la zona de irradiación directa primaria (*Shao et al., 2014*).

---

## 4. Guías de Puntería Láser (Laser Aiming Guides): Eficacia y Limitaciones Clínicas (Shuler et al., 2013)
El acoplamiento de punteros láser en el intensificador de imágenes proyecta una cruz visible sobre la piel del paciente en la dirección axial del haz:
* **Eficacia Global:** El uso de guía láser reduce el tiempo total de fluoroscopia en un **19%** al permitir centrar la articulación en el primer disparo sin disparos de tanteo (*Shuler et al., 2013*).
* **Dependencia Anatómica Crítica:** 
  * En articulaciones con **reparos óseos superficiales y palpables** (rodilla y tobillo), la guía láser disminuye el tiempo de radiación en un **39% y 29%**, respectivamente, reduciendo las desviaciones del centro en un 35-38%.
  * En articulaciones profundas sin reparos óseos palpables (como la cadera en pacientes obesos, BMI > 40), **la guía láser no demostró beneficio**, incrementando ligeramente el tiempo de fluoroscopia (151 s vs 161 s) por intentos repetidos (*Shuler et al., 2013*).

---

## 5. Parámetros de Protección en la Consola
1. **Fluoroscopia Pulsada (Pulsed Fluoro):** Ajustar la cadencia de adquisición a 4 u 8 pulsos por segundo reduce la dosis total hasta en un **75%** en comparación con el modo continuo analógico (30 cuadros/segundo) (*Kaplan et al., 2016*).
2. **Colimación Geométrica Estricta:** Las láminas de plomo del colimador estrechan el haz al área de la fractura. Esto produce dos beneficios capitales:
   * Disminuye la dosis integral impartida al paciente.
   * Reduce dramáticamente el volumen de tejido irradiado, reduciendo la producción de radiación dispersa hacia el cirujano y mejorando la nitidez al evitar la sobreexposición en los bordes (*Kaplan et al., 2016*).
3. **Última Imagen Sostenida (LIH - Last Image Hold):** Mantiene congelado el último fotograma en la pantalla de referencia para permitir que el cirujano evalúe la reducción y planifique el siguiente paso sin mantener el pedal activado.

---

## 6. Conclusión
El control del Arco en C no debe ser un proceso intuitivo ni improvisado. La combinación de una **comunicación verbal estandarizada** (dirección + distancia; movimiento + grados), la comprensión de la **cinemática redundante de 8-DoF**, la protección geométrica de las manos y el aprovechamiento de la **colimación y fluoroscopia pulsada** son los pilares fundamentales para un flujo quirúrgico eficiente y seguro.

---

## Bibliografía
1. **Kaplan, D. J., Patel, J. N., Liporace, F. A., & Yoon, R. S.** (2016). *Intraoperative radiation safety in orthopaedics: a review of the ALARA (As low as reasonably achievable) principle.* Patient Safety in Surgery, 10(1), 27.
2. **Yeo, C. H., Gordon, R., & Nusem, I.** (2013). *Improving operating theatre communication between the orthopaedics surgeon and radiographer.* ANZ Journal of Surgery, 84(5), 316-319.
3. **Shao, Z., Guan, Y., & Tan, J.** (2014). *Virtual Reality Aided Positioning of Mobile C-Arms for Image-Guided Surgery.* Advances in Mechanical Engineering, 6, 943025.
4. **Shuler, F. D., Daigre, J. L., Pham, D., & Kish, V. L.** (2013). *Laser targeting with C-arm fluoroscopy: effect on image acquisition and radiation exposure.* Journal of Orthopaedic Trauma, 27(5), e97-e102.
5. **Schueler, B. A.** (2000). *The AAPM/RSNA physics tutorial for residents: General overview of fluoroscopic imaging.* Radiographics, 20(4), 1115-1126.
