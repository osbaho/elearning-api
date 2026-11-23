/**
 * ArcoEnC_SCORM.jslib
 * Plugin WebGL de Unity: puente entre C# (ScormBridge.cs) y la página que contiene el build.
 *
 *  - SCORM 2004 4th Edition: si el build corre dentro de un LMS, este inyecta `API_1484_11`
 *    en algún window ancestro.
 *  - Plataforma ArcoC: los resultados de cada fase se envían al iframe padre con postMessage
 *    (contrato { source: "carm-sim", v: 1, type: "phase-result", ... }, ver ScormBridge.cs).
 *
 * Nota Emscripten: el código fuera del objeto de la librería solo se ejecuta al compilar y no
 * existe en el navegador. Los helpers compartidos se declaran como `$CArmBridge` y se añaden como
 * dependencia de todas las funciones con autoAddDeps.
 */

var CArmBridgeLibrary = {

    $CArmBridge: {
        // Busca el objeto SCORM 2004 en el árbol de frames. Un ancestro de otro origen lanza
        // SecurityError al leerlo: se considera "sin LMS".
        findScormApi: function () {
            var win = window;
            for (var attempts = 0; win && attempts < 10; attempts++) {
                try {
                    if (win.API_1484_11) return win.API_1484_11;
                } catch (e) {
                    return null;
                }
                if (win.parent === win) break;
                win = win.parent;
            }
            return null;
        }
    },

    // ── Inicialización ─────────────────────────────────────────────────────────
    SCORM_Initialize: function () {
        try {
            var api = CArmBridge.findScormApi();
            if (api) {
                var result = api.Initialize("");
                console.log("[SCORM] Initialize → " + result);
            } else {
                console.log("[SCORM] Sin LMS SCORM: solo se usa la integración con la plataforma.");
            }
        } catch (e) { console.error("[SCORM] Initialize error:", e); }
    },

    // ── Terminar sesión ────────────────────────────────────────────────────────
    SCORM_Terminate: function () {
        try {
            var api = CArmBridge.findScormApi();
            if (api) {
                var result = api.Terminate("");
                console.log("[SCORM] Terminate → " + result);
            }
        } catch (e) { console.error("[SCORM] Terminate error:", e); }
    },

    // ── Score ──────────────────────────────────────────────────────────────────
    SCORM_SetScore: function (score, min, max) {
        try {
            var api = CArmBridge.findScormApi();
            if (api) {
                api.SetValue("cmi.score.raw", score.toFixed(2));
                api.SetValue("cmi.score.min", min.toFixed(2));
                api.SetValue("cmi.score.max", max.toFixed(2));
                api.SetValue("cmi.score.scaled", (score / max).toFixed(4));
                console.log("[SCORM] Score → " + score.toFixed(1) + "/" + max);
            }
        } catch (e) { console.error("[SCORM] SetScore error:", e); }
    },

    // ── Completion status ──────────────────────────────────────────────────────
    SCORM_SetCompletion: function (statusPtr) {
        try {
            var status = UTF8ToString(statusPtr);
            var api = CArmBridge.findScormApi();
            if (api) {
                api.SetValue("cmi.completion_status", status);
                console.log("[SCORM] Completion → " + status);
            }
        } catch (e) { console.error("[SCORM] SetCompletion error:", e); }
    },

    // ── Success status ─────────────────────────────────────────────────────────
    SCORM_SetSuccess: function (statusPtr) {
        try {
            var status = UTF8ToString(statusPtr);
            var api = CArmBridge.findScormApi();
            if (api) {
                api.SetValue("cmi.success_status", status);
                console.log("[SCORM] Success → " + status);
            }
        } catch (e) { console.error("[SCORM] SetSuccess error:", e); }
    },

    // ── Interacciones individuales (cmi.interactions) ─────────────────────────
    SCORM_ReportInteraction: function (idPtr, typePtr, resultPtr, latency, descPtr) {
        try {
            var id = UTF8ToString(idPtr);
            var type = UTF8ToString(typePtr);
            var result = UTF8ToString(resultPtr);
            var description = UTF8ToString(descPtr);

            var api = CArmBridge.findScormApi();
            if (!api) return;

            var count = parseInt(api.GetValue("cmi.interactions._count") || "0", 10);
            var base = "cmi.interactions." + count + ".";

            api.SetValue(base + "id", id);
            api.SetValue(base + "type", type);
            api.SetValue(base + "result", result);
            api.SetValue(base + "latency", "PT" + latency.toFixed(1) + "S");
            api.SetValue(base + "description", description);

            console.log("[SCORM] Interaction[" + count + "] " + id + " → " + result);
        } catch (e) { console.error("[SCORM] ReportInteraction error:", e); }
    },

    // ── Commit (persistir) ────────────────────────────────────────────────────
    SCORM_Commit: function () {
        try {
            var api = CArmBridge.findScormApi();
            if (api) {
                api.Commit("");
                console.log("[SCORM] Commit OK");
            }
        } catch (e) { console.error("[SCORM] Commit error:", e); }
    },

    // ── Resultado de fase → plataforma ArcoC ───────────────────────────────────
    // jsonPtr: PhaseResultMessage serializado por JsonUtility en ScormBridge.NotifyPhaseResult.
    WebGL_NotifyPhaseResult: function (jsonPtr) {
        try {
            var json = UTF8ToString(jsonPtr);
            var payload = JSON.parse(json);
            console.log("[WebBridge] phase-result:", json);

            // Evento local, útil para depurar el build abierto directamente en el navegador.
            if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
                window.dispatchEvent(new CustomEvent("carm:phase-result", { detail: payload }));
            }

            // targetOrigin = el propio origen: la plataforma sirve el build desde su mismo dominio.
            // Si alguien embebe el build desde otro dominio, el navegador no le entrega el mensaje.
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, window.location.origin);
            }
        } catch (e) {
            console.error("[WebBridge] Error en WebGL_NotifyPhaseResult:", e);
        }
    }
};

autoAddDeps(CArmBridgeLibrary, '$CArmBridge');
mergeInto(LibraryManager.library, CArmBridgeLibrary);
