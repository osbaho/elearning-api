using UnityEngine;

namespace CArmSimulator.Domain
{
    /// <summary>
    /// Pure C# domain model for the rotating tungsten anode thermal capacity.
    /// Simulates heat accumulation during continuous fluoroscopy and passive dissipation.
    /// </summary>
    public class ThermalAnodeModel
    {
        // ── Physics Constants (Tungsten Anode Deceleration) ─────────────────
        public const float HEAT_CONVERSION_RATIO = 0.99f; // 99% of electron kinetic energy transforms into heat
        public const float XRAY_PHOTON_RATIO    = 0.01f; // Only 1% produces diagnostic X-ray photons
        public const float WARNING_THRESHOLD_RATIO = 0.80f; // Dra. Nova alert triggered when HU exceeds 80%

        public float MaxTemperature { get; }
        public float OverheatLockoutThreshold { get; }
        public float HeatRatePerSecond { get; }
        public float CoolRatePerSecond { get; }

        public float CurrentTemperature { get; private set; }
        public bool IsOverheated { get; private set; }

        public float NormalizedTemperature => Mathf.Clamp01(CurrentTemperature / MaxTemperature);
        public bool IsInWarningZone => NormalizedTemperature >= WARNING_THRESHOLD_RATIO;

        public ThermalAnodeModel(
            float maxTemp = 100f,
            float overheatThreshold = 90f,
            float heatPerSecond = 8f,
            float coolPerSecond = 3f)
        {
            MaxTemperature = maxTemp;
            OverheatLockoutThreshold = overheatThreshold;
            HeatRatePerSecond = heatPerSecond;
            CoolRatePerSecond = coolPerSecond;
            CurrentTemperature = 0f;
            IsOverheated = false;
        }

        public void UpdateThermalState(bool isFluoroActive, float deltaTime)
        {
            if (isFluoroActive)
            {
                CurrentTemperature += HeatRatePerSecond * deltaTime;
                if (CurrentTemperature >= OverheatLockoutThreshold)
                {
                    CurrentTemperature = Mathf.Min(CurrentTemperature, MaxTemperature);
                    IsOverheated = true;
                }
            }
            else
            {
                CurrentTemperature = Mathf.Max(0f, CurrentTemperature - (CoolRatePerSecond * deltaTime));
                if (IsOverheated && CurrentTemperature <= OverheatLockoutThreshold * 0.7f)
                {
                    IsOverheated = false; // Reset lock once cooled down below safe margin
                }
            }
        }

        public void Reset()
        {
            CurrentTemperature = 0f;
            IsOverheated = false;
        }
    }
}
