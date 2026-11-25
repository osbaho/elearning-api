using UnityEngine;
using UnityEngine.SceneManagement;

namespace CArmSimulator.Web
{
    /// <summary>
    /// Carga la escena del módulo que pide la plataforma (parámetro scene= de la URL).
    /// Con un único build para todos los módulos, cada módulo del curso es una escena
    /// con nombre estándar ModuloNN (Modulo01 = módulo 1, Modulo02 = módulo 2…), el mismo que usa el
    /// catálogo de la API.
    /// Si la escena pedida ya es la activa, no hace nada.
    /// </summary>
    public static class WebSceneRouter
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void RouteToRequestedScene()
        {
            string target = WebLaunchContext.SceneName;
            if (string.IsNullOrEmpty(target)) return;

            if (SceneManager.GetActiveScene().name == target) return;

            if (!Application.CanStreamedLevelBeLoaded(target))
            {
                Debug.LogError($"[WebSceneRouter] La escena '{target}' no está en Build Settings. Se mantiene la escena inicial.");
                return;
            }

            Debug.Log($"[WebSceneRouter] Cargando escena '{target}' solicitada por la plataforma.");
            SceneManager.LoadScene(target);
        }
    }
}
