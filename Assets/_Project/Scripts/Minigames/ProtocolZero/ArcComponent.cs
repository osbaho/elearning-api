using System;
using UnityEngine;

namespace CArmSimulator.Minigames.ProtocolZero
{
    public enum ArcNodeType
    {
        XRayTube,              // Tubo Emisor de Rayos X
        ImageIntensifier,      // Intensificador / Detector Plano
        OrbitalCArm,           // Brazo Orbital en C
        ControlConsole,        // Consola de Control
        ControlPanel = ControlConsole, // Panel / Consola de Control
        ExposurePedal,         // Pedal de Disparo
        BrakeSystem            // Sistema de Frenos y Chasis Móvil
    }

    /// <summary>Alias for ArcNodeLabel to match domain nomenclature.</summary>
    public class ArcComponent : ArcNodeLabel { }

    /// <summary>
    /// Interactive 3D component node in the operating room.
    /// Emits events when the user attempts identification.
    /// Decoupled from the controller (adheres to DIP).
    /// </summary>
    public class ArcNodeLabel : MonoBehaviour
    {
        [Header("Component Identity")]
        public ArcNodeType nodeType;
        [TextArea(1, 2)]
        public string displayName = "X-Ray Emission Tube";
        [TextArea(1, 3)]
        public string educationalNote = "Genera el haz de radiación primaria mediante el frenado de electrones contra el ánodo.";

        [Header("Visual Feedback Indicators")]
        [SerializeField] private GameObject unlabeledIndicator;
        [SerializeField] private GameObject labeledIndicator;
        [SerializeField] private GameObject errorIndicator;

        public bool IsLabeled { get; private set; } = false;

        // Decoupled event: (nodeType, wasCorrect)
        public event Action<ArcNodeType, bool> OnLabelAttempt;

        private enum LabelVisualState { Unlabeled, Labeled, Error }

        private void Awake()
        {
            ResetLabel();
        }

        public void ResetLabel()
        {
            IsLabeled = false;
            SetIndicator(LabelVisualState.Unlabeled);
        }

        /// <summary>Submits an identification attempt from UI or raycast interaction.</summary>
        public bool SubmitLabel(ArcNodeType selectedType)
        {
            bool isCorrect = (selectedType == nodeType);
            IsLabeled = isCorrect;

            SetIndicator(isCorrect ? LabelVisualState.Labeled : LabelVisualState.Error);
            OnLabelAttempt?.Invoke(nodeType, isCorrect);

            Debug.Log($"[ArcNodeLabel] '{displayName}' labeled as '{selectedType}' -> {(isCorrect ? "CORRECT ✓" : "INCORRECT ✗")}");
            return isCorrect;
        }

        private void SetIndicator(LabelVisualState state)
        {
            if (unlabeledIndicator) unlabeledIndicator.SetActive(state == LabelVisualState.Unlabeled);
            if (labeledIndicator)   labeledIndicator.SetActive(state == LabelVisualState.Labeled);
            if (errorIndicator)     errorIndicator.SetActive(state == LabelVisualState.Error);
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(transform.position, 0.15f);
        }
    }
}
