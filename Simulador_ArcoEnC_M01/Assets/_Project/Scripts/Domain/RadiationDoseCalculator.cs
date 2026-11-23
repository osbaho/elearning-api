using UnityEngine;

namespace CArmSimulator.Domain
{
    /// <summary>
    /// Pure C# domain model for radiation physics and dosimetry calculations.
    /// Encapsulates ALARA principles, inverse-square law, Compton scatter, and collimation factor.
    /// Decoupled from Unity MonoBehaviours for testability and SRP.
    /// </summary>
    public static class RadiationDoseCalculator
    {
        // ── Normative Physics Constants (Module 1 Standards) ────────────────
        public const float INVERTED_TUBE_PENALTY_FACTOR = 4.0f; // Tube up/detector down multiplies scatter to face/lens by 4x
        public const float STEP_BACK_REDUCTION_FACTOR   = 0.25f; // Inverse square law (1/d^2): 1 step back reduces dose to 1/4 (25%)
        public const float COLLIMATION_MIN_SCATTER      = 0.40f; // Closing lead shutters reduces scatter by 40% to 60%
        public const float COLLIMATION_MAX_SCATTER      = 0.60f;

        /// <summary>
        /// Calculates relative operator scatter dose index based on geometry and protective actions.
        /// </summary>
        public static float CalculateOperatorDose(
            bool isTubeAboveTable,
            bool hasSteppedBack,
            float collimationFactor, // 0.0 (maximum collimation) to 1.0 (fully open)
            float mA,
            float exposureDurationSeconds)
        {
            float baseRate = mA * exposureDurationSeconds;

            // Geometry penalty: Inverting tube above table multiplies operator scatter by 4x
            if (isTubeAboveTable)
            {
                baseRate *= INVERTED_TUBE_PENALTY_FACTOR;
            }

            // Distance protection (Inverse Square Law: 1 step back -> 1/4 dose)
            if (hasSteppedBack)
            {
                baseRate *= STEP_BACK_REDUCTION_FACTOR;
            }

            // Collimation reduces irradiated volume and Compton scatter (40%-60% reduction)
            float effectiveCollimation = Mathf.Clamp(collimationFactor, COLLIMATION_MIN_SCATTER, 1.0f);
            baseRate *= effectiveCollimation;

            return baseRate;
        }

        /// <summary>
        /// Evaluates X-ray image quality and penetration score for a given anatomical thickness.
        /// Returns a normalized score (0.0 to 1.0) and descriptive feedback from Dra. Nova.
        /// </summary>
        public static (float score, ImageQuality quality, string message) EvaluateExposure(
            float targetKvp,
            float targetMA,
            float currentKvp,
            float currentMA)
        {
            float kvpDiff = currentKvp - targetKvp;
            float maDiff  = currentMA - targetMA;

            if (currentKvp < targetKvp - 8f)
            {
                return (0.2f, ImageQuality.Underpenetrated, 
                    "Falta fuerza de penetración: sube el kilovoltaje (kVp) para que los fotones logren atravesar un tejido denso como la pelvis o el fémur.");
            }

            if (currentKvp > targetKvp + 15f)
            {
                return (0.3f, ImageQuality.Overpenetrated, 
                    "Sobrepenetración: Imagen quemada/radiolúcida excesiva. Se pierde contraste de tejidos blandos y se irradia innecesariamente al paciente.");
            }

            if (currentMA < targetMA - 0.8f)
            {
                return (0.5f, ImageQuality.QuantumNoise, 
                    "Ruido cuántico elevado: El haz no tiene suficiente densidad de fotones (mA insuficiente) para formar una imagen nítida.");
            }

            if (currentMA > targetMA + 1.5f)
            {
                return (0.6f, ImageQuality.ExcessiveDose, 
                    "Cuidado: subir el miliamperaje (mA) reduce el ruido visual, pero incrementa directamente la dosis de radiación para el paciente y para todo tu equipo.");
            }

            // Optimal range
            float kvpAccuracy = 1.0f - Mathf.Clamp01(Mathf.Abs(kvpDiff) / 10f);
            float maAccuracy  = 1.0f - Mathf.Clamp01(Mathf.Abs(maDiff) / 2f);
            float finalScore  = (kvpAccuracy * 0.6f) + (maAccuracy * 0.4f);

            return (finalScore, ImageQuality.Optimal, 
                "Parámetros de exposición óptimos: Penetración adecuada y contraste nítido con dosis controlada bajo criterio ALARA.");
        }
    }

    public enum ImageQuality
    {
        Optimal,
        Underpenetrated,
        Overpenetrated,
        QuantumNoise,
        ExcessiveDose
    }
}
