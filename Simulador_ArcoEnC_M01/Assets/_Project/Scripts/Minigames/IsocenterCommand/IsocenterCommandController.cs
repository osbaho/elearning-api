using System;
using System.Collections.Generic;
using UnityEngine;
using CArmSimulator.Core;
using CArmSimulator.Domain;
using CArmSimulator.Audio;

namespace CArmSimulator.Minigames.IsocenterCommand
{
    public enum GameStage { OrderBuilding, IsocenterAlignment }

    public enum MovementType
    {
        LongitudinalTranslation,
        HorizontalTranslation,
        VerticalElevation,
        OrbitalRotation,
        Angulation
    }

    public enum DirectionType
    {
        Cephalic,
        Caudal,
        Inward,
        Outward,
        Upward,
        Downward,
        APToLateral
    }

    /// <summary>
    /// Minigame 3 Controller: "Isocenter Command: Closed-Loop Communication & Alignment"
    /// 
    /// Stage 1: Closed-Loop Order Builder (Movement + Direction + Magnitude).
    ///          Ambiguous jargon buttons penalize with dose and intraoperative delays.
    /// Stage 2: Isocenter Alignment Challenge:
    ///          Center target anatomy at the isocenter prior to 90° AP->Lateral orbital rotation.
    /// </summary>
    public class IsocenterCommandController : MinigameBase
    {
        // ── Scoring Rules (Total: 100 pts distributed in 3 progressive cases) ──
        private const int PTS_CORRECT_ORDER_C1      = 15;
        private const int PTS_ISOCENTER_ALIGNED_C1   = 15;
        private const int PTS_PERFECT_ROTATION_C1   = 10; // Total Caso 1 = 40 pts

        private const int PTS_CORRECT_ORDER_C2      = 20;
        private const int PTS_JOINT_CLEARANCE_C2    = 10; // Total Caso 2 = 30 pts (Acumulado: 70 pts)

        private const int PTS_CORRECT_ORDER_C3      = 20;
        private const int PTS_OBLIQUE_PROJECTION_C3 = 10; // Total Caso 3 = 30 pts (Acumulado: 100 pts)

        private const int PENALTY_AMBIGUOUS_ORDER   = -15;
        private const int PENALTY_BAD_ROTATION      = -20;
        private const int PENALTY_FAILED_SHOT       = -10;

        // ── Dra. Nova Clinical Dialogues ───────────────────────────────────
        public const string AMBIGUOUS_ORDER_FEEDBACK = "Orden ambigua rechazada. Expresiones como «sube un pelo» o «gíralo hacia mí» solo generan disparos fallidos y pérdida de tiempo quirúrgico. Emite una orden en bucle cerrado con los 3 datos: nombre del movimiento, dirección anatómica y magnitud.";
        public const string ISOCENTER_FAILED_FEEDBACK = "El hueso fracturado se salió de la pantalla al girar a proyección lateral porque no estaba en el isocentro. Alinea la fractura en el eje central tanto en AP como en lateral antes de rotar el brazo en C.";

        // ── Fracture Scenarios ──────────────────────────────────────────────
        [Header("Fracture Cases")]
        [SerializeField] private FractureCase[] fractureCases = GetDefaultFractureCases();

        public static FractureCase[] GetDefaultFractureCases()
        {
            return new FractureCase[]
            {
                new FractureCase
                {
                    fractureName = "Caso 1: Centrado e Isocentro en Fractura de Fémur",
                    clinicalContext = "El trazo de fractura se encuentra 5 cm hacia la cabeza del paciente respecto al eje central. Desplaza linealmente toda la estructura del arco para centrarlo.",
                    requiredOrders = new RequiredOrderStep[]
                    {
                        new RequiredOrderStep
                        {
                            requiredMovement = MovementType.LongitudinalTranslation,
                            requiredDirection = DirectionType.Cephalic,
                            requiredMagnitude = 5f,
                            rationale = "Avanza cinco centímetros hacia cefálico para centrar la fractura en el isocentro."
                        }
                    }
                },
                new FractureCase
                {
                    fractureName = "Caso 2: Despeje Articular de Cadera/Hombro",
                    clinicalContext = "Hay superposición ósea articular. Inclina el brazo en C sobre su eje de soporte 15 grados hacia la cabeza del paciente sin mover la base.",
                    requiredOrders = new RequiredOrderStep[]
                    {
                        new RequiredOrderStep
                        {
                            requiredMovement = MovementType.Angulation,
                            requiredDirection = DirectionType.Cephalic,
                            requiredMagnitude = 15f,
                            rationale = "Angulación cefálica de 15 grados para despejar la articulación sin magnificación."
                        }
                    }
                },
                new FractureCase
                {
                    fractureName = "Caso 3: Proyección Oblicua de Pelvis (Judet)",
                    clinicalContext = "Para despejar el acetábulo, desliza el arco sobre su propio riel curvo desde la proyección frontal hacia el perfil unos 30 grados.",
                    requiredOrders = new RequiredOrderStep[]
                    {
                        new RequiredOrderStep
                        {
                            requiredMovement = MovementType.OrbitalRotation,
                            requiredDirection = DirectionType.APToLateral,
                            requiredMagnitude = 30f,
                            rationale = "Rotación orbital de 30 grados de AP a lateral para despejar la columna anterior del acetábulo (proyección oblicua de Judet)."
                        }
                    }
                }
            };
        }

        public void EnsureThreeCases()
        {
            if (fractureCases == null || fractureCases.Length < 3)
            {
                fractureCases = GetDefaultFractureCases();
            }
        }

        private int currentFractureIndex = 0;
        public int CurrentFractureIndex => currentFractureIndex;
        public int TotalFractureCases => fractureCases != null ? fractureCases.Length : 0;
        public FractureCase CurrentFracture => fractureCases != null && currentFractureIndex < fractureCases.Length
            ? fractureCases[currentFractureIndex] : null;

        // ── Active Shuffled Catalog (6 options per column: 4 real + 2 camouflaged traps) ──
        private readonly List<OrderCatalogItem> activeCol1Options = new List<OrderCatalogItem>();
        private readonly List<OrderCatalogItem> activeCol2Options = new List<OrderCatalogItem>();
        private readonly List<OrderCatalogItem> activeCol3Options = new List<OrderCatalogItem>();

        public IReadOnlyList<OrderCatalogItem> ActiveCol1Options => activeCol1Options;
        public IReadOnlyList<OrderCatalogItem> ActiveCol2Options => activeCol2Options;
        public IReadOnlyList<OrderCatalogItem> ActiveCol3Options => activeCol3Options;

        // Player selected slots (null when empty)
        private int? slotCol1Index = null;
        private int? slotCol2Index = null;
        private int? slotCol3Index = null;

        // ── 3D C-Arm & Target Setup ─────────────────────────────────────────
        [Header("C-Arm & Isocenter References")]
        [SerializeField] private Transform arcTransform;
        [SerializeField] private Transform fractureTarget;
        [SerializeField] private Transform xrayMonitorPlane;

        private Vector3 arcPosition;
        private float arcOrbitalAngle = 0f; // 0=AP, 90=Lateral
        private bool isIsocenterAligned = false;
        private bool isocenterAlignedRewarded = false;
        private float isocenterAccuracy = 0f;

        public bool IsIsocenterAligned => isIsocenterAligned;
        public float ArcOrbitalAngle => arcOrbitalAngle;
        public float IsocenterAccuracy => isocenterAccuracy;

        // Precision rating stars
        private int precisionStars = 3;

        // ── Stage Management ────────────────────────────────────────────────
        public GameStage CurrentStage { get; private set; } = GameStage.OrderBuilding;

        // ── Events for UI / HUD ─────────────────────────────────────────────
        public event Action<GameStage> OnStageChanged;
        public event Action<int, FractureCase> OnFractureCaseStarted;
        public event Action<SlotSnapshot> OnSlotsUpdated;
        public event Action<BuiltOrder, bool, string> OnOrderEvaluated;
        public event Action<string, string> OnAmbiguousOrderTriggered; // (text, pedagogicalFeedback)
        public event Action<bool, float> OnIsocenterAlignmentChanged; // (isAligned, accuracy)
        public event Action<bool, string> OnOrbitalRotationEvaluated;
        public event Action<int> OnStarsUpdated;
        public event Action<string> OnIncompleteOrderSubmitted;
        public event Action<List<OrderCatalogItem>, List<OrderCatalogItem>, List<OrderCatalogItem>> OnCatalogShuffled;

        protected override void InitializeMinigame()
        {
            EnsureThreeCases();
            currentFractureIndex = 0;
            precisionStars = 3;
            ClearSlots();

            if (arcTransform != null)
            {
                arcPosition = arcTransform.localPosition;
                arcOrbitalAngle = 0f;
            }

            if (fractureCases != null && fractureCases.Length > 0)
            {
                StartFractureCase(0);
            }
        }

        public void StartFractureCase(int index)
        {
            EnsureThreeCases();
            if (fractureCases == null || index < 0 || index >= fractureCases.Length) return;

            currentFractureIndex = index;
            CurrentStage = GameStage.OrderBuilding;
            ResetFailedAttempts();
            isIsocenterAligned = false;
            isocenterAlignedRewarded = false;
            ClearSlots();

            // Populate and shuffle the 3 columns (4 real + 2 traps each)
            PopulateAndShuffleCatalog(index);

            if (index == 0)
            {
                AnatomicalTargetManager.Instance?.SetAnatomyWithOffset(AnatomyType.Femur, new Vector3(0f, 0f, -0.05f), animate: false);
            }
            else if (index == 1)
            {
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Shoulder, animate: false);
            }
            else
            {
                AnatomicalTargetManager.Instance?.SetAnatomy(AnatomyType.Pelvis, animate: false);
            }

            if (AnatomicalTargetManager.Instance != null && AnatomicalTargetManager.Instance.CurrentTargetTransform != null)
            {
                fractureTarget = AnatomicalTargetManager.Instance.CurrentTargetTransform;
            }

            if (arcTransform != null && fractureTarget != null)
            {
                if (index == 0)
                {
                    // Desplazamiento inicial de -5cm (-0.05m caudal) para que +5cm cefálico alinee a 0.0m de desviación
                    arcTransform.position = fractureTarget.position + new Vector3(0f, 0f, -0.05f);
                    arcTransform.localRotation = Quaternion.identity;
                }
                else
                {
                    arcTransform.position = fractureTarget.position;
                    arcTransform.localRotation = Quaternion.identity;
                }
                arcPosition = arcTransform.localPosition;
                arcOrbitalAngle = 0f;
            }

            OnFractureCaseStarted?.Invoke(index, CurrentFracture);
            OnStageChanged?.Invoke(CurrentStage);
            OnStarsUpdated?.Invoke(precisionStars);

            Debug.Log($"[IsocenterCommand] Fracture case {index + 1} started: {CurrentFracture.fractureName}");
        }

        /// <summary>
        /// Populates 6 options per column (4 technical real + 2 colloquial traps) and shuffles their display order.
        /// </summary>
        private void PopulateAndShuffleCatalog(int caseIndex)
        {
            // Col 1: Movement (4 real + 2 traps)
            activeCol1Options.Clear();
            activeCol1Options.Add(new OrderCatalogItem { label = "Traslación Long.", movementType = MovementType.LongitudinalTranslation, isTrap = false });
            activeCol1Options.Add(new OrderCatalogItem { label = "Rotación Orbital", movementType = MovementType.OrbitalRotation, isTrap = false });
            activeCol1Options.Add(new OrderCatalogItem { label = "Angulación", movementType = MovementType.Angulation, isTrap = false });
            activeCol1Options.Add(new OrderCatalogItem { label = "Elevación Vert.", movementType = MovementType.VerticalElevation, isTrap = false });
            activeCol1Options.Add(new OrderCatalogItem
            {
                label = "Mover el aparato",
                isTrap = true,
                pedagogicalFeedback = "«Mover el aparato» es una expresión ambigua e imprecisa. En el Arco en C debes especificar el tipo cinemático de movimiento: Traslación Longitudinal, Rotación Orbital, Angulación o Elevación Vertical."
            });
            activeCol1Options.Add(new OrderCatalogItem
            {
                label = "Correr el cabezal",
                isTrap = true,
                pedagogicalFeedback = "«Correr el cabezal» es coloquial y confuso. El Arco en C tiene movimientos mecánicos estandarizados. Utiliza 'Traslación Longitudinal' o 'Rotación Orbital'."
            });

            // Col 2: Direction (4 real + 2 traps)
            activeCol2Options.Clear();
            activeCol2Options.Add(new OrderCatalogItem { label = "Hacia Cefálico", directionType = DirectionType.Cephalic, isTrap = false });
            activeCol2Options.Add(new OrderCatalogItem { label = "Hacia Caudal", directionType = DirectionType.Caudal, isTrap = false });
            activeCol2Options.Add(new OrderCatalogItem { label = "AP a Lateral", directionType = DirectionType.APToLateral, isTrap = false });
            activeCol2Options.Add(new OrderCatalogItem { label = "Hacia Arriba", directionType = DirectionType.Upward, isTrap = false });
            activeCol2Options.Add(new OrderCatalogItem
            {
                label = "Hacia mí",
                isTrap = true,
                pedagogicalFeedback = "«Hacia mí» es una referencia relativa que depende de la posición física del cirujano. La comunicación quirúrgica en bucle cerrado exige términos anatómicos referidos al paciente: Cefálico, Caudal, AP o Lateral."
            });
            activeCol2Options.Add(new OrderCatalogItem
            {
                label = "Un poco más allá",
                isTrap = true,
                pedagogicalFeedback = "«Un poco más allá» carece de dirección y vector anatómico objetivo. El técnico no sabe hacia dónde dirigir el haz, provocando disparos a ciegas y duplicación de radiación."
            });

            // Col 3: Magnitude (4 real including active case target + 2 traps)
            activeCol3Options.Clear();
            activeCol3Options.Add(new OrderCatalogItem
            {
                label = "Un pelo",
                isTrap = true,
                pedagogicalFeedback = "«Un pelo» no es una unidad de medida quirúrgica ni métrica. En quirófano se exigen centímetros exactos para traslaciones o grados angulares para rotaciones."
            });
            activeCol3Options.Add(new OrderCatalogItem
            {
                label = "Al ojo / Al tope",
                isTrap = true,
                pedagogicalFeedback = "«Al ojo / Al tope» viola la radioprotección (ALARA) y genera riesgo crítico de colisión con la mesa quirúrgica o el paciente. Debes cuantificar la magnitud en cm o grados precisos."
            });

            if (caseIndex == 0)
            {
                activeCol3Options.Add(new OrderCatalogItem { label = "5 cm", magnitudeValue = 5f, isAngle = false, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "10 cm", magnitudeValue = 10f, isAngle = false, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "15°", magnitudeValue = 15f, isAngle = true, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "30°", magnitudeValue = 30f, isAngle = true, isTrap = false });
            }
            else if (caseIndex == 1)
            {
                activeCol3Options.Add(new OrderCatalogItem { label = "5 cm", magnitudeValue = 5f, isAngle = false, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "15°", magnitudeValue = 15f, isAngle = true, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "30°", magnitudeValue = 30f, isAngle = true, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "90°", magnitudeValue = 90f, isAngle = true, isTrap = false });
            }
            else
            {
                activeCol3Options.Add(new OrderCatalogItem { label = "10 cm", magnitudeValue = 10f, isAngle = false, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "15°", magnitudeValue = 15f, isAngle = true, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "30°", magnitudeValue = 30f, isAngle = true, isTrap = false });
                activeCol3Options.Add(new OrderCatalogItem { label = "90°", magnitudeValue = 90f, isAngle = true, isTrap = false });
            }

            // Shuffle each list with Fisher-Yates
            ShuffleList(activeCol1Options);
            ShuffleList(activeCol2Options);
            ShuffleList(activeCol3Options);

            OnCatalogShuffled?.Invoke(activeCol1Options, activeCol2Options, activeCol3Options);
        }

        private static void ShuffleList<T>(IList<T> list)
        {
            int n = list.Count;
            for (int i = n - 1; i > 0; i--)
            {
                int j = UnityEngine.Random.Range(0, i + 1);
                T temp = list[i];
                list[i] = list[j];
                list[j] = temp;
            }
        }

        // ── Slot Configuration ──────────────────────────────────────────────

        public void SelectMovementSlot(int index) => SelectCol1Slot(index);
        public void SelectDirectionSlot(int index) => SelectCol2Slot(index);
        public void SelectMagnitudeSlot(int index) => SelectCol3Slot(index);

        public void SelectCol1Slot(int index)
        {
            slotCol1Index = index;
            DispatchSlotUpdate();
        }

        public void SelectCol2Slot(int index)
        {
            slotCol2Index = index;
            DispatchSlotUpdate();
        }

        public void SelectCol3Slot(int index)
        {
            slotCol3Index = index;
            DispatchSlotUpdate();
        }

        public void ClearSlots()
        {
            slotCol1Index = null;
            slotCol2Index = null;
            slotCol3Index = null;
            DispatchSlotUpdate();
        }

        private void DispatchSlotUpdate()
        {
            bool complete = slotCol1Index.HasValue && slotCol2Index.HasValue && slotCol3Index.HasValue;
            OnSlotsUpdated?.Invoke(new SlotSnapshot
            {
                movementIndex = slotCol1Index,
                directionIndex = slotCol2Index,
                magnitudeIndex = slotCol3Index,
                isComplete = complete
            });
        }

        // ── Verbal Order Evaluation ─────────────────────────────────────────

        public void SubmitBuiltOrder()
        {
            if (CurrentStage != GameStage.OrderBuilding) return;

            if (!slotCol1Index.HasValue || !slotCol2Index.HasValue || !slotCol3Index.HasValue)
            {
                Debug.LogWarning("[IsocenterCommand] All 3 slots (Movement, Direction, Magnitude) must be populated.");
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnIncompleteOrderSubmitted?.Invoke("Dra. Nova: La orden verbal está incompleta. Debes seleccionar una opción en cada una de las 3 columnas: [1. Movimiento] + [2. Dirección] + [3. Magnitud].");
                return;
            }

            int idx1 = Mathf.Clamp(slotCol1Index.Value, 0, activeCol1Options.Count - 1);
            int idx2 = Mathf.Clamp(slotCol2Index.Value, 0, activeCol2Options.Count - 1);
            int idx3 = Mathf.Clamp(slotCol3Index.Value, 0, activeCol3Options.Count - 1);

            var item1 = activeCol1Options[idx1];
            var item2 = activeCol2Options[idx2];
            var item3 = activeCol3Options[idx3];

            // 1. EVALUAR OPCIONES TRAMPA CAMUFLADAS
            var trapNames = new List<string>();
            var trapFeedbacks = new List<string>();

            if (item1.isTrap) { trapNames.Add($"«{item1.label}»"); trapFeedbacks.Add(item1.pedagogicalFeedback); }
            if (item2.isTrap) { trapNames.Add($"«{item2.label}»"); trapFeedbacks.Add(item2.pedagogicalFeedback); }
            if (item3.isTrap) { trapNames.Add($"«{item3.label}»"); trapFeedbacks.Add(item3.pedagogicalFeedback); }

            if (trapNames.Count > 0)
            {
                if (failedAttemptsCount >= 2)
                {
                    failedAttemptsCount++;
                    TriggerTutorRescue(GetTutorRescueText(currentFractureIndex));
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    return;
                }

                failedAttemptsCount++;
                RecordError(Mathf.Abs(PENALTY_AMBIGUOUS_ORDER), "IC_AMBIGUOUS_ORDER",
                    $"Orden verbal ambigua: {string.Join(" + ", trapNames)}.");
                AudioSFXManager.Instance?.PlayWarningScatter();
                DeductStar($"Opción ambigua: {string.Join(" + ", trapNames)}");

                string combinedFeedback = $"Dra. Nova: Orden rechazada por infringir el protocolo de bucle cerrado.\n\n" +
                    $"Término(s) ambiguo(s) detectado(s): {string.Join(", ", trapNames)}.\n\n" +
                    string.Join("\n\n", trapFeedbacks);

                OnAmbiguousOrderTriggered?.Invoke(string.Join(" + ", trapNames), combinedFeedback);
                return;
            }

            // 2. EVALUAR ORDEN TÉCNICA REAL
            var built = new BuiltOrder
            {
                movement = item1,
                direction = item2,
                magnitude = item3
            };

            bool isCorrect = false;
            string feedback = "";

            if (CurrentFracture != null && CurrentFracture.requiredOrders != null && CurrentFracture.requiredOrders.Length > 0)
            {
                var target = CurrentFracture.requiredOrders[0];
                bool matchMov = item1.movementType == target.requiredMovement;
                bool matchDir = item2.directionType == target.requiredDirection;
                bool matchMag = Mathf.Approximately(item3.magnitudeValue, target.requiredMagnitude);

                isCorrect = matchMov && matchDir && matchMag;
                if (isCorrect)
                {
                    feedback = target.rationale;
                }
                else
                {
                    feedback = "Dra. Nova: La combinación de parámetros no corresponde a la necesidad anatómica del caso. Revisa el enunciado clínico y ajusta el movimiento, la dirección o la magnitud.";
                }
            }

            if (isCorrect)
            {
                ResetFailedAttempts();
                int pts = (currentFractureIndex == 0) ? PTS_CORRECT_ORDER_C1 :
                          (currentFractureIndex == 1) ? PTS_CORRECT_ORDER_C2 : PTS_CORRECT_ORDER_C3;
                AddScore(pts);
                AudioSFXManager.Instance?.PlayBeepXRay();
                Debug.Log($"[IsocenterCommand] Order verified: {built} ✓");

                if (built.movement.movementType == MovementType.LongitudinalTranslation)
                {
                    float sign = built.direction.directionType == DirectionType.Caudal ? -1f : 1f;
                    float distMeters = (built.magnitude.magnitudeValue / 100f) * sign;
                    if (translationCoroutine != null) StopCoroutine(translationCoroutine);
                    translationCoroutine = StartCoroutine(TranslateArcRoutine(new Vector3(0f, 0f, distMeters), 1.0f));
                }
                else if (built.movement.movementType == MovementType.Angulation)
                {
                    float sign = built.direction.directionType == DirectionType.Caudal ? -1f : 1f;
                    float angle = built.magnitude.magnitudeValue * sign;
                    if (angulationCoroutine != null) StopCoroutine(angulationCoroutine);
                    angulationCoroutine = StartCoroutine(AngulateArcRoutine(angle, 1.0f));
                }
                else if (built.movement.movementType == MovementType.OrbitalRotation)
                {
                    float targetAngle = built.magnitude.magnitudeValue;
                    if (rotationCoroutine != null) StopCoroutine(rotationCoroutine);
                    rotationCoroutine = StartCoroutine(RotateOrbitalRoutine(targetAngle, 1.0f, autoAdvance: false));
                }

                SnapToIsocenter();
                TransitionToIsocenterStage();
            }
            else
            {
                if (failedAttemptsCount >= 2)
                {
                    failedAttemptsCount++;
                    TriggerTutorRescue(GetTutorRescueText(currentFractureIndex));
                    AudioSFXManager.Instance?.PlayWarningScatter();
                }
                else
                {
                    failedAttemptsCount++;
                    RecordError(Mathf.Abs(PENALTY_FAILED_SHOT), "IC_FAILED_SHOT",
                        "Disparo fallido por una orden verbal inexacta.");
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    DeductStar("Disparo fallido por orden verbal inexacta.");
                    OnOrderEvaluated?.Invoke(built, false, feedback);
                }
            }

            if (isCorrect)
            {
                OnOrderEvaluated?.Invoke(built, true, feedback);
            }
        }

        // ── Stage 2: Isocenter Alignment & 90° Rotation ─────────────────────

        /// <summary>
        /// Mathematically aligns the orbital arc center to the target isocenter position.
        /// Prevents millimeter rounding false-positives during 90° lateral rotation.
        /// </summary>
        public void SnapToIsocenter()
        {
            if (AnatomicalTargetManager.Instance != null && AnatomicalTargetManager.Instance.CurrentTargetTransform != null)
            {
                fractureTarget = AnatomicalTargetManager.Instance.CurrentTargetTransform;
            }
            if (arcTransform != null && fractureTarget != null)
            {
                arcTransform.position = fractureTarget.position;
                arcPosition = arcTransform.localPosition;
            }
            isIsocenterAligned = true;
            isocenterAccuracy = 1.0f;
            OnIsocenterAlignmentChanged?.Invoke(true, 1.0f);
            Debug.Log("[IsocenterCommand] SnapToIsocenter: Arc mathematically centered on target.");
        }

        private void TransitionToIsocenterStage()
        {
            CurrentStage = GameStage.IsocenterAlignment;
            OnStageChanged?.Invoke(CurrentStage);
            CheckIsocenterAlignment();
            Debug.Log("[IsocenterCommand] Stage 2 active: Isocenter Alignment.");
        }

        public void MoveArcManual(Vector3 delta)
        {
            if (CurrentStage != GameStage.IsocenterAlignment) return;

            if (arcTransform != null)
            {
                arcTransform.localPosition += delta;
                arcPosition = arcTransform.localPosition;
            }

            CheckIsocenterAlignment();
        }

        public void CheckIsocenterAlignment()
        {
            if (fractureTarget == null || arcTransform == null) return;

            var (aligned, accuracy, msg) = ClosedLoopOrderEvaluator.EvaluateIsocenterAlignment(
                fractureTarget.position,
                arcTransform.position,
                toleranceRadius: 0.05f // 5 cm (0.05m) max deviation
            );

            isIsocenterAligned = aligned;
            isocenterAccuracy = accuracy;

            if (isIsocenterAligned && !isocenterAlignedRewarded && currentFractureIndex == 0)
            {
                isocenterAlignedRewarded = true;
                AddScore(PTS_ISOCENTER_ALIGNED_C1);
            }

            OnIsocenterAlignmentChanged?.Invoke(isIsocenterAligned, isocenterAccuracy);
        }

        private Coroutine translationCoroutine;

        private System.Collections.IEnumerator TranslateArcRoutine(Vector3 delta, float duration)
        {
            AudioSFXManager.Instance?.PlayMotorMove();

            AnatomicalTargetManager.Instance?.TranslateRigAndCam(delta, duration);

            if (arcTransform != null)
            {
                Vector3 startPos = arcTransform.localPosition;
                Vector3 targetPos = startPos + delta;
                float timer = 0f;

                while (timer < duration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / duration);
                    arcTransform.localPosition = Vector3.Lerp(startPos, targetPos, progress);
                    arcPosition = arcTransform.localPosition;
                    yield return null;
                }
                arcTransform.localPosition = targetPos;
                arcPosition = targetPos;
            }

            SnapToIsocenter();
            translationCoroutine = null;
        }

        private Coroutine angulationCoroutine;

        private System.Collections.IEnumerator AngulateArcRoutine(float targetAngle, float duration)
        {
            AudioSFXManager.Instance?.PlayMotorMove();

            if (arcTransform != null)
            {
                float timer = 0f;
                float startX = arcTransform.localEulerAngles.x;
                if (startX > 180f) startX -= 360f;

                while (timer < duration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / duration);
                    float currentX = Mathf.Lerp(startX, targetAngle, progress);
                    arcTransform.localEulerAngles = new Vector3(currentX, 0f, arcTransform.localEulerAngles.z);
                    yield return null;
                }
                arcTransform.localEulerAngles = new Vector3(targetAngle, 0f, arcTransform.localEulerAngles.z);
            }

            CheckIsocenterAlignment();
            angulationCoroutine = null;
        }

        private Coroutine rotationCoroutine;

        /// <summary>
        /// Executes the appropriate second stage action depending on the current case:
        /// Case 1 (Femur): 90° AP->Lateral orbital rotation.
        /// Case 2 (Joint clearance): Confirm fluoroscopic joint clearance.
        /// Case 3 (Oblique projection): Confirm Judet acetabular oblique view.
        /// </summary>
        public void ExecuteStage2Action()
        {
            if (currentFractureIndex == 0)
            {
                RotateOrbital90Degrees();
            }
            else if (currentFractureIndex == 1)
            {
                ConfirmJointClearance();
            }
            else
            {
                ConfirmObliqueProjection();
            }
        }

        public void ConfirmJointClearance()
        {
            if (CurrentStage != GameStage.IsocenterAlignment)
            {
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnOrbitalRotationEvaluated?.Invoke(false,
                    "Dra. Nova: Primero debes emitir la orden verbal en bucle cerrado [Angulación] + [Hacia Cefálico] + [15°] para despejar la articulación antes de registrar el control final.");
                return;
            }

            AddScore(PTS_JOINT_CLEARANCE_C2);
            AudioSFXManager.Instance?.PlayBeepXRay();
            OnOrbitalRotationEvaluated?.Invoke(true,
                "✓ Despeje articular verificado con éxito: Interlínea visible sin magnificación ni superposición.");
            AdvanceToNextFractureCase();
        }

        public void ConfirmObliqueProjection()
        {
            if (CurrentStage != GameStage.IsocenterAlignment)
            {
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnOrbitalRotationEvaluated?.Invoke(false,
                    "Dra. Nova: Primero debes emitir la orden verbal en bucle cerrado [Rotación Orbital] + [AP a Lateral] + [30°] para posicionar la proyección oblicua.");
                return;
            }

            AddScore(PTS_OBLIQUE_PROJECTION_C3);
            AudioSFXManager.Instance?.PlayBeepXRay();
            OnOrbitalRotationEvaluated?.Invoke(true,
                "✓ Proyección oblicua de Judet verificada: Reborde cotiloideo y columna anterior visualizados con mínima dispersión Compton.");
            AdvanceToNextFractureCase();
        }

        public void RotateOrbital90Degrees()
        {
            if (currentFractureIndex == 1)
            {
                ConfirmJointClearance();
                return;
            }
            else if (currentFractureIndex >= 2)
            {
                ConfirmObliqueProjection();
                return;
            }

            if (CurrentStage != GameStage.IsocenterAlignment)
            {
                AudioSFXManager.Instance?.PlayWarningScatter();
                OnOrbitalRotationEvaluated?.Invoke(false,
                    "Dra. Nova: Primero debes emitir la orden verbal en bucle cerrado [Traslación Long.] + [Hacia Cefálico] + [5 cm] para centrar la fractura antes de rotar a lateral.");
                return;
            }

            // Force mathematical snap to target isocenter before evaluating 90° rotation
            SnapToIsocenter();

            if (isIsocenterAligned)
            {
                ResetFailedAttempts();
                if (rotationCoroutine != null) StopCoroutine(rotationCoroutine);
                rotationCoroutine = StartCoroutine(RotateOrbitalRoutine(90f, 1.2f, autoAdvance: true));
            }
            else
            {
                if (failedAttemptsCount >= 2)
                {
                    failedAttemptsCount++;
                    TriggerTutorRescue(GetTutorRescueText(currentFractureIndex));
                    AudioSFXManager.Instance?.PlayWarningScatter();
                }
                else
                {
                    failedAttemptsCount++;
                    RecordError(Mathf.Abs(PENALTY_BAD_ROTATION), "IC_BAD_ROTATION",
                        "Rotación de 90° fuera del isocentro: el hueso salió de la imagen.");
                    AudioSFXManager.Instance?.PlayWarningScatter();
                    DeductStar("Rotación de 90° fuera del isocentro (el hueso salió de la pantalla).");
                    OnOrbitalRotationEvaluated?.Invoke(false, ISOCENTER_FAILED_FEEDBACK);
                }
            }
        }

        public string GetTutorRescueText(int caseIdx)
        {
            switch (caseIdx)
            {
                case 0:
                    return "RESCATE CLÍNICO — CASO 1: FÉMUR (CENTRADO EN ISOCENTRO)\n\n" +
                           "• Diagnóstico Quirúrgico: El trazo de fractura está desplazado 5 cm hacia craneal/cefálico.\n" +
                           "• Maniobra Requerida: Desplazamiento lineal de la base sin rotar ni angular el arco.\n" +
                           "• Orden en Bucle Cerrado Exacta:\n" +
                           "  1. Movimiento: [Traslación Long.]\n" +
                           "  2. Dirección: [Hacia Cefálico]\n" +
                           "  3. Magnitud: [5 cm]\n\n" +
                           "Selecciona las 3 opciones iluminadas en verde parpadeante y pulsa EMITIR ORDEN.";
                case 1:
                    return "RESCATE CLÍNICO — CASO 2: DESPEJE ARTICULAR (CADERA/HOMBRO)\n\n" +
                           "• Diagnóstico Quirúrgico: Hay superposición ósea entre los rebordes articulares.\n" +
                           "• Maniobra Requerida: Inclinar el arco sobre su eje de soporte longitudinal 15° hacia cefálico.\n" +
                           "• Orden en Bucle Cerrado Exacta:\n" +
                           "  1. Movimiento: [Angulación]\n" +
                           "  2. Dirección: [Hacia Cefálico]\n" +
                           "  3. Magnitud: [15°]\n\n" +
                           "Selecciona las 3 opciones iluminadas en verde parpadeante y pulsa EMITIR ORDEN.";
                case 2:
                default:
                    return "RESCATE CLÍNICO — CASO 3: PROYECCIÓN OBLICUA DE JUDET (PELVIS)\n\n" +
                           "• Diagnóstico Quirúrgico: Se necesita despejar el reborde cotiloideo y la columna anterior del acetábulo.\n" +
                           "• Maniobra Requerida: Deslizar el arco sobre su propio riel circular curvo 30 grados desde la proyección AP hacia el perfil.\n" +
                           "• Orden en Bucle Cerrado Exacta:\n" +
                           "  1. Movimiento: [Rotación Orbital]\n" +
                           "  2. Dirección: [AP a Lateral]\n" +
                           "  3. Magnitud: [30°]\n\n" +
                           "Selecciona las 3 opciones iluminadas en verde parpadeante y pulsa EMITIR ORDEN.";
            }
        }

        private System.Collections.IEnumerator RotateOrbitalRoutine(float targetAngle, float duration, bool autoAdvance)
        {
            AudioSFXManager.Instance?.PlayMotorMove();

            if (arcTransform != null)
            {
                float timer = 0f;
                float startZ = arcTransform.localEulerAngles.z;
                if (startZ > 180f) startZ -= 360f; // Handle wrap around

                while (timer < duration)
                {
                    timer += Time.deltaTime;
                    float progress = Mathf.SmoothStep(0f, 1f, timer / duration);
                    float currentZ = Mathf.Lerp(startZ, targetAngle, progress);
                    float currentX = arcTransform.localEulerAngles.x;
                    arcTransform.localEulerAngles = new Vector3(currentX, 0f, currentZ);
                    yield return null;
                }
                arcTransform.localEulerAngles = new Vector3(arcTransform.localEulerAngles.x, 0f, targetAngle);
            }

            arcOrbitalAngle = targetAngle;
            if (autoAdvance)
            {
                AddScore(PTS_PERFECT_ROTATION_C1);
                AudioSFXManager.Instance?.PlayBeepXRay();
                OnOrbitalRotationEvaluated?.Invoke(true, 
                    "✓ Rotación AP a Lateral perfecta: La fractura permanece centrada en el isocentro fluoroscópico.");
                AdvanceToNextFractureCase();
            }
            rotationCoroutine = null;
        }

        private void DeductStar(string reason)
        {
            precisionStars = Mathf.Max(0, precisionStars - 1);
            OnStarsUpdated?.Invoke(precisionStars);
            Debug.Log($"[IsocenterCommand] Star lost: {reason} | Remaining: {precisionStars}");
        }

        private void AdvanceToNextFractureCase()
        {
            int next = currentFractureIndex + 1;
            if (fractureCases != null && next < fractureCases.Length)
            {
                StartFractureCase(next);
            }
            else
            {
                CompleteMinigame(true);
            }
        }
    }

    [Serializable]
    public class FractureCase
    {
        public string fractureName = "Fractura de Cadera Derecha";
        [TextArea(1, 2)] public string clinicalContext = "Paciente en mesa ortopédica. Requiere proyección AP y Lateral estricta de cuello femoral.";
        public RequiredOrderStep[] requiredOrders;
        public string trapSectionTitle = "FRASES COLOQUIALES (AMBIGUAS - TRAMPA):";
        public bool isTrapWarningExplicit = true;
        public AmbiguousOrder[] caseAmbiguousOrders;
    }

    [Serializable]
    public class RequiredOrderStep
    {
        public MovementType requiredMovement;
        public DirectionType requiredDirection;
        public float requiredMagnitude;
        [TextArea(1, 2)] public string rationale;
    }

    [Serializable]
    public class OrderCatalogItem
    {
        public string label;
        public bool isTrap;
        [TextArea(1, 2)] public string pedagogicalFeedback;
        public MovementType movementType;
        public DirectionType directionType;
        public float magnitudeValue;
        public bool isAngle;

        public override string ToString() => label;
    }

    [Serializable]
    public class MovementOption
    {
        public string label;
        public MovementType movementType;
    }

    [Serializable]
    public class DirectionOption
    {
        public string label;
        public DirectionType directionType;
    }

    [Serializable]
    public class MagnitudeOption
    {
        public string label;
        public float value;
        public bool isAngle;
    }

    [Serializable]
    public class AmbiguousOrder
    {
        [TextArea(1, 2)] public string orderText;
        [TextArea(1, 3)] public string pedagogicalFeedback;
    }

    [Serializable]
    public class BuiltOrder
    {
        public OrderCatalogItem movement;
        public OrderCatalogItem direction;
        public OrderCatalogItem magnitude;

        public override string ToString() => $"{movement?.label} | {direction?.label} | {magnitude?.label}";
    }

    [Serializable]
    public struct SlotSnapshot
    {
        [NonSerialized] public int? movementIndex, directionIndex, magnitudeIndex;
        public bool isComplete;
    }
}
