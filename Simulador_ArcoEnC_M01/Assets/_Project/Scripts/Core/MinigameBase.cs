using System;
using System.Collections.Generic;
using UnityEngine;
using CArmSimulator.Core.Interfaces;
using CArmSimulator.Data;

namespace CArmSimulator.Core
{
    /// <summary>
    /// Abstract base class for all C-Arm simulation minigames.
    /// Fulfills IMinigame, IScorable, and ITimedActivity.
    /// Adheres to SOLID principles: OCP, LSP, and ISP.
    /// </summary>
    public abstract class MinigameBase : MonoBehaviour, IMinigame, IScorable, ITimedActivity
    {
        [Header("Configuration & Settings")]
        [SerializeField] protected MinigameConfig config;
        [SerializeField] protected float defaultTimeLimit = 300f; // 5 minutes default

        [SerializeField] protected bool autoStartOnAwake = false;

        protected bool isInitialized = false;

        // State fields
        protected float elapsedTime = 0f;
        protected float timeLimit = 300f;
        protected int currentScore = 0;
        protected int errorCount = 0;
        // Detalle de cada error (qué y cuándo) para la plataforma; acotado como en la API
        protected const int MaxErrorLogEntries = 50;
        protected readonly List<ErrorEntry> errorLog = new List<ErrorEntry>();
        protected int failedAttemptsCount = 0;
        protected bool isTimerFrozenByTutor = false;
        protected bool isActive = false;
        protected bool isCompleted = false;
        protected bool isPaused = true;
        private int lastReportedSecond = -1;

        // IMinigame Properties
        public string MinigameId => config != null ? config.minigameId : GetType().Name;
        public bool IsActive => isActive && !isPaused;
        public bool IsCompleted => isCompleted;
        /// <summary>True when the minigame completed with a passing result (used by UI to auto-advance tabs).</summary>
        public bool Passed { get; private set; } = false;
        public int FailedAttemptsCount => failedAttemptsCount;
        public bool IsTutorRescueActive { get; protected set; } = false;
        public bool IsTimerFrozenByTutor => isTimerFrozenByTutor;

        // IScorable Properties
        public int CurrentScore => currentScore;
        public int ErrorCount => errorCount;
        /// <summary>Copia del detalle de errores de la partida en curso.</summary>
        public ErrorEntry[] GetErrorLog() => errorLog.ToArray();
        public int MaxScore => config != null ? config.maxScore : 100;
        public float NormalizedScore => MaxScore > 0 ? (float)currentScore / MaxScore : 0f;

        // ITimedActivity Properties
        public float TimeLimit => timeLimit;
        public float ElapsedTime => elapsedTime;
        public float RemainingTime => Mathf.Max(0f, timeLimit - elapsedTime);

        // Events
        public event Action<MinigameResult> OnMinigameEnded;
        public event Action<float> OnScoreChanged;
        public event Action<float> OnTimeUpdated;
        public event Action<bool> OnPauseStateChanged;
        public event Action<string, string> OnTutorRescueTriggered; // (title, clinicalExplanation)

        protected virtual void Start()
        {
            if (autoStartOnAwake)
            {
                if (config != null)
                {
                    Initialize(config);
                }
                else
                {
                    InitializeMinigame();
                    isInitialized = true;
                }

                StartMinigame();
            }
            else
            {
                isActive = false;
                isPaused = true;
            }
        }

        protected virtual void Update()
        {
            if (!isActive || isCompleted || isPaused || isTimerFrozenByTutor) return;

            elapsedTime += Time.deltaTime;
            float remaining = RemainingTime;
            int currentSecond = Mathf.CeilToInt(remaining);
            if (currentSecond != lastReportedSecond)
            {
                lastReportedSecond = currentSecond;
                OnTimeUpdated?.Invoke(remaining);
            }

            if (remaining <= 0f)
            {
                OnTimeExpired();
            }
        }

        public virtual void Initialize(MinigameConfig minigameConfig)
        {
            config = minigameConfig;
            timeLimit = config != null ? config.timeLimit : defaultTimeLimit;
            elapsedTime = 0f;
            currentScore = 0;
            errorCount = 0;
            errorLog.Clear();
            isCompleted = false;
            Passed = false;
            isPaused = false;
            isTimerFrozenByTutor = false;
            lastReportedSecond = -1;
            isInitialized = true;

            InitializeMinigame();
        }

        /// <summary>Concrete minigame setup hook. Override in subclasses.</summary>
        protected abstract void InitializeMinigame();

        public virtual void StartMinigame()
        {
            if (!isInitialized)
            {
                if (config != null)
                {
                    Initialize(config);
                }
                else
                {
                    InitializeMinigame();
                    isInitialized = true;
                }
            }

            isActive = true;
            isCompleted = false;
            isPaused = false;
            isTimerFrozenByTutor = false;
            elapsedTime = 0f;
            currentScore = 0;
            errorCount = 0;
            errorLog.Clear();
            lastReportedSecond = -1;

            OnScoreChanged?.Invoke(NormalizedScore);
            Debug.Log($"[{GetType().Name}] Minigame started: {MinigameId}");
        }

        public virtual void PauseMinigame()
        {
            if (!isActive || isCompleted) return;
            isPaused = true;
            OnPauseStateChanged?.Invoke(true);
        }

        public virtual void ResumeMinigame()
        {
            if (!isActive || isCompleted) return;
            isPaused = false;
            OnPauseStateChanged?.Invoke(false);
        }

        public virtual void StopMinigame()
        {
            isActive = false;
            isPaused = true;
        }

        public virtual void CompleteMinigame(bool passed)
        {
            if (isCompleted) return;

            isCompleted = true;
            isActive = false;
            Passed = passed; // Expuesto como propiedad pública para que la UI avance de pestaña

            string finalFeedback = passed
                ? (config != null ? config.feedbackPass : "Minigame passed successfully.")
                : (config != null ? config.feedbackFail : "Minimum mastery threshold not met.");

            var result = new MinigameResult
            {
                minigameIndex = GameManager.Instance != null ? GameManager.Instance.CurrentMinigameIndex : 0,
                minigameId = MinigameId,
                minigameName = config != null ? config.displayName : GetType().Name,
                score = currentScore,
                maxScore = MaxScore,
                timeTaken = elapsedTime,
                passed = passed,
                errorCount = errorCount,
                errors = errorLog.ToArray(),
                feedback = finalFeedback
            };

            OnMinigameEnded?.Invoke(result);
            GameManager.Instance?.RegisterMinigameResult(result);

            Debug.Log($"[{GetType().Name}] Completed | Passed: {passed} | Score: {currentScore}/{MaxScore}");
        }

        protected virtual void OnTimeExpired()
        {
            Debug.Log($"[{GetType().Name}] Time expired.");
            CompleteMinigame(false);
        }

        /// <summary>Adds or deducts points and dispatches normalized score event.</summary>
        protected void AddScore(int points)
        {
            currentScore = Mathf.Clamp(currentScore + points, 0, MaxScore);
            OnScoreChanged?.Invoke(NormalizedScore);
            Debug.Log($"[{GetType().Name}] Score updated: {currentScore}/{MaxScore} ({points:+0;-0;0} pts)");
        }

        /// <summary>
        /// Records an instructional error/penalty. <paramref name="code"/> y <paramref name="message"/>
        /// describen el error para la plataforma (qué hizo mal); se guarda el segundo de la partida.
        /// </summary>
        protected void RecordError(int pointsPenalty = 0, string code = null, string message = null)
        {
            errorCount++;
            if (errorLog.Count < MaxErrorLogEntries)
            {
                errorLog.Add(new ErrorEntry
                {
                    code = string.IsNullOrEmpty(code) ? "ERROR" : code,
                    message = message ?? string.Empty,
                    atSeconds = elapsedTime
                });
            }
            if (pointsPenalty != 0)
            {
                AddScore(-Mathf.Abs(pointsPenalty));
            }
        }

        /// <summary>Resets consecutive failed attempts counter (e.g. after successful action or case transition).</summary>
        public virtual void ResetFailedAttempts()
        {
            failedAttemptsCount = 0;
            IsTutorRescueActive = false;
            isTimerFrozenByTutor = false;
        }

        /// <summary>Unfreezes surgical timer after tutor mandatory reading countdown finishes.</summary>
        public virtual void UnfreezeTimerAfterTutor()
        {
            isTimerFrozenByTutor = false;
        }

        /// <summary>Dispatches pedagogical rescue event when failedAttemptsCount reaches 3 and freezes timer.</summary>
        public virtual void TriggerTutorRescue(string clinicalExplanation)
        {
            IsTutorRescueActive = true;
            isTimerFrozenByTutor = true;
            OnTutorRescueTriggered?.Invoke("ASISTENCIA DEL TUTOR — LECTURA OBLIGATORIA (15s)", clinicalExplanation);
        }
    }
}
