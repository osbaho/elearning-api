using System;
using System.Text.RegularExpressions;
using UnityEngine;

namespace CArmSimulator.Web
{
    /// <summary>
    /// Parámetros con los que la plataforma ArcoC lanza el simulador dentro de su iframe:
    ///   /webgl/index.html?attempt=&lt;uuid&gt;&amp;step=m1_s1&amp;scene=Scene1&amp;phase=1
    /// La API decide escena y fase según su catálogo; Unity solo las obedece y devuelve
    /// cada resultado etiquetado con attempt y step para que la plataforma lo correlacione.
    /// Sin estos parámetros (Editor o build abierto directamente) el simulador funciona en modo local.
    /// </summary>
    public static class WebLaunchContext
    {
        private static readonly Regex AttemptPattern = new Regex("^[0-9a-fA-F-]{36}$");
        private static readonly Regex StepPattern = new Regex("^m[0-9]+_s[0-9]+$");
        private static readonly Regex ScenePattern = new Regex("^[A-Za-z0-9_-]{1,64}$");

        public static string AttemptId { get; private set; }
        public static string StepId { get; private set; }
        public static string SceneName { get; private set; }
        public static int Phase { get; private set; } = -1;

        /// <summary>True cuando el simulador fue abierto por la plataforma con un intento válido.</summary>
        public static bool IsPlatformLaunch => !string.IsNullOrEmpty(AttemptId) && !string.IsNullOrEmpty(StepId);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetState()
        {
            AttemptId = null;
            StepId = null;
            SceneName = null;
            Phase = -1;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void InitializeFromUrl()
        {
            Parse(Application.absoluteURL);
            if (IsPlatformLaunch)
            {
                Debug.Log($"[WebLaunch] attempt={AttemptId} step={StepId} scene={SceneName} phase={Phase}");
            }
        }

        public static void Parse(string url)
        {
            ResetState();
            if (string.IsNullOrEmpty(url)) return;

            int queryStart = url.IndexOf('?');
            if (queryStart < 0) return;
            string query = url.Substring(queryStart + 1);
            int hashStart = query.IndexOf('#');
            if (hashStart >= 0) query = query.Substring(0, hashStart);

            foreach (string pair in query.Split('&'))
            {
                int eq = pair.IndexOf('=');
                if (eq <= 0) continue;
                string key = pair.Substring(0, eq);
                string value;
                try
                {
                    value = Uri.UnescapeDataString(pair.Substring(eq + 1).Replace('+', ' '));
                }
                catch (UriFormatException)
                {
                    continue;
                }

                switch (key)
                {
                    case "attempt":
                        if (AttemptPattern.IsMatch(value)) AttemptId = value;
                        break;
                    case "step":
                        if (StepPattern.IsMatch(value)) StepId = value;
                        break;
                    case "scene":
                        if (ScenePattern.IsMatch(value)) SceneName = value;
                        break;
                    case "phase":
                        if (int.TryParse(value, out int phase) && phase >= 1 && phase <= 99) Phase = phase;
                        break;
                }
            }
        }
    }
}
