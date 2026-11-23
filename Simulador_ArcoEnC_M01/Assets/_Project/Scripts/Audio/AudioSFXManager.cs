using UnityEngine;

namespace CArmSimulator.Audio
{
    /// <summary>
    /// Procedural Surgical & Medical Sound Effects Manager.
    /// Synthesizes clean audio clips in memory using AudioClip.Create and mathematical oscillators,
    /// avoiding external WAV/MP3 dependencies and ensuring 100% reliable execution in WebGL and Editor.
    /// </summary>
    public class AudioSFXManager : MonoBehaviour
    {
        public static AudioSFXManager Instance { get; private set; }

        [Header("Volume Configuration")]
        [Range(0f, 1f)] public float masterVolume = 0.85f;
        [Range(0f, 1f)] public float sfxVolume = 0.9f;

        private AudioSource audioSource;

        // Cached synthesized clips
        private AudioClip clipBeepXRay;
        private AudioClip clipWarningScatter;
        private AudioClip clipMotorMove;
        private AudioClip clipUIClick;

        private const int SAMPLE_RATE = 44100;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            audioSource = GetComponent<AudioSource>();
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }

            audioSource.playOnAwake = false;
            audioSource.spatialBlend = 0f; // 2D clean UI & medical sound
            audioSource.volume = masterVolume * sfxVolume;

            SynthesizeAllClips();
        }

        /// <summary>
        /// Guarantees that an AudioSFXManager exists in the current scene.
        /// </summary>
        public static AudioSFXManager EnsureInstance()
        {
            if (Instance != null) return Instance;

            var existing = FindAnyObjectByType<AudioSFXManager>();
            if (existing != null)
            {
                Instance = existing;
                return Instance;
            }

            var go = new GameObject("AudioSFXManager");
            Instance = go.AddComponent<AudioSFXManager>();
            return Instance;
        }

        private void SynthesizeAllClips()
        {
            clipBeepXRay = GenerateBeepClip(1850f, 0.22f);
            clipWarningScatter = GenerateWarningClip();
            clipMotorMove = GenerateMotorClip(130f, 0.85f);
            clipUIClick = GenerateClickClip(2200f, 0.04f);
        }

        // ════════════════════════════════════════════════════════════════════
        // Public Sound Trigger Methods
        // ════════════════════════════════════════════════════════════════════

        /// <summary>High-pitched medical beep indicating active X-Ray fluoroscopic exposure.</summary>
        public void PlayBeepXRay()
        {
            PlayClip(clipBeepXRay, 0.95f);
        }

        /// <summary>Pulsed acoustic alarm indicating radiation hazard (inverted tube, missing PPE, thermal overload).</summary>
        public void PlayWarningScatter()
        {
            PlayClip(clipWarningScatter, 1.0f);
        }

        /// <summary>Low electric stepper/servo motor hum during C-Arm translation or orbital rotation.</summary>
        public void PlayMotorMove()
        {
            PlayClip(clipMotorMove, 0.75f);
        }

        /// <summary>Crisp tactile metallic switch click on console button press.</summary>
        public void PlayUIClick()
        {
            PlayClip(clipUIClick, 0.65f);
        }

        private void PlayClip(AudioClip clip, float volumeScale)
        {
            if (clip == null) return;
            if (audioSource == null)
            {
                audioSource = GetComponent<AudioSource>();
                if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();
            }

            audioSource.PlayOneShot(clip, volumeScale * masterVolume * sfxVolume);
        }

        // ════════════════════════════════════════════════════════════════════
        // Mathematical Sound Synthesis (Zero Assets / In-Memory AudioClips)
        // ════════════════════════════════════════════════════════════════════

        private AudioClip GenerateBeepClip(float frequency, float duration)
        {
            int totalSamples = Mathf.FloorToInt(SAMPLE_RATE * duration);
            float[] data = new float[totalSamples];

            float attackSamples = SAMPLE_RATE * 0.008f;
            float releaseSamples = SAMPLE_RATE * 0.035f;

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / SAMPLE_RATE;
                float envelope = 1f;

                if (i < attackSamples)
                    envelope = i / attackSamples;
                else if (i > totalSamples - releaseSamples)
                    envelope = (totalSamples - i) / releaseSamples;

                // Pure sine tone with slight 2nd harmonic (warm fluoroscopy chime)
                float wave = Mathf.Sin(2f * Mathf.PI * frequency * t) * 0.85f +
                             Mathf.Sin(2f * Mathf.PI * frequency * 2f * t) * 0.15f;

                data[i] = wave * envelope * 0.75f;
            }

            var clip = AudioClip.Create("SFX_BeepXRay", totalSamples, 1, SAMPLE_RATE, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip GenerateWarningClip()
        {
            float duration = 0.52f;
            int totalSamples = Mathf.FloorToInt(SAMPLE_RATE * duration);
            float[] data = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / SAMPLE_RATE;
                float sample = 0f;

                // Tone 1: 880 Hz for 0.0s - 0.20s
                if (t >= 0f && t < 0.20f)
                {
                    float localT = t;
                    float env = Mathf.Sin(localT / 0.20f * Mathf.PI);
                    sample = Mathf.Sin(2f * Mathf.PI * 880f * localT) * env;
                }
                // Tone 2: 1200 Hz for 0.26s - 0.50s (urgent high alarm)
                else if (t >= 0.26f && t < 0.50f)
                {
                    float localT = t - 0.26f;
                    float env = Mathf.Sin(localT / 0.24f * Mathf.PI);
                    // Add slight triangular grit
                    sample = (Mathf.Sin(2f * Mathf.PI * 1200f * localT) * 0.8f +
                              Mathf.Sin(2f * Mathf.PI * 2400f * localT) * 0.2f) * env;
                }

                data[i] = sample * 0.8f;
            }

            var clip = AudioClip.Create("SFX_WarningScatter", totalSamples, 1, SAMPLE_RATE, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip GenerateMotorClip(float baseFreq, float duration)
        {
            int totalSamples = Mathf.FloorToInt(SAMPLE_RATE * duration);
            float[] data = new float[totalSamples];

            float rampSamples = SAMPLE_RATE * 0.12f;

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / SAMPLE_RATE;
                float env = 1f;

                if (i < rampSamples) env = i / rampSamples;
                else if (i > totalSamples - rampSamples) env = (totalSamples - i) / rampSamples;

                // Subtle motor speed flutter (6 Hz LFO)
                float freq = baseFreq + Mathf.Sin(2f * Mathf.PI * 6f * t) * 4f;

                float wave = Mathf.Sin(2f * Mathf.PI * freq * t) * 0.6f +
                             Mathf.Sin(2f * Mathf.PI * freq * 2f * t) * 0.28f +
                             Mathf.Sin(2f * Mathf.PI * freq * 3f * t) * 0.12f;

                // Subtle mechanical friction noise
                float noise = (Random.value * 2f - 1f) * 0.05f;

                data[i] = (wave + noise) * env * 0.7f;
            }

            var clip = AudioClip.Create("SFX_MotorMove", totalSamples, 1, SAMPLE_RATE, false);
            clip.SetData(data, 0);
            return clip;
        }

        private AudioClip GenerateClickClip(float frequency, float duration)
        {
            int totalSamples = Mathf.FloorToInt(SAMPLE_RATE * duration);
            float[] data = new float[totalSamples];

            for (int i = 0; i < totalSamples; i++)
            {
                float t = (float)i / SAMPLE_RATE;
                // Fast exponential decay
                float env = Mathf.Exp(-t * 110f);

                float wave = Mathf.Sin(2f * Mathf.PI * frequency * t) * 0.8f +
                             (Random.value * 2f - 1f) * 0.2f;

                data[i] = wave * env * 0.9f;
            }

            var clip = AudioClip.Create("SFX_UIClick", totalSamples, 1, SAMPLE_RATE, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
