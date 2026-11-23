using System;

namespace CArmSimulator.Core.Interfaces
{
    /// <summary>
    /// Contract for activities bound by time limits or latency metrics.
    /// Follows the Interface Segregation Principle (ISP).
    /// </summary>
    public interface ITimedActivity
    {
        float TimeLimit { get; }
        float ElapsedTime { get; }
        float RemainingTime { get; }

        event Action<float> OnTimeUpdated; // Remaining seconds
    }
}
