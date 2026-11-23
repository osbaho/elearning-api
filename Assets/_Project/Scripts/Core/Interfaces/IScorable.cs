using System;

namespace CArmSimulator.Core.Interfaces
{
    /// <summary>
    /// Contract for educational activities that compute and report scores.
    /// Follows the Interface Segregation Principle (ISP).
    /// </summary>
    public interface IScorable
    {
        int CurrentScore { get; }
        int MaxScore { get; }
        float NormalizedScore { get; }

        event Action<float> OnScoreChanged; // Normalized value between 0.0 and 1.0
    }
}
