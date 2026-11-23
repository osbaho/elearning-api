using System;
using UnityEngine;

namespace CArmSimulator.Domain
{
    /// <summary>
    /// Pure C# domain model for evaluating surgical closed-loop communication orders.
    /// Analyzes 3-slot syntax (Movement + Direction + Magnitude) and flags ambiguous phrasing.
    /// </summary>
    public static class ClosedLoopOrderEvaluator
    {
        public static OrderEvaluationResult EvaluateOrder(
            int movementIndex,
            int directionIndex,
            int magnitudeIndex,
            int targetMovement,
            int targetDirection,
            int targetMagnitude)
        {
            bool movementOk  = movementIndex == targetMovement;
            bool directionOk = directionIndex == targetDirection;
            bool magnitudeOk = magnitudeIndex == targetMagnitude;

            bool isExact = movementOk && directionOk && magnitudeOk;

            string feedback = isExact
                ? "Orden verbal precisa y sin ambigüedades. El técnico radiólogo ejecuta la maniobra en bucle cerrado."
                : BuildMismatchedFeedback(movementOk, directionOk, magnitudeOk);

            return new OrderEvaluationResult
            {
                IsCorrect = isExact,
                IsAmbiguous = false,
                Feedback = feedback,
                ScorePenalty = isExact ? 0 : 10
            };
        }

        public static OrderEvaluationResult EvaluateAmbiguousOrder(string orderText, string pedagogicalRisk = null)
        {
            return new OrderEvaluationResult
            {
                IsCorrect = false,
                IsAmbiguous = true,
                Feedback = "Orden ambigua rechazada. Expresiones como «sube un pelo» o «gíralo hacia mí» solo generan disparos fallidos y pérdida de tiempo quirúrgico. Emite una orden en bucle cerrado con los 3 datos: nombre del movimiento, dirección anatómica y magnitud.",
                ScorePenalty = 15
            };
        }

        public static (bool isAligned, float accuracy, string message) EvaluateIsocenterAlignment(
            Vector3 targetPosition,
            Vector3 currentPosition,
            float toleranceRadius = 0.05f) // 5 cm (0.05m) max deviation with relaxed vertical tolerance
        {
            Vector3 delta = currentPosition - targetPosition;
            float horizontalDist = new Vector2(delta.x, delta.z).magnitude;
            float verticalDist = Mathf.Abs(delta.y);
            // Relaxed vertical tolerance along table normal
            float effectiveDistance = Mathf.Sqrt(horizontalDist * horizontalDist + (verticalDist * 0.4f) * (verticalDist * 0.4f));

            bool isAligned = effectiveDistance <= toleranceRadius || Vector3.Distance(targetPosition, currentPosition) <= toleranceRadius;
            float accuracy = Mathf.Clamp01(1.0f - (effectiveDistance / (toleranceRadius * 2f)));

            string message = isAligned
                ? "Estructura ósea perfectamente centrada en el isocentro. La rotación orbital conservará la fractura en pantalla."
                : "El hueso fracturado se salió de la pantalla al girar a proyección lateral porque no estaba en el isocentro. Alinea la fractura en el eje central tanto en AP como en lateral antes de rotar el brazo en C.";

            return (isAligned, accuracy, message);
        }

        private static string BuildMismatchedFeedback(bool movementOk, bool directionOk, bool magnitudeOk)
        {
            if (!movementOk) return "Tipo de movimiento incorrecto para la proyección solicitada por el cirujano.";
            if (!directionOk) return "Dirección errónea: provocará que el equipo se aleje del campo quirúrgico.";
            if (!magnitudeOk) return "Magnitud incorrecta: el desplazamiento es insuficiente o excesivo.";
            return "Orden imperfecta.";
        }
    }

    [Serializable]
    public struct OrderEvaluationResult
    {
        public bool IsCorrect;
        public bool IsAmbiguous;
        public string Feedback;
        public int ScorePenalty;
    }
}
