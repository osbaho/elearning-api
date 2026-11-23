/**
 * ArcoEnC_SCORM.jslib
 * Plugin WebGL de Unity que actúa como puente entre el código C# (SCORMBridge.cs)
 * y el JavaScript del LMS que rodea el iframe.
 *
 * Compatible con SCORM 2004 4th Edition y xAPI (Tin Can).
 * El LMS debe inyectar el objeto `API_1484_11` (SCORM 2004) en el window padre.
 */

mergeInto(LibraryManager.library, {

    // ── Inicialización ─────────────────────────────────────────────────────────
    SCORM_Initialize: function() {
        try {
            var api = _getAPI();
            if (api) {
                var result = api.Initialize("");
                console.log("[SCORM] Initialize → " + result);
            } else {
                console.warn("[SCORM] API no encontrada. ¿Está corriendo dentro de un LMS?");
            }
        } catch(e) { console.error("[SCORM] Initialize error:", e); }
    },

    // ── Terminar sesión ────────────────────────────────────────────────────────
    SCORM_Terminate: function() {
        try {
            var api = _getAPI();
            if (api) {
                var result = api.Terminate("");
                console.log("[SCORM] Terminate → " + result);
            }
        } catch(e) { console.error("[SCORM] Terminate error:", e); }
    },

    // ── Score ──────────────────────────────────────────────────────────────────
    SCORM_SetScore: function(score, min, max) {
        try {
            var api = _getAPI();
            if (api) {
                api.SetValue("cmi.score.raw",   score.toFixed(2));
                api.SetValue("cmi.score.min",   min.toFixed(2));
                api.SetValue("cmi.score.max",   max.toFixed(2));
                api.SetValue("cmi.score.scaled", (score / max).toFixed(4));
                console.log("[SCORM] Score → " + score.toFixed(1) + "/" + max);
            }
        } catch(e) { console.error("[SCORM] SetScore error:", e); }
    },

    // ── Completion status ──────────────────────────────────────────────────────
    SCORM_SetCompletion: function(statusPtr) {
        try {
            var status = UTF8ToString(statusPtr);
            var api = _getAPI();
            if (api) {
                api.SetValue("cmi.completion_status", status);
                console.log("[SCORM] Completion → " + status);
            }
        } catch(e) { console.error("[SCORM] SetCompletion error:", e); }
    },

    // ── Success status ─────────────────────────────────────────────────────────
    SCORM_SetSuccess: function(statusPtr) {
        try {
            var status = UTF8ToString(statusPtr);
            var api = _getAPI();
            if (api) {
                api.SetValue("cmi.success_status", status);
                console.log("[SCORM] Success → " + status);
            }
        } catch(e) { console.error("[SCORM] SetSuccess error:", e); }
    },

    // ── Interacciones individuales (cmi.interactions) ─────────────────────────
    SCORM_ReportInteraction: function(idPtr, typePtr, resultPtr, latency, descPtr) {
        try {
            var id          = UTF8ToString(idPtr);
            var type        = UTF8ToString(typePtr);
            var result      = UTF8ToString(resultPtr);
            var description = UTF8ToString(descPtr);

            var api = _getAPI();
            if (!api) return;

            // Obtener índice actual de interacciones
            var count = parseInt(api.GetValue("cmi.interactions._count") || "0");
            var base  = "cmi.interactions." + count + ".";

            api.SetValue(base + "id",          id);
            api.SetValue(base + "type",        type);
            api.SetValue(base + "result",      result);
            api.SetValue(base + "latency",     "PT" + latency.toFixed(1) + "S");
            api.SetValue(base + "description", description);

            console.log("[SCORM] Interaction[" + count + "] " + id + " → " + result);
        } catch(e) { console.error("[SCORM] ReportInteraction error:", e); }
    },

    // ── Commit (persistir) ────────────────────────────────────────────────────
    SCORM_Commit: function() {
        try {
            var api = _getAPI();
            if (api) {
                api.Commit("");
                console.log("[SCORM] Commit OK");
            }
        } catch(e) { console.error("[SCORM] Commit error:", e); }
    },

    // ── Notificación de Fase Completada a la Web/API ────────────────────────────
    WebGL_NotifyPhaseCompleted: function(phaseIndex, score, doseMsv, timeSeconds) {
        try {
            var payload = {
                type: "CARM_PHASE_COMPLETED",
                module: 1,
                phase: phaseIndex,
                passed: true,
                score: Number(score.toFixed(1)),
                doseMsv: Number(doseMsv.toFixed(2)),
                timeSeconds: Number(timeSeconds.toFixed(1))
            };
            console.log("[WebBridge] WebGL_NotifyPhaseCompleted:", JSON.stringify(payload));

            // 1. Invocación directa a callback en window si existe
            if (typeof window.onCArmPhaseCompleted === "function") {
                window.onCArmPhaseCompleted(payload);
            }

            // 2. CustomEvent emitido en window
            if (typeof window.dispatchEvent === "function") {
                window.dispatchEvent(new CustomEvent("carm:phaseCompleted", { detail: payload }));
            }

            // 3. postMessage al contenedor padre (si está en iframe)
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, "*");
            }
        } catch(e) {
            console.error("[WebBridge] Error en WebGL_NotifyPhaseCompleted:", e);
        }
    }
});

// ── Helper: buscar el objeto SCORM 2004 API en el árbol de frames ─────────────
function _getAPI() {
    var win = window;
    var attempts = 0;
    while (win && attempts < 10) {
        if (win.API_1484_11) return win.API_1484_11;
        if (win.parent === win) break;
        win = win.parent;
        attempts++;
    }
    return null;
}
