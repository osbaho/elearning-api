using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using CArmSimulator.Core.Interfaces;
using CArmSimulator.Data;
using CArmSimulator.Scorm;

namespace CArmSimulator.Core
{
    /// <summary>
    /// Central orchestrator managing minigame sequence, persistent session state,
    /// and pedagogical telemetry reporting to the LMS.
    /// Implements persistent singleton pattern (DontDestroyOnLoad).
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Minigame Curricular Configurations")]
        [SerializeField] private MinigameConfig[] minigameConfigs;

        [Header("LMS / Telemetry Service")]
        [Tooltip("Optional custom IScormService. If unassigned, defaults to ScormBridge.Instance.")]
        private IScormService scormService;

        // Session state
        public SessionData CurrentSession { get; private set; }
        public int CurrentMinigameIndex { get; private set; } = -1;

        // Events
        public event Action<int> OnMinigameStarted;
        public event Action<MinigameResult> OnMinigameCompleted;
        public event Action<SessionData> OnSessionCompleted;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
            CurrentSession = new SessionData();
        }

        private void Start()
        {
            // Resolve telemetry service
            scormService ??= ScormBridge.Instance;
            scormService?.ReportInitialize();
        }

        public void SetScormService(IScormService service)
        {
            scormService = service;
        }

        /// <summary>Loads and starts a minigame by index (0-based).</summary>
        public void StartMinigame(int index)
        {
            if (minigameConfigs == null || index < 0 || index >= minigameConfigs.Length)
            {
                Debug.LogError($"[GameManager] Invalid minigame index: {index}");
                return;
            }

            CurrentMinigameIndex = index;
            MinigameConfig config = minigameConfigs[index];
            Debug.Log($"[GameManager] Starting Minigame {index + 1}: {config.displayName}");

            OnMinigameStarted?.Invoke(index);
            if (!string.IsNullOrEmpty(config.sceneName))
            {
                SceneManager.LoadScene(config.sceneName);
            }
        }

        /// <summary>Called by MinigameBase when a minigame concludes.</summary>
        public void RegisterMinigameResult(MinigameResult result)
        {
            result.minigameIndex = CurrentMinigameIndex;
            CurrentSession.AddResult(result);

            Debug.Log($"[GameManager] Minigame {CurrentMinigameIndex + 1} completed. " +
                      $"Score: {result.score}/{result.maxScore} | Passed: {result.passed}");

            scormService ??= ScormBridge.Instance;
            scormService?.ReportInteraction(result);

            OnMinigameCompleted?.Invoke(result);

            int totalExpected = minigameConfigs != null ? minigameConfigs.Length : 0;
            if (totalExpected > 0 && CurrentSession.AllMinigamesCompleted(totalExpected))
            {
                CompleteSession();
            }
        }

        private void CompleteSession()
        {
            CurrentSession.CalculateFinalScore();
            Debug.Log($"[GameManager] Training session completed. Final Score: {CurrentSession.finalScore:F1}% | Passed: {CurrentSession.passed}");

            scormService ??= ScormBridge.Instance;
            scormService?.ReportCompletion(CurrentSession);

            OnSessionCompleted?.Invoke(CurrentSession);
        }

        private void OnApplicationQuit()
        {
            scormService ??= ScormBridge.Instance;
            scormService?.ReportTerminate();
        }
    }
}
