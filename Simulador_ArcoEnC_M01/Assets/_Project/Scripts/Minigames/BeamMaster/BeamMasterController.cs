using System;
using System.Collections.Generic;
using UnityEngine;
using CArmSimulator.Core;
using CArmSimulator.Domain;
using CArmSimulator.Audio;

namespace CArmSimulator.Minigames.BeamMaster
{
    /// <summary>
    /// Minigame 2 Controller: "Beam Master: Console & Scatter Radiation"
    /// 
    /// Simulates technical exposure parameters (kVp, mA, Collimation, 1-Step-Back distance),
    /// tungsten anode thermal kinetics, Compton scatter particle emission, and fluoroscopic image formation.
    /// </summary>
    public class BeamMasterController : MinigameBase
    {
        // ── Scoring Rules ───────────────────────────────────────────────────
        private const int PTS_OPTIMAL_EXPOSURE     = 25;
        private const int PTS_DISTANCE_STEP_BACK   = 10;
        private const int PTS_COLLIMATION_APPLIED  = 15;
        private const int PTS_CASE_COMPLETED       = 20;
        private const int PENALTY_OVERHEAT         = -20;
        private const int PENALTY_EXCESSIVE_DOSE   = -15;

        // ── Dra. Nova Clinical Dialogues ───────────────────────────────────
        public const string FEEDBACK_KVP_INSUFFICIENT = "Falta fuerza de penetración: sube el kilovoltaje (kVp) para que los fotones logren atravesar un tejido denso como la pelvis o el fémur.";
        public const string FEEDBACK_EXCESSIVE_MA    = "Cuidado: subir el miliamperaje (mA) reduce el ruido visual, pero incrementa directamente la dosis de radiación para el paciente y para todo tu equipo.";
        public const string FEEDBACK_NEED_COLLIMATION = "Cierra las láminas de plomo para colimar el haz exclusivamente al área anatómica de interés; así reduces la radiación dispersa y eliminas la niebla visual para ganar contraste y nitidez.";
        public const string FEEDBACK_ANODE_OVERHEAT   = "¡Peligro térmico en el ánodo de tungsteno! Recuerda que el 99% de la energía se transforma en calor puro. Evita pisar el pedal de forma continua y utiliza pulsos cortos.";

        // ── Clinical Scenarios ──────────────────────────────────────────────
        [Header("Clinical Cases")]
        [SerializeField] private ClinicalCase[] cases = new ClinicalCase[]
        {
            new ClinicalCase
            {
                caseName = "Caso 1: Articulación de Hombro",
                clinicalContext = "Requiere penetración media y colimación focalizada.",
                recommendedKvp = 70f,
                minKvpForPenetration = 65f,
                maxKvp = 75f,
                recommendedmA = 2.8f,
                minmA = 2.0f,
                maxSafemA = 3.5f,
                recommendedCollimation = 0.40f // Apertura 0.40 = 60% colimado
            },
            new ClinicalCase
            {
                caseName = "Caso 2: Diáfisis de Fémur",
                clinicalContext = "Tejido óseo denso; exige elevar el kilovoltaje (kVp) sin abusar del miliamperaje (mA).",
                recommendedKvp = 80f,
                minKvpForPenetration = 75f,
                maxKvp = 85f,
                recommendedmA = 4.2f,
                minmA = 3.5f,
                maxSafemA = 5.0f,
                recommendedCollimation = 0.40f
            },
            new ClinicalCase
            {
                caseName = "Caso 3: Anillo Pélvico",
                clinicalContext = "Máxima densidad anatómica; alto riesgo de dispersión Compton y sobrecalentamiento del ánodo si se abusa del pedal continuo.",
                recommendedKvp = 92f,
                minKvpForPenetration = 85f,
                maxKvp = 100f,
                recommendedmA = 5.5f,
                minmA = 4.5f,
                maxSafemA = 6.5f,
                recommendedCollimation = 0.40f
            }
        };

        private int currentCaseIndex = 0;
        public int CurrentCaseIndex => currentCaseIndex;
        public ClinicalCase CurrentCase => cases != null && currentCaseIndex < cases.Length
            ? cases[currentCaseIndex] : null;

        // ── Console Operating Parameters ────────────────────────────────────
        [Header("Console Parameter Defaults")]
        [SerializeField, Range(40f, 120f)] private float defaultKvp = 70f;
        [SerializeField, Range(1f, 10f)]   private float defaultMA  = 2.8f;

        private float currentKvp;
        private float currentMA;
        private float currentCollimation = 1f; // 1 = fully open, <= 0.40 = >= 60% colimado
        private bool hasSteppedBack = false;

        // Banderas de puntuación única por caso (evita exploit de +10 pts infinito)
        private bool stepBackRewardedForCurrentCase = false;
        private bool collimationRewardedForCurrentCase = false;

        public float CollimationPercent => Mathf.Clamp01(1f - currentCollimation);
        public float CurrentKvp => currentKvp;
        public float CurrentMA => currentMA;
        public bool HasSteppedBack => hasSteppedBack;
        public float AccumulatedPatientDose => accumulatedPatientDose;

        // ── Thermal & Dosimetry Models ──────────────────────────────────────
        [Header("Anode Thermal Parameters")]
        [SerializeField] private float maxAnodeTemp = 100f;
        [SerializeField] private float heatRatePerSec = 8f;
        [SerializeField] private float coolRatePerSec = 3f;
        [SerializeField] private float overheatThreshold = 90f;

        private ThermalAnodeModel thermalModel;
        private bool hasFiredAnodeWarning = false;

        // Dosimetry accumulators
        private const float MAX_ACCUMULATED_DOSE = 500f;
        private float accumulatedPatientDose = 0f;
        private float accumulatedOperatorDose = 0f;

        // Fluoroscopy state
        private bool isFluoroActive = false;
        private float imageQuality = 0f;
        private float imageNoise = 0f;
        private float imageScatter = 0f;
        private float comptonIntensity = 0f;

        [Header("Visual & FX References")]
        [SerializeField] private ParticleSystem comptonParticles;

        // ── Events for HUD & Console UI ─────────────────────────────────────
        public event Action<ConsoleState> OnConsoleUpdated;
        public event Action<int, ClinicalCase> OnCaseStarted;
        public event Action<ExposureReport> OnExposureTriggered;
        public event Action<bool> OnFluoroStateChanged;
        public event Action<bool, string> OnAnodeOverheatStateChanged; // (isBlocked, feedback)
        public event Action<string> OnAnodeThermalWarning; // Triggered at > 80% HU
        public event Action<float> OnImageQualityUpdated;
        public event Action<float> OnComptonScatterUpdated;

        protected override void InitializeMinigame()
        {
            ResetFailedAttempts();
            thermalModel = new ThermalAnodeModel(maxAnodeTemp, overheatThreshold, heatRatePerSec, coolRatePerSec);

            currentKvp = defaultKvp;
            currentMA = defaultMA;
            currentCollimation = 1f;
            hasSteppedBack = false;

            accumulatedPatientDose = 0f;
            accumulatedOperatorDose = 0f;
            isFluoroActive = false;

            if (cases != null && cases.Length > 0)
            {
                StartCase(0);
            }
            else
            {
                NotifyConsoleUpdate();
            }
        }

        protected override void Update()
        {
            base.Update();
            if (!isActive || isCompleted || isPaused) return;

            // Thermal dissipation or heating
            bool wasBlocked = thermalModel.IsOverheated;
            thermalModel.UpdateThermalState(isFluoroActive, Time.deltaTime);

            // 80% HU warning alert from Dra. Nova
            if (thermalModel.IsInWarningZone && !hasFiredAnodeWarning)
            {
                hasFiredAnodeWarning = true;
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnAnodeThermalWarning?.Invoke(FEEDBACK_ANODE_OVERHEAT);
                Debug.LogWarning($"[BeamMaster] {FEEDBACK_ANODE_OVERHEAT}");
            }
            else if (!thermalModel.IsInWarningZone)
            {
                hasFiredAnodeWarning = false;
            }

            if (thermalModel.IsOverheated && !wasBlocked)
            {
                StopFluoroscopy();
                RecordError(Mathf.Abs(PENALTY_OVERHEAT), "BM_ANODE_OVERHEAT",
                    "Sobrecalentó el ánodo del tubo: la exposición se bloqueó.");
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnAnodeOverheatStateChanged?.Invoke(true, FEEDBACK_ANODE_OVERHEAT);
                Debug.LogWarning("[BeamMaster] Anode overheated! Exposure blocked.");
            }
            else if (!thermalModel.IsOverheated && wasBlocked)
            {
                OnAnodeOverheatStateChanged?.Invoke(false, "Ánodo enfriado por debajo del margen seguro. Pedal desbloqueado.");
                Debug.Log("[BeamMaster] Anode cooled down. System unblocked.");
            }

            // Dosimetry accumulation during active beam
            if (isFluoroActive)
            {
                float doseInc = (currentKvp / 100f) * (currentMA / 10f) * 10f * Time.deltaTime;
                accumulatedPatientDose = Mathf.Min(accumulatedPatientDose + doseInc, MAX_ACCUMULATED_DOSE);

                float opDoseInc = RadiationDoseCalculator.CalculateOperatorDose(
                    isTubeAboveTable: false,
                    hasSteppedBack: hasSteppedBack,
                    collimationFactor: currentCollimation,
                    mA: currentMA,
                    exposureDurationSeconds: Time.deltaTime
                );
                accumulatedOperatorDose = Mathf.Min(accumulatedOperatorDose + opDoseInc, MAX_ACCUMULATED_DOSE);
            }

            NotifyConsoleUpdate();
        }

        public void StartCase(int index)
        {
            if (cases == null || index < 0 || index >= cases.Length) return;

            currentCaseIndex = index;
            ResetFailedAttempts();
            ClinicalCase c = cases[index];

            // Reiniciar banderas de recompensa por caso
            stepBackRewardedForCurrentCase = false;
            collimationRewardedForCurrentCase = false;

            // Si el jugador ya tenía el toggle activo al pasar de caso, premiarlo una sola vez para el nuevo caso
            if (hasSteppedBack)
            {
                stepBackRewardedForCurrentCase = true;
                AddScore(PTS_DISTANCE_STEP_BACK);
            }

            if (CollimationPercent >= 0.595f)
            {
                collimationRewardedForCurrentCase = true;
                AddScore(PTS_COLLIMATION_APPLIED);
            }

            OnCaseStarted?.Invoke(index, c);
            NotifyConsoleUpdate();

            Debug.Log($"[BeamMaster] Case {index + 1} started: {c.caseName} ({c.clinicalContext})");
        }

        // ── Console Adjustments ─────────────────────────────────────────────

        public void SetKvp(float value)
        {
            currentKvp = Mathf.Clamp(value, 40f, 120f);
            NotifyConsoleUpdate();
        }

        public void AdjustKvp(float delta) => SetKvp(currentKvp + delta);

        public void SetMA(float value)
        {
            currentMA = Mathf.Clamp(value, 1f, 10f);
            NotifyConsoleUpdate();
        }

        public void AdjustMA(float delta) => SetMA(currentMA + delta);

        public void SetCollimation(float normalizedFraction)
        {
            currentCollimation = Mathf.Clamp(normalizedFraction, 0.15f, 1.0f);
            if (!collimationRewardedForCurrentCase && CollimationPercent >= 0.595f)
            {
                collimationRewardedForCurrentCase = true;
                AddScore(PTS_COLLIMATION_APPLIED);
            }
            NotifyConsoleUpdate();
        }

        public void ToggleStepBackDistance() => SetStepBackDistance(!hasSteppedBack);

        public void SetStepBackDistance(bool stepped)
        {
            hasSteppedBack = stepped;
            if (hasSteppedBack && !stepBackRewardedForCurrentCase)
            {
                stepBackRewardedForCurrentCase = true;
                AddScore(PTS_DISTANCE_STEP_BACK);
                Debug.Log("[BeamMaster] 1 Paso Atrás aplicado (+10 pts otorgados una sola vez en este caso).");
            }
            NotifyConsoleUpdate();
        }

        // ── Exposure Control ────────────────────────────────────────────────

        public void StartFluoroscopy()
        {
            if (thermalModel.IsOverheated)
            {
                AudioSFXManager.Instance?.PlayWarningScatter();
                Debug.LogWarning("[BeamMaster] Cannot expose: anode overheat lockout active.");
                return;
            }

            AudioSFXManager.Instance?.PlayBeepXRay();
            isFluoroActive = true;
            OnFluoroStateChanged?.Invoke(true);

            if (comptonParticles != null && !comptonParticles.isPlaying)
            {
                comptonParticles.Play();
            }

            NotifyConsoleUpdate();
        }

        public void StopFluoroscopy()
        {
            if (!isFluoroActive) return;

            isFluoroActive = false;
            OnFluoroStateChanged?.Invoke(false);

            if (comptonParticles != null)
            {
                comptonParticles.Stop();
            }

            EvaluateExposureShot();
            NotifyConsoleUpdate();
        }

        private void EvaluateExposureShot()
        {
            if (CurrentCase == null) return;

            // 1. Verificación de los 4 criterios clínicos del caso activo
            bool kvpTooLow = currentKvp < CurrentCase.minKvpForPenetration;
            bool kvpTooHigh = currentKvp > CurrentCase.maxKvp;
            bool maTooLow = currentMA < CurrentCase.minmA;
            bool maTooHigh = currentMA > CurrentCase.maxSafemA;
            bool collimationInsufficient = CollimationPercent < 0.595f; // Falta cerrar láminas de colimación >= 60%
            bool stepBackMissing = !hasSteppedBack; // Falta dar 1 Paso Atrás

            bool isOptimal = false;
            string feedback = "";

            if (kvpTooLow)
            {
                feedback = $"Dra. Nova: Subexposición por kVp bajo ({currentKvp:F0} kVp). Falta fuerza de penetración para atravesar la densidad ósea de este segmento. Sube el kilovoltaje al rango óptimo ({CurrentCase.minKvpForPenetration:F0}-{CurrentCase.maxKvp:F0} kVp).";
            }
            else if (kvpTooHigh)
            {
                feedback = $"Dra. Nova: Sobreexposición por kVp alto ({currentKvp:F0} kVp). El haz sobrepenetra el tejido y produce velo óptico. Reduce el kilovoltaje al rango óptimo ({CurrentCase.minKvpForPenetration:F0}-{CurrentCase.maxKvp:F0} kVp).";
            }
            else if (maTooLow)
            {
                feedback = $"Dra. Nova: Falta de miliamperaje ({currentMA:F1} mA). Densidad de flujo insuficiente generando ruido cuántico en la imagen. Ajusta entre {CurrentCase.minmA:F1} y {CurrentCase.maxSafemA:F1} mA.";
            }
            else if (maTooHigh)
            {
                feedback = $"Dra. Nova: Exceso de miliamperaje ({currentMA:F1} mA). Dosis de radiación innecesaria para el paciente y sobrecarga térmica en el ánodo. Ajusta entre {CurrentCase.minmA:F1} y {CurrentCase.maxSafemA:F1} mA.";
            }
            else if (collimationInsufficient)
            {
                feedback = $"Dra. Nova: Falta cerrar láminas de colimación >= 60% (actualmente al {CollimationPercent * 100f:F0}%). Colima exclusivamente al área anatómica de interés para reducir la dispersión Compton y ganar nitidez.";
            }
            else if (stepBackMissing)
            {
                feedback = "Dra. Nova: Falta dar 1 Paso Atrás. Activa el toggle '1 Paso Atrás' para alejarte del paciente y reducir la radiación dispersa Compton a 1/4 (Ley del Inverso del Cuadrado).";
            }
            else
            {
                isOptimal = true;
            }

            int evaluatedCaseIndex = currentCaseIndex;

            if (isOptimal)
            {
                ResetFailedAttempts();
                AddScore(PTS_OPTIMAL_EXPOSURE);
                AddScore(PTS_CASE_COMPLETED);

                if (evaluatedCaseIndex == 0)
                {
                    feedback = "Dra. Nova: ¡Imagen diagnóstica óptima con mínima dispersión! Pasemos al Caso 2/3: Diáfisis de Fémur. Al ser un hueso más denso, necesitarás mayor fuerza de penetración (75-85 kVp y 3.5-5.0 mA).";
                }
                else if (evaluatedCaseIndex == 1)
                {
                    feedback = "Dra. Nova: ¡Penetración ósea perfecta! Último reto, Caso 3/3: Anillo Pélvico. Máxima densidad anatómica: ajusta entre 85-100 kVp y 4.5-6.5 mA cuidando la temperatura del ánodo.";
                }
                else if (evaluatedCaseIndex == 2)
                {
                    feedback = "Dra. Nova: ¡Dominio total del haz y del principio ALARA! Has obtenido imágenes nítidas en los 3 segmentos anatómicos protegiendo al equipo. Pulsa CONTINUAR para ir a la Fase 3: Comando Isocentro.";
                }
            }
            else
            {
                if (failedAttemptsCount >= 2)
                {
                    failedAttemptsCount++;
                    TriggerTutorRescue(GetTutorRescueText(currentCaseIndex));
                    AudioSFXManager.Instance?.PlayWarningScatter();
                }
                else
                {
                    failedAttemptsCount++;
                    RecordError(5, "BM_EXPOSURE_SUBOPTIMAL",
                        $"Exposición no óptima en el caso {evaluatedCaseIndex + 1} (kVp, mA o colimación inadecuados).");
                }
            }

            var report = new ExposureReport
            {
                caseIndex = evaluatedCaseIndex,
                caseName = CurrentCase.caseName,
                kvp = currentKvp,
                mA = currentMA,
                collimation = currentCollimation,
                hasSteppedBack = hasSteppedBack,
                anodeTemp = thermalModel != null ? thermalModel.NormalizedTemperature : 0f,
                patientDose = accumulatedPatientDose / MAX_ACCUMULATED_DOSE,
                imageQuality = isOptimal ? 1.0f : imageQuality,
                comptonIntensity = comptonIntensity,
                isOptimal = isOptimal,
                diagnosticFeedback = feedback
            };

            OnExposureTriggered?.Invoke(report);

            // Si fue óptimo, avanzar automáticamente al siguiente caso o completar la fase
            if (isOptimal)
            {
                if (evaluatedCaseIndex == 0)
                {
                    StartCase(1);
                }
                else if (evaluatedCaseIndex == 1)
                {
                    StartCase(2);
                }
                else if (evaluatedCaseIndex == 2)
                {
                    CompleteMinigame(true);
                }
            }
        }

        public void AdvanceToNextCase()
        {
            int next = currentCaseIndex + 1;
            if (cases != null && next < cases.Length)
            {
                StartCase(next);
            }
            else
            {
                CompleteMinigame(currentScore >= (config != null ? config.passScorePercent : 70f));
            }
        }

        private void NotifyConsoleUpdate()
        {
            if (CurrentCase != null)
            {
                float penetration = Mathf.Clamp01((currentKvp - CurrentCase.minKvpForPenetration) /
                    Mathf.Max(1f, CurrentCase.recommendedKvp - CurrentCase.minKvpForPenetration));
                imageNoise = Mathf.Clamp01(1f - (currentMA / 10f));
                imageScatter = currentCollimation * (hasSteppedBack ? 0.5f : 1.0f);
                imageQuality = Mathf.Clamp01(penetration * (1f - imageNoise * 0.5f) * (1f - imageScatter * 0.4f));
            }

            comptonIntensity = isFluoroActive ? currentCollimation : 0f;
            OnComptonScatterUpdated?.Invoke(comptonIntensity);
            OnImageQualityUpdated?.Invoke(imageQuality);

            OnConsoleUpdated?.Invoke(new ConsoleState
            {
                kvp = currentKvp,
                mA = currentMA,
                collimation = currentCollimation,
                hasSteppedBack = hasSteppedBack,
                anodeTemp = thermalModel != null ? thermalModel.NormalizedTemperature : 0f,
                patientDose = accumulatedPatientDose / MAX_ACCUMULATED_DOSE,
                operatorDose = accumulatedOperatorDose / MAX_ACCUMULATED_DOSE,
                imageQuality = imageQuality,
                imageNoise = imageNoise,
                imageScatter = imageScatter,
                isAnodeBlocked = thermalModel != null && thermalModel.IsOverheated
            });
        }

        public string GetTutorRescueText(int caseIdx)
        {
            switch (caseIdx)
            {
                case 0:
                    return "RESCATE CLÍNICO — CASO 1: ARTICULACIÓN DE HOMBRO\n\n" +
                           "• Tensión (kVp): Ajusta entre 65 y 75 kVp. Un kVp menor no penetra el húmero proximal; un kVp mayor produce velo y sobreexposición.\n" +
                           "• Corriente (mA): Configura entre 2.0 y 3.5 mA para equilibrar el ruido cuántico sin sobrecargar de dosis al paciente.\n" +
                           "• Colimación: Cierra las láminas de plomo al menos al 60% para recortar la penumbra y suprimir la dispersión Compton.\n" +
                           "• Distancia: Activa '1 Paso Atrás' (Ley del Inverso del Cuadrado) para reducir tu dosis a la cuarta parte.\n\n" +
                           "Configura los parámetros guiados en verde y dispara el pedal.";
                case 1:
                    return "RESCATE CLÍNICO — CASO 2: DIÁFISIS DE FÉMUR\n\n" +
                           "• Tensión (kVp): El fémur es una cortical ósea compacta; exige entre 75 y 85 kVp para atravesar la masa muscular y ósea.\n" +
                           "• Corriente (mA): Configura entre 3.5 y 5.0 mA para nitidez diagnóstica.\n" +
                           "• Colimación: Cierra las láminas al menos al 60% centradas en la diáfisis.\n" +
                           "• Distancia: Mantén activo '1 Paso Atrás'.\n\n" +
                           "Configura los parámetros guiados en verde y dispara el pedal.";
                case 2:
                default:
                    return "RESCATE CLÍNICO — CASO 3: ANILLO PÉLVICO\n\n" +
                           "• Tensión (kVp): Máxima densidad anatómica del esqueleto; exige entre 85 y 100 kVp.\n" +
                           "• Corriente (mA): Ajusta entre 4.5 y 6.5 mA.\n" +
                           "• Dispersión y Temperatura: Cierra las láminas al 60% y no mantengas el pedal continuo para proteger el ánodo de tungsteno del sobrecalentamiento.\n" +
                           "• Distancia: Mantén activo '1 Paso Atrás'.\n\n" +
                           "Configura los parámetros guiados en verde y dispara el pedal.";
            }
        }
    }

    [Serializable]
    public class ClinicalCase
    {
        public string caseName = "Muñeca";
        [TextArea(1, 2)] public string clinicalContext = "Proyección anteroposterior para osteosíntesis de radio distal.";
        public float recommendedKvp = 60f;
        public float kvpTolerance = 10f;
        public float minKvpForPenetration = 45f;
        public float maxKvp = 75f;
        public float recommendedmA = 2.8f;
        public float minmA = 2.0f;
        public float maxSafemA = 4f;
        public float recommendedCollimation = 0.3f;
        public int requiredExposures = 3;
    }

    [Serializable]
    public struct ConsoleState
    {
        public float kvp, mA, collimation;
        public bool hasSteppedBack, isAnodeBlocked;
        public float anodeTemp, patientDose, operatorDose, imageQuality, imageNoise, imageScatter;
    }

    [Serializable]
    public struct ExposureReport
    {
        public int caseIndex;
        public string caseName;
        public float kvp, mA, collimation;
        public bool hasSteppedBack;
        public float anodeTemp, patientDose, imageQuality, comptonIntensity;
        public bool isOptimal;
        public string diagnosticFeedback;
    }
}
