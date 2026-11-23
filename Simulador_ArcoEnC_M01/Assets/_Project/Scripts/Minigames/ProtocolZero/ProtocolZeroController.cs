using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using CArmSimulator.Core;
using CArmSimulator.Audio;

namespace CArmSimulator.Minigames.ProtocolZero
{
    public enum MinigamePhase
    {
        Phase1_ComponentRecognition,
        Phase2_SurgicalOrientation,
        Phase3_RadiationProtection
    }

    /// <summary>
    /// Minigame 1 Controller: "Protocol Zero: C-Arm Architecture"
    /// 
    /// Three sequential phases:
    ///   Phase 1 - Recognition: Accurately label the 5 critical machine nodes.
    ///   Phase 2 - Orientation: Detect inverted C-arm geometry, view scatter heatmap, and flip tube below table.
    ///   Phase 3 - Radiation Protection: Lock equipment brakes and verify lead apron, thyroid shield, and dosimeter.
    /// </summary>
    public class ProtocolZeroController : MinigameBase
    {
        // ── Scoring Rules ───────────────────────────────────────────────────
        private const int PTS_COMPONENT_LABELED     = 10;
        private const int PTS_ORIENTATION_FIXED     = 30;
        private const int PENALTY_FIRE_INVERTED     = -20;
        private const int PTS_PPE_ITEM              = 10;
        private const int PTS_PERFECT_PHASE_BONUS   = 15;

        // ── Phase 1: Component Recognition ──────────────────────────────────
        [Header("Phase 1 – Machine Components")]
        [SerializeField] private ArcNodeLabel[] arcNodes;

        private readonly HashSet<ArcNodeType> labeledNodes = new HashSet<ArcNodeType>();
        private int phase1Errors = 0;

        // ── Phase 2: Surgical Orientation & Radiation Visuals ───────────────
        [Header("Phase 2 – C-Arm Geometry & Radiation Visuals")]
        [SerializeField] private Transform arcTransform;
        [SerializeField] private ParticleSystem heatmapParticles;
        [SerializeField] private ParticleSystem patientScatterParticles;
        [SerializeField] private Renderer collimatorIndicatorRenderer;
        [SerializeField] private Light tubeEmissionLight;
        [SerializeField] private float invertAnimationDuration = 1.2f;

        private bool isArcInverted = true; // Initially inverted (tube on top)
        public bool IsArcInverted => isArcInverted;
        public bool IsArcInverting => invertCoroutine != null;
        public bool IsHeatmapDisplayed { get; private set; } = false;
        private int phase2Errors = 0;
        private Coroutine invertCoroutine;
        private Vector3 initialArcLocalPosition = new Vector3(0f, 0.85f, 0f);
        private bool hasCapturedInitialArcPos = false;

        // ── Phase 3: Radiation Protection ───────────────────────────────────
        [Header("Phase 3 – PPE & Brake Verification")]
        [SerializeField] private PpeItem[] ppeItems;

        private readonly HashSet<PpeType> activatedPpe = new HashSet<PpeType>();
        private int phase3Errors = 0;

        // ── Dra. Nova Clinical Dialogues & Case Context ─────────────────────
        public const string CLINICAL_CASE_CONTEXT = "Preparación prequirúrgica de urgencia para osteosíntesis de fémur proximal.";
        public const string INVERTED_TUBE_FEEDBACK = "¡Alerta de radioprotección! Tienes el tubo emisor arriba y el detector abajo. Si disparas así, la radiación rebotará directamente hacia tu rostro y tu cristalino multiplicando tu dosis por cuatro. Invierte el arco: el tubo emisor siempre va debajo de la mesa.";
        public const string INCOMPLETE_PPE_FEEDBACK = "Protocolo bloqueado: En el instante en que pisas el pedal, el paciente se convierte en la principal fuente de radiación secundaria por Efecto Compton. Equipa tu delantal plomado, collarín tiroideo, gafas y dosímetro para proteger manos, tiroides y ojos.";
        public const string PHASE_SUCCESS_FEEDBACK = "Geometría de mesa verificada: tubo emisor abajo, detector plano arriba y equipo quirúrgico blindado.";

        public const string TUTOR_RESCUE_INVERTED =
            "PRINCIPIO FÍSICO DE RADIOPROTECCIÓN: El tubo emisor de rayos X produce un haz primario cónico. Al estar situado por encima de la mesa, la radiación retrodispersada por Efecto Compton emerge directamente hacia la cabeza, cuello y cristalino del operador, multiplicando la dosis ocupacional por cuatro.\n\n" +
            "ACCIÓN DE RESCATE OBLIGATORIA: Presiona el botón 'INVERTIR ARCO' para posicionar el tubo debajo del tablero de la mesa quirúrgica. De este modo, la mesa y el paciente atenúan la dispersión antes de que alcance al equipo médico.";

        public const string TUTOR_RESCUE_PPE =
            "BLINDAJE Y PROTECCIÓN PERSONAL: En el instante en que el pedal activa el tubo emisor, el paciente se convierte en una fuente tridimensional de radiación secundaria dispersa por Efecto Compton.\n\n" +
            "ACCIÓN DE RESCATE OBLIGATORIA: Activa todos los elementos de la lista de verificación:\n" +
            "1. Frenos bloqueados (estabilidad mecánica absoluta)\n" +
            "2. Delantal plomado (protección gonadal y troncal)\n" +
            "3. Collarín tiroideo (blindaje de tejido tiroideo radiosensible)\n" +
            "4. Dosímetro personal (registro acumulativo de dosis)\n" +
            "5. Gafas plomadas (protección del cristalino contra radiocataratas).";

        // ── Phase Management ────────────────────────────────────────────────
        public MinigamePhase CurrentPhase { get; private set; } = MinigamePhase.Phase1_ComponentRecognition;

        // ── Events for UI / HUD ─────────────────────────────────────────────
        public event Action<MinigamePhase, int> OnPhaseChanged; // (currentPhase, totalPhases)
        public event Action<ArcNodeType, bool> OnNodeLabelEvaluated;
        public event Action<bool, string> OnFireAttemptedWithInvertedArc; // (isBlocked, feedback)
        public event Action OnHeatmapActivated;
        public event Action<string> OnArcOrientationCorrected;
        public event Action<PpeType, bool> OnPpeItemEvaluated;
        public event Action<string> OnAllSafetyChecksPassed;

        protected override void InitializeMinigame()
        {
            ResetFailedAttempts();
            labeledNodes.Clear();
            activatedPpe.Clear();
            phase1Errors = 0;
            phase2Errors = 0;
            phase3Errors = 0;

            if (invertCoroutine != null)
            {
                StopCoroutine(invertCoroutine);
                invertCoroutine = null;
            }

            isArcInverted = true;
            IsHeatmapDisplayed = false;

            if (arcTransform != null)
            {
                if (!hasCapturedInitialArcPos)
                {
                    initialArcLocalPosition = arcTransform.localPosition;
                    hasCapturedInitialArcPos = true;
                }
                else
                {
                    arcTransform.localPosition = initialArcLocalPosition;
                }
                arcTransform.localEulerAngles = new Vector3(180f, 0f, 0f);
            }

            // Hook up node events
            if (arcNodes != null)
            {
                foreach (var node in arcNodes)
                {
                    if (node == null) continue;
                    node.ResetLabel();
                    node.OnLabelAttempt -= HandleNodeLabelAttempt;
                    node.OnLabelAttempt += HandleNodeLabelAttempt;
                }
            }

            // Hook up PPE events
            if (ppeItems != null)
            {
                foreach (var ppe in ppeItems)
                {
                    if (ppe == null) continue;
                    ppe.ResetVisualState();
                    ppe.OnItemActivated -= HandlePpeItemActivated;
                    ppe.OnItemActivated += HandlePpeItemActivated;
                }
            }

            if (heatmapParticles != null)
            {
                heatmapParticles.Stop();
            }
            if (patientScatterParticles != null)
            {
                patientScatterParticles.Stop();
            }
            if (tubeEmissionLight != null)
            {
                tubeEmissionLight.intensity = 0f;
                tubeEmissionLight.enabled = false;
            }

            StartPhase1();
        }

        private Material collimatorMat;

        private void Awake()
        {
            if (collimatorIndicatorRenderer != null)
            {
                collimatorMat = collimatorIndicatorRenderer.material;
            }
        }

        private void OnDestroy()
        {
            if (invertCoroutine != null)
            {
                StopCoroutine(invertCoroutine);
                invertCoroutine = null;
            }
            if (heatmapCoroutine != null)
            {
                StopCoroutine(heatmapCoroutine);
                heatmapCoroutine = null;
            }
            if (patientScatterCoroutine != null)
            {
                StopCoroutine(patientScatterCoroutine);
                patientScatterCoroutine = null;
            }
            if (pulseCoroutine != null)
            {
                StopCoroutine(pulseCoroutine);
                pulseCoroutine = null;
            }

            if (collimatorMat != null)
            {
                Destroy(collimatorMat);
                collimatorMat = null;
            }

            if (arcNodes != null)
            {
                foreach (var node in arcNodes)
                {
                    if (node != null) node.OnLabelAttempt -= HandleNodeLabelAttempt;
                }
            }

            if (ppeItems != null)
            {
                foreach (var ppe in ppeItems)
                {
                    if (ppe != null) ppe.OnItemActivated -= HandlePpeItemActivated;
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // Phase 1: Machine Components Recognition
        // ════════════════════════════════════════════════════════════════════

        private void StartPhase1()
        {
            CurrentPhase = MinigamePhase.Phase1_ComponentRecognition;
            isArcInverted = true;
            if (arcTransform != null)
            {
                if (hasCapturedInitialArcPos)
                {
                    arcTransform.localPosition = initialArcLocalPosition;
                }
                arcTransform.localEulerAngles = new Vector3(180f, 0f, 0f);
            }
            OnPhaseChanged?.Invoke(CurrentPhase, 3);
            Debug.Log("[ProtocolZero] Phase 1 active: Critical Node Recognition. Arc positioned initially at 180° (tube up).");
        }

        private void HandleNodeLabelAttempt(ArcNodeType nodeType, bool isCorrect)
        {
            if (CurrentPhase != MinigamePhase.Phase1_ComponentRecognition) return;

            OnNodeLabelEvaluated?.Invoke(nodeType, isCorrect);

            if (isCorrect)
            {
                if (labeledNodes.Add(nodeType))
                {
                    AddScore(PTS_COMPONENT_LABELED);
                }

                int totalRequired = arcNodes != null ? arcNodes.Length : 5;
                if (labeledNodes.Count >= totalRequired)
                {
                    if (phase1Errors == 0) AddScore(PTS_PERFECT_PHASE_BONUS);
                    StartPhase2();
                }
            }
            else
            {
                phase1Errors++;
                RecordError(5);
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // Phase 2: Surgical Orientation & Scatter Heatmap
        // ════════════════════════════════════════════════════════════════════

        private void StartPhase2()
        {
            CurrentPhase = MinigamePhase.Phase2_SurgicalOrientation;
            OnPhaseChanged?.Invoke(CurrentPhase, 3);
            Debug.Log("[ProtocolZero] Phase 2 active: Surgical Geometry Verification.");
        }

        public event Action<string> OnExposureBlockedByPpe;

        /// <summary>
        /// Triggered when user attempts exposure.
        /// Evaluates current radiation safety status (arc orientation + PPE checklist).
        /// </summary>
        public void AttemptExposure()
        {
            if (invertCoroutine != null)
            {
                Debug.Log("[ProtocolZero] Exposure blocked: Arc movement/inversion in progress.");
                return;
            }

            // 1. Efecto visual y sonoro del tubo emisor de rayos X (Norma IEC 60601-2-54)
            TriggerXRayPulseVisual();

            if (isArcInverted)
            {
                phase2Errors++;
                if (failedAttemptsCount >= 2)
                {
                    failedAttemptsCount++;
                    TriggerTutorRescue(TUTOR_RESCUE_INVERTED);
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    return;
                }

                failedAttemptsCount++;
                RecordError(Mathf.Abs(PENALTY_FIRE_INVERTED));

                ShowScatterHeatmap();
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnFireAttemptedWithInvertedArc?.Invoke(true, INVERTED_TUBE_FEEDBACK);

                Debug.LogWarning("[ProtocolZero] Inverted exposure attempt! Radiation scatter x4 towards operator.");
            }
            else
            {
                int totalRequired = ppeItems != null ? ppeItems.Length : 5;
                if (activatedPpe.Count < totalRequired)
                {
                    phase3Errors++;
                    if (failedAttemptsCount >= 2)
                    {
                        failedAttemptsCount++;
                        TriggerTutorRescue(TUTOR_RESCUE_PPE);
                        AudioSFXManager.Instance?.PlayWarningScatter();
                        return;
                    }

                    failedAttemptsCount++;
                    RecordError(5);
                    ShowPatientScatterHeatmap(); // Dispersión Compton emanando del PACIENTE hacia los lados
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    OnExposureBlockedByPpe?.Invoke(INCOMPLETE_PPE_FEEDBACK);
                    Debug.LogWarning("[ProtocolZero] Exposure attempted without PPE! Compton scatter burst emitted from patient.");
                }
                else
                {
                    ResetFailedAttempts();
                    if (phase2Errors == 0 && phase3Errors == 0) AddScore(PTS_PERFECT_PHASE_BONUS);

                    AudioSFXManager.Instance?.PlayBeepXRay();
                    OnAllSafetyChecksPassed?.Invoke(PHASE_SUCCESS_FEEDBACK);
                    Debug.Log("[ProtocolZero] All safety checks passed. Test exposure authorized! ✓");

                    CompleteMinigame(true);
                }
            }
        }

        private Coroutine heatmapCoroutine;
        private Coroutine patientScatterCoroutine;
        private Coroutine pulseCoroutine;

        public void ShowScatterHeatmap(float duration = 2.5f)
        {
            if (heatmapCoroutine != null) StopCoroutine(heatmapCoroutine);
            heatmapCoroutine = StartCoroutine(EmitHeatmapRoutine(duration));

            IsHeatmapDisplayed = true;
            OnHeatmapActivated?.Invoke();
        }

        private IEnumerator EmitHeatmapRoutine(float duration)
        {
            if (heatmapParticles != null)
            {
                heatmapParticles.Play();
                yield return new WaitForSeconds(duration);
                heatmapParticles.Stop();
            }
            heatmapCoroutine = null;
        }

        public void ShowPatientScatterHeatmap(float duration = 2.5f)
        {
            if (patientScatterCoroutine != null) StopCoroutine(patientScatterCoroutine);
            patientScatterCoroutine = StartCoroutine(EmitPatientScatterRoutine(duration));

            IsHeatmapDisplayed = true;
            OnHeatmapActivated?.Invoke();
        }

        private IEnumerator EmitPatientScatterRoutine(float duration)
        {
            if (patientScatterParticles != null)
            {
                patientScatterParticles.Play();
                yield return new WaitForSeconds(duration);
                patientScatterParticles.Stop();
            }
            patientScatterCoroutine = null;
        }

        public void TriggerXRayPulseVisual(float duration = 0.8f)
        {
            if (pulseCoroutine != null) StopCoroutine(pulseCoroutine);
            pulseCoroutine = StartCoroutine(XRayPulseRoutine(duration));
        }

        private IEnumerator XRayPulseRoutine(float duration)
        {
            AudioSFXManager.Instance?.PlayBeepXRay();

            if (tubeEmissionLight != null)
            {
                tubeEmissionLight.enabled = true;
            }

            Material mat = collimatorMat != null ? collimatorMat : (collimatorIndicatorRenderer != null ? collimatorIndicatorRenderer.sharedMaterial : null);
            Color baseEmission = new Color(1f, 0.40f, 0f) * 1.5f;
            Color peakEmission = new Color(1f, 0.75f, 0.1f) * 5.5f;

            float timer = 0f;
            while (timer < duration)
            {
                timer += Time.deltaTime;
                float progress = timer / duration;
                float intensity = Mathf.Sin(progress * Mathf.PI);

                if (tubeEmissionLight != null)
                {
                    tubeEmissionLight.intensity = Mathf.Lerp(0f, 3.5f, intensity);
                }

                if (mat != null)
                {
                    mat.SetColor("_EmissionColor", Color.Lerp(baseEmission, peakEmission, intensity));
                }

                yield return null;
            }

            if (tubeEmissionLight != null)
            {
                tubeEmissionLight.intensity = 0f;
                tubeEmissionLight.enabled = false;
            }
            if (mat != null)
            {
                mat.SetColor("_EmissionColor", baseEmission);
            }

            pulseCoroutine = null;
        }

        /// <summary>
        /// Safely rotates C-arm 180 degrees so the tube is positioned below the radiolucent surgical table.
        /// Executes a realistic 3-stage kinematic sequence:
        /// 1. Lateral retraction: Withdraws the arc laterally away from patient & table along -X into clear airspace.
        /// 2. Rotation: Flips the arc 180° around X axis (tube goes down, detector goes up) with zero table collision.
        /// 3. Re-entry: Advances the arc laterally back to the surgical isocenter over/under the table.
        /// </summary>
        public void CorrectArcOrientation()
        {
            if (!isArcInverted)
            {
                Debug.Log("[ProtocolZero] Arc is already in safe orientation (tube under table).");
                return;
            }

            if (invertCoroutine != null)
            {
                Debug.Log("[ProtocolZero] Arc inversion maneuver already in progress.");
                return;
            }

            invertCoroutine = StartCoroutine(RotateArcRoutine());
        }

        private IEnumerator RotateArcRoutine()
        {
            if (pulseCoroutine != null)
            {
                StopCoroutine(pulseCoroutine);
                pulseCoroutine = null;
            }
            if (tubeEmissionLight != null)
            {
                tubeEmissionLight.intensity = 0f;
                tubeEmissionLight.enabled = false;
            }
            if (collimatorMat != null)
            {
                collimatorMat.SetColor("_EmissionColor", new Color(1f, 0.40f, 0f) * 1.5f);
            }
            else if (collimatorIndicatorRenderer != null && collimatorIndicatorRenderer.sharedMaterial != null)
            {
                collimatorIndicatorRenderer.sharedMaterial.SetColor("_EmissionColor", new Color(1f, 0.40f, 0f) * 1.5f);
            }

            if (heatmapCoroutine != null)
            {
                StopCoroutine(heatmapCoroutine);
                heatmapCoroutine = null;
            }
            if (heatmapParticles != null) heatmapParticles.Stop();

            if (patientScatterCoroutine != null)
            {
                StopCoroutine(patientScatterCoroutine);
                patientScatterCoroutine = null;
            }
            if (patientScatterParticles != null) patientScatterParticles.Stop();

            if (arcTransform != null)
            {
                Vector3 initialPos = hasCapturedInitialArcPos ? initialArcLocalPosition : arcTransform.localPosition;

                // Calcule el retroceso seguro en X para salir del perímetro de la camilla (X = -0.27m a +0.27m).
                // La columna está en X = -0.95m. El pasillo libre central es X_world ≈ -0.55m.
                // Calculamos el desplazamiento necesario en coordenadas locales para que el arco se sitúe en el pasillo libre.
                float targetWorldX = -0.55f;
                float currentWorldX = arcTransform.position.x;
                float worldDeltaX = targetWorldX - currentWorldX;

                // Asegurar al menos -0.50m de retroceso para despejar completamente detector y tubo
                if (worldDeltaX > -0.50f)
                {
                    worldDeltaX = -0.55f;
                }

                Vector3 retractedPos = new Vector3(initialPos.x + worldDeltaX, initialPos.y, initialPos.z);

                // ── Etapa 1: Retracción lateral (Separar el arco de la camilla hacia el pasillo despejado) ──
                AudioSFXManager.Instance?.PlayMotorMove();
                float retractDuration = 0.50f;
                float timer = 0f;
                while (timer < retractDuration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / retractDuration);
                    arcTransform.localPosition = Vector3.Lerp(initialPos, retractedPos, progress);
                    yield return null;
                }
                arcTransform.localPosition = retractedPos;

                // ── Etapa 2: Rotación de 180° en espacio aéreo libre de colisión ──
                AudioSFXManager.Instance?.PlayMotorMove();
                float rotateDuration = Mathf.Max(0.75f, invertAnimationDuration * 0.70f);
                const float startX = 180f;
                const float targetX = 0f;
                timer = 0f;
                while (timer < rotateDuration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / rotateDuration);
                    float currentX = Mathf.Lerp(startX, targetX, progress);
                    arcTransform.localEulerAngles = new Vector3(currentX, 0f, 0f);
                    yield return null;
                }
                arcTransform.localEulerAngles = new Vector3(targetX, 0f, 0f);

                // ── Etapa 3: Reingreso lateral al isocentro sobre la camilla ──
                AudioSFXManager.Instance?.PlayMotorMove();
                float returnDuration = 0.50f;
                timer = 0f;
                while (timer < returnDuration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / returnDuration);
                    arcTransform.localPosition = Vector3.Lerp(retractedPos, initialPos, progress);
                    yield return null;
                }
                arcTransform.localPosition = initialPos;
            }

            isArcInverted = false;
            invertCoroutine = null;
            ResetFailedAttempts();
            AddScore(PTS_ORIENTATION_FIXED);
            if (phase2Errors == 0) AddScore(PTS_PERFECT_PHASE_BONUS);

            OnArcOrientationCorrected?.Invoke(PHASE_SUCCESS_FEEDBACK);
            Debug.Log("[ProtocolZero] C-Arm inverted safely: Arc retracted laterally, flipped 180°, and re-entered table without collision. ✓");

            StartPhase3();
        }

        // ════════════════════════════════════════════════════════════════════
        // Phase 3: Radiation Protection & Brake Verification
        // ════════════════════════════════════════════════════════════════════

        private void StartPhase3()
        {
            CurrentPhase = MinigamePhase.Phase3_RadiationProtection;
            OnPhaseChanged?.Invoke(CurrentPhase, 3);
            Debug.Log("[ProtocolZero] Phase 3 active: Radiation Protection Check.");
        }

        private void HandlePpeItemActivated(PpeType ppeType)
        {
            if (activatedPpe.Add(ppeType))
            {
                AddScore(PTS_PPE_ITEM);
                OnPpeItemEvaluated?.Invoke(ppeType, true);

                int totalRequired = ppeItems != null ? ppeItems.Length : 5;
                if (activatedPpe.Count >= totalRequired && !isArcInverted)
                {
                    if (phase3Errors == 0) AddScore(PTS_PERFECT_PHASE_BONUS);

                    OnAllSafetyChecksPassed?.Invoke(PHASE_SUCCESS_FEEDBACK);
                    Debug.Log("[ProtocolZero] All safety checks passed. Exposure pedal unlocked. ✓");

                    CompleteMinigame(true);
                }
            }
        }

        public bool IsPpeVerified(PpeType type) => activatedPpe.Contains(type);
        public int VerifiedPpeCount => activatedPpe.Count;

        /// <summary>Allows UI buttons or external events to activate a PPE check directly.</summary>
        public void VerifyPpe(PpeType ppeType)
        {
            if (ppeItems != null)
            {
                foreach (var item in ppeItems)
                {
                    if (item != null && item.ppeType == ppeType)
                    {
                        item.Activate();
                        return;
                    }
                }
            }
            HandlePpeItemActivated(ppeType);
        }
    }
}
