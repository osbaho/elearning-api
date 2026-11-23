using UnityEngine;

namespace CArmSimulator.Data
{
    /// <summary>
    /// ScriptableObject defining metadata, evaluation thresholds, and instructional feedback for minigames.
    /// Create instances in: Assets/_Project/ScriptableObjects/
    /// </summary>
    [CreateAssetMenu(fileName = "MinigameConfig", menuName = "CArm/Minigame Config", order = 1)]
    public class MinigameConfig : ScriptableObject
    {
        [Header("Identification")]
        [Tooltip("Unique technical identifier matching LMS cmi.interactions ID.")]
        public string minigameId = "MG1_ProtocolZero";
        
        [Tooltip("Human-readable title displayed on HUD.")]
        public string displayName = "Protocol Zero: C-Arm Architecture";
        
        [TextArea(2, 4)]
        public string description;

        [Header("Scene Loading")]
        [Tooltip("Exact scene name configured in Build Profiles.")]
        public string sceneName;

        [Header("Evaluation & Mastery")]
        public int maxScore = 100;
        
        [Range(0f, 100f)]
        public float passScorePercent = 70f;
        
        [Tooltip("Time limit in seconds.")]
        public float timeLimit = 300f;

        [Header("Formative Feedback")]
        [TextArea(2, 4)] public string feedbackPass = "¡Excelente! Has demostrado dominio de los protocolos de seguridad y operación.";
        [TextArea(2, 4)] public string feedbackFail = "No se alcanzó el umbral mínimo de seguridad. Revisa los fundamentos y vuelve a intentarlo.";
    }
}
