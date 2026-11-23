using System;
using System.Collections;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEngine.UI;
using CArmSimulator.Core;
using CArmSimulator.Data;
using CArmSimulator.Minigames;
using CArmSimulator.Minigames.ProtocolZero;
using CArmSimulator.Minigames.BeamMaster;
using CArmSimulator.Minigames.IsocenterCommand;
using CArmSimulator.Scorm;
using CArmSimulator.Audio;
using CArmSimulator.Web;

namespace CArmSimulator.UI
{
    /// <summary>
    /// Master UI Controller for the Cyan-Neon HUD.
    /// Bridges user inputs and event-driven displays for all three minigames,
    /// telemetric indicators, and Dra. Nova clinical feedback cards.
    /// </summary>
    public class CArmUIController : MonoBehaviour
    {
        [Header("Single-Phase Web Mode")]
        public bool singlePhaseWebMode = true;
        [Range(1, 3)] public int defaultStartPhase = 1;

        [Header("Controllers")]
        [SerializeField] private GameManager gameManager;
        [SerializeField] private ProtocolZeroController protocolZeroController;
        [SerializeField] private BeamMasterController beamMasterController;
        [SerializeField] private IsocenterCommandController isocenterController;

        [Header("Global Top Bar Indicators")]
        [SerializeField] private Text doseText;
        [SerializeField] private Text qualityText;
        [SerializeField] private Text timerText;
        [SerializeField] private Image anodeFillImage;
        [SerializeField] private Text anodeText;

        [Header("Left Panel – Fluoroscopy & Dra. Nova Card")]
        [SerializeField] private RawImage fluoroscopeDisplay;
        [SerializeField] private RectTransform collimatorMask;
        [SerializeField] private RectTransform shutterTop;
        [SerializeField] private RectTransform shutterBottom;
        [SerializeField] private RectTransform shutterLeft;
        [SerializeField] private RectTransform shutterRight;
        [SerializeField] private GameObject draNovaCard;
        [SerializeField] private Text draNovaTitleText;
        [SerializeField] private Text draNovaBodyText;
        [SerializeField] private Button draNovaContinueButton;

        [Header("Fluoroscopy HUD Clinical Overlay")]
        [SerializeField] private Image reticleCrosshair;
        [SerializeField] private Text txtMonitorTelemetry;
        [SerializeField] private Text txtAttemptsBadge;

        [Header("Minigame Subpanels & Navigation Tabs")]
        [SerializeField] private GameObject panelMG1;
        [SerializeField] private GameObject panelMG2;
        [SerializeField] private GameObject panelMG3;
        [SerializeField] private Button btnTabMG1;
        [SerializeField] private Button btnTabMG2;
        [SerializeField] private Button btnTabMG3;

        [Header("MG1: Protocol Zero Controls")]
        [SerializeField] private Button btnInvertArc;
        [SerializeField] private Button btnVerifySafety;
        [SerializeField] private Button btnPpeBrakes;
        [SerializeField] private Button btnPpeApron;
        [SerializeField] private Button btnPpeThyroid;
        [SerializeField] private Button btnPpeDosimeter;
        [SerializeField] private Button btnPpeGlasses;

        [Header("MG2: Beam Master Controls")]
        [SerializeField] private Text textMG2CaseHeader;
        [SerializeField] private Slider sliderKvp;
        [SerializeField] private Text textKvpValue;
        [SerializeField] private Slider sliderMA;
        [SerializeField] private Text textMAValue;
        [SerializeField] private Slider sliderCollimation;
        [SerializeField] private Text textCollimationValue;
        [SerializeField] private Toggle toggleStepBack;
        [SerializeField] private Button btnExposurePedal;

        [Header("MG3: Closed-Loop Order Builder (3 Columns x 6 Buttons)")]
        [SerializeField] private Button[] col1Buttons = new Button[6];
        [SerializeField] private Button[] col2Buttons = new Button[6];
        [SerializeField] private Button[] col3Buttons = new Button[6];

        [SerializeField] private Text textMG3CaseHeader;
        [SerializeField] private Text textBuiltOrder;
        [SerializeField] private Button btnSubmitOrder;
        [SerializeField] private Button btnRotate90;

        // Tutor Mode Mandatory Reading Constant (Reduced to 15 seconds)
        private const float TUTOR_MANDATORY_READ_SECONDS = 15f;

        // Visual Palette Colors
        private readonly Color cyanNeon      = new Color(0f, 0.941f, 1f, 1f);
        private readonly Color warningOrange = new Color(1f, 0.55f, 0f, 1f);
        private readonly Color dangerRed     = new Color(1f, 0.15f, 0.15f, 1f);
        private readonly Color safeGreen     = new Color(0.1f, 0.9f, 0.3f, 1f);
        private readonly Color activeBtnColor= new Color(0f, 0.6f, 0.8f, 1f);
        private readonly Color btnDarkBg     = new Color(14f / 255f, 34f / 255f, 46f / 255f, 1f);
        private readonly Color trapRedBg     = new Color(75f / 255f, 18f / 255f, 24f / 255f, 1f);
        private readonly Color hudTextLight  = new Color(240f / 255f, 250f / 255f, 255f / 255f, 1f);

        // Semantic Clinical Colors for Dra. Nova Card & Attempts Badge
        private readonly Color colorCyanNeon   = new Color(0f, 240f / 255f, 1f, 1f);           // #00F0FF
        private readonly Color colorRedCoral   = new Color(255f / 255f, 59f / 255f, 48f / 255f, 1f);   // #FF3B30
        private readonly Color colorAmberTutor = new Color(255f / 255f, 184f / 255f, 0f, 1f);  // #FFB800
        private readonly Color colorGreenSurge = new Color(25f / 255f, 225f / 255f, 90f / 255f, 1f);  // #19E15A
        private readonly Color colorYellowWarn = new Color(255f / 255f, 214f / 255f, 10f / 255f, 1f); // #FFD60A
        private readonly Color colorOrangeWarn = new Color(255f / 255f, 159f / 255f, 10f / 255f, 1f); // #FF9F0A

        // Movement / Direction / Magnitude labels for live order assembly
        private string currentMov = "[Movimiento]";
        private string currentDir = "[Dirección]";
        private string currentMag = "[Magnitud]";
        private int currentActiveTab = 1;
        private bool isPhase3Completed = false;
        private bool isTutorCountdownActive = false;
        private Coroutine tutorCountdownCoroutine = null;
        private Coroutine tutorHighlightCoroutine = null;
        private readonly Dictionary<Graphic, Color> highlightedOriginalColors = new Dictionary<Graphic, Color>();

        public enum DraNovaCardTheme
        {
            CyanInfo,       // #00F0FF Briefing inicial o estado informativo
            RedDanger,      // #FF3B30 Disparo inseguro, error de parámetros, opción trampa o pérdida de isocentro
            AmberTutor,     // #FFB800 Modo Tutor activo
            GreenSuccess    // #19E15A Orden verificada, caso clínico superado o fase completada
        }

        public struct DraNovaDialogStep
        {
            public string title;
            public string body;
            public string buttonText;
            public DraNovaCardTheme? theme;

            public DraNovaDialogStep(string title, string body, string buttonText = null, DraNovaCardTheme? theme = null)
            {
                this.title = title;
                this.body = body;
                this.buttonText = buttonText;
                this.theme = theme;
            }
        }

        private readonly List<DraNovaDialogStep> activeDialogSequence = new List<DraNovaDialogStep>();
        private int currentDialogSequenceIndex = 0;
        private Action onSequenceCompletedCallback = null;

        // UI component & zero-GC state caches
        private Outline draNovaOutline;
        private Text draNovaContinueButtonText;
        private string lastMonitorTelemetryText = null;
        private int lastReticleAligned = -1;
        private int lastAttemptsFails = -1;
        private bool lastAttemptsTutorActive = false;
        private int lastDisplayedSecond = -1;

        // Cached delegates for clean unsubscription
        private Action<string, string> onP0TutorRescue;
        private Action<bool, string> onP0FireAttemptedWithInvertedArc;
        private Action<string> onP0ExposureBlockedByPpe;
        private Action<string> onP0ArcOrientationCorrected;
        private Action<string> onP0AllSafetyChecksPassed;
        private Action<float> onP0TimeUpdated;

        private Action<string, string> onBmTutorRescue;
        private Action<int, ClinicalCase> onBmCaseStarted;
        private Action<ConsoleState> onBmConsoleUpdated;
        private Action<string> onBmAnodeThermalWarning;
        private Action<bool, string> onBmAnodeOverheatStateChanged;
        private Action<ExposureReport> onBmExposureTriggered;
        private Action<float> onBmTimeUpdated;

        private Action<string, string> onIsoTutorRescue;
        private Action<string, string> onIsoAmbiguousOrder;
        private Action<List<OrderCatalogItem>, List<OrderCatalogItem>, List<OrderCatalogItem>> onIsoCatalogShuffled;
        private Action<SlotSnapshot> onIsoSlotsUpdated;
        private Action<BuiltOrder, bool, string> onIsoOrderEvaluated;
        private Action<bool, string> onIsoOrbitalRotationEvaluated;
        private Action<MinigameResult> onIsoMinigameEnded;
        private Action<int, FractureCase> onIsoFractureCaseStarted;
        private Action<string> onIsoIncompleteOrderSubmitted;
        private Action<float> onIsoTimeUpdated;

        private void Awake()
        {
            if (draNovaCard != null)
            {
                draNovaOutline = draNovaCard.GetComponent<Outline>();
            }
            if (draNovaContinueButton != null)
            {
                draNovaContinueButtonText = draNovaContinueButton.GetComponentInChildren<Text>();
            }
        }

        private Text GetDraNovaButtonText()
        {
            if (draNovaContinueButtonText == null && draNovaContinueButton != null)
            {
                draNovaContinueButtonText = draNovaContinueButton.GetComponentInChildren<Text>();
            }
            return draNovaContinueButtonText;
        }

        private void Start()
        {
            AudioSFXManager.EnsureInstance();

            // Auto-locate controllers if unassigned
            if (!gameManager) gameManager = FindAnyObjectByType<GameManager>();
            if (!protocolZeroController) protocolZeroController = FindAnyObjectByType<ProtocolZeroController>();
            if (!beamMasterController) beamMasterController = FindAnyObjectByType<BeamMasterController>();
            if (!isocenterController) isocenterController = FindAnyObjectByType<IsocenterCommandController>();

            HookEvents();
            SetupButtonListeners();

            // Determine initial phase: inspect absoluteURL (?phase=1|2|3 or &phase=X) or fallback to defaultStartPhase
            int targetPhase = defaultStartPhase;
            if (!string.IsNullOrEmpty(Application.absoluteURL))
            {
                int detected = DetectPhaseFromURL(Application.absoluteURL);
                if (detected >= 1 && detected <= 3)
                {
                    targetPhase = detected;
                    Debug.Log($"[CArmUIController] Target phase detected from URL ({Application.absoluteURL}): Phase {targetPhase}");
                }
            }
            else
            {
                Debug.Log($"[CArmUIController] Standalone/Editor mode: Starting in Phase {targetPhase} (singlePhaseWebMode={singlePhaseWebMode})");
            }

            // Launch target subpanel directly
            ShowSubpanel(targetPhase);

            // In single-phase web mode, enforce tab locking
            if (singlePhaseWebMode)
            {
                ConfigureTabLocksForSinglePhase(targetPhase);
            }

            ApplyTypographyScaling();
            UpdateAttemptsBadge();
            UpdateMonitorTelemetry();
            UpdateReticleCrosshair();
        }

        private void Update()
        {
            UpdateMonitorTelemetry();
            UpdateReticleCrosshair();
            UpdateAttemptsBadge();
        }

        public MinigameBase GetActiveMinigameController()
        {
            if (currentActiveTab == 1) return protocolZeroController;
            if (currentActiveTab == 2) return beamMasterController;
            if (currentActiveTab == 3) return isocenterController;
            return null;
        }

        public void SetDraNovaTheme(DraNovaCardTheme theme)
        {
            Color c = colorCyanNeon;
            switch (theme)
            {
                case DraNovaCardTheme.RedDanger:    c = colorRedCoral; break;
                case DraNovaCardTheme.AmberTutor:   c = colorAmberTutor; break;
                case DraNovaCardTheme.GreenSuccess: c = colorGreenSurge; break;
                case DraNovaCardTheme.CyanInfo:     c = colorCyanNeon; break;
            }

            if (draNovaTitleText != null) draNovaTitleText.color = c;
            if (draNovaOutline == null && draNovaCard != null)
            {
                draNovaOutline = draNovaCard.GetComponent<Outline>();
            }
            if (draNovaOutline != null)
            {
                draNovaOutline.effectColor = c;
            }
        }

        public DraNovaCardTheme InferThemeFromTitle(string title)
        {
            if (string.IsNullOrEmpty(title)) return DraNovaCardTheme.CyanInfo;
            string up = title.ToUpperInvariant();
            if (up.Contains("TUTOR") || up.Contains("RESCATE")) return DraNovaCardTheme.AmberTutor;
            if (up.Contains("ALERTA") || up.Contains("INCOMPLETA") || up.Contains("BLOQUEO") ||
                up.Contains("RECHAZADA") || up.Contains("ERRÓNEA") || up.Contains("ERRONEA") ||
                up.Contains("PÉRDIDA") || up.Contains("PERDIDA") || up.Contains("ERROR") ||
                up.Contains("INSEGURA") || up.Contains("TRAMPA"))
            {
                return DraNovaCardTheme.RedDanger;
            }
            if (up.Contains("VERIFICADA") || up.Contains("VERIFICADO") || up.Contains("SUPERADO") ||
                up.Contains("COMPLETO") || up.Contains("COMPLETADO") || up.Contains("ÉXITO") || up.Contains("EXITO"))
            {
                return DraNovaCardTheme.GreenSuccess;
            }
            return DraNovaCardTheme.CyanInfo;
        }

        public void UpdateAttemptsBadge()
        {
            if (txtAttemptsBadge == null) return;

            var activeMG = GetActiveMinigameController();
            int fails = activeMG != null ? activeMG.FailedAttemptsCount : 0;
            bool tutorActive = activeMG != null && activeMG.IsTutorRescueActive;

            if (fails == lastAttemptsFails && tutorActive == lastAttemptsTutorActive) return;

            lastAttemptsFails = fails;
            lastAttemptsTutorActive = tutorActive;

            if (tutorActive || fails >= 3)
            {
                txtAttemptsBadge.text = "⚡ MODO TUTOR ACTIVO";
                txtAttemptsBadge.color = colorAmberTutor; // #FFB800
            }
            else if (fails == 2)
            {
                txtAttemptsBadge.text = "INTENTOS: ● ○ ○";
                txtAttemptsBadge.color = colorOrangeWarn; // #FF9F0A
            }
            else if (fails == 1)
            {
                txtAttemptsBadge.text = "INTENTOS: ● ● ○";
                txtAttemptsBadge.color = colorYellowWarn; // #FFD60A
            }
            else
            {
                txtAttemptsBadge.text = "INTENTOS: ● ● ●";
                txtAttemptsBadge.color = colorCyanNeon; // #00F0FF
            }
        }

        private void UpdateMonitorTelemetry()
        {
            if (txtMonitorTelemetry == null) return;

            string proy = "PROY: AP 0°";
            string iso = "ISO: CENTRADO";

            if (currentActiveTab == 1)
            {
                bool inv = protocolZeroController != null && protocolZeroController.IsArcInverted;
                proy = inv ? "PROY: INVERTIDA (Tubo Arriba)" : "PROY: AP 0° (Tubo Abajo)";
                iso = inv ? "ISO: BLOQUEADO" : "ISO: SEGURO";
            }
            else if (currentActiveTab == 2)
            {
                string seg = beamMasterController != null && beamMasterController.CurrentCase != null
                    ? (beamMasterController.CurrentCaseIndex == 0 ? "HOMBRO" : beamMasterController.CurrentCaseIndex == 1 ? "FÉMUR" : "PELVIS")
                    : "AP";
                proy = $"PROY: AP 0° ({seg})";
                iso = "ISO: CENTRADO";
            }
            else if (currentActiveTab == 3 && isocenterController != null)
            {
                int caseIdx = isocenterController.CurrentFractureIndex;
                float angleZ = isocenterController.ArcOrbitalAngle;
                bool aligned = isocenterController.IsIsocenterAligned;

                if (caseIdx == 0)
                {
                    proy = angleZ >= 85f ? "PROY: LAT 90°" : "PROY: AP 0°";
                }
                else if (caseIdx == 1)
                {
                    proy = "PROY: ANG +15° CEF";
                }
                else
                {
                    proy = "PROY: OBL 30° JUDET";
                }

                iso = aligned ? "ISO: CENTRADO" : "ISO: DESALINEADO";
            }

            string combined = $"{proy} | {iso}";
            if (combined != lastMonitorTelemetryText)
            {
                lastMonitorTelemetryText = combined;
                txtMonitorTelemetry.text = combined;
            }
        }

        private void UpdateReticleCrosshair()
        {
            if (reticleCrosshair == null) return;

            bool isAligned = false;
            if (currentActiveTab == 3 && isocenterController != null)
            {
                isAligned = isocenterController.IsIsocenterAligned;
            }
            else if (currentActiveTab == 1)
            {
                isAligned = protocolZeroController != null && !protocolZeroController.IsArcInverted;
            }
            else if (currentActiveTab == 2)
            {
                isAligned = true;
            }

            int state = isAligned ? 1 : 0;
            if (state == lastReticleAligned) return;
            lastReticleAligned = state;

            if (isAligned)
            {
                reticleCrosshair.color = colorGreenSurge; // #19E15A
            }
            else
            {
                reticleCrosshair.color = new Color(0f, 240f / 255f, 1f, 0.45f); // Dim cyan
            }
        }

        private void UpdateKvpLabel(float val)
        {
            if (textKvpValue == null) return;
            bool showTutorHint = beamMasterController != null && beamMasterController.IsTutorRescueActive && !isTutorCountdownActive;
            var curCase = beamMasterController != null ? beamMasterController.CurrentCase : null;
            if (showTutorHint && curCase != null)
            {
                textKvpValue.text = $"{val:F0} kVp <color=#19E15A>[META: {curCase.minKvpForPenetration:F0}-{curCase.maxKvp:F0} kVp]</color>";
            }
            else
            {
                textKvpValue.text = $"{val:F0} kVp";
            }
        }

        private void UpdateMALabel(float val)
        {
            if (textMAValue == null) return;
            bool showTutorHint = beamMasterController != null && beamMasterController.IsTutorRescueActive && !isTutorCountdownActive;
            var curCase = beamMasterController != null ? beamMasterController.CurrentCase : null;
            if (showTutorHint && curCase != null)
            {
                textMAValue.text = $"{val:F1} mA <color=#19E15A>[META: {curCase.minmA:F1}-{curCase.maxSafemA:F1} mA]</color>";
            }
            else
            {
                textMAValue.text = $"{val:F1} mA";
            }
        }

        private void UpdateCollimationLabel(float val)
        {
            if (textCollimationValue == null) return;
            bool showTutorHint = beamMasterController != null && beamMasterController.IsTutorRescueActive && !isTutorCountdownActive;
            if (showTutorHint)
            {
                textCollimationValue.text = $"{val * 100f:F0}% <color=#19E15A>[META: ≥60%]</color>";
            }
            else
            {
                textCollimationValue.text = $"{val * 100f:F0}%";
            }
        }

        private void UpdateCollimationShutters(float collimation)
        {
            float inset = Mathf.Clamp(collimation * 0.45f, 0f, 0.35f);
            if (shutterTop)    { shutterTop.anchorMin    = new Vector2(0f, 1f - inset); shutterTop.anchorMax    = new Vector2(1f, 1f); }
            if (shutterBottom) { shutterBottom.anchorMin = new Vector2(0f, 0f);        shutterBottom.anchorMax = new Vector2(1f, inset); }
            if (shutterLeft)   { shutterLeft.anchorMin   = new Vector2(0f, inset);     shutterLeft.anchorMax   = new Vector2(inset, 1f - inset); }
            if (shutterRight)  { shutterRight.anchorMin  = new Vector2(1f - inset, inset); shutterRight.anchorMax = new Vector2(1f, 1f - inset); }

            if (collimatorMask != null)
            {
                float s = Mathf.Clamp(1f - collimation * 0.5f, 0.45f, 1f);
                collimatorMask.localScale = new Vector3(s, s, 1f);
            }
        }

        /// <summary>
        /// Enforces high-contrast bold typography scaling across HUD elements at runtime.
        /// </summary>
        private void ApplyTypographyScaling()
        {
            // Top Bar Global
            if (doseText)    { doseText.fontSize = 30; doseText.fontStyle = FontStyle.Bold; }
            if (qualityText) { qualityText.fontSize = 30; qualityText.fontStyle = FontStyle.Bold; }
            if (timerText)   { timerText.fontSize = 30; timerText.fontStyle = FontStyle.Bold; }
            if (anodeText)
            {
                anodeText.fontSize = 18;
                anodeText.fontStyle = FontStyle.Bold;
                anodeText.color = new Color(10f / 255f, 21f / 255f, 30f / 255f, 1f); // Black/dark for high contrast over green
            }

            // Left Panel (Monitor & Dra. Nova Card)
            if (draNovaTitleText)
            {
                draNovaTitleText.fontSize = 21;
                draNovaTitleText.fontStyle = FontStyle.Bold;
                draNovaTitleText.color = cyanNeon;
                draNovaTitleText.resizeTextForBestFit = true;
                draNovaTitleText.resizeTextMinSize = 16;
                draNovaTitleText.resizeTextMaxSize = 22;
            }
            if (draNovaBodyText)
            {
                draNovaBodyText.fontSize = 24;
                draNovaBodyText.fontStyle = FontStyle.Bold;
                draNovaBodyText.resizeTextForBestFit = true;
                draNovaBodyText.resizeTextMinSize = 18;
                draNovaBodyText.resizeTextMaxSize = 26;
                draNovaBodyText.lineSpacing = 1.25f;
                draNovaBodyText.color = Color.white;
            }
            if (draNovaContinueButton != null)
            {
                var txt = GetDraNovaButtonText();
                if (txt != null)
                {
                    txt.fontSize = 20;
                    txt.fontStyle = FontStyle.Bold;
                    txt.resizeTextForBestFit = true;
                    txt.resizeTextMinSize = 16;
                    txt.resizeTextMaxSize = 22;
                }
            }

            // Right Panel Indicators & Headers
            if (textMG2CaseHeader)   { textMG2CaseHeader.fontSize = 17; textMG2CaseHeader.fontStyle = FontStyle.Bold; }
            if (textMG3CaseHeader)   { textMG3CaseHeader.fontSize = 17; textMG3CaseHeader.fontStyle = FontStyle.Bold; }
            if (textKvpValue)         { textKvpValue.fontSize = 18; textKvpValue.fontStyle = FontStyle.Bold; }
            if (textMAValue)          { textMAValue.fontSize = 18; textMAValue.fontStyle = FontStyle.Bold; }
            if (textCollimationValue) { textCollimationValue.fontSize = 18; textCollimationValue.fontStyle = FontStyle.Bold; }
            if (textBuiltOrder)       { textBuiltOrder.fontSize = 17; textBuiltOrder.fontStyle = FontStyle.Bold; }
        }

        private void HookEvents()
        {
            UnhookEvents();

            if (ScormBridge.Instance != null)
            {
                ScormBridge.Instance.PhaseAcknowledged += OnPlatformPhaseAcknowledged;
            }

            if (protocolZeroController != null)
            {
                onP0TutorRescue = (title, explanation) => ShowTutorRescueDialog(title, explanation);
                onP0FireAttemptedWithInvertedArc = (blocked, msg) =>
                {
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    ShowDraNovaDialog("QUIRÓFANO // ALERTA RADIOLÓGICA", msg);
                };
                onP0ExposureBlockedByPpe = (msg) =>
                {
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    ShowDraNovaDialog("QUIRÓFANO // RADIOPROTECCIÓN INCOMPLETA", msg);
                };
                onP0ArcOrientationCorrected = (msg) =>
                {
                    StopTutorHighlights();
                    ShowDraNovaDialog("QUIRÓFANO // GEOMETRÍA VERIFICADA", msg);
                    if (btnInvertArc != null)
                    {
                        var t = btnInvertArc.GetComponentInChildren<Text>();
                        if (t != null) t.text = "ARCO EN ORIENTACIÓN SEGURA (TUBO ABAJO ✓)";
                        var img = btnInvertArc.GetComponent<Image>();
                        if (img != null) img.color = new Color(0.12f, 0.45f, 0.28f, 1f);
                    }
                };
                onP0AllSafetyChecksPassed = (msg) =>
                {
                    StopTutorHighlights();
                    ShowDraNovaDialog("QUIRÓFANO // PROTOCOLO CERO COMPLETO", msg);
                };
                onP0TimeUpdated = (time) =>
                {
                    if (currentActiveTab == 1) UpdateTimer(time);
                };

                protocolZeroController.OnTutorRescueTriggered += onP0TutorRescue;
                protocolZeroController.OnFireAttemptedWithInvertedArc += onP0FireAttemptedWithInvertedArc;
                protocolZeroController.OnExposureBlockedByPpe += onP0ExposureBlockedByPpe;
                protocolZeroController.OnArcOrientationCorrected += onP0ArcOrientationCorrected;
                protocolZeroController.OnAllSafetyChecksPassed += onP0AllSafetyChecksPassed;
                protocolZeroController.OnTimeUpdated += onP0TimeUpdated;
            }

            if (beamMasterController != null)
            {
                onBmTutorRescue = (title, explanation) => ShowTutorRescueDialog(title, explanation);
                onBmCaseStarted = (index, c) =>
                {
                    StopTutorHighlights();
                    UpdateActiveCaseDisplay(index, c);
                };
                onBmConsoleUpdated = state =>
                {
                    if (currentActiveTab == 2) UpdateConsoleDisplay(state);
                };
                onBmAnodeThermalWarning = msg =>
                {
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    ShowDraNovaDialog("QUIRÓFANO // ALERTA TÉRMICA DEL ÁNODO", msg);
                };
                onBmAnodeOverheatStateChanged = (blocked, msg) =>
                {
                    if (blocked)
                    {
                        AudioSFXManager.Instance?.PlayWarningScatter();
                        ShowDraNovaDialog("QUIRÓFANO // BLOQUEO TÉRMICO (HU CRÍTICO)", msg);
                    }
                };
                onBmExposureTriggered = report =>
                {
                    if (!report.isOptimal)
                    {
                        ShowDraNovaDialog("QUIRÓFANO // EVALUACIÓN DE DISPARO", report.diagnosticFeedback);
                    }
                    else
                    {
                        StopTutorHighlights();
                        if (report.caseIndex == 0)
                            ShowDraNovaDialog("QUIRÓFANO // CASO 1 SUPERADO (HOMBRO)", report.diagnosticFeedback);
                        else if (report.caseIndex == 1)
                            ShowDraNovaDialog("QUIRÓFANO // CASO 2 SUPERADO (FÉMUR)", report.diagnosticFeedback);
                        else if (report.caseIndex == 2)
                            ShowDraNovaDialog("QUIRÓFANO // FASE 2: MAESTRO DEL HAZ COMPLETADO", report.diagnosticFeedback);
                    }
                };
                onBmTimeUpdated = (time) =>
                {
                    if (currentActiveTab == 2) UpdateTimer(time);
                };

                beamMasterController.OnTutorRescueTriggered += onBmTutorRescue;
                beamMasterController.OnCaseStarted += onBmCaseStarted;
                beamMasterController.OnConsoleUpdated += onBmConsoleUpdated;
                beamMasterController.OnAnodeThermalWarning += onBmAnodeThermalWarning;
                beamMasterController.OnAnodeOverheatStateChanged += onBmAnodeOverheatStateChanged;
                beamMasterController.OnExposureTriggered += onBmExposureTriggered;
                beamMasterController.OnTimeUpdated += onBmTimeUpdated;
            }

            if (isocenterController != null)
            {
                onIsoTutorRescue = (title, explanation) => ShowTutorRescueDialog(title, explanation);
                onIsoAmbiguousOrder = (orderText, feedback) =>
                {
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    ShowDraNovaDialog("QUIRÓFANO // ORDEN RECHAZADA", feedback);
                };
                onIsoCatalogShuffled = (c1, c2, c3) => UpdateShuffledCatalogButtons(c1, c2, c3);
                onIsoSlotsUpdated = (snapshot) =>
                {
                    if (!snapshot.movementIndex.HasValue && !snapshot.directionIndex.HasValue && !snapshot.magnitudeIndex.HasValue)
                        ResetBuiltOrderUI();
                };
                onIsoOrderEvaluated = (order, isCorrect, feedback) =>
                {
                    if (isCorrect)
                    {
                        StopTutorHighlights();
                        if (isocenterController.CurrentFractureIndex == 0)
                        {
                            ShowDraNovaDialog("QUIRÓFANO // ORDEN VERIFICADA",
                                "Dra. Nova: ¡Orden en bucle cerrado verificada! El técnico radiólogo avanzó 5 cm hacia cefálico y el isocentro quedó centrado con la fractura.\n\n" +
                                "Ahora pulsa el botón 'ROTAR 90° (AP A LATERAL)' para poner el arco en proyección horizontal/lateral.");
                        }
                        else if (isocenterController.CurrentFractureIndex == 1)
                        {
                            ShowDraNovaDialog("QUIRÓFANO // ORDEN VERIFICADA",
                                "Dra. Nova: ¡Orden en bucle cerrado verificada! El técnico inclinó el tubo 15° hacia cefálico. La articulación se proyecta despejada.\n\n" +
                                "Ahora pulsa el botón 'CONFIRMAR DESPEJE ARTICULAR' para registrar el control final.");
                        }
                        else
                        {
                            ShowDraNovaDialog("QUIRÓFANO // ORDEN VERIFICADA",
                                "Dra. Nova: ¡Orden en bucle cerrado verificada! El técnico rotó el arco 30° a oblicua de Judet manteniendo el isocentro cotiloideo.\n\n" +
                                "Ahora pulsa el botón 'CONFIRMAR PROYECCIÓN OBLICUA' para concluir el procedimiento.");
                        }
                    }
                    else
                    {
                        AudioSFXManager.Instance?.PlayWarningScatter();
                        string targetHint = isocenterController.CurrentFracture != null &&
                                            isocenterController.CurrentFracture.requiredOrders != null &&
                                            isocenterController.CurrentFracture.requiredOrders.Length > 0
                            ? isocenterController.CurrentFracture.requiredOrders[0].rationale
                            : "";
                        ShowDraNovaDialog("QUIRÓFANO // ORDEN ERRÓNEA",
                            $"Dra. Nova: {feedback}\n\nIndicación quirúrgica: {targetHint}");
                    }
                };
                onIsoOrbitalRotationEvaluated = (success, msg) =>
                {
                    if (success)
                    {
                        StopTutorHighlights();
                        if (isocenterController.CurrentFractureIndex == 0)
                        {
                            ShowDraNovaDialog("QUIRÓFANO // CASO 1 SUPERADO",
                                "Dra. Nova: ¡Rotación 90° AP a Lateral impecable! La fractura diafisaria se mantuvo perfectamente en el isocentro fluoroscópico.\n\n" +
                                "Iniciando Caso 2: Despeje Articular de Hombro.");
                        }
                        else if (isocenterController.CurrentFractureIndex == 1)
                        {
                            ShowDraNovaDialog("QUIRÓFANO // CASO 2 SUPERADO",
                                "Dra. Nova: ¡Excelente angulación cefálica de 15°! La interlínea articular quedó despejada sin magnificación excesiva.\n\n" +
                                "Iniciando Caso 3: Proyección Oblicua de Pelvis (Judet).");
                        }
                        else
                        {
                            isPhase3Completed = true;
                            ShowDraNovaDialog("QUIRÓFANO // MÓDULO 1 SUPERADO CON ÉXITO",
                                "Dra. Nova: ¡Proyección oblicua de Judet perfecta! Has completado con honores las 3 fases del Módulo 1: Protocolo Cero, Maestro del Haz y Comando Isocentro.");
                        }
                    }
                    else
                    {
                        AudioSFXManager.Instance?.PlayWarningScatter();
                        ShowDraNovaDialog("QUIRÓFANO // PÉRDIDA DE ISOCENTRO", msg);
                    }
                };
                onIsoMinigameEnded = (result) =>
                {
                    if (result.passed) isPhase3Completed = true;
                };
                onIsoFractureCaseStarted = (idx, fc) =>
                {
                    StopTutorHighlights();
                    if (currentActiveTab == 3) UpdateActiveFractureCaseDisplay(idx, fc);
                };
                onIsoIncompleteOrderSubmitted = (msg) => ShowDraNovaDialog("QUIRÓFANO // ORDEN INCOMPLETA", msg);
                onIsoTimeUpdated = (time) =>
                {
                    if (currentActiveTab == 3) UpdateTimer(time);
                };

                isocenterController.OnTutorRescueTriggered += onIsoTutorRescue;
                isocenterController.OnAmbiguousOrderTriggered += onIsoAmbiguousOrder;
                isocenterController.OnCatalogShuffled += onIsoCatalogShuffled;
                isocenterController.OnSlotsUpdated += onIsoSlotsUpdated;
                isocenterController.OnOrderEvaluated += onIsoOrderEvaluated;
                isocenterController.OnOrbitalRotationEvaluated += onIsoOrbitalRotationEvaluated;
                isocenterController.OnMinigameEnded += onIsoMinigameEnded;
                isocenterController.OnFractureCaseStarted += onIsoFractureCaseStarted;
                isocenterController.OnIncompleteOrderSubmitted += onIsoIncompleteOrderSubmitted;
                isocenterController.OnTimeUpdated += onIsoTimeUpdated;
            }
        }

        private void UnhookEvents()
        {
            if (ScormBridge.Instance != null)
            {
                ScormBridge.Instance.PhaseAcknowledged -= OnPlatformPhaseAcknowledged;
            }

            if (protocolZeroController != null)
            {
                if (onP0TutorRescue != null) protocolZeroController.OnTutorRescueTriggered -= onP0TutorRescue;
                if (onP0FireAttemptedWithInvertedArc != null) protocolZeroController.OnFireAttemptedWithInvertedArc -= onP0FireAttemptedWithInvertedArc;
                if (onP0ExposureBlockedByPpe != null) protocolZeroController.OnExposureBlockedByPpe -= onP0ExposureBlockedByPpe;
                if (onP0ArcOrientationCorrected != null) protocolZeroController.OnArcOrientationCorrected -= onP0ArcOrientationCorrected;
                if (onP0AllSafetyChecksPassed != null) protocolZeroController.OnAllSafetyChecksPassed -= onP0AllSafetyChecksPassed;
                if (onP0TimeUpdated != null) protocolZeroController.OnTimeUpdated -= onP0TimeUpdated;
            }

            if (beamMasterController != null)
            {
                if (onBmTutorRescue != null) beamMasterController.OnTutorRescueTriggered -= onBmTutorRescue;
                if (onBmCaseStarted != null) beamMasterController.OnCaseStarted -= onBmCaseStarted;
                if (onBmConsoleUpdated != null) beamMasterController.OnConsoleUpdated -= onBmConsoleUpdated;
                if (onBmAnodeThermalWarning != null) beamMasterController.OnAnodeThermalWarning -= onBmAnodeThermalWarning;
                if (onBmAnodeOverheatStateChanged != null) beamMasterController.OnAnodeOverheatStateChanged -= onBmAnodeOverheatStateChanged;
                if (onBmExposureTriggered != null) beamMasterController.OnExposureTriggered -= onBmExposureTriggered;
                if (onBmTimeUpdated != null) beamMasterController.OnTimeUpdated -= onBmTimeUpdated;
            }

            if (isocenterController != null)
            {
                if (onIsoTutorRescue != null) isocenterController.OnTutorRescueTriggered -= onIsoTutorRescue;
                if (onIsoAmbiguousOrder != null) isocenterController.OnAmbiguousOrderTriggered -= onIsoAmbiguousOrder;
                if (onIsoCatalogShuffled != null) isocenterController.OnCatalogShuffled -= onIsoCatalogShuffled;
                if (onIsoSlotsUpdated != null) isocenterController.OnSlotsUpdated -= onIsoSlotsUpdated;
                if (onIsoOrderEvaluated != null) isocenterController.OnOrderEvaluated -= onIsoOrderEvaluated;
                if (onIsoOrbitalRotationEvaluated != null) isocenterController.OnOrbitalRotationEvaluated -= onIsoOrbitalRotationEvaluated;
                if (onIsoMinigameEnded != null) isocenterController.OnMinigameEnded -= onIsoMinigameEnded;
                if (onIsoFractureCaseStarted != null) isocenterController.OnFractureCaseStarted -= onIsoFractureCaseStarted;
                if (onIsoIncompleteOrderSubmitted != null) isocenterController.OnIncompleteOrderSubmitted -= onIsoIncompleteOrderSubmitted;
                if (onIsoTimeUpdated != null) isocenterController.OnTimeUpdated -= onIsoTimeUpdated;
            }
        }

        private void OnDestroy()
        {
            UnhookEvents();

            if (tutorCountdownCoroutine != null)
            {
                StopCoroutine(tutorCountdownCoroutine);
                tutorCountdownCoroutine = null;
            }

            if (tutorHighlightCoroutine != null)
            {
                StopCoroutine(tutorHighlightCoroutine);
                tutorHighlightCoroutine = null;
            }
        }

        private void SetupButtonListeners()
        {
            // Dra. Nova continue button
            if (draNovaContinueButton)
            {
                draNovaContinueButton.onClick.AddListener(() =>
                {
                    if (isTutorCountdownActive) return;

                    AudioSFXManager.Instance?.PlayUIClick();

                    if (activeDialogSequence != null && activeDialogSequence.Count > 0)
                    {
                        currentDialogSequenceIndex++;
                        if (currentDialogSequenceIndex < activeDialogSequence.Count)
                        {
                            DisplayCurrentSequenceStep();
                            return;
                        }
                        else
                        {
                            activeDialogSequence.Clear();
                            var callback = onSequenceCompletedCallback;
                            onSequenceCompletedCallback = null;
                            HideDraNovaDialog();
                            callback?.Invoke();
                            return;
                        }
                    }

                    HideDraNovaDialog();
                });
            }

            // Minigame Tabs
            if (btnTabMG1) btnTabMG1.onClick.AddListener(() => { AudioSFXManager.Instance?.PlayUIClick(); ShowSubpanel(1); });
            if (btnTabMG2) btnTabMG2.onClick.AddListener(() => { AudioSFXManager.Instance?.PlayUIClick(); ShowSubpanel(2); });
            if (btnTabMG3) btnTabMG3.onClick.AddListener(() => { AudioSFXManager.Instance?.PlayUIClick(); ShowSubpanel(3); });

            // ── MG1 Controls ────────────────────────────────────────────────
            if (btnInvertArc && protocolZeroController)
            {
                btnInvertArc.onClick.AddListener(() =>
                {
                    if (protocolZeroController.IsArcInverting || !protocolZeroController.IsArcInverted) return;
                    AudioSFXManager.Instance?.PlayUIClick();
                    protocolZeroController.CorrectArcOrientation();
                });
            }

            if (btnVerifySafety && protocolZeroController)
            {
                btnVerifySafety.onClick.AddListener(() =>
                {
                    AudioSFXManager.Instance?.PlayUIClick();
                    protocolZeroController.AttemptExposure();
                });
            }

            SetupPpeButton(btnPpeBrakes, PpeType.EquipmentBrakes);
            SetupPpeButton(btnPpeApron, PpeType.LeadApron);
            SetupPpeButton(btnPpeThyroid, PpeType.ThyroidShield);
            SetupPpeButton(btnPpeDosimeter, PpeType.Dosimeter);
            SetupPpeButton(btnPpeGlasses, PpeType.LeadGlasses);

            // ── MG2 Controls ────────────────────────────────────────────────
            if (sliderKvp && beamMasterController)
            {
                sliderKvp.onValueChanged.AddListener(val =>
                {
                    beamMasterController.SetKvp(val);
                    UpdateKvpLabel(val);
                });
            }

            if (sliderMA && beamMasterController)
            {
                sliderMA.onValueChanged.AddListener(val =>
                {
                    beamMasterController.SetMA(val);
                    UpdateMALabel(val);
                });
            }

            if (sliderCollimation && beamMasterController)
            {
                sliderCollimation.onValueChanged.AddListener(val =>
                {
                    // val es porcentaje colimado: 0 = sin colimar (apertura 1.0), 0.60 = 60% colimado (apertura 0.40)
                    float aperture = Mathf.Clamp(1f - val, 0.15f, 1f);
                    beamMasterController.SetCollimation(aperture);
                    UpdateCollimationLabel(val);
                    UpdateCollimationShutters(val);
                });
            }

            if (toggleStepBack && beamMasterController)
            {
                toggleStepBack.onValueChanged.AddListener(isOn =>
                {
                    AudioSFXManager.Instance?.PlayUIClick();
                    beamMasterController.SetStepBackDistance(isOn);
                });
            }

            if (btnExposurePedal && beamMasterController)
            {
                btnExposurePedal.onClick.AddListener(() =>
                {
                    StartCoroutine(SimulatePedalTap());
                });
            }

            // ── MG3 Order Builder Controls (3 Columns x 6 Shuffled Buttons) ──
            EnsureMG3Buttons();
            for (int i = 0; i < 6; i++)
            {
                int slotIdx = i;
                if (col1Buttons != null && i < col1Buttons.Length && col1Buttons[i] != null)
                {
                    col1Buttons[i].onClick.RemoveAllListeners();
                    col1Buttons[i].onClick.AddListener(() => OnColButtonClicked(1, slotIdx));
                }
                if (col2Buttons != null && i < col2Buttons.Length && col2Buttons[i] != null)
                {
                    col2Buttons[i].onClick.RemoveAllListeners();
                    col2Buttons[i].onClick.AddListener(() => OnColButtonClicked(2, slotIdx));
                }
                if (col3Buttons != null && i < col3Buttons.Length && col3Buttons[i] != null)
                {
                    col3Buttons[i].onClick.RemoveAllListeners();
                    col3Buttons[i].onClick.AddListener(() => OnColButtonClicked(3, slotIdx));
                }
            }

            if (btnSubmitOrder && isocenterController)
            {
                btnSubmitOrder.onClick.RemoveAllListeners();
                btnSubmitOrder.onClick.AddListener(() =>
                {
                    AudioSFXManager.Instance?.PlayUIClick();
                    isocenterController.SubmitBuiltOrder();
                });
            }

            if (btnRotate90 && isocenterController)
            {
                btnRotate90.onClick.RemoveAllListeners();
                btnRotate90.onClick.AddListener(() =>
                {
                    isocenterController.ExecuteStage2Action();
                });
            }
        }

        private void OnColButtonClicked(int col, int slotIdx)
        {
            AudioSFXManager.Instance?.PlayUIClick();
            if (col == 1)
            {
                isocenterController?.SelectCol1Slot(slotIdx);
                if (isocenterController != null && slotIdx < isocenterController.ActiveCol1Options.Count)
                    currentMov = isocenterController.ActiveCol1Options[slotIdx].label;
                HighlightColumnButton(col1Buttons, col1Buttons[slotIdx]);
            }
            else if (col == 2)
            {
                isocenterController?.SelectCol2Slot(slotIdx);
                if (isocenterController != null && slotIdx < isocenterController.ActiveCol2Options.Count)
                    currentDir = isocenterController.ActiveCol2Options[slotIdx].label;
                HighlightColumnButton(col2Buttons, col2Buttons[slotIdx]);
            }
            else if (col == 3)
            {
                isocenterController?.SelectCol3Slot(slotIdx);
                if (isocenterController != null && slotIdx < isocenterController.ActiveCol3Options.Count)
                    currentMag = isocenterController.ActiveCol3Options[slotIdx].label;
                HighlightColumnButton(col3Buttons, col3Buttons[slotIdx]);
            }
            UpdateBuiltOrderText();
        }

        private void UpdateShuffledCatalogButtons(System.Collections.Generic.List<CArmSimulator.Minigames.IsocenterCommand.OrderCatalogItem> c1,
                                                   System.Collections.Generic.List<CArmSimulator.Minigames.IsocenterCommand.OrderCatalogItem> c2,
                                                   System.Collections.Generic.List<CArmSimulator.Minigames.IsocenterCommand.OrderCatalogItem> c3)
        {
            EnsureMG3Buttons();

            for (int i = 0; i < 6; i++)
            {
                if (col1Buttons != null && i < col1Buttons.Length && col1Buttons[i] != null && c1 != null && i < c1.Count)
                {
                    var txt = col1Buttons[i].GetComponentInChildren<Text>();
                    if (txt != null) { txt.text = c1[i].label; txt.color = hudTextLight; }
                    SetButtonBaseAppearance(col1Buttons[i]);
                }

                if (col2Buttons != null && i < col2Buttons.Length && col2Buttons[i] != null && c2 != null && i < c2.Count)
                {
                    var txt = col2Buttons[i].GetComponentInChildren<Text>();
                    if (txt != null) { txt.text = c2[i].label; txt.color = hudTextLight; }
                    SetButtonBaseAppearance(col2Buttons[i]);
                }

                if (col3Buttons != null && i < col3Buttons.Length && col3Buttons[i] != null && c3 != null && i < c3.Count)
                {
                    var txt = col3Buttons[i].GetComponentInChildren<Text>();
                    if (txt != null) { txt.text = c3[i].label; txt.color = hudTextLight; }
                    SetButtonBaseAppearance(col3Buttons[i]);
                }
            }

            ResetBuiltOrderUI();
        }

        private void SetButtonBaseAppearance(Button btn)
        {
            if (btn == null) return;
            var img = btn.GetComponent<Image>();
            if (img != null) img.color = btnDarkBg;

            var cb = btn.colors;
            cb.normalColor = btnDarkBg;
            cb.highlightedColor = btnDarkBg * 1.3f;
            cb.selectedColor = btnDarkBg;
            btn.colors = cb;
        }

        private void EnsureMG3Buttons()
        {
            if (panelMG3 == null) return;

            if (col1Buttons == null || col1Buttons.Length != 6) col1Buttons = new Button[6];
            if (col2Buttons == null || col2Buttons.Length != 6) col2Buttons = new Button[6];
            if (col3Buttons == null || col3Buttons.Length != 6) col3Buttons = new Button[6];

            for (int i = 0; i < 6; i++)
            {
                if (col1Buttons[i] == null)
                {
                    var t = panelMG3.transform.Find($"Btn_Col1_{i}");
                    if (t != null) col1Buttons[i] = t.GetComponent<Button>();
                }
                if (col2Buttons[i] == null)
                {
                    var t = panelMG3.transform.Find($"Btn_Col2_{i}");
                    if (t != null) col2Buttons[i] = t.GetComponent<Button>();
                }
                if (col3Buttons[i] == null)
                {
                    var t = panelMG3.transform.Find($"Btn_Col3_{i}");
                    if (t != null) col3Buttons[i] = t.GetComponent<Button>();
                }
            }

            if (btnSubmitOrder == null)
            {
                var t = panelMG3.transform.Find("Btn_SubmitOrder");
                if (t != null) btnSubmitOrder = t.GetComponent<Button>();
            }

            if (btnRotate90 == null)
            {
                var t = panelMG3.transform.Find("Btn_Rotate90");
                if (t != null) btnRotate90 = t.GetComponent<Button>();
            }
        }

        private void SetupPpeButton(Button btn, PpeType ppeType)
        {
            if (btn == null || protocolZeroController == null) return;
            btn.onClick.AddListener(() =>
            {
                AudioSFXManager.Instance?.PlayUIClick();
                protocolZeroController.VerifyPpe(ppeType);
                SetButtonActiveState(btn, true);
                int count = protocolZeroController.VerifiedPpeCount;
                ShowDraNovaDialog("QUIRÓFANO // RADIOPROTECCIÓN EPP",
                    $"Dra. Nova: Elemento EPP verificado ({count}/5). Toda barrera plomada y bloqueo mecánico reduce la radiación dispersa y fija la geometría quirúrgica.");
            });
        }

        private void SetButtonActiveState(Button btn, bool active)
        {
            if (btn == null) return;
            Color col = active ? new Color(0.1f, 0.88f, 0.45f, 1f) : new Color(14f / 255f, 34f / 255f, 46f / 255f, 1f);
            var img = btn.GetComponent<Image>();
            if (img != null) img.color = col;

            var colors = btn.colors;
            colors.normalColor = col;
            colors.highlightedColor = col * 1.15f;
            colors.selectedColor = col;
            btn.colors = colors;

            var txt = btn.GetComponentInChildren<Text>();
            if (txt != null && active && !txt.text.StartsWith("✓ "))
            {
                txt.text = "✓ " + txt.text;
                txt.color = Color.black;
            }
        }

        private void HighlightColumnButton(Button[] column, Button selectedBtn)
        {
            if (column == null) return;
            foreach (var b in column)
            {
                if (b == null) continue;
                bool isSelected = (b == selectedBtn);
                Color bg = isSelected ? cyanNeon : btnDarkBg;
                Color fg = isSelected ? Color.black : hudTextLight;

                var img = b.GetComponent<Image>();
                if (img != null) img.color = bg;

                var cb = b.colors;
                cb.normalColor = bg;
                cb.highlightedColor = isSelected ? bg * 1.15f : bg * 1.3f;
                cb.selectedColor = bg;
                b.colors = cb;

                var txt = b.GetComponentInChildren<Text>();
                if (txt != null) txt.color = fg;
            }
        }

        private void UpdateBuiltOrderText()
        {
            if (textBuiltOrder != null)
            {
                textBuiltOrder.text = $"Orden: [{currentMov}] + [{currentDir}] + [{currentMag}]";
            }
        }

        private void ClearColumnHighlight(Button[] column)
        {
            if (column == null) return;
            foreach (var b in column)
            {
                if (b == null) continue;
                Color bg = btnDarkBg;
                Color fg = hudTextLight;

                var img = b.GetComponent<Image>();
                if (img != null) img.color = bg;

                var cb = b.colors;
                cb.normalColor = bg;
                cb.highlightedColor = bg * 1.3f;
                cb.selectedColor = bg;
                b.colors = cb;

                var txt = b.GetComponentInChildren<Text>();
                if (txt != null) txt.color = fg;
            }
        }

        public void ResetBuiltOrderUI()
        {
            currentMov = "[Movimiento]";
            currentDir = "[Dirección]";
            currentMag = "[Magnitud]";
            UpdateBuiltOrderText();
            EnsureMG3Buttons();
            ClearColumnHighlight(col1Buttons);
            ClearColumnHighlight(col2Buttons);
            ClearColumnHighlight(col3Buttons);
        }

        private bool isPedalRunning = false;
        private IEnumerator SimulatePedalTap()
        {
            if (isPedalRunning) yield break;
            isPedalRunning = true;
            AudioSFXManager.Instance?.PlayBeepXRay();
            beamMasterController.StartFluoroscopy();
            // Reveal penetration and image quality results on the fluoroscopy monitor exclusively during exposure pulse
            UpdateFluoroscopyVisuals(sliderKvp != null ? sliderKvp.value : 70f, sliderCollimation != null ? sliderCollimation.value : 0f);
            yield return new WaitForSeconds(0.8f);
            beamMasterController.StopFluoroscopy();
            isPedalRunning = false;
        }

        public void ShowSubpanel(int minigameIndex)
        {
            currentActiveTab = minigameIndex;

            if (panelMG1) panelMG1.SetActive(minigameIndex == 1);
            if (panelMG2) panelMG2.SetActive(minigameIndex == 2);
            if (panelMG3) panelMG3.SetActive(minigameIndex == 3);

            UpdateTabHighlight(minigameIndex);

            // Configure tab locks depending on single-phase mode
            if (singlePhaseWebMode)
            {
                ConfigureTabLocksForSinglePhase(minigameIndex);
            }
            else
            {
                UnlockAllTabs();
            }

            // Restore CONTINUE button state for the active phase
            if (draNovaContinueButton != null)
            {
                draNovaContinueButton.interactable = true;
                var btnTxt = GetDraNovaButtonText();
                if (btnTxt != null)
                {
                    btnTxt.text = "CONTINUAR";
                }
            }

            // Manage minigame execution: Start active tab, pause/stop others
            if (minigameIndex == 1)
            {
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Femur);

                if (beamMasterController) beamMasterController.StopMinigame();
                if (isocenterController) isocenterController.StopMinigame();
                if (protocolZeroController)
                {
                    if (!protocolZeroController.IsActive) protocolZeroController.StartMinigame();
                    else protocolZeroController.ResumeMinigame();
                }

                // Metrics for Phase 1
                if (doseText) doseText.text = "0.0 mSv";
                if (qualityText) qualityText.text = "100%";
                if (anodeText) anodeText.text = "0% HU (Régimen Seguro)";
                if (anodeFillImage) { anodeFillImage.fillAmount = 0.05f; anodeFillImage.color = safeGreen; }
                UpdateTimer(protocolZeroController != null ? protocolZeroController.RemainingTime : 300f);

                ShowDraNovaDialog("QUIRÓFANO // PROTOCOLO CERO",
                    "Dra. Nova: Inicia la preparación del equipo quirúrgico para osteosíntesis de fémur proximal. Verifica la orientación del arco y los elementos de radioprotección antes del primer disparo.");
            }
            else if (minigameIndex == 2)
            {
                if (protocolZeroController) protocolZeroController.PauseMinigame();
                if (isocenterController) isocenterController.StopMinigame();
                if (beamMasterController)
                {
                    if (!beamMasterController.IsActive) beamMasterController.StartMinigame();
                    else beamMasterController.ResumeMinigame();

                    if (beamMasterController.CurrentCase != null)
                    {
                        UpdateActiveCaseDisplay(beamMasterController.CurrentCaseIndex, beamMasterController.CurrentCase);
                    }
                    else
                    {
                        AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Shoulder);
                    }
                }
                else
                {
                    AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Shoulder);
                }

                ShowDraNovaDialog("QUIRÓFANO // FASE 2: MAESTRO DEL HAZ",
                    "Dra. Nova: Ajusta la consola técnica para obtener imagen diagnóstica con mínima dispersión Compton (ALARA).\n" +
                    "Caso 1/3: Articulación de Hombro (Meta: 65-75 kVp, 2.0-3.5 mA, Colimación >= 60% y 1 Paso Atrás). Luego pulsa el pedal de disparo.");
            }
            else if (minigameIndex == 3)
            {
                if (protocolZeroController) protocolZeroController.PauseMinigame();
                if (beamMasterController) beamMasterController.StopMinigame();
                if (isocenterController)
                {
                    if (!isocenterController.IsActive) isocenterController.StartMinigame();
                    else isocenterController.ResumeMinigame();

                    UpdateActiveFractureCaseDisplay(isocenterController.CurrentFractureIndex, isocenterController.CurrentFracture);
                }
                else
                {
                    AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Femur);
                }
            }
        }

        private void UpdateActiveCaseDisplay(int index, ClinicalCase c)
        {
            if (c == null) return;

            // Switch anatomical 3D silhouette in BoneXRay layer
            if (index == 0)
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Shoulder);
            else if (index == 1)
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Femur);
            else if (index == 2)
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Pelvis);

            string header = "";
            if (index == 0)
                header = "OBJETIVO: CASO 1/3 — HOMBRO (Meta: 65-75 kVp | 2.0-3.5 mA | Colimación >= 60%)";
            else if (index == 1)
                header = "OBJETIVO: CASO 2/3 — DIÁFISIS DE FÉMUR (Meta: 75-85 kVp | 3.5-5.0 mA | Colimación >= 60%)";
            else if (index == 2)
                header = "OBJETIVO: CASO 3/3 — ANILLO PÉLVICO (Meta: 85-100 kVp | 4.5-6.5 mA | Colimación >= 60%)";
            else
                header = $"CASO {index + 1}/3: {c.caseName.ToUpper()} (Meta: {c.minKvpForPenetration:F0}-{c.maxKvp:F0} kVp | {c.minmA:F1}-{c.maxSafemA:F1} mA | Colimación >= 60%)";

            if (textMG2CaseHeader != null)
            {
                textMG2CaseHeader.color = new Color(0.1f, 0.95f, 0.45f, 1f); // Verde neón brillante
                textMG2CaseHeader.text = header;
            }

            UpdateFluoroscopyVisuals(sliderKvp != null ? sliderKvp.value : 70f, sliderCollimation != null ? sliderCollimation.value : 0f);
        }

        private void UpdateActiveFractureCaseDisplay(int index, FractureCase fc)
        {
            if (fc == null && isocenterController != null)
                fc = isocenterController.CurrentFracture;

            // 1. Switch anatomical 3D silhouette in BoneXRay layer
            if (index == 0)
                AnatomicalTargetManager.Instance?.SetAnatomyWithOffset(AnatomyType.Femur, new Vector3(0f, 0f, -0.05f));
            else if (index == 1)
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Shoulder);
            else
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Pelvis);

            // 2. Update Case Header Text in HUD (without literal spoilers)
            EnsureMG3CaseHeader();
            if (textMG3CaseHeader != null)
            {
                textMG3CaseHeader.color = new Color(0.1f, 0.95f, 0.45f, 1f); // Verde neón brillante
                if (index == 0)
                {
                    textMG3CaseHeader.text = "OBJETIVO: CASO 1/3 — DIÁFISIS FEMORAL (Centrar el trazo de fractura en el isocentro)";
                }
                else if (index == 1)
                {
                    textMG3CaseHeader.text = "OBJETIVO: CASO 2/3 — DESPEJE ARTICULAR (Despejar la interlínea articular superpuesta)";
                }
                else
                {
                    textMG3CaseHeader.text = "OBJETIVO: CASO 3/3 — PROYECCIÓN OBLICUA (Visualizar reborde cotiloideo y columna anterior)";
                }
            }

            // 3. Update Action button text
            if (btnRotate90 != null)
            {
                var btnTxt = btnRotate90.GetComponentInChildren<Text>();
                if (btnTxt != null)
                {
                    if (index == 0)
                        btnTxt.text = "ROTAR 90° (AP A LATERAL)";
                    else if (index == 1)
                        btnTxt.text = "CONFIRMAR DESPEJE ARTICULAR";
                    else
                        btnTxt.text = "CONFIRMAR PROYECCIÓN OBLICUA";
                }
            }

            // 4. Reset UI slots & highlight
            ResetBuiltOrderUI();

            // 5. Instruction dialogue with Dra. Nova (Sequential cards with large readable typography for mobile UX)
            if (index == 0)
            {
                ShowDraNovaSequence(new DraNovaDialogStep[]
                {
                    new DraNovaDialogStep(
                        "QUIRÓFANO // CASO 1: INDICACIÓN CLÍNICA (1/3)",
                        "Dra. Nova: El trazo de fractura se encuentra 5 cm hacia la cabeza del paciente respecto al eje central.\n\nDesplaza linealmente toda la estructura del arco para centrarlo.",
                        "CONTINUAR (1/3)"
                    ),
                    new DraNovaDialogStep(
                        "QUIRÓFANO // REGLA DE BUCLE CERRADO (2/3)",
                        "REGLA FORMATIVA:\nEn quirófano se exige comunicación estricta en bucle cerrado:\n\n[Movimiento] + [Dirección] + [Magnitud]\n\nSelecciona una opción de cada columna y pulsa EMITIR ORDEN.",
                        "CONTINUAR (2/3)"
                    ),
                    new DraNovaDialogStep(
                        "QUIRÓFANO // ADVERTENCIA TÉCNICA (3/3)",
                        "ADVERTENCIA FORMATIVA:\nEvita términos ambiguos o coloquiales como «un poco», «al ojo» o «un pelo».\n\nSolo las órdenes técnicas estandarizadas serán aceptadas por el cirujano.",
                        "¡ENTENDIDO, EMPEZAR!"
                    )
                });
            }
            else if (index == 1)
            {
                ShowDraNovaSequence(new DraNovaDialogStep[]
                {
                    new DraNovaDialogStep(
                        "QUIRÓFANO // CASO 2: DESPEJE ARTICULAR (1/2)",
                        "Dra. Nova: Hay superposición ósea articular.\n\nInclina el brazo en C sobre su eje de soporte 15 grados hacia la cabeza del paciente sin mover la base.",
                        "CONTINUAR (1/2)"
                    ),
                    new DraNovaDialogStep(
                        "QUIRÓFANO // COMUNICACIÓN TÉCNICA (2/2)",
                        "COMUNICACIÓN TÉCNICA:\nIdentifica el tipo de movimiento, su dirección precisa y la magnitud requerida.\n\nConstruye la orden técnica precisa y pulsa EMITIR ORDEN.",
                        "¡ENTENDIDO, EMPEZAR!"
                    )
                });
            }
            else
            {
                ShowDraNovaSequence(new DraNovaDialogStep[]
                {
                    new DraNovaDialogStep(
                        "QUIRÓFANO // CASO 3: PROYECCIÓN OBLICUA (1/2)",
                        "Dra. Nova: Para despejar el acetábulo, desliza el arco sobre su propio riel curvo desde la proyección frontal hacia el perfil unos 30 grados.",
                        "CONTINUAR (1/2)"
                    ),
                    new DraNovaDialogStep(
                        "QUIRÓFANO // MÁXIMA PRECAUCIÓN (2/2)",
                        "MÁXIMA PRECAUCIÓN:\nCuidado con las opciones ambiguas o coloquiales que simulan ser soluciones rápidas pero violan los protocolos.\n\nConstruye la orden técnica precisa y pulsa EMITIR ORDEN.",
                        "¡ENTENDIDO, EMPEZAR!"
                    )
                });
            }
        }

        private void EnsureMG3CaseHeader()
        {
            if (textMG3CaseHeader == null && panelMG3 != null)
            {
                var existing = panelMG3.transform.Find("MG3_CaseHeader");
                if (existing != null)
                {
                    textMG3CaseHeader = existing.GetComponent<Text>();
                }
                else
                {
                    var go = new GameObject("MG3_CaseHeader", typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
                    go.transform.SetParent(panelMG3.transform, false);
                    var rt = go.GetComponent<RectTransform>();
                    rt.anchorMin = new Vector2(0.04f, 0.88f);
                    rt.anchorMax = new Vector2(0.96f, 0.93f);
                    rt.offsetMin = Vector2.zero;
                    rt.offsetMax = Vector2.zero;
                    textMG3CaseHeader = go.GetComponent<Text>();
                    textMG3CaseHeader.font = textBuiltOrder != null ? textBuiltOrder.font : Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                    textMG3CaseHeader.fontSize = 17;
                    textMG3CaseHeader.fontStyle = FontStyle.Bold;
                    textMG3CaseHeader.resizeTextForBestFit = true;
                    textMG3CaseHeader.resizeTextMinSize = 13;
                    textMG3CaseHeader.resizeTextMaxSize = 17;
                    textMG3CaseHeader.alignment = TextAnchor.MiddleLeft;
                    textMG3CaseHeader.color = new Color(0.1f, 0.95f, 0.45f, 1f);

                    if (textBuiltOrder != null)
                    {
                        var rtBuilt = textBuiltOrder.GetComponent<RectTransform>();
                        if (rtBuilt != null)
                        {
                            rtBuilt.anchorMin = new Vector2(0.04f, 0.83f);
                            rtBuilt.anchorMax = new Vector2(0.96f, 0.87f);
                        }
                    }
                }
            }
        }

        private void UpdateFluoroscopyVisuals(float kvp, float collimation)
        {
            // 1. Feedback en vivo por kVp y Colimación (Brillo, Contraste y Nitidez)
            if (fluoroscopeDisplay != null)
            {
                var curCase = beamMasterController != null ? beamMasterController.CurrentCase : null;
                float minKvp = curCase != null ? curCase.minKvpForPenetration : 65f;
                float maxKvp = curCase != null ? curCase.maxKvp : 75f;

                if (kvp < minKvp)
                {
                    // Subexpuesto / oscuro / ruido cuántico
                    float t = Mathf.Clamp01((kvp - 40f) / Mathf.Max(1f, minKvp - 40f));
                    float b = Mathf.Lerp(0.12f, 0.65f, t);
                    fluoroscopeDisplay.color = new Color(b, b, b, 1f);
                }
                else if (kvp <= maxKvp)
                {
                    // Contraste óptimo diagnóstica (con leve realce radiológico si está colimado)
                    if (collimation >= 0.595f)
                    {
                        // Haz colimado óptimo: Máxima nitidez y reducción de dispersión
                        fluoroscopeDisplay.color = new Color(1.05f, 1.05f, 1.10f, 1f);
                    }
                    else
                    {
                        fluoroscopeDisplay.color = Color.white;
                    }
                }
                else
                {
                    // Sobreexpuesto / quemado (blanco brillante lavado con velo radiográfico)
                    float t = Mathf.Clamp01((kvp - maxKvp) / (120f - maxKvp));
                    float over = 1f + t * 0.9f;
                    fluoroscopeDisplay.color = new Color(over, over, over * 1.05f, 1f);
                }
            }

            // 2. Colimación: 4 bordes negros cerrando la ventana del haz
            float inset = Mathf.Clamp(collimation * 0.45f, 0f, 0.35f);
            if (shutterTop)    { shutterTop.anchorMin    = new Vector2(0f, 1f - inset); shutterTop.anchorMax    = new Vector2(1f, 1f); }
            if (shutterBottom) { shutterBottom.anchorMin = new Vector2(0f, 0f);        shutterBottom.anchorMax = new Vector2(1f, inset); }
            if (shutterLeft)   { shutterLeft.anchorMin   = new Vector2(0f, inset);     shutterLeft.anchorMax   = new Vector2(inset, 1f - inset); }
            if (shutterRight)  { shutterRight.anchorMin  = new Vector2(1f - inset, inset); shutterRight.anchorMax = new Vector2(1f, 1f - inset); }

            if (collimatorMask != null)
            {
                float s = Mathf.Clamp(1f - collimation * 0.5f, 0.45f, 1f);
                collimatorMask.localScale = new Vector3(s, s, 1f);
            }
        }

        private void UpdateTabHighlight(int activeIndex)
        {
            SetTabColor(btnTabMG1, activeIndex == 1);
            SetTabColor(btnTabMG2, activeIndex == 2);
            SetTabColor(btnTabMG3, activeIndex == 3);
        }

        private void SetTabColor(Button tabBtn, bool isActive)
        {
            if (tabBtn == null) return;
            var img = tabBtn.GetComponent<Image>();
            if (img != null)
            {
                img.color = isActive ? activeBtnColor : new Color(0.08f, 0.12f, 0.16f, 0.9f);
            }
        }

        public void ShowDraNovaDialog(string title, string body, DraNovaCardTheme? theme = null)
        {
            if (!draNovaCard) return;

            activeDialogSequence.Clear();
            onSequenceCompletedCallback = null;

            if (draNovaTitleText) draNovaTitleText.text = title;
            if (draNovaBodyText)  draNovaBodyText.text = body;

            if (draNovaContinueButton != null)
            {
                var btnTxt = GetDraNovaButtonText();
                if (btnTxt != null) btnTxt.text = "CONTINUAR";
            }

            DraNovaCardTheme finalTheme = theme.HasValue ? theme.Value : InferThemeFromTitle(title);
            SetDraNovaTheme(finalTheme);

            draNovaCard.SetActive(true);
        }

        public void ShowDraNovaSequence(IEnumerable<DraNovaDialogStep> steps, Action onComplete = null)
        {
            if (!draNovaCard) return;

            activeDialogSequence.Clear();
            if (steps != null)
            {
                activeDialogSequence.AddRange(steps);
            }

            if (activeDialogSequence.Count == 0)
            {
                HideDraNovaDialog();
                return;
            }

            currentDialogSequenceIndex = 0;
            onSequenceCompletedCallback = onComplete;
            DisplayCurrentSequenceStep();
            draNovaCard.SetActive(true);
        }

        private void DisplayCurrentSequenceStep()
        {
            if (currentDialogSequenceIndex < 0 || currentDialogSequenceIndex >= activeDialogSequence.Count)
            {
                HideDraNovaDialog();
                return;
            }

            var step = activeDialogSequence[currentDialogSequenceIndex];

            if (draNovaTitleText != null)
            {
                draNovaTitleText.text = step.title;
            }

            if (draNovaBodyText != null)
            {
                draNovaBodyText.text = step.body;
            }

            DraNovaCardTheme finalTheme = step.theme.HasValue ? step.theme.Value : InferThemeFromTitle(step.title);
            SetDraNovaTheme(finalTheme);

            if (draNovaContinueButton != null)
            {
                var btnTxt = GetDraNovaButtonText();
                if (btnTxt != null)
                {
                    if (!string.IsNullOrEmpty(step.buttonText))
                    {
                        btnTxt.text = step.buttonText;
                    }
                    else
                    {
                        bool isLast = (currentDialogSequenceIndex == activeDialogSequence.Count - 1);
                        btnTxt.text = isLast ? "¡ENTENDIDO, EMPEZAR!" : $"CONTINUAR ({currentDialogSequenceIndex + 1}/{activeDialogSequence.Count})";
                    }
                }
            }
        }

        public void ShowTutorRescueDialog(string title, string explanation)
        {
            if (!draNovaCard) return;

            string finalTitle = string.IsNullOrEmpty(title)
                ? "ASISTENCIA DEL TUTOR — LECTURA OBLIGATORIA 15s"
                : title;

            if (draNovaTitleText) draNovaTitleText.text = finalTitle;
            if (draNovaBodyText)  draNovaBodyText.text = explanation;

            SetDraNovaTheme(DraNovaCardTheme.AmberTutor);
            draNovaCard.SetActive(true);

            if (tutorCountdownCoroutine != null)
            {
                StopCoroutine(tutorCountdownCoroutine);
            }
            tutorCountdownCoroutine = StartCoroutine(TutorCountdownRoutine(TUTOR_MANDATORY_READ_SECONDS));
        }

        private IEnumerator TutorCountdownRoutine(float duration)
        {
            isTutorCountdownActive = true;
            StopTutorHighlights();

            Text btnTxt = GetDraNovaButtonText();

            if (draNovaContinueButton != null)
            {
                draNovaContinueButton.interactable = false;
            }

            float remaining = duration;
            while (remaining > 0f)
            {
                int sec = Mathf.CeilToInt(remaining);
                if (btnTxt != null)
                {
                    btnTxt.text = $"CONTINUAR ({sec}s)";
                }
                yield return new WaitForSeconds(1f);
                remaining -= 1f;
            }

            if (btnTxt != null)
            {
                btnTxt.text = "CONTINUAR";
            }

            if (draNovaContinueButton != null)
            {
                draNovaContinueButton.interactable = true;
            }

            isTutorCountdownActive = false;
            tutorCountdownCoroutine = null;

            // Reanudar el reloj quirúrgico automáticamente al habilitar el botón CONTINUAR
            GetActiveMinigameController()?.UnfreezeTimerAfterTutor();

            // Activar iluminación en verde parpadeante (#19E15A) sobre las opciones/botones correctos
            StartTutorHighlights();
        }

        public void StartTutorHighlights()
        {
            StopTutorHighlights();

            if (currentActiveTab == 1)
            {
                if (protocolZeroController != null && protocolZeroController.IsArcInverted)
                {
                    if (btnInvertArc != null) AddHighlightTarget(btnInvertArc.image);
                }
                else
                {
                    if (protocolZeroController != null)
                    {
                        if (!protocolZeroController.IsPpeVerified(PpeType.EquipmentBrakes) && btnPpeBrakes != null) AddHighlightTarget(btnPpeBrakes.image);
                        if (!protocolZeroController.IsPpeVerified(PpeType.LeadApron) && btnPpeApron != null) AddHighlightTarget(btnPpeApron.image);
                        if (!protocolZeroController.IsPpeVerified(PpeType.ThyroidShield) && btnPpeThyroid != null) AddHighlightTarget(btnPpeThyroid.image);
                        if (!protocolZeroController.IsPpeVerified(PpeType.Dosimeter) && btnPpeDosimeter != null) AddHighlightTarget(btnPpeDosimeter.image);
                        if (!protocolZeroController.IsPpeVerified(PpeType.LeadGlasses) && btnPpeGlasses != null) AddHighlightTarget(btnPpeGlasses.image);
                    }
                    if (btnVerifySafety != null) AddHighlightTarget(btnVerifySafety.image);
                }
            }
            else if (currentActiveTab == 2)
            {
                var curCase = beamMasterController != null ? beamMasterController.CurrentCase : null;
                if (curCase != null)
                {
                    float curKvp = sliderKvp != null ? sliderKvp.value : 70f;
                    float curMA = sliderMA != null ? sliderMA.value : 2.8f;
                    float curColl = sliderCollimation != null ? sliderCollimation.value : 0f;

                    if (textKvpValue != null)
                    {
                        textKvpValue.text = $"{curKvp:F0} kVp <color=#19E15A>[META: {curCase.minKvpForPenetration:F0}-{curCase.maxKvp:F0} kVp]</color>";
                        AddHighlightTarget(textKvpValue);
                    }
                    if (textMAValue != null)
                    {
                        textMAValue.text = $"{curMA:F1} mA <color=#19E15A>[META: {curCase.minmA:F1}-{curCase.maxSafemA:F1} mA]</color>";
                        AddHighlightTarget(textMAValue);
                    }
                    if (textCollimationValue != null)
                    {
                        textCollimationValue.text = $"{curColl * 100f:F0}% <color=#19E15A>[META: ≥60%]</color>";
                        AddHighlightTarget(textCollimationValue);
                    }
                }

                if (sliderKvp != null && sliderKvp.targetGraphic != null) AddHighlightTarget(sliderKvp.targetGraphic);
                if (sliderMA != null && sliderMA.targetGraphic != null) AddHighlightTarget(sliderMA.targetGraphic);
                if (sliderCollimation != null && sliderCollimation.targetGraphic != null) AddHighlightTarget(sliderCollimation.targetGraphic);

                if (toggleStepBack != null && (beamMasterController == null || !beamMasterController.HasSteppedBack))
                {
                    AddHighlightTarget(toggleStepBack.targetGraphic);
                }
                if (btnExposurePedal != null) AddHighlightTarget(btnExposurePedal.image);
            }
            else if (currentActiveTab == 3)
            {
                if (isocenterController != null && isocenterController.CurrentFracture != null &&
                    isocenterController.CurrentFracture.requiredOrders != null &&
                    isocenterController.CurrentFracture.requiredOrders.Length > 0)
                {
                    var req = isocenterController.CurrentFracture.requiredOrders[0];

                    var col1 = isocenterController.ActiveCol1Options;
                    for (int i = 0; i < col1.Count && i < col1Buttons.Length; i++)
                    {
                        if (!col1[i].isTrap && col1[i].movementType == req.requiredMovement)
                        {
                            if (col1Buttons[i] != null) AddHighlightTarget(col1Buttons[i].image);
                            break;
                        }
                    }

                    var col2 = isocenterController.ActiveCol2Options;
                    for (int i = 0; i < col2.Count && i < col2Buttons.Length; i++)
                    {
                        if (!col2[i].isTrap && col2[i].directionType == req.requiredDirection)
                        {
                            if (col2Buttons[i] != null) AddHighlightTarget(col2Buttons[i].image);
                            break;
                        }
                    }

                    var col3 = isocenterController.ActiveCol3Options;
                    for (int i = 0; i < col3.Count && i < col3Buttons.Length; i++)
                    {
                        if (!col3[i].isTrap && Mathf.Approximately(col3[i].magnitudeValue, req.requiredMagnitude))
                        {
                            if (col3Buttons[i] != null) AddHighlightTarget(col3Buttons[i].image);
                            break;
                        }
                    }

                    if (btnSubmitOrder != null) AddHighlightTarget(btnSubmitOrder.image);
                    if (btnRotate90 != null) AddHighlightTarget(btnRotate90.image);
                }
            }

            if (highlightedOriginalColors.Count > 0)
            {
                tutorHighlightCoroutine = StartCoroutine(PulsingHighlightRoutine());
            }
        }

        private void AddHighlightTarget(Graphic g)
        {
            if (g == null) return;
            if (!highlightedOriginalColors.ContainsKey(g))
            {
                highlightedOriginalColors[g] = g.color;
            }
        }

        private IEnumerator PulsingHighlightRoutine()
        {
            Color tutorGreen = new Color(25f / 255f, 225f / 255f, 90f / 255f, 1f);

            while (true)
            {
                float t = Mathf.PingPong(Time.unscaledTime * 3f, 1f);
                foreach (var kvp in highlightedOriginalColors)
                {
                    if (kvp.Key != null)
                    {
                        kvp.Key.color = Color.Lerp(kvp.Value, tutorGreen, t);
                    }
                }
                yield return null;
            }
        }

        public void StopTutorHighlights()
        {
            if (tutorHighlightCoroutine != null)
            {
                StopCoroutine(tutorHighlightCoroutine);
                tutorHighlightCoroutine = null;
            }

            foreach (var kvp in highlightedOriginalColors)
            {
                if (kvp.Key != null)
                {
                    kvp.Key.color = kvp.Value;
                }
            }
            highlightedOriginalColors.Clear();

            // Restaurar etiquetas limpias de sliders sin spoiler
            if (sliderKvp != null) UpdateKvpLabel(sliderKvp.value);
            if (sliderMA != null) UpdateMALabel(sliderMA.value);
            if (sliderCollimation != null) UpdateCollimationLabel(sliderCollimation.value);
        }

        public void HideDraNovaDialog()
        {
            // Bloqueo de 15 segundos en modo tutor: impide cerrar la tarjeta antes de cumplir la lectura obligatoria
            if (isTutorCountdownActive) return;

            activeDialogSequence.Clear();
            onSequenceCompletedCallback = null;

            if (draNovaContinueButton != null)
            {
                var btnTxt = GetDraNovaButtonText();
                if (btnTxt != null) btnTxt.text = "CONTINUAR";
            }

            // Al confirmar/continuar, se restablece el contador de fallos para dar una nueva oportunidad limpia
            if (protocolZeroController != null) protocolZeroController.ResetFailedAttempts();
            if (beamMasterController != null) beamMasterController.ResetFailedAttempts();
            if (isocenterController != null) isocenterController.ResetFailedAttempts();

            UpdateAttemptsBadge();

            // Verificar si la fase activa ya fue superada con éxito
            bool isPhase1Done = (currentActiveTab == 1 && protocolZeroController != null && (protocolZeroController.Passed || protocolZeroController.IsCompleted));
            bool isPhase2Done = (currentActiveTab == 2 && beamMasterController != null && (beamMasterController.Passed || beamMasterController.IsCompleted));
            bool isPhase3Done = isPhase3Completed || (currentActiveTab == 3 && isocenterController != null && (isocenterController.Passed || isocenterController.IsCompleted));

            if (isPhase1Done || isPhase2Done || isPhase3Done)
            {
                // En modo web monofase O al finalizar la Fase 3 (última fase del curso completo)
                if (singlePhaseWebMode || isPhase3Done)
                {
                    // 1. Fase concluida y su minijuego (la fase reportada y las métricas siempre coinciden)
                    int phaseIndexToNotify = isPhase3Done ? 3 : currentActiveTab;
                    MinigameBase finishedMinigame = phaseIndexToNotify switch
                    {
                        1 => protocolZeroController,
                        2 => beamMasterController,
                        3 => isocenterController,
                        _ => null
                    };
                    float dose = (phaseIndexToNotify == 2 && beamMasterController != null)
                        ? beamMasterController.AccumulatedPatientDose
                        : 0f;
                    if (finishedMinigame != null) finishedMinigame.PauseMinigame();

                    // 2. Notificar a la plataforma (la API decide los Puntos de Reserva y responde con un acuse)
                    bool sent = ReportPhaseResultToPlatform(phaseIndexToNotify, finishedMinigame, dose);

                    // 3. Mensaje en la tarjeta de Dra. Nova y botón bloqueado (la navegación la controla la plataforma)
                    string body;
                    if (!sent)
                        body = "Dra. Nova: Fase finalizada. No se pudo contactar a la plataforma; el resultado no se registró.";
                    else if (WebLaunchContext.IsPlatformLaunch)
                        body = "Dra. Nova: Fase finalizada. Enviando tu resultado a la plataforma...";
                    else
                        body = "Dra. Nova: Fase finalizada en modo local (sin plataforma). El resultado no se registra.";
                    ShowDraNovaDialog("QUIRÓFANO // FASE FINALIZADA", body);
                    LockDraNovaButton("✓ FASE COMPLETADA");

                    Debug.Log($"[WebBridge] Phase {phaseIndexToNotify} completed and reported (sent={sent}). Game view paused.");
                    return;
                }

                // Modo secuencial multi-fase tradicional
                if (isPhase1Done)
                {
                    ShowSubpanel(2);
                    return;
                }

                if (isPhase2Done)
                {
                    ShowSubpanel(3);
                    return;
                }
            }

            // Ocultar la tarjeta si no es un estado de finalización de fase
            if (draNovaCard != null)
                draNovaCard.SetActive(false);

            // Estado de espera genérico si no hay fase completada
            if (draNovaBodyText)
                draNovaBodyText.text = "Dra. Nova: En espera de tus acciones de radioprotección y verificación en consola.";
            if (draNovaTitleText)
                draNovaTitleText.text = "QUIRÓFANO // EN ESPERA";
        }

        // ════════════════════════════════════════════════════════════════════
        // Web Integration & Single Phase Helpers
        // ════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Envía el resultado de la fase a la plataforma ArcoC (vía ScormBridge → postMessage).
        /// attempt y step salen de la URL de lanzamiento para que la API pueda correlacionarlo.
        /// </summary>
        private bool ReportPhaseResultToPlatform(int phase, MinigameBase minigame, float doseMsv)
        {
            var bridge = ScormBridge.Instance;
            if (bridge == null)
            {
                Debug.LogWarning("[WebBridge] ScormBridge no disponible: el resultado no se envió.");
                return false;
            }

            bridge.NotifyPhaseResult(new PhaseResultMessage
            {
                attemptId = WebLaunchContext.AttemptId ?? string.Empty,
                stepId = WebLaunchContext.StepId ?? string.Empty,
                phase = phase,
                score = minigame != null ? minigame.CurrentScore : 0,
                maxScore = minigame != null ? minigame.MaxScore : 100,
                passed = minigame != null && minigame.Passed,
                errorCount = minigame != null ? minigame.ErrorCount : 0,
                doseMsv = doseMsv,
                timeSeconds = minigame != null ? minigame.ElapsedTime : 0f
            });
            return true;
        }

        /// <summary>Acuse de la plataforma: muestra lo que la API registró para esta partida.</summary>
        private void OnPlatformPhaseAcknowledged(HostMessage ack)
        {
            if (ack == null || ack.attemptId != WebLaunchContext.AttemptId) return;

            string body;
            if (ack.type == "phase-ack")
            {
                string tierLabel = ack.tier == "perfect" ? "fase perfecta"
                    : ack.tier == "intermediate" ? "fase aprobada con errores"
                    : "fase no aprobada";
                body = ack.pointsAwarded > 0
                    ? $"Dra. Nova: Resultado registrado en la plataforma ({tierLabel}). Ganaste +{ack.pointsAwarded} Puntos de Reserva."
                    : $"Dra. Nova: Resultado registrado en la plataforma ({tierLabel}). Esta partida no sumó Puntos de Reserva; puedes volver a intentarlo.";
            }
            else
            {
                body = "Dra. Nova: La plataforma no pudo registrar el resultado. " + (ack.error ?? string.Empty);
            }

            ShowDraNovaDialog("QUIRÓFANO // FASE FINALIZADA", body);
            LockDraNovaButton("✓ FASE COMPLETADA");
        }

        /// <summary>
        /// Deja el botón de la tarjeta deshabilitado con el texto indicado.
        /// Se llama después de ShowDraNovaDialog, que restablece el texto a "CONTINUAR".
        /// </summary>
        private void LockDraNovaButton(string label)
        {
            if (draNovaContinueButton == null) return;
            draNovaContinueButton.interactable = false;
            var btnTxt = GetDraNovaButtonText();
            if (btnTxt != null) btnTxt.text = label;
        }

        /// <summary>
        /// Parses the target phase integer (1, 2, or 3) from absolute URL query parameters (?phase=X or &phase=X).
        /// </summary>
        public int DetectPhaseFromURL(string url)
        {
            try
            {
                if (string.IsNullOrEmpty(url)) return -1;
                var match = Regex.Match(url, @"[?&]phase=([1-3])", RegexOptions.IgnoreCase);
                if (match.Success && int.TryParse(match.Groups[1].Value, out int phase))
                {
                    return phase;
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[CArmUIController] Error detecting phase from URL: {ex.Message}");
            }
            return -1;
        }

        /// <summary>
        /// Public entrypoint for web page wrapper to switch or launch phase directly via unityInstance.SendMessage.
        /// </summary>
        public void LaunchSinglePhaseFromWeb(int phaseIndex)
        {
            if (phaseIndex < 1 || phaseIndex > 3)
            {
                Debug.LogWarning($"[CArmUIController] LaunchSinglePhaseFromWeb: Invalid phase index {phaseIndex}. Must be 1, 2, or 3.");
                return;
            }

            Debug.Log($"[CArmUIController] LaunchSinglePhaseFromWeb received: Phase {phaseIndex}");
            singlePhaseWebMode = true;
            ShowSubpanel(phaseIndex);
            ConfigureTabLocksForSinglePhase(phaseIndex);
        }

        /// <summary>
        /// String overload for unityInstance.SendMessage("CArmUIController", "LaunchSinglePhaseFromWeb", "2").
        /// </summary>
        public void LaunchSinglePhaseFromWeb(string phaseStr)
        {
            if (int.TryParse(phaseStr, out int phaseIndex))
            {
                LaunchSinglePhaseFromWeb(phaseIndex);
            }
            else
            {
                Debug.LogWarning($"[CArmUIController] LaunchSinglePhaseFromWeb: Could not parse '{phaseStr}' to integer.");
            }
        }

        private void ConfigureTabLocksForSinglePhase(int activePhase)
        {
            LockTabButton(btnTabMG1, activePhase == 1);
            LockTabButton(btnTabMG2, activePhase == 2);
            LockTabButton(btnTabMG3, activePhase == 3);
        }

        private void LockTabButton(Button btn, bool isThisActivePhase)
        {
            if (btn == null) return;
            btn.interactable = isThisActivePhase;

            var cg = btn.GetComponent<CanvasGroup>();
            if (cg == null) cg = btn.gameObject.AddComponent<CanvasGroup>();

            cg.alpha = isThisActivePhase ? 1.0f : 0.35f;
            cg.blocksRaycasts = isThisActivePhase;
            cg.interactable = isThisActivePhase;
        }

        private void UnlockAllTabs()
        {
            UnlockTabButton(btnTabMG1);
            UnlockTabButton(btnTabMG2);
            UnlockTabButton(btnTabMG3);
        }

        private void UnlockTabButton(Button btn)
        {
            if (btn == null) return;
            btn.interactable = true;

            var cg = btn.GetComponent<CanvasGroup>();
            if (cg != null)
            {
                cg.alpha = 1.0f;
                cg.blocksRaycasts = true;
                cg.interactable = true;
            }
        }

        private float lastDisplayedDose = -1f;
        private int lastDisplayedQuality = -1;
        private int lastDisplayedAnodeTemp = -1;

        private void UpdateConsoleDisplay(ConsoleState state)
        {
            float doseVal = state.patientDose * 100f;
            if (doseText && !Mathf.Approximately(doseVal, lastDisplayedDose))
            {
                lastDisplayedDose = doseVal;
                doseText.text = $"{doseVal:F1} mSv";
            }

            int qualityVal = Mathf.RoundToInt(state.imageQuality * 100f);
            if (qualityText && qualityVal != lastDisplayedQuality)
            {
                lastDisplayedQuality = qualityVal;
                qualityText.text = $"{qualityVal}%";
            }

            if (anodeFillImage)
            {
                anodeFillImage.fillAmount = state.anodeTemp;
                if (state.anodeTemp >= 0.9f)
                    anodeFillImage.color = dangerRed;
                else if (state.anodeTemp >= 0.8f)
                    anodeFillImage.color = warningOrange;
                else
                    anodeFillImage.color = safeGreen;
            }

            int anodeTempVal = Mathf.RoundToInt(state.anodeTemp * 100f);
            if (anodeText && anodeTempVal != lastDisplayedAnodeTemp)
            {
                lastDisplayedAnodeTemp = anodeTempVal;
                anodeText.text = $"{anodeTempVal}% HU";
            }
        }

        private void UpdateTimer(float remainingSeconds)
        {
            if (!timerText) return;

            int totalSec = Mathf.Max(0, Mathf.FloorToInt(remainingSeconds));
            if (totalSec == lastDisplayedSecond) return;
            lastDisplayedSecond = totalSec;

            int min = totalSec / 60;
            int sec = totalSec % 60;
            timerText.text = $"{min:00}:{sec:00}";
        }
    }
}
