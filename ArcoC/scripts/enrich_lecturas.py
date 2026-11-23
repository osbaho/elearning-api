# -*- coding: utf-8 -*-
import os

# Update lectura_parte2.md with AO Trauma principles
p2 = r'c:\Oscar\ArcoC\public\documents\lectura_parte2.md'
with open(p2, 'r', encoding='utf-8') as f:
    c2 = f.read()

ao_p2 = """
### 5.1. La Regla de Oro Internacional de AO Trauma: "Hug the Intensifier!"
La evidencia curricular de la **AO Foundation / AO Trauma** establece directrices estrictas para el personal de quirófano:
* **Scatter Asimétrico en Proyección Lateral:** Del lado del tubo emisor de rayos X, la tasa de radiación dispersa al torso del cirujano es **25 veces mayor** y a la región tiroidea es **3 a 4 veces mayor** que del lado del intensificador/detector (*AO Trauma Radiation Hazards; Lee et al., 2012*). 
* **Regla "Hug the Intensifier!":** El cirujano, instrumentador y enfermeros deben mantenerse siempre del lado del intensificador de imagen y lo más lejos posible del tubo generador de rayos X.
* **Vulnerabilidad Crítica del Asistente Quirúrgico:** Estudios en cirugías ortopédicas consecutivas revelan que mientras el cirujano principal suele ubicarse a >90 cm del haz central, el primer asistente quirúrgico se sitúa con frecuencia a escasos **10 cm del haz**, absorbiendo la mayor carga de dosis si no se corrige su posición.
* **Advertencia Verbal Obligatoria:** Jamás se debe pisar el pedal de exposición en silencio. El protocolo de AO Trauma exige exclamar en voz alta **"¡Disparo!"** o **"¡Screening!"** antes de accionar el haz para que ningún miembro del equipo invada el campo de dispersión.
"""

if 'Hug the Intensifier!' not in c2:
    target = '## 6. Conclusión'
    c2 = c2.replace(target, ao_p2.strip() + '\n\n' + target)
    with open(p2, 'w', encoding='utf-8') as f:
        f.write(c2)
    print('lectura_parte2.md updated with AO Trauma!')

# Update lectura_parte4.md with AO Trauma stations 3 & 4
p4 = r'c:\Oscar\ArcoC\public\documents\lectura_parte4.md'
with open(p4, 'r', encoding='utf-8') as f:
    c4 = f.read()

ao_p4_femur = """
### 2.4. Estándar AO Trauma (Estación 3): Posicionamiento Centro-Centro del Tornillo Cefálico
En el tratamiento de fracturas extracapsulares de cadera mediante clavos cefalomedulares (trocantéricos):
* **Criterio de Fijación Centro-Centro:** Tanto en la vista AP como en la proyección axial/lateral verdadera, el tornillo o lámina cefálica debe colocarse en el centro exacto de la cabeza femoral (o centro-inferior en AP). Esta colocación biomecánica previene el fallo catastrófico por migración y corte óseo superior (*cut-out*).
* **Fluoroscopia 3D en Fémur y Pelvis:** El uso de barrido 3D intraoperatorio permite certificar que las clavijas guía no han penetrado inadvertidamente en el espacio articular acetabular antes del fresado.
"""

ao_p4_ankle = """
### 4.3. Estándar AO Trauma (Estación 4): Sindesmosis y Escaneo 3D Articular
* **Apertura del Espacio Claro Sindesmótico:** La proyección de mortaja a 15°-20° de rotación interna es indispensable para verificar que el peroné se encuentre anatómicamente reducido dentro de la incisura tibial sin diástasis ni rotación.
* **Control 3D de Tornillos y Clavijas:** En fracturas articulares complejas de tobillo, pilón tibial y calcáneo, la AO Trauma enfatiza que la fluoroscopia 2D convencional puede ocultar la penetración articular de tornillos subcondrales; el escaneo 3D intraoperatorio detecta estas intrusiones antes del cierre de piel, evitando reintervenciones.
"""

if 'Estándar AO Trauma (Estación 3)' not in c4:
    target_f = '## 3. Rodilla'
    c4 = c4.replace(target_f, ao_p4_femur.strip() + '\n\n---\n\n' + target_f)
    target_a = '## 5. Conclusión'
    c4 = c4.replace(target_a, ao_p4_ankle.strip() + '\n\n---\n\n' + target_a)
    with open(p4, 'w', encoding='utf-8') as f:
        f.write(c4)
    print('lectura_parte4.md updated with AO Trauma stations 3 & 4!')

# Update lectura_parte5.md with AO Trauma stations 1 & 2
p5 = r'c:\Oscar\ArcoC\public\documents\lectura_parte5.md'
with open(p5, 'r', encoding='utf-8') as f:
    c5 = f.read()

ao_p5 = """
### 2.3. Estándar AO Trauma (Estación 1): Húmero Proximal y Tornillos Calcar
* **Posicionamiento en Silla de Playa:** El paciente semi-incorporado permite que el Arco en C ingrese perpendicular a la escápula desde la cabecera.
* **Control de Penetración Articular:** En el enclavado anterógrado o placas bloqueadas de húmero proximal, la fluoroscopia dinámica debe corroborar que los tornillos inferomediales (tornillos de soporte del calcar) no penetren en la articulación glenohumeral, rotando el brazo en abducción y rotación externa/interna bajo visualización continua.

### 4.4. Estándar AO Trauma (Estación 2): Radio Distal, DRUJ y Riesgo del Tendón EPL
En la fijación con placa volar de radio distal:
* **Articulación Radiocubital Distal (DRUJ):** Proyecciones oblicuas a 20° de pronación descartan que los tornillos distales penetren en la fosa sigmoidea del radio invadiendo la DRUJ.
* **Tendón Extensor Largo del Pulgar (EPL):** Vistas laterales estrictas y tangenciales dorsales a 30° de inclinación son obligatorias para verificar que los tornillos bicorticales no sobresalgan más de 1 mm por la cortical dorsal en la corredera del EPL (tubérculo de Lister), lo que causaría la atrición y rotura tardía del tendón del pulgar.
"""

if 'Estándar AO Trauma (Estación 1)' not in c5:
    target_c = '## 3. Codo'
    c5 = c5.replace(target_c, ao_p5.strip() + '\n\n---\n\n' + target_c)
    with open(p5, 'w', encoding='utf-8') as f:
        f.write(c5)
    print('lectura_parte5.md updated with AO Trauma stations 1 & 2!')
