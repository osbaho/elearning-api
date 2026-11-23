# -*- coding: utf-8 -*-
"""
Script to embed figures and clinical images extracted from AO Trauma presentations
into lectura_parte1.md through lectura_parte5.md, including updated 2026 guidelines.
"""
import os

base = r'C:\Oscar\ArcoC\public\documents'

# ==============================================================================
# PARTE 1
# ==============================================================================
p1 = os.path.join(base, 'lectura_parte1.md')
with open(p1, 'r', encoding='utf-8') as f:
    c1 = f.read()

img_sec_1 = """
---

## 3. Fundamentos Físicos de la Radiación y Densidades Tisulares en Quirófano

### 3.1. Origen Histórico y Generación del Haz (Röntgen 1895)
El descubrimiento de los rayos X por Wilhelm Conrad Röntgen en 1895 transformó la medicina quirúrgica. En el tubo de fluoroscopia moderno, una corriente de electrones acelerada a alta tensión (~70-110 kV) colisiona contra un blanco de tungsteno rotatorio en vacío, liberando energía electromagnética ionizante de longitud de onda ultra-corta y alta frecuencia.

<div align="center">
  <img src="../images/modulo1/roentgen_wilhelm.jpg" width="45%" alt="Wilhelm Röntgen" />
  <img src="../images/modulo1/xray_production_tube.jpg" width="45%" alt="Generación del haz en tubo de rayos X" />
  <p><em>Figura 1.1: Wilhelm Röntgen (1895) y esquema de producción de rayos X mediante blanco de tungsteno al vacío en el tubo emisor.</em></p>
</div>

<div align="center">
  <img src="../images/modulo1/electromagnetic_spectrum_ionizing.jpg" width="85%" alt="Espectro Electromagnético e Ionización" />
  <p><em>Figura 1.2: Posición de los rayos X en el espectro electromagnético: radiación ionizante de longitud de onda corta capaz de arrancar electrones de la materia biológica.</em></p>
</div>

### 3.2. Las Cinco Densidades Radiológicas Clásicas en Traumatología
En una toma radiográfica o fluoroscópica, el nivel de atenuación fotónica determina si una estructura se observa **radiopaca** (blanca/clara) o **radiolúcida** (oscura/negra):
1. **Aire:** Radiolúcido absoluto (negro).
2. **Grasa:** Radiolúcido moderado (gris oscuro).
3. **Agua / Partes Blandas:** Atenuación intermedia (gris neutro).
4. **Hueso (Cortical y Esponjoso):** Radiopaco (blanco hueso con patrón trabecular).
5. **Metal:** Radiopaco absoluto (blanco puro brillante de implantes y prótesis).

<div align="center">
  <img src="../images/modulo1/five_tissue_densities_tibia.jpg" width="48%" alt="Densidades en fractura abierta de tibia" />
  <img src="../images/modulo1/metal_density_open_fracture.jpg" width="48%" alt="Densidad de metal en osteosíntesis" />
  <p><em>Figura 1.3: Demostración de las 5 densidades en fractura expuesta de tibia: aire ambiental, tejidos blandos edematizados, cortical ósea y metal de la osteosíntesis.</em></p>
</div>

<div align="center">
  <img src="../images/modulo1/radiopaque_vs_radiolucent_concept.jpg" width="70%" alt="Concepto Radiopaco vs Radiolúcido" />
  <p><em>Figura 1.4: Principio de absorción fotónica: las estructuras de alto número atómico (Z) absorben fotones (radiopacas), mientras que los tejidos de bajo Z permiten su paso (radiolúcidas).</em></p>
</div>

### 3.3. Dosis Ocupacionales y Lesiones Traumáticas Ocultas
La radiación natural de fondo ronda los 2-3 mSv/año a nivel del mar. En quirófano, cada segundo de exposición debe justificarse por el beneficio directo al paciente. 

<div align="center">
  <img src="../images/modulo1/natural_radiation_background_scale.png" width="48%" alt="Escala de Radiación Natural" />
  <img src="../images/modulo1/medical_radiation_exposure_mSv.png" width="48%" alt="Comparativa de Exposición Médica en mSv" />
  <p><em>Figura 1.5: Comparativa de dosis: desde radiación cósmica y ambiental hasta procedimientos diagnósticos de alta dosis en medicina.</em></p>
</div>

Asimismo, la fluoroscopia y la radiología convencional presentan limitaciones diagnósticas en fracturas articulares complejas y lesiones osteocondrales:

<div align="center">
  <img src="../images/modulo1/fat_pad_sign_lipohemarthrosis.png" width="48%" alt="Signo de la Almohadilla Grasa" />
  <img src="../images/modulo1/scaphoid_occult_fracture_mri.png" width="48%" alt="Fractura Oculta de Escafoides en RM" />
  <p><em>Figura 1.6: Izquierda: Signo de la almohadilla grasa (lipohemartrosis) en codo traumático. Derecha: Fractura oculta de escafoides no visible en Rx convencional pero evidente en resonancia magnética.</em></p>
</div>

<div align="center">
  <img src="../images/modulo1/lisfranc_fracture_comparison.png" width="48%" alt="Fractura de Lisfranc" />
  <img src="../images/modulo1/femoral_neck_occult_fracture.png" width="48%" alt="Fractura Oculta de Cuello Femoral" />
  <p><em>Figura 1.7: Izquierda: Comparativa pie normal vs diástasis articular en fractura-luxación de Lisfranc. Derecha: Fractura oculta subcapital de cuello femoral detectada por RM tras radiografía normal.</em></p>
</div>
"""

if 'Fundamentos Físicos de la Radiación y Densidades Tisulares' not in c1:
    c1 = c1.replace('## 3. Conclusión', img_sec_1.strip() + '\n\n## 4. Conclusión')
    with open(p1, 'w', encoding='utf-8') as f:
        f.write(c1)
    print('lectura_parte1.md successfully updated.')

# ==============================================================================
# PARTE 2
# ==============================================================================
p2 = os.path.join(base, 'lectura_parte2.md')
with open(p2, 'r', encoding='utf-8') as f:
    c2 = f.read()

img_sec_2_scatter = """
<div align="center">
  <img src="../images/modulo2/radiation_cataracts_eye_hazard.jpg" width="48%" alt="Cataratas inducidas por radiación" />
  <img src="../images/modulo2/photon_scatter_patient_absorption_80_20_2.png" width="48%" alt="Física del Scatter 80/20/2" />
  <p><em>Figura 2.1: Izquierda: Daño ocular y cataratas en cristalino por dosis ocupacional acumulada. Derecha: Física de absorción y dispersión AO Trauma: el paciente absorbe el 80% del haz primario, emite 10-20% de radiación dispersa (scatter) hacia el equipo, y solo el 2% llega al detector.</em></p>
</div>
"""

img_sec_2_distance = """
<div align="center">
  <img src="../images/modulo2/inverse_square_law_distance_graph.jpg" width="48%" alt="Ley del Inverso del Cuadrado" />
  <img src="../images/modulo2/safety_distance_3m_carm.jpg" width="48%" alt="Distancia de Seguridad de 3 Metros" />
  <p><em>Figura 2.2: Ley del Inverso del Cuadrado: duplicar la distancia reduce la radiación a la cuarta parte. A 3 metros de la fuente la dosis dispersa alcanza niveles prácticamente insignificantes.</em></p>
</div>
"""

img_sec_2_carm_pos = """
<div align="center">
  <img src="../images/modulo2/tube_under_patient_safe_config.png" width="48%" alt="Configuración Segura: Tubo Debajo" />
  <img src="../images/modulo2/tube_over_patient_danger_config.png" width="48%" alt="Configuración Peligrosa: Tubo Arriba" />
  <p><em>Figura 2.3: Configuración geométrica en proyección anteroposterior. Correcto (Izquierda): Tubo debajo de la mesa y receptor arriba (la radiación retrodispersa impacta las extremidades inferiores del personal). Incorrecto (Derecha): Tubo arriba (el scatter impacta directamente la cabeza, ojos y tiroides del cirujano).</em></p>
</div>

<div align="center">
  <img src="../images/modulo2/hug_the_intensifier_lateral_rule.png" width="48%" alt="Regla Hug the Intensifier" />
  <img src="../images/modulo2/torso_25x_lateral_scatter_diagram.jpg" width="48%" alt="Exposición del Torso 25X" />
  <p><em>Figura 2.4: La regla de oro internacional de AO Trauma: "Hug the Intensifier!" En proyección lateral, el cirujano debe situarse del lado del intensificador/detector. Del lado del tubo, el torso recibe 25 veces más dosis y la tiroides 3 a 4 veces más radiación dispersa.</em></p>
</div>
"""

img_sec_2_epp = """
<div align="center">
  <img src="../images/modulo2/personal_protective_equipment_apron.png" width="48%" alt="EPP Completo Plomado" />
  <img src="../images/modulo2/thyroid_shield_collar_importance.jpg" width="48%" alt="Protector Tiroideo" />
  <p><em>Figura 2.5: Equipo de Protección Personal: Mandil de 0.5 mm Pb (reduce 16x frontalmente y 4x lateralmente) y protector tiroideo (el 85% de los carcinomas papilares se relacionan con radiación).</em></p>
</div>

<div align="center">
  <img src="../images/modulo2/lead_apron_damage_cracks.jpg" width="48%" alt="Grietas en Mandil Plomado por Mal Cuidado" />
  <img src="../images/modulo2/lead_apron_proper_hanging_storage.png" width="48%" alt="Almacenamiento Correcto en Colgador" />
  <p><em>Figura 2.6: Mantenimiento del blindaje: Si el mandil se dobla o se deja en el suelo, el plomo interno se fisura (Izquierda, escaneo radiográfico). Debe almacenarse siempre en perchas murales dedicadas (Derecha).</em></p>
</div>

<div align="center">
  <img src="../images/modulo2/carm_attitude_floor_landmarks.jpg" width="32%" alt="Marcas en el Piso" />
  <img src="../images/modulo2/laser_aiming_positioning.jpg" width="32%" alt="Puntería Láser" />
  <img src="../images/modulo2/pulsed_fluoroscopy_dose_reduction.jpg" width="32%" alt="Fluoroscopia Pulsada" />
  <p><em>Figura 2.7: "C-arm attitude" de AO Trauma: Marcas en el piso para retornos mecánicos rápidos, puntería láser para centrado sin disparos de prueba, y fluoroscopia pulsada (1 seg = 15-25 cuadros con menor dosis).</em></p>
</div>
"""

if 'Figura 2.1' not in c2:
    c2 = c2.replace('## 2. Clasificación de los Efectos Biológicos', img_sec_2_scatter.strip() + '\n\n## 2. Clasificación de los Efectos Biológicos')
    c2 = c2.replace('## 4. Estrategias de Blindaje', img_sec_2_distance.strip() + '\n\n## 4. Estrategias de Blindaje')
    c2 = c2.replace('### 5.1. La Regla de Oro', img_sec_2_carm_pos.strip() + '\n\n### 5.1. La Regla de Oro')
    c2 = c2.replace('## 6. Conclusión', img_sec_2_epp.strip() + '\n\n## 6. Conclusión')
    with open(p2, 'w', encoding='utf-8') as f:
        f.write(c2)
    print('lectura_parte2.md successfully updated.')

# ==============================================================================
# PARTE 3
# ==============================================================================
p3 = os.path.join(base, 'lectura_parte3.md')
with open(p3, 'r', encoding='utf-8') as f:
    c3 = f.read()

img_sec_3 = """
<div align="center">
  <img src="../images/modulo3/focus_skin_distance_patient_dose.png" width="48%" alt="Distancia Foco Piel y Dosis de Entrada" />
  <img src="../images/modulo3/isocentric_carm_geometry.png" width="48%" alt="Geometría Isocéntrica del Arco en C" />
  <p><em>Figura 3.1: Izquierda: Influencia de la distancia foco-piel; alejar el tubo del paciente reduce drásticamente la dosis de entrada en piel. Derecha: Geometría isocéntrica que mantiene el centro de rotación anatómico sin desplazar la base entre proyecciones AP y lateral.</em></p>
</div>

<div align="center">
  <img src="../images/modulo3/collimation_and_metal_reduction.jpg" width="70%" alt="Colimación y Reducción de Metal" />
  <p><em>Figura 3.2: Colimación activa y reducción de instrumental metálico en el campo: disminuye la dosis de radiación y evita que el control automático de brillo (AEC) sobrecargue innecesariamente los kilovoltios del haz.</em></p>
</div>

<div align="center">
  <img src="../images/modulo3/kwire_joint_penetration_2d_carm.png" width="48%" alt="Falso Negativo en 2D" />
  <img src="../images/modulo3/screw_articular_penetration_3d_carm.png" width="48%" alt="Penetración Articular en 3D" />
  <p><em>Figura 3.3: Limitación crítica de la fluoroscopia 2D tradicional frente a tomografía computarizada 3D intraoperatoria (CBCT). Izquierda: Clavija guía o tornillo que parece extraarticular en 2D. Derecha: Reconstrucción multiplanar 3D evidenciando invasión del cartílago articular.</em></p>
</div>

<div align="center">
  <img src="../images/modulo3/tibial_plateau_complex_ct_3d.png" width="48%" alt="Fractura Compleja de Platillo Tibial" />
  <img src="../images/modulo3/articular_depression_ct_reconstruction.png" width="48%" alt="Depresión Articular en 3D" />
  <p><em>Figura 3.4: Reconstrucción volumétrica 3D de fractura articular con hundimiento de platillo tibial, permitiendo verificar la restitución de la superficie antes del cierre de piel.</em></p>
</div>
"""

if 'Figura 3.1' not in c3:
    c3 = c3.replace('## 5. Conclusión', img_sec_3.strip() + '\n\n## 5. Conclusión')
    with open(p3, 'w', encoding='utf-8') as f:
        f.write(c3)
    print('lectura_parte3.md successfully updated.')

# ==============================================================================
# PARTE 4
# ==============================================================================
p4 = os.path.join(base, 'lectura_parte4.md')
with open(p4, 'r', encoding='utf-8') as f:
    c4 = f.read()

img_sec_4 = """
<div align="center">
  <img src="../images/modulo4/proximal_femur_carm_positioning.png" width="48%" alt="Posicionamiento en Fémur Proximal" />
  <img src="../images/modulo4/femur_nail_entry_point_projection.png" width="48%" alt="Punto de Entrada de Clavo Cefalomedular" />
  <p><em>Figura 4.1: Estación AO Trauma en Fémur Proximal: Colocación del paciente y del Arco en C para transitar de AP a lateral verdadera sin colisiones, corroborando el punto de entrada óseo en la punta del trocánter mayor.</em></p>
</div>

<div align="center">
  <img src="../images/modulo4/ankle_fracture_syndesmosis_setup.png" width="48%" alt="Posicionamiento en Fractura de Tobillo" />
  <img src="../images/modulo4/ankle_mortise_view_3d_evaluation.png" width="48%" alt="Proyección de Mortaja y Control 3D" />
  <p><em>Figura 4.2: Estación AO Trauma en Tobillo y Sindesmosis: Alineación para mortaja a 15°-20° de rotación interna y reconstrucción 3D intraoperatoria de la congruencia articular tibio-peronea y astragalina.</em></p>
</div>
"""

if 'Figura 4.1' not in c4:
    c4 = c4.replace('## 5. Conclusión', img_sec_4.strip() + '\n\n## 5. Conclusión')
    with open(p4, 'w', encoding='utf-8') as f:
        f.write(c4)
    print('lectura_parte4.md successfully updated.')

# ==============================================================================
# PARTE 5
# ==============================================================================
p5 = os.path.join(base, 'lectura_parte5.md')
with open(p5, 'r', encoding='utf-8') as f:
    c5 = f.read()

img_sec_5 = """
<div align="center">
  <img src="../images/modulo5/proximal_humerus_beach_chair_setup.png" width="48%" alt="Silla de Playa en Húmero Proximal" />
  <img src="../images/modulo5/humerus_nailing_standard_views.png" width="48%" alt="Proyecciones Estándar en Húmero" />
  <p><em>Figura 5.1: Estación AO Trauma en Húmero Proximal: Posición en silla de playa con arco entrando oblicuo desde craneal, y proyecciones AP verdadera y axilar para corroborar tornillos calcar sin penetración glenoidea.</em></p>
</div>

<div align="center">
  <img src="../images/modulo5/distal_radius_standard_projections.png" width="48%" alt="Proyecciones en Radio Distal" />
  <img src="../images/modulo5/distal_radius_misplaced_screw_check.png" width="48%" alt="Comprobación de Tornillos en Radio Distal" />
  <p><em>Figura 5.2: Estación AO Trauma en Radio Distal: Inclinación del haz a 11°-15° para tangenciar la superficie articular radiocarpiana y comprobar que ningún tornillo penetre en la articulación o lesione el tendón extensor largo del pulgar (EPL) en la cortical dorsal.</em></p>
</div>

<div align="center">
  <img src="../images/modulo5/cervical_spine_articular_pillar_ct.png" width="48%" alt="Columna Cervical Pilar Articular" />
  <img src="../images/modulo5/cervicothoracic_junction_lateral_view.png" width="48%" alt="Charnela Cervicotorácica en Lateral" />
  <p><em>Figura 5.3: Dificultades de penetración en columna vertebral: fracturas de lámina y pilares articulares ocultas en Rx convencional (Izquierda), y visualización de la unión C7-T1 superpuesta por los hombros (Derecha).</em></p>
</div>
"""

if 'Figura 5.1' not in c5:
    c5 = c5.replace('## 5. Conclusión', img_sec_5.strip() + '\n\n## 5. Conclusión')
    with open(p5, 'w', encoding='utf-8') as f:
        f.write(c5)
    print('lectura_parte5.md successfully updated.')

print('All 5 reading documents enriched with images and captions!')
