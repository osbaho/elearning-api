using System;
using System.Collections.Generic;
using UnityEngine;

namespace CArmSimulator.Data
{
    /// <summary>
    /// Encapsulates the entire student training session for learning analytics,
    /// persistence, and SCORM/xAPI completion evaluation.
    /// </summary>
    [Serializable]
    public class SessionData
    {
        public string userId = "student_anonymous";
        public string startTimeUtc;
        public List<MinigameResult> results = new List<MinigameResult>();
        public float finalScore;
        public bool passed;
        public const float PASS_THRESHOLD = 70f;

        public SessionData()
        {
            startTimeUtc = DateTime.UtcNow.ToString("o");
        }

        public void AddResult(MinigameResult result)
        {
            results.Add(result);
            CalculateFinalScore();
        }

        public bool AllMinigamesCompleted(int totalMinigames)
        {
            return results.Count >= totalMinigames;
        }

        public void CalculateFinalScore()
        {
            if (results.Count == 0)
            {
                finalScore = 0f;
                passed = false;
                return;
            }

            float totalPercentage = 0f;
            foreach (var r in results)
            {
                totalPercentage += r.ScorePercent;
            }

            finalScore = totalPercentage / results.Count;
            passed = finalScore >= PASS_THRESHOLD;
        }

        /// <summary>Serializes state to JSON for cmi.suspend_data or PlayerPrefs.</summary>
        public string ToJson() => JsonUtility.ToJson(this);

        /// <summary>Restores state from JSON.</summary>
        public static SessionData FromJson(string json) => JsonUtility.FromJson<SessionData>(json);
    }

    /// <summary>
    /// Granular pedagogical result for an individual minigame.
    /// Maps directly to cmi.interactions in LMS SCORM 1.2 / 2004.
    /// </summary>
    [Serializable]
    public class MinigameResult
    {
        public int minigameIndex;
        public string minigameId;
        public string minigameName;
        public int score;
        public int maxScore;
        public float timeTaken; // In seconds
        public bool passed;
        public int errorCount;
        public string feedback;

        public float ScorePercent => maxScore > 0 ? (float)score / maxScore * 100f : 0f;
    }
}
