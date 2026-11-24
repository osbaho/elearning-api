'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loadFaceApi } from '../../lib/faceApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, checkSession, loading } = useAuth();
  const { addToast } = useToast();
  const videoRef = useRef(null);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    id_type: 'CC',
    id_number: '',
    institution: ''
  });
  const [habeasData, setHabeasData] = useState(false);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // MOCK MODE: Seguro por defecto (en producción NUNCA se activa; en desarrollo solo si es explícitamente 'true')
  const DEV_MOCK_CAMERA = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_MOCK_CAMERA === 'true';

  useEffect(() => {
    // Si no está autenticado, redirigir al login
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    // Si ya está onboarded, redirigir al curso
    if (user?.isOnboarded) {
      router.replace('/course');
      return;
    }
    // Cleanup de la cámara al desmontar
    const currentVideo = videoRef.current;
    return () => {
      if (currentVideo && currentVideo.srcObject) {
        currentVideo.srcObject.getTracks().forEach(t => t.stop());
        currentVideo.srcObject = null;
      }
    };
  }, [loading, user, router]);

  useEffect(() => {
    // A-04: Only load face-api models when actually needed (not in mock mode, not already onboarded)
    if (DEV_MOCK_CAMERA || user?.isOnboarded) return;
    const loadModels = async () => {
      try {
        const faceapi = await loadFaceApi();
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Error loading face-api models', err);
      }
    };
    loadModels();
  }, [DEV_MOCK_CAMERA, user?.isOnboarded]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!formData.id_number || !formData.institution) {
      addToast('Por favor, completa todos los campos requeridos', 'error');
      return;
    }
    if (!habeasData) {
      addToast('Debes aceptar la política de tratamiento de datos para continuar', 'error');
      return;
    }
    setStep(2);
  };

  const startCamera = async () => {
    if (DEV_MOCK_CAMERA) {
      const mockDescriptor = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
      setFaceDescriptor(mockDescriptor);
      addToast('Rostro registrado exitosamente (Modo Desarrollo)', 'success');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraError(false);
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Error de cámara:', err);
      setCameraError(true);
      setIsCameraActive(false);
      addToast('No pudimos acceder a tu cámara. Es requerida.', 'error');
    }
  };

  const scanFace = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setIsScanning(true);
    
    try {
      const faceapi = await loadFaceApi();
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                                     .withFaceLandmarks()
                                     .withFaceDescriptor();
      
      if (detection) {
        const descriptorArray = Array.from(detection.descriptor);
        setFaceDescriptor(descriptorArray);
        
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
          setIsCameraActive(false);
        }
        addToast('Rostro registrado exitosamente.', 'success');
      } else {
        addToast('No se detectó un rostro claro. Mira directamente a la cámara con buena iluminación.', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Ocurrió un error al escanear.', 'error');
    } finally {
      setIsScanning(false);
    }
  }, [modelsLoaded, addToast]);

  const handleSubmit = async () => {
    if (!faceDescriptor) {
      addToast('Debes registrar tu rostro para continuar', 'error');
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          face_descriptor: faceDescriptor
        })
      });

      if (res.ok) {
        addToast('¡Registro completado! Bienvenido al Quirófano.', 'success');
        await checkSession();
        router.push('/course');
      } else {
        addToast('Error al guardar tus datos', 'error');
      }
    } catch (err) {
      addToast('Error de conexión', 'error');
    }
  };

  if (loading || !user) return null;

  return (
    <main className="login-main min-h-80vh">
      <div className="login-card max-w-600 w-full onboarding-card">
        
        {/* Paso 1: Datos */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="animate-fade-in">
            <div className="text-center mb-24">
              <h1 className="title-lg mb-8 text-cyan">Comencemos, {user.name.split(' ')[0]}</h1>
              <p className="text-secondary text-lg">
                Para personalizar tu experiencia y garantizar la validez de tu certificación, necesitamos algunos datos.
              </p>
            </div>

            <div className="bg-dark-light border-cyan-transparent radius-lg p-24 mb-24 relative overflow-hidden onboarding-card-glow">
              <div className="absolute top-0 left-0 w-full onboarding-line-glow"></div>
              <h3 className="text-cyan mb-16 flex items-center gap-8"><span className="text-xl">🪪</span> Datos de Identificación</h3>
              
              <div className="grid-cols-2 gap-16 mb-16">
                <div>
                  <label className="d-block mb-8 font-bold text-light text-sm">Tipo de Identificación</label>
                  <select name="id_type" className="form-input" value={formData.id_type} onChange={handleChange}>
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula de Extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="d-block mb-8 font-bold text-light text-sm">Número de Identificación</label>
                  <input 
                    type="text" 
                    name="id_number" 
                    className="form-input" 
                    placeholder="Ej. 10203040"
                    value={formData.id_number}
                    onChange={handleChange}
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="d-block mb-8 font-bold text-light text-sm flex items-center gap-8"><span className="text-lg">🏥</span> Institución / Hospital</label>
                <input 
                  type="text" 
                  name="institution" 
                  className="form-input" 
                  placeholder="Lugar donde laboras o estudias"
                  value={formData.institution}
                  onChange={handleChange}
                  required 
                />
              </div>
            </div>

            <div className="mb-24 p-16 bg-dark-light border-cyan-transparent radius-lg">
              <div className="text-sm text-secondary lh-15 mb-12">
                <strong className="text-light d-block mb-4">Tratamiento de Datos Personales (Ley 1581 de 2012)</strong>
                Autorizo de manera voluntaria, previa y explícita el tratamiento de mis datos personales y biométricos. 
                Entiendo que mi perfil facial será convertido en un vector matemático anónimo e irreversible, utilizado única y 
                exclusivamente para validar mi identidad mediante inteligencia artificial durante las evaluaciones del curso, garantizando 
                la transparencia y validez de la certificación en Colombia.
              </div>
              <label className="flex items-center justify-center w-full gap-12 cursor-pointer pt-12 border-t border-cyan-transparent">
                <input 
                  type="checkbox" 
                  checked={habeasData}
                  onChange={(e) => setHabeasData(e.target.checked)}
                  className="habeas-checkbox"
                />
                <span className="text-light font-bold">Acepto</span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary w-full text-lg py-12" disabled={!habeasData}>
              Continuar a Registro Biométrico ▶
            </button>
          </form>
        )}

        {/* Paso 2: Biometría */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-24">
              <h1 className="title-lg mb-8 text-cyan">Proctoring Biométrico</h1>
              <p className="text-secondary text-lg">
                La Dra. Nova (IA) necesita conocerte para supervisar tus exámenes.
              </p>
            </div>

            <div className="grid-onboarding-step2 gap-24 mb-24 items-center">
              
              <div className="instructions bg-dark-light p-20 radius-lg border-cyan-transparent">
                <h3 className="text-light mb-12 flex items-center gap-8">
                  <span className="text-cyan">📷</span> Consejos de Captura
                </h3>
                <ul className="text-secondary text-sm m-0 pl-20 lh-18">
                  <li><strong>Luz frontal:</strong> Evita ventanas o luces fuertes detrás de ti.</li>
                  <li><strong>Rostro despejado:</strong> Sin gafas de sol, gorras ni tapabocas.</li>
                  <li><strong>Mirada fija:</strong> Mira directamente a la lente de tu cámara.</li>
                  <li><strong>Encuadre:</strong> Tu rostro debe ocupar el centro de la imagen.</li>
                </ul>
                <div className="mt-16 p-12 bg-dark radius-md text-xs text-secondary italic">
                  💡 ¿Por qué hacemos esto? Para certificar que eres tú quien completa los módulos y aprueba el examen final, evitando fraudes y asegurando el prestigio del curso.
                </div>
              </div>

              <div className="onboarding-webcam-container">
                {!faceDescriptor && (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`onboarding-video ${DEV_MOCK_CAMERA ? 'hidden' : ''}`}
                  />
                )}
                
                {DEV_MOCK_CAMERA && !faceDescriptor && (
                   <div className="p-20 text-center text-secondary text-sm">
                      <div className="text-3xl mb-8">🛠️</div>
                      Modo desarrollo.<br/>(Cámara simulada)
                   </div>
                )}
                
                {faceDescriptor && (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center bg-cyan-transparent">
                    <div className="text-5xl mb-12">🤖✅</div>
                    <h3 className="text-cyan m-0 text-lg">Perfil Creado</h3>
                  </div>
                )}
              </div>
            </div>

            {!faceDescriptor ? (
              <div className="flex gap-16">
                <button 
                  className="btn btn-secondary w-full" 
                  onClick={() => setStep(1)}
                  type="button"
                >
                  ◀ Modificar Datos
                </button>
                
                {(!DEV_MOCK_CAMERA && !isCameraActive) ? (
                  <button className="btn btn-primary w-full" onClick={startCamera}>
                    1. Encender Cámara
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary w-full" 
                    onClick={DEV_MOCK_CAMERA ? startCamera : scanFace} 
                    disabled={isScanning || (!DEV_MOCK_CAMERA && !modelsLoaded)}
                  >
                    {isScanning ? 'Escaneando...' : '2. Capturar Rostro'}
                  </button>
                )}
              </div>
            ) : (
              <button className="btn btn-primary w-full text-lg py-12" onClick={handleSubmit}>
                Finalizar y Entrar al Curso 🚀
              </button>
            )}
          </div>
        )}

      </div>
    </main>
  );
}

