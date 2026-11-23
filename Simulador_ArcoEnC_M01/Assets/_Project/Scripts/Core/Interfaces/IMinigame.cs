using System;
using CArmSimulator.Data;

namespace CArmSimulator.Core.Interfaces
{
    /// <summary>
    /// Lifecycle contract for any minigame or simulation module.
    /// Follows the Open/Closed Principle (OCP) and Liskov Substitution Principle (LSP).
    /// </summary>
    public interface IMinigame
    {
        string MinigameId { get; }
        bool IsActive { get; }
        bool IsCompleted { get; }

        event Action<MinigameResult> OnMinigameEnded;

        void Initialize(MinigameConfig config);
        void StartMinigame();
        void PauseMinigame();
        void ResumeMinigame();
        void CompleteMinigame(bool passed);
    }
}
