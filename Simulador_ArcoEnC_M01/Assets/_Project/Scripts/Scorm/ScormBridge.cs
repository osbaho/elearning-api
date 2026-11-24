using System;
using System.Runtime.InteropServices;
using UnityEngine;
using CArmSimulator.Core.Interfaces;
using CArmSimulator.Data;

namespace CArmSimulator.Scorm
{
    /// <summary>
    /// Resultado de una fase tal como se envía a la plataforma ArcoC (postMessage al iframe padre).
    /// Los nombres de campo forman parte del contrato con la API: no renombrar.
    /// </summary>
    [Serializable]
    public class PhaseResultMessage
    {
        public string source = "carm-sim";
        public int v = 1;
        public string type = "phase-result";
        public string attemptId;
        public string stepId;
        public int phase;
        public int score;
        public int maxScore;
        public bool passed;
        public int errorCount;
        public float doseMsv;
        public float timeSeconds;
        /// <summary>Detalle de cada error (código, mensaje y segundo). Opcional para la API.</summary>
        public ErrorEntry[] errors;
    }

    /// <summary>
    /// Mensaje que la plataforma envía al simulador tras registrar un resultado
    /// (type = "phase-ack" o "phase-ack-error").
    /// </summary>
    [Serializable]
    public class HostMessage
    {
        public string source;
        public int v;
        public string type;
        public string attemptId;
        public string tier;
        public int pointsAwarded;
        public int reservePoints;
        public string error;
    }

    /// <summary>
    /// Puente entre Unity WebGL y su contenedor web:
    ///  - SCORM 2004 (API_1484_11) cuando el build corre dentro de un LMS.
    ///  - Plataforma ArcoC: envía resultados de fase y recibe la confirmación de la API.
    /// Se crea automáticamente al arrancar (no hace falta colocarlo en la escena) con el
    /// nombre <see cref="HostObjectName"/>, que la plantilla WebGL usa en SendMessage.
    /// </summary>
    public class ScormBridge : MonoBehaviour, IScormService
    {
        public const string HostObjectName = "ScormBridge";

        public static ScormBridge Instance { get; private set; }

        /// <summary>La plataforma confirmó (o rechazó) el registro de un resultado.</summary>
        public event Action<HostMessage> PhaseAcknowledged;

        // ── WebGL JavaScript interop (active only in actual WebGL build) ──────
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void SCORM_Initialize();
        [DllImport("__Internal")] private static extern void SCORM_Terminate();
        [DllImport("__Internal")] private static extern void SCORM_SetScore(float score, float min, float max);
        [DllImport("__Internal")] private static extern void SCORM_SetCompletion(string status); // "completed" | "incomplete"
        [DllImport("__Internal")] private static extern void SCORM_SetSuccess(string status);    // "passed" | "failed"
        [DllImport("__Internal")] private static extern void SCORM_ReportInteraction(
            string id, string type, string result, float latency, string description);
        [DllImport("__Internal")] private static extern void SCORM_Commit();
        [DllImport("__Internal")] private static extern void WebGL_NotifyPhaseResult(string json);
#else
        // Mock stubs for in-editor playmode testing
        private static void SCORM_Initialize() => Debug.Log("[SCORM] Initialize LMS connection.");
        private static void SCORM_Terminate() => Debug.Log("[SCORM] Terminate LMS connection.");
        private static void SCORM_SetScore(float s, float mn, float mx) => Debug.Log($"[SCORM] SetScore({s}, min:{mn}, max:{mx})");
        private static void SCORM_SetCompletion(string status) => Debug.Log($"[SCORM] Completion status: {status}");
        private static void SCORM_SetSuccess(string status) => Debug.Log($"[SCORM] Success status: {status}");
        private static void SCORM_ReportInteraction(string id, string type, string result, float latency, string description)
            => Debug.Log($"[SCORM] Interaction: id={id} | type={type} | result={result} | latency={latency:F1}s | desc={description}");
        private static void SCORM_Commit() => Debug.Log("[SCORM] Commit data persistence.");
        private static void WebGL_NotifyPhaseResult(string json) => Debug.Log($"[WebBridge] (Editor) phase-result: {json}");
#endif

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStatics()
        {
            Instance = null;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Bootstrap()
        {
            if (Instance != null) return;
            new GameObject(HostObjectName).AddComponent<ScormBridge>();
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            // La plantilla WebGL envía los mensajes de la plataforma a este nombre exacto.
            gameObject.name = HostObjectName;
            DontDestroyOnLoad(gameObject);
        }

        public void ReportInitialize()
        {
            SCORM_Initialize();
        }

        public void ReportTerminate()
        {
            SCORM_Commit();
            SCORM_Terminate();
        }

        public void SetScore(float score, float min, float max)
        {
            SCORM_SetScore(score, min, max);
            SCORM_Commit();
        }

        /// <summary>Reports an individual minigame activity as a SCORM interaction.</summary>
        public void ReportInteraction(MinigameResult result)
        {
            string interactionId = string.IsNullOrEmpty(result.minigameId)
                ? $"minigame_{result.minigameIndex + 1}"
                : result.minigameId;

            string scormResult = result.passed ? "correct" : "incorrect";
            string description = $"{result.minigameName}: {result.score}/{result.maxScore} pts (Errors: {result.errorCount})";

            SCORM_ReportInteraction(
                id: interactionId,
                type: "performance",
                result: scormResult,
                latency: result.timeTaken,
                description: description
            );

            SCORM_Commit();
        }

        /// <summary>Reports the cumulative final score and marks the SCORM module as completed.</summary>
        public void ReportCompletion(SessionData session)
        {
            SCORM_SetScore(session.finalScore, 0f, 100f);
            SCORM_SetCompletion("completed");
            SCORM_SetSuccess(session.passed ? "passed" : "failed");
            SCORM_Commit();

            Debug.Log($"[ScormBridge] Final mastery reported: Score={session.finalScore:F1}%, Success={(session.passed ? "passed" : "failed")}");
        }

        /// <summary>
        /// Envía a la plataforma el resultado de una fase. La plataforma lo registra en la API
        /// (que decide los Puntos de Reserva) y responde con <see cref="OnHostMessage"/>.
        /// </summary>
        public void NotifyPhaseResult(PhaseResultMessage message)
        {
            if (message == null) return;
            string json = JsonUtility.ToJson(message);
            WebGL_NotifyPhaseResult(json);
        }

        /// <summary>
        /// Punto de entrada de los mensajes de la plataforma. Lo invoca la plantilla WebGL con
        /// unityInstance.SendMessage("ScormBridge", "OnHostMessage", json).
        /// </summary>
        public void OnHostMessage(string json)
        {
            HostMessage message;
            try
            {
                message = JsonUtility.FromJson<HostMessage>(json);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[WebBridge] Mensaje de la plataforma inválido: {ex.Message}");
                return;
            }
            if (message == null || message.source != "carm-host" || message.v != 1) return;

            if (message.type == "phase-ack" || message.type == "phase-ack-error")
            {
                Debug.Log($"[WebBridge] {message.type}: attempt={message.attemptId} tier={message.tier} +{message.pointsAwarded} pts");
                PhaseAcknowledged?.Invoke(message);
            }
        }
    }
}
