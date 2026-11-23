using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace CArmSimulator.EditorTools
{
    /// <summary>
    /// Genera el build WebGL directamente en la carpeta pública de la plataforma ArcoC
    /// (monorepo elearning-api): ArcoC/client/public/webgl → servido en /webgl/index.html.
    ///
    /// Desde el Editor: menú CArm → Build WebGL para ArcoC.
    /// Por línea de comandos:
    ///   Unity.exe -batchmode -quit -projectPath &lt;Simulador_ArcoEnC_M01&gt; -buildTarget WebGL
    ///             -executeMethod CArmSimulator.EditorTools.ArcoCWebGLBuilder.BuildBatch -logFile build.log
    /// </summary>
    public static class ArcoCWebGLBuilder
    {
        private const string ArcoCPublicRelativePath = "../ArcoC/client/public";
        private const string OutputFolderName = "webgl";

        [MenuItem("CArm/Build WebGL para ArcoC")]
        public static void BuildFromMenu()
        {
            Build(exitWhenDone: false);
        }

        public static void BuildBatch()
        {
            Build(exitWhenDone: true);
        }

        private static void Build(bool exitWhenDone)
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string publicDir = Path.GetFullPath(Path.Combine(projectRoot, ArcoCPublicRelativePath));
            if (!Directory.Exists(publicDir))
            {
                Fail($"No se encontró {publicDir}. Abre el proyecto Unity desde el monorepo elearning-api (carpeta Simulador_ArcoEnC_M01).", exitWhenDone);
                return;
            }
            string outputDir = Path.Combine(publicDir, OutputFolderName);

            string[] scenes = EditorBuildSettings.scenes
                .Where(s => s.enabled && File.Exists(s.path))
                .Select(s => s.path)
                .ToArray();
            if (scenes.Length == 0)
            {
                Fail("No hay escenas habilitadas en Build Settings.", exitWhenDone);
                return;
            }

            // Limpia el build anterior (solo si parece un build WebGL) para no dejar archivos huérfanos
            if (Directory.Exists(outputDir))
            {
                bool looksLikeWebGlBuild = File.Exists(Path.Combine(outputDir, "index.html")) || Directory.Exists(Path.Combine(outputDir, "Build"));
                if (!looksLikeWebGlBuild)
                {
                    Fail($"{outputDir} existe pero no parece un build WebGL; no se borrará.", exitWhenDone);
                    return;
                }
                Directory.Delete(outputDir, true);
            }

            var options = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputDir,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };

            Debug.Log($"[ArcoCWebGLBuilder] Escenas: {string.Join(", ", scenes)} → {outputDir}");
            BuildReport report = BuildPipeline.BuildPlayer(options);
            BuildSummary summary = report.summary;

            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log($"[ArcoCWebGLBuilder] Build OK: {summary.totalSize / (1024f * 1024f):F1} MB en {summary.totalTime.TotalMinutes:F1} min → {outputDir}");
                if (exitWhenDone) EditorApplication.Exit(0);
            }
            else
            {
                Fail($"Build {summary.result} con {summary.totalErrors} error(es). Revisa el log.", exitWhenDone);
            }
        }

        private static void Fail(string message, bool exitWhenDone)
        {
            Debug.LogError($"[ArcoCWebGLBuilder] {message}");
            if (exitWhenDone) EditorApplication.Exit(1);
        }
    }
}
