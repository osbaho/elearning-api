using System;
using UnityEngine;

namespace CArmSimulator.Minigames.ProtocolZero
{
    public enum PpeType
    {
        EquipmentBrakes,    // Bloqueo de frenos del equipo
        LeadApron,          // Mandil plomado
        ThyroidShield,      // Protector tiroideo
        Dosimeter,          // Dosímetro personal
        LeadGlasses         // Gafas plomadas
    }

    /// <summary>
    /// Interactive PPE / Radiation safety verification item in the operating room.
    /// Phase 3 of Protocol Zero: student must verify each prior to exposure authorization.
    /// Decoupled from controller (adheres to DIP).
    /// </summary>
    public class PpeItem : MonoBehaviour
    {
        [Header("PPE Specification")]
        public PpeType ppeType;
        public string displayName = "Lead Apron";
        [TextArea(1, 3)]
        public string educationalNote = "Atenúa más del 90% de la radiación dispersa incidente sobre órganos radiosensibles.";

        [Header("Visual Feedback")]
        [SerializeField] private GameObject inactiveVisual;
        [SerializeField] private GameObject activeVisual;
        [SerializeField] private ParticleSystem activateParticles;

        public bool IsActivated { get; private set; } = false;

        public event Action<PpeType> OnItemActivated;

        private void Awake()
        {
            ResetVisualState();
        }

        public void ResetVisualState()
        {
            IsActivated = false;
            SetVisual(false);
        }

        /// <summary>Invoked by UI click or raycast interaction.</summary>
        public void Activate()
        {
            if (IsActivated) return;

            IsActivated = true;
            SetVisual(true);

            if (activateParticles != null)
            {
                activateParticles.Play();
            }

            OnItemActivated?.Invoke(ppeType);
            Debug.Log($"[PpeItem] Verified safety item: '{displayName}' ({ppeType}) ✓");
        }

        private void SetVisual(bool activated)
        {
            if (inactiveVisual) inactiveVisual.SetActive(!activated);
            if (activeVisual)   activeVisual.SetActive(activated);
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = IsActivated ? Color.green : Color.yellow;
            Gizmos.DrawWireCube(transform.position, Vector3.one * 0.2f);
        }
    }
}
