using System.Collections;
using UnityEngine;

namespace CArmSimulator.Minigames
{
    public enum AnatomyType
    {
        Shoulder,
        Femur,
        Pelvis
    }

    /// <summary>
    /// Manages clinical anatomical bone targets visible in the BoneXRay fluoroscopy layer.
    /// Dynamically switches between:
    /// - Femur (Phase 1 Protocol Zero, Phase 2 Case 2, Phase 3 Case 1): Anatomical femoral head, angled neck at 128°,
    ///   greater/lesser trochanters, anatomical shaft, realistic oblique fracture with cortical butterfly wedge fragment and distal condyles.
    /// - Shoulder (Phase 2 Case 1, Phase 3 Case 2): True glenohumeral joint space (4mm), hemispherical humeral head,
    ///   trochiter, trochin, bicipital groove, glenoid fossa, acromioclavicular arch, and coracoid process.
    /// - Pelvis (Phase 2 Case 3, Phase 3 Case 3): Iliac crest/wing, acetabular dome with articulated femoral head,
    ///   obturator ring (superior/inferior pubic and ischial rami), and ischial tuberosity (Judet criteria).
    /// 
    /// Coordinates anatomical sites on the patient table and synchronizes the physical C-Arm mobile base
    /// and X-Ray camera so fluoroscopy monitors and OR physical equipment reflect real imaging procedure locations.
    /// </summary>
    public class AnatomicalTargetManager : MonoBehaviour
    {
        public static AnatomicalTargetManager Instance { get; private set; }

        public const int LAYER_BONE_XRAY = 8;

        // True anatomical offsets on surgical table surface relative to patient hologram center
        public static readonly Vector3 LOCAL_POS_SHOULDER = new Vector3(0.14f, 0f, 0.42f); // Right shoulder
        public static readonly Vector3 LOCAL_POS_FEMUR    = new Vector3(0.12f, 0f, -0.32f); // Right thigh/femur diaphysis
        public static readonly Vector3 LOCAL_POS_PELVIS   = new Vector3(0.06f, 0f, 0.00f); // Right hip / acetabulum

        [Header("Anatomical 3D Targets (BoneXRay Layer)")]
        [SerializeField] private GameObject shoulderRoot;
        [SerializeField] private GameObject femurRoot;
        [SerializeField] private GameObject pelvisRoot;

        [Header("Materials")]
        [SerializeField] private Material boneMaterial;

        [Header("Physical C-Arm & Fluoroscopy Camera Synchronization")]
        [SerializeField] private Transform carmRigTransform;
        [SerializeField] private Camera xrayCamera;

        public GameObject ShoulderRoot => shoulderRoot;
        public GameObject FemurRoot => femurRoot;
        public GameObject PelvisRoot => pelvisRoot;

        public Transform CurrentTargetTransform
        {
            get
            {
                switch (CurrentAnatomy)
                {
                    case AnatomyType.Shoulder:
                        return shoulderRoot != null ? shoulderRoot.transform : transform;
                    case AnatomyType.Pelvis:
                        return pelvisRoot != null ? pelvisRoot.transform : transform;
                    case AnatomyType.Femur:
                    default:
                        return femurRoot != null ? femurRoot.transform : transform;
                }
            }
        }

        public Vector3 CurrentAnatomyWorldPosition => CurrentTargetTransform != null ? CurrentTargetTransform.position : transform.position;

        public AnatomyType CurrentAnatomy { get; private set; } = AnatomyType.Femur;

        private Coroutine moveRigCoroutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;

            EnsureRigAndCameraReferences();

            // Ensure roots exist if not bound via inspector, or rebuild if outdated geometry is present
            if (shoulderRoot == null || femurRoot == null || pelvisRoot == null ||
                femurRoot.transform.Find("Fragmento_Ala_Mariposa") == null)
            {
                BuildAllAnatomies();
            }
        }

        private void Start()
        {
            // Default to Femur for Phase 1 Protocol Zero, positioning rig and camera immediately
            SetAnatomy(CurrentAnatomy, animate: false);
        }

        private void OnDestroy()
        {
            if (moveRigCoroutine != null)
            {
                StopCoroutine(moveRigCoroutine);
                moveRigCoroutine = null;
            }

            if (Instance == this)
            {
                Instance = null;
            }
        }

        public void EnsureRigAndCameraReferences()
        {
            if (carmRigTransform == null)
            {
                var rig = GameObject.Find("CArm_Rig");
                if (rig != null) carmRigTransform = rig.transform;
            }

            if (xrayCamera == null)
            {
                var camGO = GameObject.Find("XRay_Camera");
                if (camGO != null) xrayCamera = camGO.GetComponent<Camera>();
            }
        }

        /// <summary>
        /// Activates the designated anatomical silhouette and positions physical C-arm rig and X-ray camera.
        /// </summary>
        public void SetAnatomy(AnatomyType type, bool animate = true)
        {
            SetAnatomyWithOffset(type, Vector3.zero, animate);
        }

        /// <summary>
        /// Activates the designated anatomy with an optional translational offset (e.g. 5cm caudal in Phase 3 Case 1).
        /// </summary>
        public void SetAnatomyWithOffset(AnatomyType type, Vector3 extraOffset, bool animate = true)
        {
            CurrentAnatomy = type;

            if (shoulderRoot != null) shoulderRoot.SetActive(type == AnatomyType.Shoulder);
            if (femurRoot != null)    femurRoot.SetActive(type == AnatomyType.Femur);
            if (pelvisRoot != null)   pelvisRoot.SetActive(type == AnatomyType.Pelvis);

            SyncRigAndCameraToAnatomy(type, extraOffset, animate);

            Debug.Log($"[AnatomicalTargetManager] Active fluoroscopic anatomy switched to: {type} (Offset: {extraOffset})");
        }

        /// <summary>
        /// Compatibility overload for callers using SetAnatomy(AnatomyType).
        /// </summary>
        public void SetAnatomy(AnatomyType type)
        {
            SetAnatomy(type, animate: true);
        }

        /// <summary>
        /// Convenience method mapping 0-based case index to anatomy type:
        /// 0 = Shoulder, 1 = Femur, 2 = Pelvis.
        /// </summary>
        public void SetAnatomyByIndex(int caseIndex)
        {
            switch (caseIndex)
            {
                case 0:
                    SetAnatomy(AnatomyType.Shoulder);
                    break;
                case 1:
                    SetAnatomy(AnatomyType.Femur);
                    break;
                case 2:
                    SetAnatomy(AnatomyType.Pelvis);
                    break;
                default:
                    SetAnatomy(AnatomyType.Femur);
                    break;
            }
        }

        public Vector3 GetAnatomyWorldPosition(AnatomyType type)
        {
            switch (type)
            {
                case AnatomyType.Shoulder:
                    return shoulderRoot != null ? shoulderRoot.transform.position : transform.TransformPoint(LOCAL_POS_SHOULDER);
                case AnatomyType.Pelvis:
                    return pelvisRoot != null ? pelvisRoot.transform.position : transform.TransformPoint(LOCAL_POS_PELVIS);
                case AnatomyType.Femur:
                default:
                    return femurRoot != null ? femurRoot.transform.position : transform.TransformPoint(LOCAL_POS_FEMUR);
            }
        }

        /// <summary>
        /// Glides the C-Arm mobile cart along the floor (Z axis) and positions the X-Ray camera
        /// directly over the target bone so the fluoroscopy monitor frames the active anatomical site.
        /// </summary>
        public void SyncRigAndCameraToAnatomy(AnatomyType type, Vector3 extraOffset, bool animate = true)
        {
            EnsureRigAndCameraReferences();

            Vector3 targetWorld = GetAnatomyWorldPosition(type) + extraOffset;

            // Rig moves along Z (longitudinal table axis) while preserving its base X and Y
            Vector3 targetRigPos = carmRigTransform != null
                ? new Vector3(carmRigTransform.position.x, carmRigTransform.position.y, targetWorld.z)
                : Vector3.zero;

            // X-Ray orthographic camera centers over the bone in X and Z, keeping its overhead Y height (1.60m)
            Vector3 targetCamPos = xrayCamera != null
                ? new Vector3(targetWorld.x, xrayCamera.transform.position.y, targetWorld.z)
                : Vector3.zero;

            if (animate && Application.isPlaying && gameObject.activeInHierarchy)
            {
                if (moveRigCoroutine != null) StopCoroutine(moveRigCoroutine);
                moveRigCoroutine = StartCoroutine(MoveRigAndCamRoutine(targetRigPos, targetCamPos, 0.65f));
            }
            else
            {
                if (carmRigTransform != null) carmRigTransform.position = targetRigPos;
                if (xrayCamera != null) xrayCamera.transform.position = targetCamPos;
            }
        }

        /// <summary>
        /// Translates both the physical C-Arm cart and the fluoroscopic camera by a given delta
        /// (e.g. executing closed-loop verbal orders in Isocenter Command).
        /// </summary>
        public void TranslateRigAndCam(Vector3 delta, float duration = 1.0f)
        {
            EnsureRigAndCameraReferences();

            Vector3 targetRigPos = carmRigTransform != null
                ? carmRigTransform.position + new Vector3(0f, 0f, delta.z)
                : Vector3.zero;

            Vector3 targetCamPos = xrayCamera != null
                ? xrayCamera.transform.position + new Vector3(delta.x, 0f, delta.z)
                : Vector3.zero;

            if (Application.isPlaying && gameObject.activeInHierarchy)
            {
                if (moveRigCoroutine != null) StopCoroutine(moveRigCoroutine);
                moveRigCoroutine = StartCoroutine(MoveRigAndCamRoutine(targetRigPos, targetCamPos, duration));
            }
            else
            {
                if (carmRigTransform != null) carmRigTransform.position = targetRigPos;
                if (xrayCamera != null) xrayCamera.transform.position = targetCamPos;
            }
        }

        private IEnumerator MoveRigAndCamRoutine(Vector3 targetRigPos, Vector3 targetCamPos, float duration)
        {
            Vector3 startRigPos = carmRigTransform != null ? carmRigTransform.position : Vector3.zero;
            Vector3 startCamPos = xrayCamera != null ? xrayCamera.transform.position : Vector3.zero;

            float timer = 0f;
            while (timer < duration)
            {
                timer += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, timer / duration);
                if (carmRigTransform != null) carmRigTransform.position = Vector3.Lerp(startRigPos, targetRigPos, t);
                if (xrayCamera != null) xrayCamera.transform.position = Vector3.Lerp(startCamPos, targetCamPos, t);
                yield return null;
            }

            if (carmRigTransform != null) carmRigTransform.position = targetRigPos;
            if (xrayCamera != null) xrayCamera.transform.position = targetCamPos;
            moveRigCoroutine = null;
        }

        /// <summary>
        /// Generates or rebuilds the 3 anatomical bone models with realistic primitive composition
        /// at their true anatomical locations on the table.
        /// </summary>
        public void BuildAllAnatomies(Material customBoneMat = null)
        {
            if (customBoneMat != null)
            {
                boneMaterial = customBoneMat;
            }

            if (boneMaterial == null)
            {
                Shader urpUnlit = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
                boneMaterial = new Material(urpUnlit) { name = "Mat_BoneXRay_Runtime", color = new Color(0.92f, 0.94f, 0.90f, 1f) };
            }

            // Clean previous children if rebuilding
            if (shoulderRoot != null) DestroyImmediate(shoulderRoot);
            if (femurRoot != null)    DestroyImmediate(femurRoot);
            if (pelvisRoot != null)   DestroyImmediate(pelvisRoot);

            shoulderRoot = CreateShoulderAnatomy(transform, boneMaterial);
            femurRoot    = CreateFemurAnatomy(transform, boneMaterial);
            pelvisRoot   = CreatePelvisAnatomy(transform, boneMaterial);

            SetAnatomy(CurrentAnatomy, animate: false);
        }

        private static GameObject CreateBonePart(string name, PrimitiveType primType, Transform parent,
            Vector3 localPos, Quaternion localRot, Vector3 localScale, Material mat)
        {
            var go = GameObject.CreatePrimitive(primType);
            go.name = name;
            go.layer = LAYER_BONE_XRAY;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = localRot;
            go.transform.localScale = localScale;

            // Remove box/sphere/capsule colliders to avoid collision engine overhead
            var col = go.GetComponent<Collider>();
            if (col != null)
            {
                if (Application.isPlaying) Destroy(col);
                else DestroyImmediate(col);
            }

            if (mat != null)
            {
                var mr = go.GetComponent<MeshRenderer>();
                if (mr != null) mr.sharedMaterial = mat;
            }

            return go;
        }

        // ════════════════════════════════════════════════════════════════════════
        // 1. ANATOMÍA DEL HOMBRO / HÚMERO PROXIMAL (Anatomy_Shoulder)
        // ════════════════════════════════════════════════════════════════════════
        public static GameObject CreateShoulderAnatomy(Transform parent, Material matBone)
        {
            var root = new GameObject("Anatomy_Shoulder");
            root.layer = LAYER_BONE_XRAY;
            root.transform.SetParent(parent, false);
            root.transform.localPosition = LOCAL_POS_SHOULDER;

            // 1. Cabeza Humeral esférica articulada (12.2 cm de diámetro)
            CreateBonePart("Cabeza_Humeral", PrimitiveType.Sphere, root.transform,
                new Vector3(0.055f, 0f, 0.020f), Quaternion.identity,
                new Vector3(0.122f, 0.108f, 0.122f), matBone);

            // 2. Tuberosidad Mayor (Troquíter) superolateral para inserción del supraespinoso
            CreateBonePart("Troquiter", PrimitiveType.Capsule, root.transform,
                new Vector3(0.100f, 0f, 0.052f), Quaternion.Euler(0f, 0f, -24f),
                new Vector3(0.046f, 0.052f, 0.042f), matBone);

            // 3. Tuberosidad Menor (Troquín) anterior y corredera bicipital
            CreateBonePart("Troquin", PrimitiveType.Capsule, root.transform,
                new Vector3(0.058f, 0.018f, 0.070f), Quaternion.identity,
                new Vector3(0.034f, 0.038f, 0.034f), matBone);

            // 4. Cuello Quirúrgico cilíndrico
            CreateBonePart("Cuello_Quirurgico", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.072f, 0f, -0.048f), Quaternion.Euler(86f, 0f, -6f),
                new Vector3(0.060f, 0.042f, 0.060f), matBone);

            // 5. Diáfisis Humeral descendente (Cuerpo)
            CreateBonePart("Diafisis_Humero_Media", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.082f, 0f, -0.118f), Quaternion.Euler(86f, 0f, -6f),
                new Vector3(0.054f, 0.052f, 0.054f), matBone);

            // 6. Tuberosidad Deltoidea (Relieve cortical lateral)
            CreateBonePart("Tuberosidad_Deltoidea", PrimitiveType.Cube, root.transform,
                new Vector3(0.106f, 0f, -0.108f), Quaternion.Euler(0f, 0f, -14f),
                new Vector3(0.022f, 0.028f, 0.038f), matBone);

            // 7. Cavidad Glenoidea con espacio articular glenohumeral visible (4-5mm)
            CreateBonePart("Cavidad_Glenoidea", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.026f, 0f, 0.020f), Quaternion.Euler(86f, 0f, 8f),
                new Vector3(0.040f, 0.082f, 0.042f), matBone);

            // 8. Cuello Escapular y Pilar Axilar (Borde lateral de la escápula)
            CreateBonePart("Cuello_Escapula", PrimitiveType.Cube, root.transform,
                new Vector3(-0.065f, 0f, 0.012f), Quaternion.Euler(0f, 0f, 14f),
                new Vector3(0.052f, 0.038f, 0.072f), matBone);

            CreateBonePart("Pilar_Axilar_Escapula", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.080f, 0f, -0.065f), Quaternion.Euler(72f, 0f, 22f),
                new Vector3(0.044f, 0.062f, 0.044f), matBone);

            // 9. Acromion horizontal formando el arco subacromial
            CreateBonePart("Acromion", PrimitiveType.Cube, root.transform,
                new Vector3(0.012f, 0f, 0.120f), Quaternion.Euler(0f, 0f, -10f),
                new Vector3(0.125f, 0.032f, 0.052f), matBone);

            // 10. Apófisis Coracoides anterior en gancho
            CreateBonePart("Apofisis_Coracoides", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.012f, 0.014f, 0.078f), Quaternion.Euler(28f, 0f, -36f),
                new Vector3(0.026f, 0.042f, 0.026f), matBone);

            // 11. Clavícula Distal articulada (Articulación acromioclavicular)
            CreateBonePart("Clavicula_Distal", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.072f, 0f, 0.138f), Quaternion.Euler(0f, 0f, 74f),
                new Vector3(0.036f, 0.068f, 0.036f), matBone);

            return root;
        }

        // ════════════════════════════════════════════════════════════════════════
        // 2. ANATOMÍA DEL FÉMUR (Anatomy_Femur) — Con Fractura Oblicua Realista
        // ════════════════════════════════════════════════════════════════════════
        public static GameObject CreateFemurAnatomy(Transform parent, Material matBone)
        {
            var root = new GameObject("Anatomy_Femur");
            root.layer = LAYER_BONE_XRAY;
            root.transform.SetParent(parent, false);
            root.transform.localPosition = LOCAL_POS_FEMUR;

            // 1. Cabeza Femoral Esférica medial (+Z cefálico, -X medial)
            CreateBonePart("Cabeza_Femoral", PrimitiveType.Sphere, root.transform,
                new Vector3(-0.040f, 0f, 0.165f), Quaternion.identity,
                new Vector3(0.086f, 0.082f, 0.086f), matBone);

            // 2. Cuello Femoral con ángulo cérvico-diafisario anatómico de 128°
            CreateBonePart("Cuello_Femoral", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.018f, 0f, 0.138f), Quaternion.Euler(0f, 0f, -38f),
                new Vector3(0.044f, 0.042f, 0.044f), matBone);

            // 3. Trocánter Mayor (Saliente lateral prominente con bisel)
            CreateBonePart("Trocanter_Mayor", PrimitiveType.Capsule, root.transform,
                new Vector3(0.040f, 0f, 0.128f), Quaternion.Euler(0f, 0f, -14f),
                new Vector3(0.048f, 0.062f, 0.048f), matBone);

            CreateBonePart("Trocanter_Base", PrimitiveType.Cube, root.transform,
                new Vector3(0.032f, 0f, 0.098f), Quaternion.Euler(0f, 0f, -10f),
                new Vector3(0.044f, 0.038f, 0.055f), matBone);

            // 4. Trocánter Menor (Saliente posteromedial inferior al cuello)
            CreateBonePart("Trocanter_Menor", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.024f, 0f, 0.086f), Quaternion.Euler(0f, 0f, 38f),
                new Vector3(0.026f, 0.026f, 0.026f), matBone);

            // 5. Metáfisis Proximal Femoral
            CreateBonePart("Metafisis_Proximal", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.005f, 0f, 0.092f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.062f, 0.032f, 0.060f), matBone);

            // 6. Diáfisis Proximal (Fragmento Proximal de la fractura)
            CreateBonePart("Diafisis_Prox_1", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.002f, 0f, 0.056f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.056f, 0.035f, 0.056f), matBone);

            CreateBonePart("Diafisis_Prox_2", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.000f, 0f, 0.024f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.052f, 0.032f, 0.052f), matBone);

            // 7. Bisel Oblicuo de Fractura Proximal (Espícula cortante biselada a 36°)
            CreateBonePart("Bisel_Proximal", PrimitiveType.Cube, root.transform,
                new Vector3(0.010f, 0f, 0.004f), Quaternion.Euler(0f, 0f, -36f),
                new Vector3(0.036f, 0.042f, 0.032f), matBone);

            CreateBonePart("Espicula_Proximal", PrimitiveType.Cube, root.transform,
                new Vector3(0.022f, 0f, -0.006f), Quaternion.Euler(0f, 0f, -28f),
                new Vector3(0.014f, 0.022f, 0.026f), matBone);

            // 8. Tercer Fragmento Óseo Cortical en Cuña ("Ala de Mariposa" en foco de fractura)
            CreateBonePart("Fragmento_Ala_Mariposa", PrimitiveType.Cube, root.transform,
                new Vector3(-0.016f, 0f, -0.003f), Quaternion.Euler(14f, 18f, 32f),
                new Vector3(0.020f, 0.028f, 0.032f), matBone);

            // 9. Fragmento Distal Desplazado (Desplazamiento transversal y cabalgamiento clínico)
            CreateBonePart("Bisel_Distal", PrimitiveType.Cube, root.transform,
                new Vector3(-0.012f, 0f, -0.020f), Quaternion.Euler(0f, 0f, -36f),
                new Vector3(0.036f, 0.042f, 0.032f), matBone);

            CreateBonePart("Espicula_Distal", PrimitiveType.Cube, root.transform,
                new Vector3(-0.028f, 0f, -0.010f), Quaternion.Euler(0f, 0f, -30f),
                new Vector3(0.012f, 0.022f, 0.024f), matBone);

            // 10. Diáfisis Distal descendente
            CreateBonePart("Diafisis_Dist_1", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.010f, 0f, -0.050f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.052f, 0.032f, 0.052f), matBone);

            CreateBonePart("Diafisis_Dist_2", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.010f, 0f, -0.088f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.056f, 0.035f, 0.056f), matBone);

            // 11. Metáfisis Distal (Ensanchamiento supracondíleo)
            CreateBonePart("Metafisis_Distal", PrimitiveType.Cube, root.transform,
                new Vector3(-0.010f, 0f, -0.128f), Quaternion.identity,
                new Vector3(0.072f, 0.042f, 0.038f), matBone);

            // 12. Cóndilos Femorales Distales (Medial y Lateral con escotadura intercondílea)
            CreateBonePart("Condilo_Medial", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.036f, 0f, -0.162f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.038f, 0.040f, 0.044f), matBone);

            CreateBonePart("Condilo_Lateral", PrimitiveType.Capsule, root.transform,
                new Vector3(0.016f, 0f, -0.162f), Quaternion.Euler(90f, 0f, 0f),
                new Vector3(0.040f, 0.040f, 0.044f), matBone);

            return root;
        }

        // ════════════════════════════════════════════════════════════════════════
        // 3. ANATOMÍA DE PELVIS Y COTILO (Anatomy_Pelvis) — Criterios Judet
        // ════════════════════════════════════════════════════════════════════════
        public static GameObject CreatePelvisAnatomy(Transform parent, Material matBone)
        {
            var root = new GameObject("Anatomy_Pelvis");
            root.layer = LAYER_BONE_XRAY;
            root.transform.SetParent(parent, false);
            root.transform.localPosition = LOCAL_POS_PELVIS;

            // 1. Techo Acetabular (Ceja cotiloidea densa para proyección de Judet)
            CreateBonePart("Techo_Acetabulo", PrimitiveType.Capsule, root.transform,
                new Vector3(0.005f, 0f, 0.032f), Quaternion.Euler(0f, 0f, 42f),
                new Vector3(0.052f, 0.062f, 0.052f), matBone);

            CreateBonePart("Fondo_Acetabulo", PrimitiveType.Sphere, root.transform,
                new Vector3(-0.015f, 0f, 0.010f), Quaternion.identity,
                new Vector3(0.044f, 0.032f, 0.044f), matBone);

            // 2. Cabeza Femoral Articulada en el Cotilo (Permite evaluar la relación coxofemoral)
            CreateBonePart("Cabeza_Femur_Articulada", PrimitiveType.Sphere, root.transform,
                new Vector3(0.018f, 0f, 0.008f), Quaternion.identity,
                new Vector3(0.076f, 0.068f, 0.076f), matBone);

            CreateBonePart("Cuello_Femoral_Articulado", PrimitiveType.Cylinder, root.transform,
                new Vector3(0.054f, 0f, -0.018f), Quaternion.Euler(0f, 0f, -46f),
                new Vector3(0.038f, 0.034f, 0.038f), matBone);

            CreateBonePart("Trocanter_Mayor_Cadera", PrimitiveType.Capsule, root.transform,
                new Vector3(0.092f, 0f, -0.038f), Quaternion.Euler(0f, 0f, 14f),
                new Vector3(0.044f, 0.052f, 0.044f), matBone);

            // 3. Ala Ilíaca y Cresta Ilíaca Curva
            CreateBonePart("Pala_Iliaca", PrimitiveType.Cube, root.transform,
                new Vector3(-0.035f, 0f, 0.095f), Quaternion.Euler(0f, 0f, 18f),
                new Vector3(0.115f, 0.024f, 0.105f), matBone);

            CreateBonePart("Cresta_Iliaca_Curva_1", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.010f, 0f, 0.155f), Quaternion.Euler(0f, 0f, 68f),
                new Vector3(0.042f, 0.072f, 0.042f), matBone);

            CreateBonePart("Cresta_Iliaca_Curva_2", PrimitiveType.Capsule, root.transform,
                new Vector3(-0.078f, 0f, 0.128f), Quaternion.Euler(0f, 0f, 22f),
                new Vector3(0.042f, 0.068f, 0.042f), matBone);

            // 4. Espina Ilíaca Anterosuperior (EIAS)
            CreateBonePart("EIAS_Espina", PrimitiveType.Sphere, root.transform,
                new Vector3(-0.100f, 0f, 0.078f), Quaternion.identity,
                new Vector3(0.034f, 0.028f, 0.034f), matBone);

            // 5. Agujero Obturador y Columnas de Judet:
            // Columna Anterior: Rama Iliopubiana superior
            CreateBonePart("Rama_Iliopubiana_ColAnt", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.042f, 0f, -0.048f), Quaternion.Euler(0f, 0f, 42f),
                new Vector3(0.030f, 0.052f, 0.030f), matBone);

            // Rama Isquiopubiana inferior (Cierre del foramen obturador)
            CreateBonePart("Rama_Isquiopubiana_Inf", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.076f, 0f, -0.102f), Quaternion.Euler(0f, 0f, 82f),
                new Vector3(0.028f, 0.052f, 0.028f), matBone);

            // Columna Posterior: Cuerpo del Isquion
            CreateBonePart("Cuerpo_Isquion_ColPost", PrimitiveType.Cylinder, root.transform,
                new Vector3(-0.050f, 0f, -0.048f), Quaternion.Euler(0f, 0f, -20f),
                new Vector3(0.036f, 0.048f, 0.036f), matBone);

            // Tuberosidad Isquiática (Apoyo isquiático radiopaco)
            CreateBonePart("Tuberosidad_Isquiatica", PrimitiveType.Sphere, root.transform,
                new Vector3(-0.058f, 0f, -0.090f), Quaternion.identity,
                new Vector3(0.042f, 0.038f, 0.042f), matBone);

            // 6. Sínfisis del Pubis
            CreateBonePart("Sinfisis_Pubis", PrimitiveType.Cube, root.transform,
                new Vector3(-0.098f, 0f, -0.082f), Quaternion.identity,
                new Vector3(0.042f, 0.032f, 0.042f), matBone);

            // 7. Alerón Sacro y Articulación Sacroilíaca
            CreateBonePart("Aleron_Sacro", PrimitiveType.Cube, root.transform,
                new Vector3(0.035f, 0f, 0.095f), Quaternion.identity,
                new Vector3(0.058f, 0.034f, 0.078f), matBone);

            return root;
        }
    }
}
