using System;
using System.IO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using CArmSimulator.Core;
using CArmSimulator.Data;
using CArmSimulator.UI;
using CArmSimulator.Minigames;
using CArmSimulator.Minigames.ProtocolZero;
using CArmSimulator.Minigames.BeamMaster;
using CArmSimulator.Minigames.IsocenterCommand;
using CArmSimulator.Audio;
using TMPro;

namespace CArmSimulator.Editor
{
    /// <summary>
    /// Automated Wizard to construct the 3D C-Arm Rig, Surgical Table, Bone target,
    /// RenderTexture, Neon-Cyan Canvas HUD, and wire all SerializedField references in Unity 6 URP.
    /// Accessible via menu: "CArm Simulator/1. Generar Escena Completa, Rig 3D y HUD"
    /// </summary>
    [InitializeOnLoad]
    public static class CArmSceneSetupWizard
    {
        static CArmSceneSetupWizard()
        {
            CheckTrigger();
            EditorApplication.update += CheckTrigger;
            EditorApplication.playModeStateChanged += (state) => CheckTrigger();
        }

        private static void CheckTrigger()
        {
            string trigger = Path.Combine(Application.dataPath, "../Temp/TriggerSceneRegen.txt");
            if (!File.Exists(trigger)) return;

            if (EditorApplication.isPlaying)
            {
                Debug.Log("[CArmSetup] Saliendo de Play Mode para regenerar la escena...");
                EditorApplication.isPlaying = false;
                return;
            }

            try { File.Delete(trigger); } catch { }
            File.AppendAllText("Temp/setup_status.txt", "CheckTrigger: Trigger detected at " + DateTime.Now + "\n");
            Debug.Log("[CArmSetup] Auto-regenerando escena y prefab por solicitud...");
            
            AssetDatabase.Refresh();
            if (EditorApplication.isCompiling)
            {
                File.AppendAllText("Temp/setup_status.txt", "Waiting for compilation to finish at " + DateTime.Now + "\n");
                File.WriteAllText(trigger, "pending");
                return;
            }

            try
            {
                File.AppendAllText("Temp/setup_status.txt", "Calling GenerateCompleteSceneAndHUD at " + DateTime.Now + "\n");
                GenerateCompleteSceneAndHUD(silent: true);
                File.AppendAllText("Temp/setup_status.txt", "GenerateCompleteSceneAndHUD returned at " + DateTime.Now + "\n");
            }
            catch (Exception ex)
            {
                File.AppendAllText("Temp/setup_status.txt", "CheckTrigger EXCEPTION: " + ex.ToString() + "\n");
                Debug.LogError("[CArmSetup] Exception in CheckTrigger: " + ex);
            }
        }
        private const int LAYER_BONE_XRAY = 8;
        private const string LAYER_NAME = "BoneXRay";

        // HUD Neon Cyan Palette
        private static readonly Color HUD_BG_DARK       = new Color(6f / 255f, 20f / 255f, 27f / 255f, 0.88f);
        private static readonly Color HUD_PANEL_BG      = new Color(10f / 255f, 28f / 255f, 38f / 255f, 0.92f);
        private static readonly Color HUD_CYAN_NEON     = new Color(0f, 240f / 255f, 1f, 1f);
        private static readonly Color HUD_CYAN_DIM      = new Color(0f, 160f / 255f, 180f / 255f, 0.7f);
        private static readonly Color HUD_CYAN_HIGH_CONTRAST = new Color(102f / 255f, 247f / 255f, 1f, 1f); // #66F7FF
        private static readonly Color HUD_ACCENT_RED    = new Color(255f / 255f, 65f / 255f, 65f / 255f, 1f);
        private static readonly Color HUD_ACCENT_YEL    = new Color(255f / 255f, 200f / 255f, 0f, 1f);
        private static readonly Color HUD_ACCENT_GREEN  = new Color(25f / 255f, 225f / 255f, 90f / 255f, 1f);
        private static readonly Color HUD_TEXT_LIGHT    = new Color(240f / 255f, 250f / 255f, 255f / 255f, 1f);
        private static readonly Color HUD_TEXT_DARK     = new Color(10f / 255f, 21f / 255f, 30f / 255f, 1f); // #0A151E
        private static readonly Color HUD_BTN_DARK      = new Color(14f / 255f, 34f / 255f, 46f / 255f, 1f);
        private static readonly Color HUD_TRAP_RED      = new Color(75f / 255f, 18f / 255f, 24f / 255f, 1f);

        [MenuItem("CArm Simulator/1. Generar Escena Completa, Rig 3D y HUD", false, 1)]
        public static void GenerateCompleteSceneAndHUD()
        {
            GenerateCompleteSceneAndHUD(false);
        }

        public static void GenerateCompleteSceneAndHUD(bool silent)
        {
            bool batch = Application.isBatchMode || silent;
            File.AppendAllText("Temp/setup_status.txt", $"GenerateCompleteSceneAndHUD entered (batch={batch}, silent={silent}) at " + DateTime.Now + "\n");
            if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Iniciando configuración...", 0.05f);

            try
            {
                // 0. Ensure Scene1 is active
                string scenePath = "Assets/Scenes/Scene1.unity";
                var activeScene = EditorSceneManager.GetActiveScene();
                File.AppendAllText("Temp/setup_status.txt", $"Active scene: '{activeScene.path}', isDirty: {activeScene.isDirty} at " + DateTime.Now + "\n");
                if (File.Exists(scenePath) && activeScene.path != scenePath)
                {
                    EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);
                }

                // 1. TagManager & RenderTexture
                if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Configurando capas y RenderTexture...", 0.15f);
                EnsureLayer8BoneXRay();
                RenderTexture rt = EnsureRenderTexture();
                File.AppendAllText("Temp/setup_status.txt", "Step 1 (Layers & RT) done at " + DateTime.Now + "\n");

                // 2. 3D Rig & Operating Table
                if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Construyendo Rig 3D del Arco en C y Mesa Quirúrgica...", 0.35f);
                Setup3DSceneAndRig(rt, out GameObject carmRig, out Transform arcTransform, out Transform fractureTarget,
                    out ArcNodeLabel[] arcNodes, out PpeItem[] ppeItems, out ParticleSystem heatmapPS, out ParticleSystem comptonPS,
                    out Renderer collimatorIndicatorRenderer, out Light tubeEmissionLight);
                File.AppendAllText("Temp/setup_status.txt", "Step 2 (3D Rig & Table) done at " + DateTime.Now + "\n");

                // 3. Controllers & Configs
                if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Configurando Controladores y ScriptableObjects...", 0.55f);
                SetupControllersAndConfigs(out GameManager gm, out ProtocolZeroController pz,
                    out BeamMasterController bm, out IsocenterCommandController ic);
                File.AppendAllText("Temp/setup_status.txt", "Step 3 (Controllers) done at " + DateTime.Now + "\n");

                // 4. Canvas HUD Cyan Neon
                if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Construyendo Canvas HUD Cyan Neón...", 0.75f);
                SetupUIHUD(rt, gm, pz, bm, ic, out CArmUIController uiController);
                File.AppendAllText("Temp/setup_status.txt", "Step 4 (HUD) done at " + DateTime.Now + "\n");

                // 5. Wire SerializedFields
                if (!batch) EditorUtility.DisplayProgressBar("CArm Simulator Setup", "Cableando referencias SerializedField...", 0.90f);
                WireAllSerializedReferences(gm, pz, bm, ic, uiController, carmRig, arcTransform, fractureTarget,
                    arcNodes, ppeItems, heatmapPS, comptonPS, collimatorIndicatorRenderer, tubeEmissionLight);
                File.AppendAllText("Temp/setup_status.txt", "Step 5 (Wire) done at " + DateTime.Now + "\n");

                // 6. Save Prefab & Mark Scene Dirty
                SavePrefabAndScene(carmRig);
                File.AppendAllText("Temp/setup_status.txt", "Step 6 (Save) done at " + DateTime.Now + "\n");

                if (!batch)
                {
                    EditorUtility.ClearProgressBar();
                    EditorUtility.DisplayDialog("CArm Simulator Setup",
                        "¡Montaje Automatizado Completado con Éxito!\n\n" +
                        "✓ Capa 8 'BoneXRay' verificada en TagManager.\n" +
                        "✓ RenderTexture 'RT_Fluoroscope' (512x512) creada y conectada.\n" +
                        "✓ Rig 3D 'CArm_Rig' con isocentro pivote (0,0,0) ensamblado y guardado como Prefab.\n" +
                        "✓ Mesa quirúrgica con 'Fracture_Target' alineado al isocentro.\n" +
                        "✓ EventSystem (New Input System) y PhysicsRaycaster configurados.\n" +
                        "✓ Canvas HUD Cyan Neón completo con monitor fluoroscópico, tarjeta Dra. Nova, 3 columnas de orden bucle cerrado y botones trampa.\n" +
                        "✓ Todas las referencias serializadas cableadas y escena guardada.",
                        "Entendido");
                }
                Debug.Log("[CArmSetupWizard] ✓ Generación completa finalizada con éxito.");
                File.AppendAllText("Temp/setup_status.txt", "GenerateCompleteSceneAndHUD SUCCESS at " + DateTime.Now + "\n");
            }
            catch (Exception ex)
            {
                if (!batch)
                {
                    EditorUtility.ClearProgressBar();
                    EditorUtility.DisplayDialog("Error en el Setup", $"Ocurrió un error: {ex.Message}", "Cerrar");
                }
                Debug.LogError($"[CArmSetupWizard] Error durante la generación: {ex}");
                File.AppendAllText("Temp/setup_status.txt", "GenerateCompleteSceneAndHUD ERROR: " + ex + "\n");
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // 1. TagManager & RenderTexture Setup
        // ════════════════════════════════════════════════════════════════════

        private static void EnsureLayer8BoneXRay()
        {
            var tagManagerAsset = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset");
            if (tagManagerAsset == null || tagManagerAsset.Length == 0) return;

            var tagManager = new SerializedObject(tagManagerAsset[0]);
            var layersProp = tagManager.FindProperty("layers");
            if (layersProp != null && layersProp.isArray && layersProp.arraySize > LAYER_BONE_XRAY)
            {
                var layer8Prop = layersProp.GetArrayElementAtIndex(LAYER_BONE_XRAY);
                if (layer8Prop.stringValue != LAYER_NAME)
                {
                    layer8Prop.stringValue = LAYER_NAME;
                    tagManager.ApplyModifiedProperties();
                    Debug.Log($"[CArmSetup] Capa {LAYER_BONE_XRAY} '{LAYER_NAME}' configurada en TagManager.");
                }
            }
        }

        private static RenderTexture EnsureRenderTexture()
        {
            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder("Assets/_Project"))
                AssetDatabase.CreateFolder("Assets", "_Project");
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            string path = $"{folder}/RT_Fluoroscope.renderTexture";
            var rt = AssetDatabase.LoadAssetAtPath<RenderTexture>(path);
            if (rt == null)
            {
                rt = new RenderTexture(512, 512, 16, RenderTextureFormat.ARGB32)
                {
                    name = "RT_Fluoroscope",
                    filterMode = FilterMode.Bilinear,
                    wrapMode = TextureWrapMode.Clamp
                };
                AssetDatabase.CreateAsset(rt, path);
                AssetDatabase.SaveAssets();
                Debug.Log($"[CArmSetup] RenderTexture creada en {path}");
            }
            return rt;
        }

        // ════════════════════════════════════════════════════════════════════
        // 2. 3D Scene, C-Arm Rig, and Operating Table Setup
        // ════════════════════════════════════════════════════════════════════

        private static void Setup3DSceneAndRig(
            RenderTexture rt,
            out GameObject carmRig,
            out Transform arcTransform,
            out Transform fractureTarget,
            out ArcNodeLabel[] arcNodes,
            out PpeItem[] ppeItems,
            out ParticleSystem heatmapPS,
            out ParticleSystem comptonPS,
            out Renderer collimatorIndicatorRenderer,
            out Light tubeEmissionLight)
        {
            // Material placeholders (URP Lit & Unlit)
            Shader urpLit = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            Shader urpUnlit = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Unlit/Color") ?? urpLit;
            Material matDarkMetal   = new Material(urpLit) { name = "Mat_DarkMetal",   color = new Color(0.15f, 0.18f, 0.22f) };
            Material matLightGray   = new Material(urpLit) { name = "Mat_LightGray",   color = new Color(0.75f, 0.78f, 0.82f) };
            Material matCyanNeon    = new Material(urpLit) { name = "Mat_CyanNeon",    color = HUD_CYAN_NEON };
            Material matBone        = new Material(urpUnlit) { name = "Mat_BoneXRay",   color = new Color(0.92f, 0.94f, 0.90f, 1f) };
            Material matTable       = new Material(urpLit) { name = "Mat_OR_Table",    color = new Color(0.12f, 0.14f, 0.16f) };
            // Find or clean old Rig and duplicate scene objects
            GameObject oldRig;
            while ((oldRig = GameObject.Find("CArm_Rig")) != null)
            {
                UnityEngine.Object.DestroyImmediate(oldRig);
            }

            GameObject oldTable;
            while ((oldTable = GameObject.Find("Mesa_Quirurgica")) != null)
            {
                UnityEngine.Object.DestroyImmediate(oldTable);
            }

            GameObject oldCam;
            while ((oldCam = GameObject.Find("XRay_Camera")) != null)
            {
                UnityEngine.Object.DestroyImmediate(oldCam);
            }

            // Material para Tubo Emisor: monobloque cobre/metálico #B85D19 (R:184, G:93, B:25)
            Material matTubeMonoblock = new Material(urpLit) { name = "Mat_TubeMonoblock", color = new Color(184f / 255f, 93f / 255f, 25f / 255f) };
            matTubeMonoblock.SetFloat("_Metallic", 0.80f);
            matTubeMonoblock.SetFloat("_Smoothness", 0.65f);

            // Blanco clínico para columna vertical, brazo y detector plano
            Material matClinicalWhite = new Material(urpLit) { name = "Mat_ClinicalWhite", color = new Color(0.92f, 0.94f, 0.96f) };
            matClinicalWhite.SetFloat("_Smoothness", 0.70f);

            // Anillo indicador emisor naranja brillante
            Material matOrangeIndicator = new Material(urpLit) { name = "Mat_OrangeIndicator", color = new Color(1f, 0.45f, 0f) };
            matOrangeIndicator.EnableKeyword("_EMISSION");
            matOrangeIndicator.SetColor("_EmissionColor", new Color(1f, 0.40f, 0f) * 1.5f);

            Material matDetAluminum = new Material(urpLit) { name = "Mat_DetAluminum", color = new Color(0.72f, 0.76f, 0.80f) };
            matDetAluminum.SetFloat("_Metallic", 0.65f);
            matDetAluminum.SetFloat("_Smoothness", 0.60f);

            Material matActiveCarbon= new Material(urpLit) { name = "Mat_ActiveCarbon",color = new Color(0.10f, 0.12f, 0.14f) };

            // ── Root CArm_Rig ───────────────────────────────────────────────
            carmRig = new GameObject("CArm_Rig");
            carmRig.transform.position = new Vector3(0f, 0f, 0.90f);

            // 1. Base_Ruedas (Chasis rodante bajo a la izquierda de la mesa con estructura en "U" y frenos)
            var baseGO = new GameObject("Base_Ruedas");
            baseGO.transform.SetParent(carmRig.transform, false);
            baseGO.transform.localPosition = new Vector3(-0.95f, 0.06f, 0f);
            baseGO.transform.localScale = Vector3.one;

            var baseBody = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseBody.name = "Cuerpo_Chasis";
            baseBody.transform.SetParent(baseGO.transform, false);
            baseBody.transform.localPosition = Vector3.zero;
            baseBody.transform.localScale = new Vector3(0.32f, 0.08f, 0.60f);
            baseBody.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // Dos patas delanteras bajas que se proyectan hacia la mesa (+X) en estructura "U"
            var legFrontCef = GameObject.CreatePrimitive(PrimitiveType.Cube);
            legFrontCef.name = "Pata_Delantera_Cefalica";
            legFrontCef.transform.SetParent(baseGO.transform, false);
            legFrontCef.transform.localPosition = new Vector3(0.24f, -0.01f, 0.25f);
            legFrontCef.transform.localScale = new Vector3(0.32f, 0.06f, 0.10f);
            legFrontCef.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var legFrontCaud = GameObject.CreatePrimitive(PrimitiveType.Cube);
            legFrontCaud.name = "Pata_Delantera_Caudal";
            legFrontCaud.transform.SetParent(baseGO.transform, false);
            legFrontCaud.transform.localPosition = new Vector3(0.24f, -0.01f, -0.25f);
            legFrontCaud.transform.localScale = new Vector3(0.32f, 0.06f, 0.10f);
            legFrontCaud.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // 4 Ruedas cilíndricas del chasis móvil
            Vector3[] wheelOffsets = new Vector3[]
            {
                new Vector3(-0.14f, -0.03f, 0.25f),
                new Vector3(-0.14f, -0.03f, -0.25f),
                new Vector3(0.36f, -0.03f, 0.25f),
                new Vector3(0.36f, -0.03f, -0.25f)
            };
            for (int w = 0; w < wheelOffsets.Length; w++)
            {
                var wheel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                wheel.name = $"Rueda_{w + 1}";
                wheel.transform.SetParent(baseGO.transform, false);
                wheel.transform.localPosition = wheelOffsets[w];
                wheel.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
                wheel.transform.localScale = new Vector3(0.06f, 0.03f, 0.06f);
                wheel.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;
            }

            // Palanca de freno del sistema mecánico
            var brakeLever = GameObject.CreatePrimitive(PrimitiveType.Cube);
            brakeLever.name = "Palanca_Freno";
            brakeLever.transform.SetParent(baseGO.transform, false);
            brakeLever.transform.localPosition = new Vector3(-0.16f, 0.08f, 0f);
            brakeLever.transform.localRotation = Quaternion.Euler(20f, 0f, 0f);
            brakeLever.transform.localScale = new Vector3(0.04f, 0.12f, 0.04f);
            brakeLever.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var colBase = baseGO.AddComponent<BoxCollider>();
            colBase.size = new Vector3(0.70f, 0.14f, 0.70f);
            var nodeBrakes = baseGO.AddComponent<ArcComponent>();
            nodeBrakes.nodeType = ArcNodeType.BrakeSystem;
            nodeBrakes.displayName = "Sistema de Frenos y Chasis Móvil";
            nodeBrakes.educationalNote = "Chasis con bloqueo mecánico central para fijar la posición durante la radioscopia.";

            // 2. Columna_Vertical (Blanca en X = -0.95f, Z = 0f)
            var colGO = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            colGO.name = "Columna_Vertical";
            colGO.transform.SetParent(carmRig.transform, false);
            colGO.transform.localPosition = new Vector3(-0.95f, 0.58f, 0f);
            colGO.transform.localScale = new Vector3(0.18f, 0.48f, 0.18f); // Altura = 2 * 0.48 = 0.96m
            colGO.GetComponent<MeshRenderer>().sharedMaterial = matClinicalWhite;

            // Manubrios laterales para empuje y transporte
            var handleColL = GameObject.CreatePrimitive(PrimitiveType.Cube);
            handleColL.name = "Manubrio_Columna_Cefalico";
            handleColL.transform.SetParent(carmRig.transform, false);
            handleColL.transform.localPosition = new Vector3(-0.95f, 0.85f, 0.14f);
            handleColL.transform.localScale = new Vector3(0.03f, 0.03f, 0.12f);
            handleColL.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var handleColR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            handleColR.name = "Manubrio_Columna_Caudal";
            handleColR.transform.SetParent(carmRig.transform, false);
            handleColR.transform.localPosition = new Vector3(-0.95f, 0.85f, -0.14f);
            handleColR.transform.localScale = new Vector3(0.03f, 0.03f, 0.12f);
            handleColR.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // Consola de Control inclinada montada en la columna
            var consoleGO = GameObject.CreatePrimitive(PrimitiveType.Cube);
            consoleGO.name = "Consola_Control";
            consoleGO.transform.SetParent(carmRig.transform, false);
            consoleGO.transform.localPosition = new Vector3(-1.02f, 0.98f, -0.12f);
            consoleGO.transform.localRotation = Quaternion.Euler(25f, -25f, 0f);
            consoleGO.transform.localScale = new Vector3(0.24f, 0.18f, 0.08f);
            consoleGO.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var consoleScreen = GameObject.CreatePrimitive(PrimitiveType.Cube);
            consoleScreen.name = "Pantalla_Consola";
            consoleScreen.transform.SetParent(consoleGO.transform, false);
            consoleScreen.transform.localPosition = new Vector3(0f, 0.02f, 0.045f);
            consoleScreen.transform.localScale = new Vector3(0.85f, 0.65f, 0.05f);
            consoleScreen.GetComponent<MeshRenderer>().sharedMaterial = matCyanNeon;

            EnsureBoxCollider(consoleGO);
            var nodeConsole = consoleGO.AddComponent<ArcComponent>();
            nodeConsole.nodeType = ArcNodeType.ControlPanel;
            nodeConsole.displayName = "Consola de Control";
            nodeConsole.educationalNote = "Permite regular kVp, mA, colimación y monitorear el calor acumulado en el ánodo.";

            // 3. Eje_Longitudinal (Brazo Horizontal Telescópico desde Columna X=-0.95f hasta Cuna X=-0.56f en Y=0.85f)
            var ejeLongGO = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ejeLongGO.name = "Eje_Longitudinal";
            ejeLongGO.transform.SetParent(carmRig.transform, false);
            ejeLongGO.transform.localPosition = new Vector3(-0.755f, 0.85f, 0f);
            ejeLongGO.transform.localScale = new Vector3(0.39f, 0.14f, 0.14f);
            ejeLongGO.GetComponent<MeshRenderer>().sharedMaterial = matClinicalWhite;

            var collarinGO = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            collarinGO.name = "Collarin_Telescopico";
            collarinGO.transform.SetParent(ejeLongGO.transform, false);
            collarinGO.transform.localPosition = new Vector3(0.12f, 0f, 0f);
            collarinGO.transform.localRotation = Quaternion.Euler(0f, 0f, 90f);
            collarinGO.transform.localScale = new Vector3(0.16f, 0.14f, 0.16f);
            collarinGO.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // 4. Cuna_Orbital (Cradle mecánico soporte del arco: Position = (-0.56f, 0.85f, 0f), Scale = (0.12f, 0.22f, 0.16f))
            var cunaGO = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cunaGO.name = "Cuna_Orbital";
            cunaGO.transform.SetParent(carmRig.transform, false);
            cunaGO.transform.localPosition = new Vector3(-0.56f, 0.85f, 0f);
            cunaGO.transform.localScale = new Vector3(0.12f, 0.22f, 0.16f);
            cunaGO.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // 5. Brazo Orbital e Isocentro — Pivote exactamente en (0f, 0.85f, 0f) coincidiendo con Fracture_Target
            //    ESTADO INICIAL: 180° en EJE X = Tubo arriba (inseguro) para Protocolo Cero, lomo C fijo a la izquierda.
            var isocenterGO = new GameObject("Brazo_Orbital_Isocentro");
            isocenterGO.transform.SetParent(carmRig.transform, false);
            isocenterGO.transform.localPosition = new Vector3(0f, 0.85f, 0f);
            isocenterGO.transform.localEulerAngles = new Vector3(180f, 0f, 0f);
            arcTransform = isocenterGO.transform;

            EnsureBoxCollider(isocenterGO);
            var nodeArc = isocenterGO.AddComponent<ArcComponent>();
            nodeArc.nodeType = ArcNodeType.OrbitalCArm;
            nodeArc.displayName = "Brazo Orbital en C";
            nodeArc.educationalNote = "Soporte semicircular articulado que permite rotaciones angulares y orbitales manteniendo el isocentro.";

            // 6. Riel Curvo en C (Arco_Curvo_Mesh) — Radio R = 0.56f, 20 segmentos continuos desde 82° (arriba) hasta 278° (abajo)
            float arcRadius = 0.56f;
            const int ARC_SEGMENT_COUNT = 20;
            for (int s = 0; s < ARC_SEGMENT_COUNT; s++)
            {
                float angleDeg = Mathf.Lerp(82f, 278f, (float)s / (ARC_SEGMENT_COUNT - 1));
                float rad = angleDeg * Mathf.Deg2Rad;
                float segX = arcRadius * Mathf.Cos(rad);
                float segY = arcRadius * Mathf.Sin(rad);

                var segGO = GameObject.CreatePrimitive(PrimitiveType.Cube);
                segGO.name = $"Arco_Segmento_{s}";
                segGO.transform.SetParent(isocenterGO.transform, false);
                segGO.transform.localPosition = new Vector3(segX, segY, 0f);
                segGO.transform.localRotation = Quaternion.Euler(0f, 0f, angleDeg);
                segGO.transform.localScale = new Vector3(0.065f, 0.115f, 0.075f);
                segGO.GetComponent<MeshRenderer>().sharedMaterial = EnsureArcMetalMaterial();
            }

            // Soporte estructural superior hacia el detector plano
            var bracketDet = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bracketDet.name = "Soporte_Detector";
            bracketDet.transform.SetParent(isocenterGO.transform, false);
            bracketDet.transform.localPosition = new Vector3(0.04f, 0.50f, 0f);
            bracketDet.transform.localScale = new Vector3(0.09f, 0.08f, 0.08f);
            bracketDet.GetComponent<MeshRenderer>().sharedMaterial = EnsureArcMetalMaterial();

            // 7. Detector_Plano (Flat Panel en localPosition = (0f, +0.45f, 0f), Scale = (0.30f, 0.06f, 0.30f))
            var detectorGO = GameObject.CreatePrimitive(PrimitiveType.Cube);
            detectorGO.name = "Detector_Plano";
            detectorGO.transform.SetParent(isocenterGO.transform, false);
            detectorGO.transform.localPosition = new Vector3(0f, 0.45f, 0f);
            detectorGO.transform.localScale = new Vector3(0.30f, 0.06f, 0.30f);
            detectorGO.GetComponent<MeshRenderer>().sharedMaterial = matClinicalWhite;
            EnsureBoxCollider(detectorGO);

            // Borde Cyan Neón de alto contraste
            var detBorder = GameObject.CreatePrimitive(PrimitiveType.Cube);
            detBorder.name = "Borde_Cyan_Detector";
            detBorder.transform.SetParent(detectorGO.transform, false);
            detBorder.transform.localPosition = new Vector3(0f, -0.015f, 0f);
            detBorder.transform.localScale = new Vector3(0.31f, 0.008f, 0.31f);
            detBorder.GetComponent<MeshRenderer>().sharedMaterial = matCyanNeon;

            // Matriz activa de carbono en la cara inferior mirando hacia -Y (al isocentro / paciente)
            var carbonFace = GameObject.CreatePrimitive(PrimitiveType.Cube);
            carbonFace.name = "Matriz_Activa_Fluoroscopica";
            carbonFace.transform.SetParent(detectorGO.transform, false);
            carbonFace.transform.localPosition = new Vector3(0f, -0.031f, 0f);
            carbonFace.transform.localScale = new Vector3(0.27f, 0.004f, 0.27f);
            carbonFace.GetComponent<MeshRenderer>().sharedMaterial = matActiveCarbon;

            // Asas ergonómicas quirúrgicas laterales
            var handleDetL = GameObject.CreatePrimitive(PrimitiveType.Cube);
            handleDetL.name = "Asa_Izquierda";
            handleDetL.transform.SetParent(detectorGO.transform, false);
            handleDetL.transform.localPosition = new Vector3(-0.165f, 0f, 0f);
            handleDetL.transform.localScale = new Vector3(0.03f, 0.05f, 0.16f);
            handleDetL.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var handleDetR = GameObject.CreatePrimitive(PrimitiveType.Cube);
            handleDetR.name = "Asa_Derecha";
            handleDetR.transform.SetParent(detectorGO.transform, false);
            handleDetR.transform.localPosition = new Vector3(0.165f, 0f, 0f);
            handleDetR.transform.localScale = new Vector3(0.03f, 0.05f, 0.16f);
            handleDetR.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // Tira LED de estado Cyan Neón
            var ledStrip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            ledStrip.name = "LED_Estado_Fluoroscopia";
            ledStrip.transform.SetParent(detectorGO.transform, false);
            ledStrip.transform.localPosition = new Vector3(0f, 0.031f, 0.14f);
            ledStrip.transform.localScale = new Vector3(0.18f, 0.005f, 0.015f);
            ledStrip.GetComponent<MeshRenderer>().sharedMaterial = matCyanNeon;

            var nodeDetector = detectorGO.AddComponent<ArcComponent>();
            nodeDetector.nodeType = ArcNodeType.ImageIntensifier;
            nodeDetector.displayName = "Detector Plano (Flat Panel)";
            nodeDetector.educationalNote = "Receptor digital que convierte el haz transmitido en señal radiológica.";

            // Soporte estructural inferior hacia el tubo emisor
            var bracketTube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bracketTube.name = "Soporte_Tubo";
            bracketTube.transform.SetParent(isocenterGO.transform, false);
            bracketTube.transform.localPosition = new Vector3(0.04f, -0.50f, 0f);
            bracketTube.transform.localScale = new Vector3(0.09f, 0.08f, 0.08f);
            bracketTube.GetComponent<MeshRenderer>().sharedMaterial = EnsureArcMetalMaterial();

            // 8. Tubo_Emisor (Monobloque generador de rayos X en localPosition = (0f, -0.45f, 0f), BAJO la mesa)
            var tuboGO = new GameObject("Tubo_Emisor");
            tuboGO.transform.SetParent(isocenterGO.transform, false);
            tuboGO.transform.localPosition = new Vector3(0f, -0.45f, 0f);
            tuboGO.transform.localRotation = Quaternion.identity;

            // Carcasa horizontal robusta (Cube de 0.22 x 0.14 x 0.16) en cobre/metálico #B85D19
            var carcasaMonobloque = GameObject.CreatePrimitive(PrimitiveType.Cube);
            carcasaMonobloque.name = "Carcasa_Generador_Monobloque";
            carcasaMonobloque.transform.SetParent(tuboGO.transform, false);
            carcasaMonobloque.transform.localPosition = Vector3.zero;
            carcasaMonobloque.transform.localScale = new Vector3(0.22f, 0.14f, 0.16f);
            carcasaMonobloque.GetComponent<MeshRenderer>().sharedMaterial = matTubeMonoblock;

            // Cilindro colimador vertical (Cylinder de 0.12 x 0.08 x 0.12) apuntando hacia el isocentro (+Y)
            var colimadorSnout = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            colimadorSnout.name = "Cono_Colimador";
            colimadorSnout.transform.SetParent(tuboGO.transform, false);
            colimadorSnout.transform.localPosition = new Vector3(0f, 0.11f, 0f);
            colimadorSnout.transform.localScale = new Vector3(0.12f, 0.04f, 0.12f); // Altura = 2 * 0.04 = 0.08m
            colimadorSnout.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // Anillo indicador naranja brillante para identificar claramente el emisor
            var anilloIndicador = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            anilloIndicador.name = "Anillo_Indicador_Emision";
            anilloIndicador.transform.SetParent(colimadorSnout.transform, false);
            anilloIndicador.transform.localPosition = new Vector3(0f, 0.85f, 0f);
            anilloIndicador.transform.localScale = new Vector3(1.08f, 0.15f, 1.08f);
            anilloIndicador.GetComponent<MeshRenderer>().sharedMaterial = matOrangeIndicator;
            collimatorIndicatorRenderer = anilloIndicador.GetComponent<Renderer>();

            // Luz Spot de emisión de Rayos X (apuntando hacia el isocentro / paciente)
            var lightGO = new GameObject("Luz_Emision_RayosX");
            lightGO.transform.SetParent(colimadorSnout.transform, false);
            lightGO.transform.localPosition = new Vector3(0f, 1.05f, 0f);
            lightGO.transform.localRotation = Quaternion.Euler(-90f, 0f, 0f); // Apunta hacia +Y (isocentro / paciente)
            tubeEmissionLight = lightGO.AddComponent<Light>();
            tubeEmissionLight.type = LightType.Spot;
            tubeEmissionLight.color = new Color(1f, 0.65f, 0.2f); // Ámbar cálido de emisión radiológica
            tubeEmissionLight.range = 2.2f;
            tubeEmissionLight.spotAngle = 60f;
            tubeEmissionLight.innerSpotAngle = 35f;
            tubeEmissionLight.intensity = 0f;
            tubeEmissionLight.enabled = false;

            // Apertura de plomo en la boca del colimador
            var collimatorAperture = GameObject.CreatePrimitive(PrimitiveType.Cube);
            collimatorAperture.name = "Apertura_Colimador";
            collimatorAperture.transform.SetParent(colimadorSnout.transform, false);
            collimatorAperture.transform.localPosition = new Vector3(0f, 0.98f, 0f);
            collimatorAperture.transform.localScale = new Vector3(0.65f, 0.05f, 0.65f);
            collimatorAperture.GetComponent<MeshRenderer>().sharedMaterial = matActiveCarbon;

            // Aletas de disipación de calor
            var coolingFins = GameObject.CreatePrimitive(PrimitiveType.Cube);
            coolingFins.name = "Aletas_Disipacion";
            coolingFins.transform.SetParent(tuboGO.transform, false);
            coolingFins.transform.localPosition = new Vector3(0f, -0.075f, 0f);
            coolingFins.transform.localScale = new Vector3(0.20f, 0.02f, 0.14f);
            coolingFins.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            var colTubo = tuboGO.AddComponent<BoxCollider>();
            colTubo.size = new Vector3(0.24f, 0.24f, 0.24f);

            var nodeTubo = tuboGO.AddComponent<ArcComponent>();
            nodeTubo.nodeType = ArcNodeType.XRayTube;
            nodeTubo.displayName = "Tubo Emisor de Rayos X";
            nodeTubo.educationalNote = "Debe ubicarse debajo de la mesa para que el haz primario no rebote directamente al rostro del cirujano.";

            // ── XRay Camera — hijo de la ESCENA (NO del detector) ──────────────
            // Al no ser hijo del Brazo_Orbital_Isocentro, no rota con el arco
            // y siempre mantiene la imagen del fluoroscopio derecha.
            var camGO = new GameObject("XRay_Camera");
            camGO.transform.SetParent(null, false); // Raíz de la escena
            // Posicionamos encima del objetivo anatómico apuntando hacia abajo
            camGO.transform.position = new Vector3(0f, 1.6f, 0.90f);
            camGO.transform.rotation = Quaternion.Euler(90f, 0f, 0f); // Mira hacia -Y (isocentro anatómico)
            var xrayCam = camGO.AddComponent<Camera>();
            xrayCam.orthographic = true;
            xrayCam.orthographicSize = 0.22f; // Campo de visión focalizado en 0.44m para que las siluetas óseas ocupen el monitor
            xrayCam.clearFlags = CameraClearFlags.SolidColor;
            xrayCam.backgroundColor = Color.black;
            xrayCam.cullingMask = 1 << LAYER_BONE_XRAY;
            xrayCam.targetTexture = rt;
            xrayCam.nearClipPlane = 0.01f;
            xrayCam.farClipPlane = 1.5f;

            // ── Mesa Quirúrgica Radiolúcida en Voladizo ───────────────────────
            var tableGO = new GameObject("Mesa_Quirurgica");
            tableGO.transform.position = new Vector3(0f, 0f, 0.90f);

            // 1. Tablero radiolúcido de fibra de carbono (Position = (0f, 0.78f, 0f), Scale = (0.54f, 0.04f, 1.85f))
            var topTable = GameObject.CreatePrimitive(PrimitiveType.Cube);
            topTable.name = "Tablero_Radiolucido";
            topTable.transform.SetParent(tableGO.transform, false);
            topTable.transform.localPosition = new Vector3(0f, 0.78f, 0f);
            topTable.transform.localScale = new Vector3(0.54f, 0.04f, 1.85f);
            topTable.GetComponent<MeshRenderer>().sharedMaterial = matTable;

            // 2. Columna / pedestal de soporte desplazado al extremo posterior (+Z = +0.72f, Y = 0.39f, Scale = (0.28f, 0.78f, 0.28f))
            //    Deja 100% libre el frente y centro bajo la mesa hacia la cámara
            var pillarTable = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pillarTable.name = "Pilar_Mesa";
            pillarTable.transform.SetParent(tableGO.transform, false);
            pillarTable.transform.localPosition = new Vector3(0f, 0.39f, 0.72f);
            pillarTable.transform.localScale = new Vector3(0.28f, 0.78f, 0.28f);
            pillarTable.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // 3. Base pesada a ras de piso (Y = 0.03f, Z = +0.72f)
            var baseTable = GameObject.CreatePrimitive(PrimitiveType.Cube);
            baseTable.name = "Base_Pilar_Mesa";
            baseTable.transform.SetParent(tableGO.transform, false);
            baseTable.transform.localPosition = new Vector3(0f, 0.03f, 0.72f);
            baseTable.transform.localScale = new Vector3(0.48f, 0.06f, 0.48f);
            baseTable.GetComponent<MeshRenderer>().sharedMaterial = matDarkMetal;

            // Ancla de superficie de la mesa para mantener la altura de paciente y hologramas en Y = 0.78m
            var tableSurface = new GameObject("Superficie_Mesa");
            tableSurface.transform.SetParent(tableGO.transform, false);
            tableSurface.transform.localPosition = new Vector3(0f, 0.78f, 0f);

            // ── Silueta Holográfica del Paciente y Orientación CEFÁLICO ────────
            CreatePatientHologramAndOrientationLabels(tableSurface.transform);

            // ── Siluetas Óseas Anatómicas Dinámicas por Caso Clínico ─────────
            var anatomyRoot = new GameObject("Anatomy_Targets_Root");
            anatomyRoot.transform.SetParent(tableSurface.transform, false);
            anatomyRoot.transform.localPosition = new Vector3(0f, 0.07f, 0f); // Isocentro anatómico a Y = 0.85f (0, 0.85, 0.90)

            var shoulderGO = CreateAnatomyShoulder(anatomyRoot.transform, matBone);
            var femurGO    = CreateAnatomyFemur(anatomyRoot.transform, matBone);
            var pelvisGO   = CreateAnatomyPelvis(anatomyRoot.transform, matBone);

            var anatMgr = anatomyRoot.AddComponent<AnatomicalTargetManager>();
            var soAnat = new SerializedObject(anatMgr);
            soAnat.FindProperty("shoulderRoot").objectReferenceValue = shoulderGO;
            soAnat.FindProperty("femurRoot").objectReferenceValue = femurGO;
            soAnat.FindProperty("pelvisRoot").objectReferenceValue = pelvisGO;
            soAnat.FindProperty("carmRigTransform").objectReferenceValue = carmRig.transform;
            soAnat.FindProperty("xrayCamera").objectReferenceValue = xrayCam;
            soAnat.ApplyModifiedProperties();

            // Default to Femur for initial setup and align C-Arm rig and camera immediately
            anatMgr.SetAnatomy(AnatomyType.Femur, animate: false);

            fractureTarget = femurGO.transform;

            // Align C-Arm isocenter directly with Anatomical Target center (Femur)
            isocenterGO.transform.position = femurGO.transform.position;

            // ── Partículas (Heatmap y Compton) ──────────────────────────────
            var heatmapGO = new GameObject("Heatmap_Particles");
            heatmapGO.transform.SetParent(tuboGO.transform, false);
            heatmapGO.transform.localPosition = new Vector3(0f, 0.15f, 0f);
            heatmapPS = CreateParticleSystem(heatmapGO, new Color(1f, 0.2f, 0.1f, 0.8f), 0.5f);

            var comptonGO = new GameObject("Compton_Scatter_Particles");
            comptonGO.transform.SetParent(anatomyRoot.transform, false);
            comptonPS = CreateParticleSystem(comptonGO, new Color(1f, 0.28f, 0.12f, 0.85f), 0.85f);
            var cShape = comptonPS.shape;
            cShape.radius = 0.38f;
            var cMain = comptonPS.main;
            cMain.maxParticles = 60;
            cMain.startLifetime = 1.2f;
            var cEmission = comptonPS.emission;
            cEmission.rateOverTime = 35f;

            // ── Elementos EPP en Escena ─────────────────────────────────────
            var ppeRoot = new GameObject("PPE_Verification_Items");
            ppeRoot.transform.SetParent(tableSurface.transform, false);
            ppeRoot.transform.localPosition = Vector3.zero;

            var ppeBrakes  = CreatePpeItem(ppeRoot.transform, "PPE_EquipmentBrakes", PpeType.EquipmentBrakes, "Frenos Mecánicos", new Vector3(-0.45f, 0.1f, -0.4f));
            var ppeApron   = CreatePpeItem(ppeRoot.transform, "PPE_LeadApron", PpeType.LeadApron, "Delantal Plomado (0.5mm Pb)", new Vector3(-0.45f, 0.1f, -0.2f));
            var ppeThyroid = CreatePpeItem(ppeRoot.transform, "PPE_ThyroidShield", PpeType.ThyroidShield, "Collarín Tiroideo", new Vector3(-0.45f, 0.1f, 0.0f));
            var ppeDosim   = CreatePpeItem(ppeRoot.transform, "PPE_Dosimeter", PpeType.Dosimeter, "Dosímetro Personal", new Vector3(-0.45f, 0.1f, 0.2f));
            var ppeGlasses = CreatePpeItem(ppeRoot.transform, "PPE_LeadGlasses", PpeType.LeadGlasses, "Gafas Plomadas (Cristalino)", new Vector3(-0.45f, 0.1f, 0.4f));

            arcNodes = new ArcNodeLabel[] { nodeTubo, nodeDetector, nodeArc, nodeConsole, nodeBrakes };
            ppeItems = new PpeItem[] { ppeBrakes, ppeApron, ppeThyroid, ppeDosim, ppeGlasses };
        }

        private static GameObject CreateAnatomyShoulder(Transform parent, Material matBone)
        {
            return AnatomicalTargetManager.CreateShoulderAnatomy(parent, matBone);
        }

        private static GameObject CreateAnatomyFemur(Transform parent, Material matBone)
        {
            return AnatomicalTargetManager.CreateFemurAnatomy(parent, matBone);
        }

        private static GameObject CreateAnatomyPelvis(Transform parent, Material matBone)
        {
            return AnatomicalTargetManager.CreatePelvisAnatomy(parent, matBone);
        }

        private static void EnsureBoxCollider(GameObject go)
        {
            if (go.GetComponent<Collider>() == null)
            {
                go.AddComponent<BoxCollider>();
            }
        }

        private static PpeItem CreatePpeItem(Transform parent, string name, PpeType type, string displayName, Vector3 localPos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;

            var ppe = go.AddComponent<PpeItem>();
            ppe.ppeType = type;
            ppe.displayName = displayName;
            return ppe;
        }

        private static ParticleSystem CreateParticleSystem(GameObject go, Color color, float startSize)
        {
            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startColor = color;
            main.startSize = startSize;
            main.startLifetime = 1.0f;
            main.startSpeed = 0.5f;
            main.maxParticles = 50;
            main.playOnAwake = false;

            var emission = ps.emission;
            emission.rateOverTime = 25f;

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.25f;

            // Asignar material URP compatible — evita cuadros magentas en URP Play Mode
            var renderer = go.GetComponent<ParticleSystemRenderer>();
            if (renderer != null)
            {
                renderer.sharedMaterial = EnsureParticleScatterMaterial();
                renderer.renderMode = ParticleSystemRenderMode.Billboard; // Circular, no quad opaco
            }

            return ps;
        }

        /// <summary>
        /// Crea o carga M_Particle_Scatter.mat con shader URP/Particles/Unlit,
        /// Transparent + Additive, tinte #FF4500 con Alpha 0.4 (naranja-rojo dispersión).
        /// </summary>
        private static Material EnsureParticleScatterMaterial()
        {
            const string matPath = "Assets/_Project/Materials/M_Particle_Scatter.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            Texture2D softTex = GenerateSoftParticleTexture();
            if (existing != null)
            {
                if (softTex != null) existing.SetTexture("_BaseMap", softTex);
                existing.SetColor("_BaseColor", new Color(1f, 0.231f, 0.118f, 0.65f)); // #FF3B1E
                existing.SetColor("_EmissionColor", new Color(1f, 0.231f, 0.118f, 0.4f));
                EditorUtility.SetDirty(existing);
                AssetDatabase.SaveAssets();
                return existing;
            }

            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            // Shader URP Particles/Unlit — compatible con URP sin magenta
            var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (shader == null)
                shader = Shader.Find("Particles/Standard Unlit"); // Fallback legacy

            var mat = new Material(shader);
            mat.name = "M_Particle_Scatter";

            // Surface Type: Transparent (1) + Blending Mode: Additive
            mat.SetFloat("_Surface", 1f);         // 0 = Opaque, 1 = Transparent
            mat.SetFloat("_BlendOp", (float)UnityEngine.Rendering.BlendOp.Add);
            mat.SetFloat("_SrcBlend",  (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetFloat("_DstBlend",  (float)UnityEngine.Rendering.BlendMode.One); // Additive
            mat.SetFloat("_ZWrite", 0f); // No escribir en depth buffer (transparente)
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            mat.EnableKeyword("_ALPHAPREMULTIPLY_ON");

            // Color rojo-naranja dispersión: #FF3B1E, Alpha 0.65
            mat.SetColor("_BaseColor", new Color(1f, 0.231f, 0.118f, 0.65f));
            mat.SetColor("_EmissionColor", new Color(1f, 0.231f, 0.118f, 0.4f));

            // Textura radial suave — elimina bordes duros/cuadrados
            if (softTex != null) mat.SetTexture("_BaseMap", softTex);

            AssetDatabase.CreateAsset(mat, matPath);
            AssetDatabase.SaveAssets();
            return mat;
        }

        /// <summary>
        /// Genera una Texture2D 64x64 con gradiente radial suave (alpha 1.0 en centro, 0.0 en borde).
        /// Guardada como PNG en Assets/_Project/Materials/T_SoftParticle.png.
        /// Elimina los bordes duros cuadrados de las partículas de radiación.
        /// </summary>
        private static Texture2D GenerateSoftParticleTexture()
        {
            const string texPath = "Assets/_Project/Materials/T_SoftParticle.png";
            var existing = AssetDatabase.LoadAssetAtPath<Texture2D>(texPath);
            if (existing != null) return existing;

            const int size = 64;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.name = "T_SoftParticle";

            Vector2 center = new Vector2(size * 0.5f, size * 0.5f);
            float radius   = size * 0.5f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dist      = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), center);
                    float normalized = Mathf.Clamp01(dist / radius);
                    // SmoothStep: cae suavemente de 1.0 en centro a 0.0 en el borde
                    float alpha = Mathf.SmoothStep(1f, 0f, normalized);
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }
            tex.Apply();

            // Guardar como PNG en el proyecto
            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            byte[] pngBytes = tex.EncodeToPNG();
            string absPath  = System.IO.Path.Combine(Application.dataPath,
                "_Project/Materials/T_SoftParticle.png");
            System.IO.File.WriteAllBytes(absPath, pngBytes);
            AssetDatabase.ImportAsset(texPath, ImportAssetOptions.ForceUpdate);

            // Configurar import settings: tipo Sprite/Default, Alpha transparente
            var importer = AssetImporter.GetAtPath(texPath) as TextureImporter;
            if (importer != null)
            {
                importer.textureType        = TextureImporterType.Default;
                importer.alphaIsTransparency = true;
                importer.mipmapEnabled      = false;
                importer.filterMode         = FilterMode.Bilinear;
                importer.SaveAndReimport();
            }

            return AssetDatabase.LoadAssetAtPath<Texture2D>(texPath);
        }

        /// <summary>
        /// Crea o carga M_Arc_Metal.mat con shader URP/Lit, color #5A6570, Smoothness 0.6.
        /// Usado por Arco_Curvo_Mesh para visualización metálica gris del arco en C.
        /// </summary>
        private static Material EnsureArcMetalMaterial()
        {
            const string matPath = "Assets/_Project/Materials/M_Arc_Metal.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            if (existing != null) return existing;

            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) shader = Shader.Find("Standard");

            var mat = new Material(shader);
            mat.name = "M_Arc_Metal";
            // Gris metálico #5A6570
            mat.SetColor("_BaseColor", new Color(0.353f, 0.396f, 0.439f, 1f));
            mat.SetFloat("_Smoothness", 0.6f);
            mat.SetFloat("_Metallic", 0.4f);

            AssetDatabase.CreateAsset(mat, matPath);
            AssetDatabase.SaveAssets();
            return mat;
        }

        // ════════════════════════════════════════════════════════════════════
        // 3. Controllers & Configs Setup
        // ════════════════════════════════════════════════════════════════════

        private static void SetupControllersAndConfigs(
            out GameManager gm,
            out ProtocolZeroController pz,
            out BeamMasterController bm,
            out IsocenterCommandController ic)
        {
            string soFolder = "Assets/_Project/ScriptableObjects";
            if (!AssetDatabase.IsValidFolder(soFolder))
                AssetDatabase.CreateFolder("Assets/_Project", "ScriptableObjects");

            var cfg1 = EnsureMinigameConfig($"{soFolder}/MG1_ProtocolZero.asset", "MG1_ProtocolZero", "Protocolo Cero: Arquitectura del Arco");
            var cfg2 = EnsureMinigameConfig($"{soFolder}/MG2_BeamMaster.asset", "MG2_BeamMaster", "Maestro del Haz: Consola y Dispersión");
            var cfg3 = EnsureMinigameConfig($"{soFolder}/MG3_IsocenterCommand.asset", "MG3_IsocenterCommand", "Comando Isocentro: Bucle Cerrado");

            var mgrGO = GameObject.Find("Managers_And_Controllers");
            if (mgrGO == null) mgrGO = new GameObject("Managers_And_Controllers");

            gm = mgrGO.GetComponent<GameManager>() ?? mgrGO.AddComponent<GameManager>();
            pz = mgrGO.GetComponent<ProtocolZeroController>() ?? mgrGO.AddComponent<ProtocolZeroController>();
            bm = mgrGO.GetComponent<BeamMasterController>() ?? mgrGO.AddComponent<BeamMasterController>();
            ic = mgrGO.GetComponent<IsocenterCommandController>() ?? mgrGO.AddComponent<IsocenterCommandController>();
            ic.EnsureThreeCases();

            // Audio SFX Manager (Procedural Surgical Sound Synthesizer)
            if (mgrGO.GetComponent<AudioSFXManager>() == null)
            {
                mgrGO.AddComponent<AudioSFXManager>();
            }

            var soGm = new SerializedObject(gm);
            var configsProp = soGm.FindProperty("minigameConfigs");
            if (configsProp != null)
            {
                configsProp.arraySize = 3;
                configsProp.GetArrayElementAtIndex(0).objectReferenceValue = cfg1;
                configsProp.GetArrayElementAtIndex(1).objectReferenceValue = cfg2;
                configsProp.GetArrayElementAtIndex(2).objectReferenceValue = cfg3;
                soGm.ApplyModifiedProperties();
            }
        }

        private static MinigameConfig EnsureMinigameConfig(string path, string id, string title)
        {
            var cfg = AssetDatabase.LoadAssetAtPath<MinigameConfig>(path);
            if (cfg == null)
            {
                cfg = ScriptableObject.CreateInstance<MinigameConfig>();
                cfg.minigameId = id;
                cfg.displayName = title;
                cfg.maxScore = 100;
                cfg.passScorePercent = 70f;
                cfg.timeLimit = 300f;
                AssetDatabase.CreateAsset(cfg, path);
                AssetDatabase.SaveAssets();
            }
            return cfg;
        }

        // ════════════════════════════════════════════════════════════════════
        // 4. UI HUD Cyan Neon Setup
        // ════════════════════════════════════════════════════════════════════

        private static void SetupUIHUD(
            RenderTexture rt,
            GameManager gm,
            ProtocolZeroController pz,
            BeamMasterController bm,
            IsocenterCommandController ic,
            out CArmUIController uiController)
        {
            // EventSystem with InputSystemUIInputModule
            var es = UnityEngine.Object.FindAnyObjectByType<EventSystem>();
            if (es == null)
            {
                var esGO = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            }
            else if (es.GetComponent<InputSystemUIInputModule>() == null)
            {
                var oldModule = es.GetComponent<BaseInputModule>();
                if (oldModule != null) UnityEngine.Object.DestroyImmediate(oldModule);
                es.gameObject.AddComponent<InputSystemUIInputModule>();
            }

            // Main Camera Quirófano Setup (SolidColor #0A151E, framed centrally)
            var mainCam = Camera.main;
            if (mainCam == null)
            {
                var camGO = new GameObject("Main Camera");
                mainCam = camGO.AddComponent<Camera>();
                camGO.tag = "MainCamera";
            }
            mainCam.clearFlags = CameraClearFlags.SolidColor;
            mainCam.backgroundColor = new Color(10f / 255f, 21f / 255f, 30f / 255f, 1f); // #0A151E
            mainCam.rect = new Rect(0f, 0f, 1f, 1f);
            // Encuadre centrado en la franja libre 0.27 - 0.63
            mainCam.transform.position = new Vector3(-0.25f, 1.35f, -1.90f);
            mainCam.transform.rotation = Quaternion.Euler(11f, 5f, 0f);
            if (mainCam.GetComponent<PhysicsRaycaster>() == null)
            {
                mainCam.gameObject.AddComponent<PhysicsRaycaster>();
            }

            // Directional Light Setup for Operating Room
            var dirLight = UnityEngine.Object.FindAnyObjectByType<Light>();
            if (dirLight == null)
            {
                var lightGO = new GameObject("Directional Light");
                dirLight = lightGO.AddComponent<Light>();
                dirLight.type = LightType.Directional;
                dirLight.intensity = 1.15f;
                dirLight.color = new Color(0.95f, 0.98f, 1f);
                lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }

            // Clean old Canvas if exists
            var oldCanvas = GameObject.Find("UI_Master_Canvas");
            if (oldCanvas != null) UnityEngine.Object.DestroyImmediate(oldCanvas);

            var canvasGO = new GameObject("UI_Master_Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGO.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGO.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            uiController = canvasGO.AddComponent<CArmUIController>();

            // ── Top Bar Global ──────────────────────────────────────────────
            var topBar = CreateUIPanel("Top_Bar_Global", canvasGO.transform, HUD_BG_DARK,
                new Vector2(0f, 0.91f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);

            CreateUIText("LogoTitle", topBar.transform, "ARCO EN C // MÓDULO 1: ARQUITECTURA Y FÍSICA MÉDICA", 22, HUD_CYAN_NEON, TextAnchor.MiddleLeft,
                new Vector2(0f, 0f), new Vector2(0.33f, 1f), new Vector2(25f, 0f), Vector2.zero, bold: true, autoSize: true, minSize: 16, maxSize: 22);

            CreateUIText("LblDose", topBar.transform, "DOSIS ACUMULADA", 16, HUD_CYAN_HIGH_CONTRAST, TextAnchor.UpperCenter,
                new Vector2(0.34f, 0.58f), new Vector2(0.46f, 0.96f), Vector2.zero, Vector2.zero, bold: true);
            var doseTxt = CreateUIText("DoseValue", topBar.transform, "0.0 mSv", 30, HUD_TEXT_LIGHT, TextAnchor.LowerCenter,
                new Vector2(0.34f, 0.04f), new Vector2(0.46f, 0.58f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 20, maxSize: 30);

            CreateUIText("LblQuality", topBar.transform, "CALIDAD DIAGNÓSTICA", 16, HUD_CYAN_HIGH_CONTRAST, TextAnchor.UpperCenter,
                new Vector2(0.47f, 0.58f), new Vector2(0.59f, 0.96f), Vector2.zero, Vector2.zero, bold: true);
            var qualityTxt = CreateUIText("QualityValue", topBar.transform, "100%", 30, HUD_CYAN_NEON, TextAnchor.LowerCenter,
                new Vector2(0.47f, 0.04f), new Vector2(0.59f, 0.58f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 20, maxSize: 30);

            CreateUIText("LblTimer", topBar.transform, "TIEMPO QUIRÚRGICO", 16, HUD_CYAN_HIGH_CONTRAST, TextAnchor.UpperCenter,
                new Vector2(0.60f, 0.58f), new Vector2(0.72f, 0.96f), Vector2.zero, Vector2.zero, bold: true);
            var timerTxt = CreateUIText("TimerValue", topBar.transform, "05:00", 30, HUD_CYAN_NEON, TextAnchor.LowerCenter,
                new Vector2(0.60f, 0.04f), new Vector2(0.72f, 0.58f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 20, maxSize: 30);

            // Anode Heat Bar
            CreateUIText("LblAnode", topBar.transform, "CARGA TÉRMICA ÁNODO", 16, HUD_CYAN_HIGH_CONTRAST, TextAnchor.UpperCenter,
                new Vector2(0.73f, 0.65f), new Vector2(0.98f, 0.98f), Vector2.zero, Vector2.zero, bold: true);

            var anodeBg = CreateUIPanel("AnodeBar_BG", topBar.transform, new Color(0.08f, 0.12f, 0.15f, 0.95f),
                new Vector2(0.73f, 0.12f), new Vector2(0.98f, 0.60f), Vector2.zero, Vector2.zero);
            var anodeFillGO = CreateUIPanel("Fill", anodeBg.transform, HUD_ACCENT_GREEN,
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var anodeFillImg = anodeFillGO.GetComponent<Image>();
            anodeFillImg.type = Image.Type.Filled;
            anodeFillImg.fillMethod = Image.FillMethod.Horizontal;
            anodeFillImg.fillAmount = 0.1f;

            var anodeTxt = CreateUIText("AnodeText", anodeBg.transform, "10% HU (Régimen Seguro)", 18, HUD_TEXT_DARK, TextAnchor.MiddleCenter,
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 13, maxSize: 18);

            // ── Left Panel (Fluoroscopy Monitor + Dra. Nova Card) ───────────
            var leftPanel = CreateUIPanel("Panel_Izquierdo", canvasGO.transform, HUD_BG_DARK,
                new Vector2(0.01f, 0.02f), new Vector2(0.27f, 0.90f), Vector2.zero, Vector2.zero);

            CreateUIText("MonitorTitle", leftPanel.transform, "MONITOR FLUOROSCÓPICO // SEÑAL RT", 18, HUD_CYAN_NEON, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.93f), new Vector2(0.96f, 0.99f), Vector2.zero, Vector2.zero, bold: true);

            var monitorGO = new GameObject("Monitor_Fluoroscopia", typeof(RectTransform), typeof(CanvasRenderer), typeof(RawImage));
            monitorGO.transform.SetParent(leftPanel.transform, false);
            var monitorRT = monitorGO.GetComponent<RectTransform>();
            monitorRT.anchorMin = new Vector2(0.5f, 0.68f);
            monitorRT.anchorMax = new Vector2(0.5f, 0.68f);
            monitorRT.sizeDelta = new Vector2(340f, 340f);
            var monitorRaw = monitorGO.GetComponent<RawImage>();
            monitorRaw.texture = rt;

            // 4 Collimation Shutters (Top, Bottom, Left, Right) closing in over the fluoroscopy monitor
            var shutterTopGO = CreateUIPanel("Collimation_Shutter_Top", monitorGO.transform, Color.black,
                new Vector2(0f, 1f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            var shutterTopRT = shutterTopGO.GetComponent<RectTransform>();

            var shutterBottomGO = CreateUIPanel("Collimation_Shutter_Bottom", monitorGO.transform, Color.black,
                new Vector2(0f, 0f), new Vector2(1f, 0f), Vector2.zero, Vector2.zero);
            var shutterBottomRT = shutterBottomGO.GetComponent<RectTransform>();

            var shutterLeftGO = CreateUIPanel("Collimation_Shutter_Left", monitorGO.transform, Color.black,
                new Vector2(0f, 0f), new Vector2(0f, 1f), Vector2.zero, Vector2.zero);
            var shutterLeftRT = shutterLeftGO.GetComponent<RectTransform>();

            var shutterRightGO = CreateUIPanel("Collimation_Shutter_Right", monitorGO.transform, Color.black,
                new Vector2(1f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero);
            var shutterRightRT = shutterRightGO.GetComponent<RectTransform>();

            // Collimator Mask Overlay
            var maskGO = CreateUIPanel("Collimator_Mask", monitorGO.transform, new Color(0f, 0f, 0f, 0.45f),
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var collimatorRT = maskGO.GetComponent<RectTransform>();

            // ── Retícula Quirúrgica (Crosshair) y Telemetría Fluoroscópica ──
            var crosshairSprite = EnsureCrosshairSprite();
            var reticleGO = new GameObject("Reticle_Crosshair", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            reticleGO.transform.SetParent(monitorGO.transform, false);
            var reticleRT = reticleGO.GetComponent<RectTransform>();
            reticleRT.anchorMin = new Vector2(0.5f, 0.5f);
            reticleRT.anchorMax = new Vector2(0.5f, 0.5f);
            reticleRT.anchoredPosition = Vector2.zero;
            reticleRT.sizeDelta = new Vector2(80f, 80f);
            var reticleImg = reticleGO.GetComponent<Image>();
            reticleImg.sprite = crosshairSprite;
            reticleImg.color = new Color(0f, 240f / 255f, 1f, 0.45f); // Blanco/cyan tenue 0.45
            reticleImg.raycastTarget = false;

            var txtTelemetry = CreateUIText("Txt_Monitor_Telemetry", monitorGO.transform, "PROY: AP 0° | ISO: CENTRADO", 15, HUD_CYAN_NEON, TextAnchor.LowerLeft,
                new Vector2(0.04f, 0.03f), new Vector2(0.96f, 0.16f), Vector2.zero, Vector2.zero, bold: true);
            txtTelemetry.raycastTarget = false;

            // Tarjeta Dra. Nova con borde Cyan Neón
            var draNovaCard = CreateUIPanel("Tarjeta_HUD_DraNova", leftPanel.transform, HUD_PANEL_BG,
                new Vector2(0.04f, 0.03f), new Vector2(0.96f, 0.44f), Vector2.zero, Vector2.zero);
            var cardOutline = draNovaCard.AddComponent<Outline>();
            cardOutline.effectColor = HUD_CYAN_NEON;
            cardOutline.effectDistance = new Vector2(2f, -2f);
            draNovaCard.SetActive(true);

            var novaTitle = CreateUIText("NovaHeader", draNovaCard.transform, "QUIRÓFANO // PROTOCOLO", 21, HUD_CYAN_NEON, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.86f), new Vector2(0.96f, 0.98f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 16, maxSize: 22);

            var novaBody = CreateUIText("NovaBody", draNovaCard.transform,
                "Dra. Nova: Inicia la preparación del equipo quirúrgico para osteosíntesis de fémur proximal. Verifica la orientación del arco y los elementos de radioprotección antes del primer disparo.",
                24, Color.white, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.20f), new Vector2(0.96f, 0.85f), Vector2.zero, Vector2.zero,
                bold: true, autoSize: true, minSize: 18, maxSize: 26, lineSpacing: 1.25f);

            var novaBtn = CreateUIButton("BtnContinuar", draNovaCard.transform, "CONTINUAR",
                HUD_CYAN_NEON, Color.black,
                new Vector2(0.08f, 0.03f), new Vector2(0.92f, 0.03f), Vector2.zero, new Vector2(0f, 56f),
                fontSize: 20, bold: true, autoSize: true, minSize: 16, maxSize: 22);

            // ── Right Container with Minigame Tabs & Panels ─────────────────
            var rightContainer = CreateUIPanel("Contenedor_Derecho", canvasGO.transform, HUD_BG_DARK,
                new Vector2(0.63f, 0.02f), new Vector2(0.99f, 0.90f), Vector2.zero, Vector2.zero);

            // ── Indicador Visual de Intentos (● ● ●) en esquina superior derecha ──
            var txtBadge = CreateUIText("Txt_Attempts_Badge", rightContainer.transform, "INTENTOS: ● ● ●", 16, HUD_CYAN_NEON, TextAnchor.MiddleRight,
                new Vector2(0.50f, 0.875f), new Vector2(0.97f, 0.925f), Vector2.zero, Vector2.zero, bold: true);
            txtBadge.raycastTarget = false;

            // Navigation Tabs at the Top of Right Container (18 pt Bold)
            var btnTab1 = CreateUIButton("Tab_MG1", rightContainer.transform, "1. PROTOCOLO", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.02f, 0.93f), new Vector2(0.32f, 0.99f), Vector2.zero, Vector2.zero,
                fontSize: 18, bold: true, autoSize: true, minSize: 14, maxSize: 18);
            var btnTab2 = CreateUIButton("Tab_MG2", rightContainer.transform, "2. MAESTRO DEL HAZ", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.35f, 0.93f), new Vector2(0.65f, 0.99f), Vector2.zero, Vector2.zero,
                fontSize: 18, bold: true, autoSize: true, minSize: 14, maxSize: 18);
            var btnTab3 = CreateUIButton("Tab_MG3", rightContainer.transform, "3. ISOCENTRO", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.68f, 0.93f), new Vector2(0.98f, 0.99f), Vector2.zero, Vector2.zero,
                fontSize: 18, bold: true, autoSize: true, minSize: 14, maxSize: 18);

            // ── MG1 Panel: Protocol Zero ────────────────────────────────────
            var panelMG1 = CreateUIPanel("Panel_MG1_ProtocolZero", rightContainer.transform, Color.clear,
                Vector2.zero, new Vector2(1f, 0.93f), Vector2.zero, Vector2.zero);

            CreateUIText("MG1_Title", panelMG1.transform, "FASE 1: PROTOCOLO CERO Y RADIOPROTECCIÓN", 20, HUD_CYAN_NEON, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.92f), new Vector2(0.96f, 0.98f), Vector2.zero, Vector2.zero, bold: true);

            var btnInvert = CreateUIButton("BtnInvertirOrientacion", panelMG1.transform, "INVERTIR ARCO (TUBO ABAJO / DETECTOR ARRIBA)",
                new Color(0f, 0.45f, 0.55f, 0.95f), HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.78f), new Vector2(0.94f, 0.88f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            var btnVerify = CreateUIButton("BtnVerificarDisparo", panelMG1.transform, "DISPARO DE PRUEBA (VERIFICAR SEGURIDAD)",
                HUD_ACCENT_RED, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.65f), new Vector2(0.94f, 0.75f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            CreateUIText("PpeTitle", panelMG1.transform, "LISTA DE VERIFICACIÓN EPP (4x REGLA DE ORO):", 17, HUD_CYAN_HIGH_CONTRAST, TextAnchor.MiddleLeft,
                new Vector2(0.06f, 0.57f), new Vector2(0.94f, 0.63f), Vector2.zero, Vector2.zero, bold: true);

            var btnPpe1 = CreateUIButton("Btn_PpeBrakes", panelMG1.transform, "1. Frenos de Chasis y Mesa Bloqueados", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.46f), new Vector2(0.94f, 0.54f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);
            var btnPpe2 = CreateUIButton("Btn_PpeApron", panelMG1.transform, "2. Delantal Plomado (≥ 0.35 mm Pb)", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.36f), new Vector2(0.94f, 0.44f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);
            var btnPpe3 = CreateUIButton("Btn_PpeThyroid", panelMG1.transform, "3. Collarín Tiroideo Ajustado", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.26f), new Vector2(0.94f, 0.34f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);
            var btnPpe4 = CreateUIButton("Btn_PpeDosimeter", panelMG1.transform, "4. Dosímetro Personal en Pecho", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.16f), new Vector2(0.94f, 0.24f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);
            var btnPpe5 = CreateUIButton("Btn_PpeGlasses", panelMG1.transform, "5. Gafas Plomadas (Protección Cristalino)", HUD_BTN_DARK, HUD_TEXT_LIGHT,
                new Vector2(0.06f, 0.06f), new Vector2(0.94f, 0.14f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            // ── MG2 Panel: Beam Master ──────────────────────────────────────
            var panelMG2 = CreateUIPanel("Panel_MG2_BeamMaster", rightContainer.transform, Color.clear,
                Vector2.zero, new Vector2(1f, 0.93f), Vector2.zero, Vector2.zero);

            CreateUIText("MG2_Title", panelMG2.transform, "FASE 2: MAESTRO DEL HAZ Y DISPERSIÓN COMPTON", 20, HUD_CYAN_NEON, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.93f), new Vector2(0.96f, 0.98f), Vector2.zero, Vector2.zero, bold: true);

            var txtMG2CaseHeader = CreateUIText("MG2_CaseHeader", panelMG2.transform,
                "OBJETIVO: CASO 1/3 — HOMBRO (Meta: 65-75 kVp | 2.0-3.5 mA | Colimación >= 60%)", 17, HUD_ACCENT_GREEN, TextAnchor.MiddleLeft,
                new Vector2(0.04f, 0.86f), new Vector2(0.96f, 0.92f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 14, maxSize: 18);

            // kVp Slider (Labels 18 pt Bold)
            CreateUIText("Label_kVp_Title", panelMG2.transform, "TENSIÓN DEL TUBO (kVp - Penetrancia):", 18, HUD_TEXT_LIGHT, TextAnchor.MiddleLeft,
                new Vector2(0.06f, 0.78f), new Vector2(0.65f, 0.83f), Vector2.zero, Vector2.zero, bold: true);
            var txtKvp = CreateUIText("Label_kVp", panelMG2.transform, "70 kVp", 18, HUD_CYAN_NEON, TextAnchor.MiddleRight,
                new Vector2(0.65f, 0.78f), new Vector2(0.94f, 0.83f), Vector2.zero, Vector2.zero, bold: true);
            var sliderKvp = CreateUISlider("Slider_kVp", panelMG2.transform, 50f, 115f, 70f,
                new Vector2(0.06f, 0.72f), new Vector2(0.94f, 0.77f), Vector2.zero, Vector2.zero);

            // mA Slider (Labels 18 pt Bold)
            CreateUIText("Label_mA_Title", panelMG2.transform, "CORRIENTE (mA - Cantidad de Fotones):", 18, HUD_TEXT_LIGHT, TextAnchor.MiddleLeft,
                new Vector2(0.06f, 0.63f), new Vector2(0.65f, 0.68f), Vector2.zero, Vector2.zero, bold: true);
            var txtMA = CreateUIText("Label_mA", panelMG2.transform, "2.8 mA", 18, HUD_CYAN_NEON, TextAnchor.MiddleRight,
                new Vector2(0.65f, 0.63f), new Vector2(0.94f, 0.68f), Vector2.zero, Vector2.zero, bold: true);
            var sliderMA = CreateUISlider("Slider_mA", panelMG2.transform, 1.0f, 8.0f, 2.8f,
                new Vector2(0.06f, 0.57f), new Vector2(0.94f, 0.62f), Vector2.zero, Vector2.zero);

            // Collimation Slider (Labels 18 pt Bold)
            CreateUIText("Label_Coll_Title", panelMG2.transform, "COLIMACIÓN (Cierre de Láminas de Plomo):", 18, HUD_TEXT_LIGHT, TextAnchor.MiddleLeft,
                new Vector2(0.06f, 0.48f), new Vector2(0.65f, 0.53f), Vector2.zero, Vector2.zero, bold: true);
            var txtColl = CreateUIText("Label_Collimation", panelMG2.transform, "0% (Haz Abierto)", 18, HUD_CYAN_NEON, TextAnchor.MiddleRight,
                new Vector2(0.65f, 0.48f), new Vector2(0.94f, 0.53f), Vector2.zero, Vector2.zero, bold: true);
            var sliderCollimation = CreateUISlider("Slider_Collimation", panelMG2.transform, 0f, 0.85f, 0f,
                new Vector2(0.06f, 0.42f), new Vector2(0.94f, 0.47f), Vector2.zero, Vector2.zero);

            // Distance Toggle (18 pt Bold)
            var toggleStepBack = CreateUIToggle("Toggle_StepBack", panelMG2.transform, "1 Paso Atrás (Ley Inversa del Cuadrado 1/d² = 1/4 Dosis)", false,
                new Vector2(0.06f, 0.30f), new Vector2(0.94f, 0.38f), Vector2.zero, Vector2.zero, fontSize: 18, bold: true);

            // Pedal Button (20 pt Bold)
            var btnPedal = CreateUIButton("Btn_PedalDisparo", panelMG2.transform, "PEDAL DE DISPARO (PULSO FLUOROSCÓPICO)",
                HUD_CYAN_NEON, Color.black,
                new Vector2(0.06f, 0.12f), new Vector2(0.94f, 0.25f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            // ── MG3 Panel: Isocenter Command & Closed Loop Order Builder ──
            var panelMG3 = CreateUIPanel("Panel_MG3_IsocenterCommand", rightContainer.transform, Color.clear,
                Vector2.zero, new Vector2(1f, 0.93f), Vector2.zero, Vector2.zero);

            // Encabezado de Fase y Enunciado del Caso Clínico: Y: 0.80f a 0.91f
            CreateUIText("MG3_Title", panelMG3.transform, "FASE 3: COMANDO ISOCENTRO Y BUCLE CERRADO", 20, HUD_CYAN_NEON, TextAnchor.UpperLeft,
                new Vector2(0.04f, 0.86f), new Vector2(0.96f, 0.91f), Vector2.zero, Vector2.zero, bold: true);

            var txtMG3CaseHeader = CreateUIText("MG3_CaseHeader", panelMG3.transform,
                "OBJETIVO: CASO 1/3 — DIÁFISIS FEMORAL (Centrar el trazo de fractura en el isocentro)", 17, HUD_ACCENT_GREEN, TextAnchor.MiddleLeft,
                new Vector2(0.04f, 0.80f), new Vector2(0.96f, 0.85f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 13, maxSize: 17);

            // Monitor de texto dinámico: Y: 0.73f a 0.79f
            var txtBuilt = CreateUIText("Txt_BuiltOrder", panelMG3.transform, "Orden: [Movimiento] + [Dirección] + [Magnitud]", 17, HUD_CYAN_NEON, TextAnchor.MiddleLeft,
                new Vector2(0.04f, 0.73f), new Vector2(0.96f, 0.79f), Vector2.zero, Vector2.zero, bold: true, autoSize: true, minSize: 13, maxSize: 18);

            // Títulos de las 3 columnas: Y: 0.68f a 0.72f
            CreateUIText("Col1_Title", panelMG3.transform, "1. MOVIMIENTO", 17, HUD_CYAN_HIGH_CONTRAST, TextAnchor.MiddleCenter,
                new Vector2(0.02f, 0.68f), new Vector2(0.33f, 0.72f), Vector2.zero, Vector2.zero, bold: true);

            CreateUIText("Col2_Title", panelMG3.transform, "2. DIRECCIÓN", 17, HUD_CYAN_HIGH_CONTRAST, TextAnchor.MiddleCenter,
                new Vector2(0.35f, 0.68f), new Vector2(0.66f, 0.72f), Vector2.zero, Vector2.zero, bold: true);

            CreateUIText("Col3_Title", panelMG3.transform, "3. MAGNITUD", 17, HUD_CYAN_HIGH_CONTRAST, TextAnchor.MiddleCenter,
                new Vector2(0.68f, 0.68f), new Vector2(0.98f, 0.72f), Vector2.zero, Vector2.zero, bold: true);

            // Las 3 columnas con sus 6 botones cada una: Y: 0.24f a 0.67f
            // (4 opciones técnicas reales + 2 opciones trampa camufladas con exactamente el mismo estilo)
            string[] defaultCol1Labels = new string[] {
                "Traslación Long.", "Rotación Orbital", "Angulación", "Elevación Vert.",
                "Mover el aparato", "Correr el cabezal"
            };
            string[] defaultCol2Labels = new string[] {
                "Hacia Cefálico", "Hacia Caudal", "AP a Lateral", "Hacia Arriba",
                "Hacia mí", "Un poco más allá"
            };
            string[] defaultCol3Labels = new string[] {
                "5 cm", "10 cm", "15°", "30°",
                "Un pelo", "Al ojo / Al tope"
            };

            var col1Buttons = new Button[6];
            var col2Buttons = new Button[6];
            var col3Buttons = new Button[6];

            float stepY = (0.67f - 0.24f) / 6f; // ~0.07166f
            float btnH = 0.060f;

            for (int i = 0; i < 6; i++)
            {
                float ymax = 0.67f - (i * stepY);
                float ymin = ymax - btnH;

                col1Buttons[i] = CreateUIButton($"Btn_Col1_{i}", panelMG3.transform, defaultCol1Labels[i], HUD_BTN_DARK, HUD_TEXT_LIGHT,
                    new Vector2(0.02f, ymin), new Vector2(0.33f, ymax), Vector2.zero, Vector2.zero,
                    fontSize: 17, bold: true, autoSize: true, minSize: 12, maxSize: 17);

                col2Buttons[i] = CreateUIButton($"Btn_Col2_{i}", panelMG3.transform, defaultCol2Labels[i], HUD_BTN_DARK, HUD_TEXT_LIGHT,
                    new Vector2(0.35f, ymin), new Vector2(0.66f, ymax), Vector2.zero, Vector2.zero,
                    fontSize: 17, bold: true, autoSize: true, minSize: 12, maxSize: 17);

                col3Buttons[i] = CreateUIButton($"Btn_Col3_{i}", panelMG3.transform, defaultCol3Labels[i], HUD_BTN_DARK, HUD_TEXT_LIGHT,
                    new Vector2(0.68f, ymin), new Vector2(0.98f, ymax), Vector2.zero, Vector2.zero,
                    fontSize: 17, bold: true, autoSize: true, minSize: 12, maxSize: 17);
            }

            // Botón principal "EMITIR ORDEN (BUCLE CERRADO)": Y: 0.13f a 0.21f
            var btnSubmitOrder = CreateUIButton("Btn_SubmitOrder", panelMG3.transform, "EMITIR ORDEN (BUCLE CERRADO)",
                new Color(0f, 0.5f, 0.65f, 1f), HUD_TEXT_LIGHT,
                new Vector2(0.04f, 0.13f), new Vector2(0.96f, 0.21f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            // Botón inferior de confirmación: Y: 0.03f a 0.11f
            var btnRotate90 = CreateUIButton("Btn_Rotate90", panelMG3.transform, "ROTAR 90° (AP A LATERAL)",
                HUD_CYAN_NEON, Color.black,
                new Vector2(0.04f, 0.03f), new Vector2(0.96f, 0.11f), Vector2.zero, Vector2.zero,
                fontSize: 20, bold: true, autoSize: true, minSize: 15, maxSize: 21);

            // Connect UI references to CArmUIController using SerializedObject
            var soUi = new SerializedObject(uiController);
            soUi.FindProperty("gameManager").objectReferenceValue = gm;
            soUi.FindProperty("protocolZeroController").objectReferenceValue = pz;
            soUi.FindProperty("beamMasterController").objectReferenceValue = bm;
            soUi.FindProperty("isocenterController").objectReferenceValue = ic;

            soUi.FindProperty("doseText").objectReferenceValue = doseTxt;
            soUi.FindProperty("qualityText").objectReferenceValue = qualityTxt;
            soUi.FindProperty("timerText").objectReferenceValue = timerTxt;
            soUi.FindProperty("anodeFillImage").objectReferenceValue = anodeFillImg;
            soUi.FindProperty("anodeText").objectReferenceValue = anodeTxt;

            soUi.FindProperty("fluoroscopeDisplay").objectReferenceValue = monitorRaw;
            soUi.FindProperty("reticleCrosshair").objectReferenceValue = reticleImg;
            soUi.FindProperty("txtMonitorTelemetry").objectReferenceValue = txtTelemetry;
            soUi.FindProperty("txtAttemptsBadge").objectReferenceValue = txtBadge;
            soUi.FindProperty("collimatorMask").objectReferenceValue = collimatorRT;
            soUi.FindProperty("shutterTop").objectReferenceValue = shutterTopRT;
            soUi.FindProperty("shutterBottom").objectReferenceValue = shutterBottomRT;
            soUi.FindProperty("shutterLeft").objectReferenceValue = shutterLeftRT;
            soUi.FindProperty("shutterRight").objectReferenceValue = shutterRightRT;
            soUi.FindProperty("draNovaCard").objectReferenceValue = draNovaCard;
            soUi.FindProperty("draNovaTitleText").objectReferenceValue = novaTitle;
            soUi.FindProperty("draNovaBodyText").objectReferenceValue = novaBody;
            soUi.FindProperty("draNovaContinueButton").objectReferenceValue = novaBtn;

            soUi.FindProperty("panelMG1").objectReferenceValue = panelMG1;
            soUi.FindProperty("panelMG2").objectReferenceValue = panelMG2;
            soUi.FindProperty("panelMG3").objectReferenceValue = panelMG3;
            soUi.FindProperty("btnTabMG1").objectReferenceValue = btnTab1;
            soUi.FindProperty("btnTabMG2").objectReferenceValue = btnTab2;
            soUi.FindProperty("btnTabMG3").objectReferenceValue = btnTab3;

            soUi.FindProperty("btnInvertArc").objectReferenceValue = btnInvert;
            soUi.FindProperty("btnVerifySafety").objectReferenceValue = btnVerify;
            soUi.FindProperty("btnPpeBrakes").objectReferenceValue = btnPpe1;
            soUi.FindProperty("btnPpeApron").objectReferenceValue = btnPpe2;
            soUi.FindProperty("btnPpeThyroid").objectReferenceValue = btnPpe3;
            soUi.FindProperty("btnPpeDosimeter").objectReferenceValue = btnPpe4;
            soUi.FindProperty("btnPpeGlasses").objectReferenceValue = btnPpe5;

            soUi.FindProperty("textMG2CaseHeader").objectReferenceValue = txtMG2CaseHeader;
            soUi.FindProperty("sliderKvp").objectReferenceValue = sliderKvp;
            soUi.FindProperty("textKvpValue").objectReferenceValue = txtKvp;
            soUi.FindProperty("sliderMA").objectReferenceValue = sliderMA;
            soUi.FindProperty("textMAValue").objectReferenceValue = txtMA;
            soUi.FindProperty("sliderCollimation").objectReferenceValue = sliderCollimation;
            soUi.FindProperty("textCollimationValue").objectReferenceValue = txtColl;
            soUi.FindProperty("toggleStepBack").objectReferenceValue = toggleStepBack;
            soUi.FindProperty("btnExposurePedal").objectReferenceValue = btnPedal;

            // Bind col1Buttons, col2Buttons, col3Buttons arrays (3 Columns x 6 Buttons)
            var col1Prop = soUi.FindProperty("col1Buttons");
            if (col1Prop != null)
            {
                col1Prop.arraySize = 6;
                for (int i = 0; i < 6; i++)
                    col1Prop.GetArrayElementAtIndex(i).objectReferenceValue = col1Buttons[i];
            }

            var col2Prop = soUi.FindProperty("col2Buttons");
            if (col2Prop != null)
            {
                col2Prop.arraySize = 6;
                for (int i = 0; i < 6; i++)
                    col2Prop.GetArrayElementAtIndex(i).objectReferenceValue = col2Buttons[i];
            }

            var col3Prop = soUi.FindProperty("col3Buttons");
            if (col3Prop != null)
            {
                col3Prop.arraySize = 6;
                for (int i = 0; i < 6; i++)
                    col3Prop.GetArrayElementAtIndex(i).objectReferenceValue = col3Buttons[i];
            }

            soUi.FindProperty("textMG3CaseHeader").objectReferenceValue = txtMG3CaseHeader;
            soUi.FindProperty("textBuiltOrder").objectReferenceValue = txtBuilt;
            soUi.FindProperty("btnSubmitOrder").objectReferenceValue = btnSubmitOrder;
            soUi.FindProperty("btnRotate90").objectReferenceValue = btnRotate90;

            var propSinglePhase = soUi.FindProperty("singlePhaseWebMode");
            if (propSinglePhase != null) propSinglePhase.boolValue = true;
            var propDefaultStartPhase = soUi.FindProperty("defaultStartPhase");
            if (propDefaultStartPhase != null) propDefaultStartPhase.intValue = 1;

            soUi.ApplyModifiedProperties();

            // ── Responsive HUD Layout Manager (WCAG >= 64px, Multiplatform Adaptive) ──
            var responsive = canvasGO.GetComponent<ResponsiveHUDLayout>() ?? canvasGO.AddComponent<ResponsiveHUDLayout>();
            var soResp = new SerializedObject(responsive);
            soResp.FindProperty("topBar").objectReferenceValue = topBar.GetComponent<RectTransform>();
            soResp.FindProperty("panelLeft").objectReferenceValue = leftPanel.GetComponent<RectTransform>();
            soResp.FindProperty("panelRight").objectReferenceValue = rightContainer.GetComponent<RectTransform>();
            soResp.FindProperty("panelMG1").objectReferenceValue = panelMG1.GetComponent<RectTransform>();
            soResp.FindProperty("panelMG2").objectReferenceValue = panelMG2.GetComponent<RectTransform>();
            soResp.FindProperty("panelMG3").objectReferenceValue = panelMG3.GetComponent<RectTransform>();
            soResp.FindProperty("minTouchTargetHeight").floatValue = 64f;
            var propMon = soResp.FindProperty("monitorFluoroscopia");
            if (propMon != null) propMon.objectReferenceValue = monitorRT;
            var propCard = soResp.FindProperty("cardDraNova");
            if (propCard != null) propCard.objectReferenceValue = draNovaCard.GetComponent<RectTransform>();
            soResp.ApplyModifiedProperties();

            responsive.EnforceTouchTargetMinimums();
            responsive.ApplyResponsiveLayout();
        }

        // ════════════════════════════════════════════════════════════════════
        // 5. Wire All Serialized References
        // ════════════════════════════════════════════════════════════════════

        private static void WireAllSerializedReferences(
            GameManager gm,
            ProtocolZeroController pz,
            BeamMasterController bm,
            IsocenterCommandController ic,
            CArmUIController uiController,
            GameObject carmRig,
            Transform arcTransform,
            Transform fractureTarget,
            ArcNodeLabel[] arcNodes,
            PpeItem[] ppeItems,
            ParticleSystem heatmapPS,
            ParticleSystem comptonPS,
            Renderer collimatorIndicatorRenderer,
            Light tubeEmissionLight)
        {
            // Wire ProtocolZeroController
            if (pz != null)
            {
                var so = new SerializedObject(pz);
                so.FindProperty("arcTransform").objectReferenceValue = arcTransform;
                so.FindProperty("heatmapParticles").objectReferenceValue = heatmapPS;
                so.FindProperty("patientScatterParticles").objectReferenceValue = comptonPS;
                so.FindProperty("collimatorIndicatorRenderer").objectReferenceValue = collimatorIndicatorRenderer;
                so.FindProperty("tubeEmissionLight").objectReferenceValue = tubeEmissionLight;

                var nodesProp = so.FindProperty("arcNodes");
                nodesProp.arraySize = arcNodes.Length;
                for (int i = 0; i < arcNodes.Length; i++)
                    nodesProp.GetArrayElementAtIndex(i).objectReferenceValue = arcNodes[i];

                var ppeProp = so.FindProperty("ppeItems");
                ppeProp.arraySize = ppeItems.Length;
                for (int i = 0; i < ppeItems.Length; i++)
                    ppeProp.GetArrayElementAtIndex(i).objectReferenceValue = ppeItems[i];

                so.ApplyModifiedProperties();
            }

            // Wire BeamMasterController
            if (bm != null)
            {
                var so = new SerializedObject(bm);
                so.FindProperty("comptonParticles").objectReferenceValue = comptonPS;
                so.ApplyModifiedProperties();
            }

            // Wire IsocenterCommandController
            if (ic != null)
            {
                var so = new SerializedObject(ic);
                so.FindProperty("arcTransform").objectReferenceValue = arcTransform;
                so.FindProperty("fractureTarget").objectReferenceValue = fractureTarget;
                so.ApplyModifiedProperties();
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // 6. Prefab Saving & Scene Persistence
        // ════════════════════════════════════════════════════════════════════

        private static void SavePrefabAndScene(GameObject carmRig)
        {
            string prefabFolder = "Assets/_Project/Prefabs";
            if (!AssetDatabase.IsValidFolder("Assets/_Project"))
                AssetDatabase.CreateFolder("Assets", "_Project");
            if (!AssetDatabase.IsValidFolder(prefabFolder))
                AssetDatabase.CreateFolder("Assets/_Project", "Prefabs");

            string prefabPath = $"{prefabFolder}/CArm_Rig.prefab";
            var savedPrefab = PrefabUtility.SaveAsPrefabAsset(carmRig, prefabPath, out bool success);
            Debug.Log($"[CArmSetup] SaveAsPrefabAsset result: {success}, asset: {(savedPrefab != null ? savedPrefab.name : "null")}");
            AssetDatabase.SaveAssets();

            var activeScene = EditorSceneManager.GetActiveScene();
            EditorSceneManager.MarkSceneDirty(activeScene);
            if (!string.IsNullOrEmpty(activeScene.path))
            {
                EditorSceneManager.SaveScene(activeScene);
            }
            else
            {
                string scenePath = "Assets/Scenes/Scene1.unity";
                EditorSceneManager.SaveScene(activeScene, scenePath);
            }

            EnsureSceneInBuildSettings("Assets/Scenes/Scene1.unity");
            Debug.Log("[CArmSetup] Prefab 'CArm_Rig.prefab' y 'Scene1.unity' guardados en disco exitosamente.");
        }

        private static void EnsureSceneInBuildSettings(string scenePath)
        {
            var scenes = EditorBuildSettings.scenes;
            bool exists = false;
            foreach (var s in scenes)
            {
                if (s.path == scenePath) { exists = true; break; }
            }
            if (!exists)
            {
                var newScenes = new EditorBuildSettingsScene[scenes.Length + 1];
                newScenes[0] = new EditorBuildSettingsScene(scenePath, true);
                for (int i = 0; i < scenes.Length; i++)
                {
                    newScenes[i + 1] = scenes[i];
                }
                EditorBuildSettings.scenes = newScenes;
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // UI Helpers
        // ════════════════════════════════════════════════════════════════════

        private static GameObject CreateUIPanel(string name, Transform parent, Color bgColor, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
            var img = go.GetComponent<Image>();
            img.color = bgColor;
            return go;
        }

        private static Text CreateUIText(
            string name, Transform parent, string text, int fontSize, Color color, TextAnchor alignment,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax,
            bool bold = true, bool autoSize = false, int minSize = 10, int maxSize = 40, float lineSpacing = 1.0f)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
            var t = go.GetComponent<Text>();
            t.text = text;
            t.fontSize = fontSize;
            t.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            t.color = color;
            t.alignment = alignment;
            t.lineSpacing = lineSpacing;
            if (autoSize)
            {
                t.resizeTextForBestFit = true;
                t.resizeTextMinSize = minSize;
                t.resizeTextMaxSize = maxSize;
            }
            t.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf") ?? Resources.GetBuiltinResource<Font>("Arial.ttf");
            return t;
        }

        private static Button CreateUIButton(
            string name, Transform parent, string label, Color btnColor, Color txtColor,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax,
            int fontSize = 18, bool bold = true, bool autoSize = true, int minSize = 13, int maxSize = 22)
        {
            var panel = CreateUIPanel(name, parent, btnColor, anchorMin, anchorMax, offsetMin, offsetMax);
            var btn = panel.AddComponent<Button>();
            var colors = btn.colors;
            colors.normalColor = btnColor;
            colors.highlightedColor = btnColor * 1.25f;
            colors.pressedColor = btnColor * 0.75f;
            btn.colors = colors;

            // Touch Ergonomics: LayoutElement guarantees minimum 64x64px touch target
            var le = panel.AddComponent<LayoutElement>();
            le.minHeight = 64f;
            le.minWidth = 64f;

            var txt = CreateUIText("Text", panel.transform, label, fontSize, txtColor, TextAnchor.MiddleCenter,
                Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero,
                bold: bold, autoSize: autoSize, minSize: minSize, maxSize: maxSize);

            return btn;
        }

        private static Slider CreateUISlider(string name, Transform parent, float minVal, float maxVal, float defaultVal, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax)
        {
            var bgGO = CreateUIPanel(name, parent, new Color(0.08f, 0.12f, 0.16f, 0.95f), anchorMin, anchorMax, offsetMin, offsetMax);
            var slider = bgGO.AddComponent<Slider>();
            slider.minValue = minVal;
            slider.maxValue = maxVal;
            slider.value = defaultVal;

            var fillArea = new GameObject("Fill Area", typeof(RectTransform));
            fillArea.transform.SetParent(bgGO.transform, false);
            var fillAreaRT = fillArea.GetComponent<RectTransform>();
            fillAreaRT.anchorMin = new Vector2(0f, 0.25f);
            fillAreaRT.anchorMax = new Vector2(1f, 0.75f);
            fillAreaRT.offsetMin = Vector2.zero;
            fillAreaRT.offsetMax = Vector2.zero;

            var fill = CreateUIPanel("Fill", fillArea.transform, HUD_CYAN_NEON, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            slider.fillRect = fill.GetComponent<RectTransform>();
            slider.targetGraphic = fill.GetComponent<Image>();

            return slider;
        }

        private static Toggle CreateUIToggle(
            string name, Transform parent, string label, bool defaultVal,
            Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax,
            int fontSize = 18, bool bold = true)
        {
            var go = CreateUIPanel(name, parent, Color.clear, anchorMin, anchorMax, offsetMin, offsetMax);
            var toggle = go.AddComponent<Toggle>();
            toggle.isOn = defaultVal;

            var checkBg = CreateUIPanel("Background", go.transform, new Color(0.08f, 0.12f, 0.16f, 0.95f),
                new Vector2(0f, 0.2f), new Vector2(0.08f, 0.8f), Vector2.zero, Vector2.zero);
            var checkmark = CreateUIPanel("Checkmark", checkBg.transform, HUD_CYAN_NEON,
                new Vector2(0.2f, 0.2f), new Vector2(0.8f, 0.8f), Vector2.zero, Vector2.zero);

            toggle.graphic = checkmark.GetComponent<Image>();
            toggle.targetGraphic = checkBg.GetComponent<Image>();

            CreateUIText("Label", go.transform, label, fontSize, HUD_TEXT_LIGHT, TextAnchor.MiddleLeft,
                new Vector2(0.11f, 0f), new Vector2(1f, 1f), Vector2.zero, Vector2.zero, bold: bold);

            return toggle;
        }

        // ════════════════════════════════════════════════════════════════════
        // Paciente Holograma & Retícula Crosshair Helpers
        // ════════════════════════════════════════════════════════════════════

        private static Material EnsurePatientHologramMaterial()
        {
            const string matPath = "Assets/_Project/Materials/M_Patient_Hologram.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(matPath);
            if (existing != null) return existing;

            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            var shader = Shader.Find("Universal Render Pipeline/Unlit")
                         ?? Shader.Find("Universal Render Pipeline/Lit")
                         ?? Shader.Find("Unlit/Color");

            var mat = new Material(shader) { name = "M_Patient_Hologram" };
            mat.SetFloat("_Surface", 1f); // 1 = Transparent
            mat.SetFloat("_Blend", 0f);   // 0 = Alpha blend
            mat.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.SetFloat("_ZWrite", 0f);
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            mat.SetColor("_BaseColor", new Color(0f, 240f / 255f, 1f, 0.20f)); // #00F0FF Alpha 0.20

            AssetDatabase.CreateAsset(mat, matPath);
            AssetDatabase.SaveAssets();
            return mat;
        }

        private static void CreatePatientHologramAndOrientationLabels(Transform tableTransform)
        {
            Material matHolo = EnsurePatientHologramMaterial();

            // 1. Root Paciente_Holograma sobre la mesa (Capa Default = 0, NUNCA BoneXRay = 8)
            var holoRoot = new GameObject("Paciente_Holograma");
            holoRoot.layer = 0;
            holoRoot.transform.SetParent(tableTransform, false);
            holoRoot.transform.localPosition = Vector3.zero;
            holoRoot.transform.localRotation = Quaternion.identity;

            // Primitivas anatómicas suaves en decúbito supino:
            // Cabeza hacia +Z, Cuello, Torso, Pelvis y Piernas hacia -Z
            CreateHoloPart("Cabeza", PrimitiveType.Sphere, holoRoot.transform,
                new Vector3(0f, 0.12f, 0.70f), Quaternion.identity, new Vector3(0.18f, 0.18f, 0.22f), matHolo);

            CreateHoloPart("Cuello", PrimitiveType.Cylinder, holoRoot.transform,
                new Vector3(0f, 0.08f, 0.54f), Quaternion.identity, new Vector3(0.10f, 0.05f, 0.10f), matHolo);

            CreateHoloPart("Torso", PrimitiveType.Cube, holoRoot.transform,
                new Vector3(0f, 0.10f, 0.30f), Quaternion.identity, new Vector3(0.36f, 0.14f, 0.38f), matHolo);

            CreateHoloPart("Pelvis", PrimitiveType.Cube, holoRoot.transform,
                new Vector3(0f, 0.09f, 0.00f), Quaternion.identity, new Vector3(0.34f, 0.12f, 0.22f), matHolo);

            CreateHoloPart("Pierna_Izquierda", PrimitiveType.Capsule, holoRoot.transform,
                new Vector3(-0.10f, 0.08f, -0.42f), Quaternion.Euler(90f, 0f, 0f), new Vector3(0.11f, 0.28f, 0.11f), matHolo);

            CreateHoloPart("Pierna_Derecha", PrimitiveType.Capsule, holoRoot.transform,
                new Vector3(0.10f, 0.08f, -0.42f), Quaternion.Euler(90f, 0f, 0f), new Vector3(0.11f, 0.28f, 0.11f), matHolo);

            CreateHoloPart("Pie_Izquierdo", PrimitiveType.Cube, holoRoot.transform,
                new Vector3(-0.10f, 0.11f, -0.74f), Quaternion.identity, new Vector3(0.08f, 0.10f, 0.08f), matHolo);

            CreateHoloPart("Pie_Derecho", PrimitiveType.Cube, holoRoot.transform,
                new Vector3(0.10f, 0.11f, -0.74f), Quaternion.identity, new Vector3(0.08f, 0.10f, 0.08f), matHolo);

            // 2. Etiqueta 3D TextMeshPro desplazada hacia un costado de la cabecera (localPosition = (0.38f, 0.12f, 0.82f))
            Create3DTableLabel("Label_3D_Cefalico", tableTransform, "▲ CEFÁLICO (Cabeza)",
                new Vector3(0.38f, 0.12f, 0.82f), Quaternion.Euler(15f, 0f, 0f), HUD_CYAN_HIGH_CONTRAST, fontSize: 1.15f);
        }

        private static GameObject CreateHoloPart(string name, PrimitiveType primType, Transform parent,
            Vector3 localPos, Quaternion localRot, Vector3 localScale, Material mat)
        {
            var go = GameObject.CreatePrimitive(primType);
            go.name = name;
            go.layer = 0; // Layer 0 = Default, nunca BoneXRay (8)
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = localRot;
            go.transform.localScale = localScale;

            var col = go.GetComponent<Collider>();
            if (col != null) UnityEngine.Object.DestroyImmediate(col);

            var mr = go.GetComponent<MeshRenderer>();
            if (mr != null) mr.sharedMaterial = mat;

            return go;
        }

        private static void Create3DTableLabel(string name, Transform parent, string text,
            Vector3 localPos, Quaternion localRot, Color color, float fontSize = 1.15f)
        {
            var go = new GameObject(name);
            go.layer = 0;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = localRot;

            var tmp = go.AddComponent<TMPro.TextMeshPro>();
            tmp.text = text;
            tmp.fontSize = fontSize;
            tmp.color = color;
            tmp.fontStyle = TMPro.FontStyles.Bold;
            tmp.alignment = TMPro.TextAlignmentOptions.Center;
            tmp.textWrappingMode = TMPro.TextWrappingModes.NoWrap;
            tmp.rectTransform.sizeDelta = new Vector2(3.0f, 0.5f);
        }

        private static Sprite EnsureCrosshairSprite()
        {
            const string texPath = "Assets/_Project/Materials/T_Reticle_Crosshair.png";
            var existingSprite = AssetDatabase.LoadAssetAtPath<Sprite>(texPath);
            if (existingSprite != null) return existingSprite;

            const int size = 128;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.name = "T_Reticle_Crosshair";

            Color clear = new Color(0f, 0f, 0f, 0f);
            Color white = Color.white;

            float cx = size * 0.5f;
            float cy = size * 0.5f;
            float rInner = 20f;
            float rOuter = 23f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = x + 0.5f - cx;
                    float dy = y + 0.5f - cy;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);

                    // Anillo central
                    bool isRing = dist >= rInner && dist <= rOuter;

                    // Mira (+) exterior de 4 puntas: de dist 27 a 54 px con grosor de 2px
                    bool isHLine = Mathf.Abs(dy) <= 1.2f && (dist >= 27f && dist <= 54f);
                    bool isVLine = Mathf.Abs(dx) <= 1.2f && (dist >= 27f && dist <= 54f);

                    // Punto central sutil
                    bool isDot = dist <= 2.2f;

                    if (isRing || isHLine || isVLine || isDot)
                    {
                        tex.SetPixel(x, y, white);
                    }
                    else
                    {
                        tex.SetPixel(x, y, clear);
                    }
                }
            }
            tex.Apply();

            string folder = "Assets/_Project/Materials";
            if (!AssetDatabase.IsValidFolder(folder))
                AssetDatabase.CreateFolder("Assets/_Project", "Materials");

            byte[] bytes = tex.EncodeToPNG();
            string absPath = Path.Combine(Application.dataPath, "_Project/Materials/T_Reticle_Crosshair.png");
            File.WriteAllBytes(absPath, bytes);
            AssetDatabase.ImportAsset(texPath, ImportAssetOptions.ForceUpdate);

            var importer = AssetImporter.GetAtPath(texPath) as TextureImporter;
            if (importer != null)
            {
                importer.textureType = TextureImporterType.Sprite;
                importer.spriteImportMode = SpriteImportMode.Single;
                importer.alphaIsTransparency = true;
                importer.filterMode = FilterMode.Bilinear;
                importer.SaveAndReimport();
            }

            return AssetDatabase.LoadAssetAtPath<Sprite>(texPath);
        }
    }
}
