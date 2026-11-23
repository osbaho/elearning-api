using CArmSimulator.Data;

namespace CArmSimulator.Core.Interfaces
{
    /// <summary>
    /// Contract for LMS communication (SCORM 1.2, SCORM 2004, or xAPI).
    /// Follows the Dependency Inversion Principle (DIP).
    /// </summary>
    public interface IScormService
    {
        void ReportInitialize();
        void ReportTerminate();
        void ReportInteraction(MinigameResult result);
        void ReportCompletion(SessionData session);
        void SetScore(float score, float min, float max);
    }
}
