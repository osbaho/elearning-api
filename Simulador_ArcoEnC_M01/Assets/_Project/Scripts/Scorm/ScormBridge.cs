using System.Runtime.InteropServices;
using UnityEngine;
using CArmSimulator.Core.Interfaces;
using CArmSimulator.Data;

namespace CArmSimulator.Scorm
{
    /// <summary>
    /// SCORM 1.2 / 2004 Bridge connecting Unity WebGL with the host LMS runtime environment.
    /// Implements IScormService and singleton pattern.
    /// </summary>
    public class ScormBridge : MonoBehaviour, IScormService
    {
        public static ScormBridge Instance { get; private set; }

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
        [DllImport("__Internal")] private static extern void WebGL_NotifyPhaseCompleted(int phaseIndex, float score, float doseMsv, float timeSeconds);
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
        private static void WebGL_NotifyPhaseCompleted(int phaseIndex, float score, float doseMsv, float timeSeconds)
            => Debug.Log($"[WebBridge] Phase {phaseIndex} completed notification sent to Web API. Exiting game view... (score={score:F1}, dose={doseMsv:F2}mSv, time={timeSeconds:F1}s)");
#endif

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
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
        /// Notifies the hosting web platform / LMS API that an individual phase was completed.
        /// Sends payload with phase index, score, dose (mSv), and time elapsed.
        /// </summary>
        public void NotifyPhaseCompletedToWeb(int phaseIndex, float score, float doseMsv, float timeSeconds)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            WebGL_NotifyPhaseCompleted(phaseIndex, score, doseMsv, timeSeconds);
#else
            Debug.Log($"[WebBridge] Phase {phaseIndex} completed notification sent to Web API. Exiting game view...");
            WebGL_NotifyPhaseCompleted(phaseIndex, score, doseMsv, timeSeconds);
#endif
        }
    }
}
