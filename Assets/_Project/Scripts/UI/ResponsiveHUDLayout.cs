using UnityEngine;
using UnityEngine.UI;

namespace CArmSimulator.UI
{
    /// <summary>
    /// Responsive HUD Layout Manager for UI_Master_Canvas.
    /// Dynamically optimizes viewport distribution and touch target ergonomics across:
    /// - Desktop / Laptop Widescreen (16:9 / 16:10 Landscape)
    /// - Tablet / Touch Monitors (4:3 / 3:2 Landscape & Portrait)
    /// - Mobile Devices (Portrait and Compact Landscape)
    /// Ensures minimum 64x64px touch target guidelines (WCAG / Mobile Human Interface Guidelines).
    /// </summary>
    [RequireComponent(typeof(Canvas))]
    public class ResponsiveHUDLayout : MonoBehaviour
    {
        [Header("Main Containers")]
        [SerializeField] private RectTransform topBar;
        [SerializeField] private RectTransform panelLeft;
        [SerializeField] private RectTransform panelRight;

        [Header("Minigame Subpanels")]
        [SerializeField] private RectTransform panelMG1;
        [SerializeField] private RectTransform panelMG2;
        [SerializeField] private RectTransform panelMG3;

        [Header("Left Panel Components")]
        [SerializeField] private RectTransform monitorFluoroscopia;
        [SerializeField] private RectTransform cardDraNova;

        [Header("Ergonomics & Touch Minimums")]
        [Tooltip("Minimum touch button height in canvas pixels (WCAG recommended >= 64px).")]
        [SerializeField] private float minTouchTargetHeight = 64f;

        private CanvasScaler canvasScaler;
        private int lastScreenWidth = -1;
        private int lastScreenHeight = -1;
        private bool isCurrentlyPortrait = false;

        private void Awake()
        {
            canvasScaler = GetComponent<CanvasScaler>();
            AutoLocatePanels();
        }

        private void Start()
        {
            EnforceTouchTargetMinimums();
            ApplyResponsiveLayout();
        }

        private void Update()
        {
            if (Screen.width != lastScreenWidth || Screen.height != lastScreenHeight)
            {
                lastScreenWidth = Screen.width;
                lastScreenHeight = Screen.height;
                ApplyResponsiveLayout();
            }
        }

        private void AutoLocatePanels()
        {
            if (!topBar)
            {
                var tb = transform.Find("Top_Bar_Global");
                if (tb) topBar = tb.GetComponent<RectTransform>();
            }

            if (!panelLeft)
            {
                var pl = transform.Find("Panel_Izquierdo");
                if (pl) panelLeft = pl.GetComponent<RectTransform>();
            }

            if (panelLeft)
            {
                if (!monitorFluoroscopia)
                {
                    var mf = panelLeft.Find("Monitor_Fluoroscopia");
                    if (mf) monitorFluoroscopia = mf.GetComponent<RectTransform>();
                }
                if (!cardDraNova)
                {
                    var cd = panelLeft.Find("Tarjeta_HUD_DraNova");
                    if (cd) cardDraNova = cd.GetComponent<RectTransform>();
                }
            }

            if (!panelRight)
            {
                var pr = transform.Find("Contenedor_Derecho");
                if (pr) panelRight = pr.GetComponent<RectTransform>();
            }

            if (panelRight)
            {
                if (!panelMG1)
                {
                    var p1 = panelRight.Find("Panel_MG1_ProtocolZero");
                    if (p1) panelMG1 = p1.GetComponent<RectTransform>();
                }
                if (!panelMG2)
                {
                    var p2 = panelRight.Find("Panel_MG2_BeamMaster");
                    if (p2) panelMG2 = p2.GetComponent<RectTransform>();
                }
                if (!panelMG3)
                {
                    var p3 = panelRight.Find("Panel_MG3_IsocenterCommand");
                    if (p3) panelMG3 = p3.GetComponent<RectTransform>();
                }
            }
        }

        /// <summary>
        /// Recalculates canvas layout anchors based on aspect ratio and viewport width.
        /// </summary>
        public void ApplyResponsiveLayout()
        {
            AutoLocatePanels();

            float aspect = (float)Screen.width / Mathf.Max(1, Screen.height);
            bool isNarrow = aspect < 1.30f || Screen.width < 1000;

            if (canvasScaler != null)
            {
                if (aspect < 1.0f) // Portrait orientation
                {
                    canvasScaler.referenceResolution = new Vector2(1080f, 1920f);
                    canvasScaler.matchWidthOrHeight = 0f; // Scale by width to maintain readability
                }
                else if (aspect < 1.55f) // Square or tablet (iPad, 4:3)
                {
                    canvasScaler.referenceResolution = new Vector2(1920f, 1080f);
                    canvasScaler.matchWidthOrHeight = 0.35f;
                }
                else // Standard widescreen 16:9 / 16:10 PC
                {
                    canvasScaler.referenceResolution = new Vector2(1920f, 1080f);
                    canvasScaler.matchWidthOrHeight = 0.5f;
                }
            }

            if (panelLeft != null && panelRight != null)
            {
                if (topBar != null)
                {
                    topBar.anchorMin = new Vector2(0f, isNarrow ? 0.93f : 0.91f);
                    topBar.anchorMax = new Vector2(1f, 1f);
                    topBar.offsetMin = Vector2.zero;
                    topBar.offsetMax = Vector2.zero;
                }

                if (isNarrow)
                {
                    // 3 Franjas Horizontales (Móvil Portrait):
                    // Arriba (0.68 - 0.92): Panel_Izquierdo (Monitor y Dra. Nova lado a lado)
                    panelLeft.anchorMin = new Vector2(0.02f, 0.68f);
                    panelLeft.anchorMax = new Vector2(0.98f, 0.92f);
                    panelLeft.offsetMin = Vector2.zero;
                    panelLeft.offsetMax = Vector2.zero;

                    if (monitorFluoroscopia != null && cardDraNova != null)
                    {
                        monitorFluoroscopia.anchorMin = new Vector2(0.02f, 0.05f);
                        monitorFluoroscopia.anchorMax = new Vector2(0.38f, 0.95f);
                        monitorFluoroscopia.offsetMin = Vector2.zero;
                        monitorFluoroscopia.offsetMax = Vector2.zero;

                        cardDraNova.anchorMin = new Vector2(0.40f, 0.05f);
                        cardDraNova.anchorMax = new Vector2(0.98f, 0.95f);
                        cardDraNova.offsetMin = Vector2.zero;
                        cardDraNova.offsetMax = Vector2.zero;
                    }

                    // Abajo (0.01 - 0.38): Controles Táctiles
                    panelRight.anchorMin = new Vector2(0.02f, 0.01f);
                    panelRight.anchorMax = new Vector2(0.98f, 0.38f);
                    panelRight.offsetMin = Vector2.zero;
                    panelRight.offsetMax = Vector2.zero;

                    // Espacio 3D central (0.38 - 0.68) queda 100% libre para ver el Arco en C
                }
                else
                {
                    // 3 Columnas Verticales (PC Landscape):
                    // Izquierda (0.01 - 0.27): Monitor Fluoroscópico y Dra. Nova
                    panelLeft.anchorMin = new Vector2(0.01f, 0.02f);
                    panelLeft.anchorMax = new Vector2(0.27f, 0.90f);
                    panelLeft.offsetMin = Vector2.zero;
                    panelLeft.offsetMax = Vector2.zero;

                    if (monitorFluoroscopia != null && cardDraNova != null)
                    {
                        monitorFluoroscopia.anchorMin = new Vector2(0.5f, 0.68f);
                        monitorFluoroscopia.anchorMax = new Vector2(0.5f, 0.68f);
                        monitorFluoroscopia.sizeDelta = new Vector2(340f, 340f);

                        cardDraNova.anchorMin = new Vector2(0.04f, 0.03f);
                        cardDraNova.anchorMax = new Vector2(0.96f, 0.44f);
                        cardDraNova.offsetMin = Vector2.zero;
                        cardDraNova.offsetMax = Vector2.zero;
                    }

                    // Derecha (0.63 - 0.99): Pestañas y Consolas de Control
                    panelRight.anchorMin = new Vector2(0.63f, 0.02f);
                    panelRight.anchorMax = new Vector2(0.99f, 0.90f);
                    panelRight.offsetMin = Vector2.zero;
                    panelRight.offsetMax = Vector2.zero;

                    // Espacio central (0.27 - 0.63) queda 100% libre y despejado para el Quirófano 3D
                }
            }

            isCurrentlyPortrait = isNarrow;
        }

        /// <summary>
        /// Enforces minimum touch target dimensions across all interactive console buttons.
        /// </summary>
        public void EnforceTouchTargetMinimums()
        {
            var buttons = GetComponentsInChildren<Button>(true);
            foreach (var btn in buttons)
            {
                var rt = btn.GetComponent<RectTransform>();
                if (rt == null) continue;

                // Ensure button is touch-friendly
                var le = btn.GetComponent<LayoutElement>();
                if (le == null)
                {
                    le = btn.gameObject.AddComponent<LayoutElement>();
                }

                le.minHeight = Mathf.Max(le.minHeight, minTouchTargetHeight);
                le.minWidth = Mathf.Max(le.minWidth, 64f);

                // Ensure Text inside doesn't clip on small screens while respecting high-contrast scaling
                var txt = btn.GetComponentInChildren<Text>();
                if (txt != null)
                {
                    txt.resizeTextForBestFit = true;
                    if (txt.resizeTextMinSize < 13) txt.resizeTextMinSize = 13;
                    txt.resizeTextMaxSize = Mathf.Max(txt.resizeTextMaxSize, txt.fontSize);
                }
            }

            // Also ensure sliders in Phase 2 have comfortable grab areas
            var sliders = GetComponentsInChildren<Slider>(true);
            foreach (var s in sliders)
            {
                var rt = s.GetComponent<RectTransform>();
                if (rt != null && rt.sizeDelta.y < 36f)
                {
                    rt.sizeDelta = new Vector2(rt.sizeDelta.x, 38f);
                }
            }
        }
    }
}
