import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { io } from 'socket.io-client';

export function useProctoring() {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(true);
  const [isFaceMatch, setIsFaceMatch] = useState(true); // Biometric match result
  const [webcamError, setWebcamError] = useState(false);
  const [examSuspended, setExamSuspended] = useState(false);
  const [proctoringWarning, setProctoringWarning] = useState(null); // F-3: advertencia de señal débil
  const socketRef = useRef(null);
  const heartbeatInterval = useRef(null);
  const onPlayListenerRef = useRef(null);
  // Use a ref to avoid stale closure in setInterval
  const examSuspendedRef = useRef(false);

  // Use refs for flags that must be stable across re-renders (A-09)
  const isModelLoadedRef = useRef(false);
  const registeredDescriptorRef = useRef(null); // Loaded from API endpoint (I-04)
  const workerRef = useRef(null);
  const isWorkerReadyRef = useRef(false);
  const isProcessingFrameRef = useRef(false);
  // La sesión de supervisión en el servidor ('start_exam') se abre con el primer latido real,
  // cuando la cámara y los modelos ya funcionan, para no contar como pérdida de señal la carga inicial.
  const serverSessionRef = useRef(false);

  const sendHeartbeat = useCallback((faceDetected, isMatch) => {
    const socket = socketRef.current;
    if (!socket || examSuspendedRef.current) return;
    if (!serverSessionRef.current) {
      socket.emit('start_exam');
      serverSessionRef.current = true;
    }
    // isMatch null = sin descriptor registrado para comparar: el servidor no penaliza la identidad
    socket.emit('proctoring_heartbeat', { faceDetected, isMatch });
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ||
      (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');

    socketRef.current = io(socketUrl, {
      withCredentials: true
    });

    // Tras una reconexión el socket es otro: reabrir la sesión de supervisión si el examen sigue en curso
    socketRef.current.on('connect', () => {
      if (serverSessionRef.current && !examSuspendedRef.current) {
        socketRef.current.emit('start_exam');
      }
    });

    socketRef.current.on('exam_suspended', (data) => {
      console.warn('Exam suspended by backend:', data.reason);
      examSuspendedRef.current = true;  // Update ref immediately
      serverSessionRef.current = false; // el servidor ya cerró la sesión
      setExamSuspended(true);
      setProctoringWarning(null); // limpiar advertencia al suspender
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    });

    // F-3: Escuchar advertencia de señal débil antes de la suspensión
    socketRef.current.on('proctoring_warning', (data) => {
      setProctoringWarning(data.reason);
    });

    const handleTestSuspend = () => {
      examSuspendedRef.current = true;
      setExamSuspended(true);
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };

    if (process.env.NODE_ENV !== 'production') {
      window.addEventListener('__test_suspend_exam', handleTestSuspend);
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (process.env.NODE_ENV !== 'production') {
        window.removeEventListener('__test_suspend_exam', handleTestSuspend);
      }
    };
  }, []);

  // MOCK MODE: Seguro por defecto (en producción NUNCA se activa; en desarrollo/test solo si es explícitamente habilitado)
  const [isParamMock, setIsParamMock] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('skipCamera') === 'true') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsParamMock(true);
      }
    }
  }, []);

  const DEV_MOCK_CAMERA = process.env.NODE_ENV !== 'production' && (
    process.env.NEXT_PUBLIC_ENABLE_MOCK_CAMERA === 'true' || isParamMock
  );
  const isMockMode = DEV_MOCK_CAMERA;

  // Fallback: cargar modelos de face-api en el hilo principal si el worker no está disponible
  const ensureMainThreadModels = useCallback(async () => {
    if (!isModelLoadedRef.current) {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setIsModelLoaded(true);
        isModelLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading face-api models on main thread', err);
      }
    }
  }, []);

  // Start webcam and detection loop
  const startProctoring = useCallback(async () => {
    // I-04: Load face descriptor from protected API endpoint (not from user state which strips it)
    if (!registeredDescriptorRef.current) {
      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/student/descriptor`, {
          credentials: 'include'
        });
        if (resp.ok) {
          const { descriptor } = await resp.json();
          registeredDescriptorRef.current = new Float32Array(descriptor);
        } else {
          console.warn('Face descriptor not available; biometric match disabled.');
        }
      } catch (e) {
        console.warn('Could not fetch face descriptor:', e.message);
      }
    }

    // Inicializar Web Worker para inferencia biométrica en segundo plano
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !workerRef.current) {
      try {
        const worker = new Worker('/workers/proctoringWorker.js');
        workerRef.current = worker;

        worker.onmessage = (event) => {
          const { type, hasFace, match, error } = event.data || {};
          if (type === 'INIT_SUCCESS') {
            isWorkerReadyRef.current = true;
            setIsModelLoaded(true);
            isModelLoadedRef.current = true;
          } else if (type === 'INIT_ERROR') {
            console.warn('[Proctoring Worker] Init error, will fallback to main thread:', error);
            isWorkerReadyRef.current = false;
          } else if (type === 'FRAME_PROCESSED') {
            isProcessingFrameRef.current = false;
            const detected = !!hasFace;
            // Sin descriptor registrado no hay con qué comparar: identidad "no evaluable" (null)
            const matched = registeredDescriptorRef.current ? !!match : null;
            setFaceDetected(detected);
            setIsFaceMatch(detected ? matched !== false : false);
            sendHeartbeat(detected, detected ? matched : null);
          }
        };

        worker.onerror = (err) => {
          console.warn('[Proctoring Worker] Runtime error, falling back to main thread', err);
          isWorkerReadyRef.current = false;
          isProcessingFrameRef.current = false;
        };

        worker.postMessage({
          type: 'INIT',
          payload: {
            modelUri: '/models',
            registeredDescriptor: registeredDescriptorRef.current ? Array.from(registeredDescriptorRef.current) : null
          }
        });
      } catch (err) {
        console.warn('[Proctoring Worker] Could not instantiate Web Worker:', err);
      }
    }

    if (DEV_MOCK_CAMERA) {
      setWebcamError(false); // Do not block exam in mock mode
      setFaceDetected(true);
      setIsFaceMatch(true);

      heartbeatInterval.current = setInterval(() => sendHeartbeat(true, true), 3000);
      return true;
    }

    if (!videoRef.current) return false;
    const videoEl = videoRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      const label = videoTrack?.label?.toLowerCase() || '';
      if (label.includes('virtual') || label.includes('obs') || label.includes('snap') || label.includes('epoccam')) {
        console.warn('Virtual camera detected:', label);
        setWebcamError(true);
        stream.getTracks().forEach(t => t.stop());
        return false;
      }
      videoEl.srcObject = stream;
      setWebcamError(false);

      const onPlay = () => {
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        heartbeatInterval.current = setInterval(async () => {
          if (!videoEl || examSuspendedRef.current) return;

          // RUTA 1: Procesamiento Tensorial en Web Worker (Offload de Hilo Principal)
          if (isWorkerReadyRef.current && workerRef.current && !isProcessingFrameRef.current) {
            try {
              isProcessingFrameRef.current = true;
              if (typeof createImageBitmap === 'function') {
                const bitmap = await createImageBitmap(videoEl);
                workerRef.current.postMessage({
                  type: 'PROCESS_FRAME',
                  payload: { imageBitmap: bitmap }
                }, [bitmap]);
                return;
              }
            } catch (frameErr) {
              console.warn('[Proctoring] Error capturing bitmap for worker:', frameErr);
              isProcessingFrameRef.current = false;
            }
          }

          // RUTA 2: Fallback al hilo principal si el Web Worker no está listo o no es soportado
          if (!isModelLoadedRef.current) {
            await ensureMainThreadModels();
          }

          if (isModelLoadedRef.current) {
            try {
              const detection = await faceapi.detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
                                             .withFaceLandmarks()
                                             .withFaceDescriptor();

              const hasFace = !!detection;
              // Sin descriptor registrado no hay con qué comparar: identidad "no evaluable" (null)
              let match = registeredDescriptorRef.current ? false : null;

              // I-04: Use descriptor fetched from API endpoint (via registeredDescriptorRef)
              if (hasFace && registeredDescriptorRef.current) {
                 try {
                    const distance = faceapi.euclideanDistance(detection.descriptor, registeredDescriptorRef.current);
                    // Distance < 0.6 is generally considered a match
                    match = distance < 0.6;
                 } catch(e) {
                    console.error('Error comparing faces', e);
                 }
              }

              setFaceDetected(hasFace);
              setIsFaceMatch(hasFace ? match !== false : false);
              sendHeartbeat(hasFace, hasFace ? match : null);
            } catch (detErr) {
              console.error('Main thread detection error:', detErr);
            }
          }
        }, 3000);
      };

      onPlayListenerRef.current = onPlay;
      videoEl.addEventListener('play', onPlay);
      return true;

    } catch (err) {
      // Sin cámara el examen no arranca (la página muestra el aviso) y no se consume un intento
      console.error('Webcam access denied or error', err);
      setWebcamError(true);
      setFaceDetected(false);
      setIsFaceMatch(false);
      return false;
    }
  }, [DEV_MOCK_CAMERA, ensureMainThreadModels, sendHeartbeat]); // A-09: uses refs and stable callbacks

  const stopProctoring = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    // Cerrar la sesión de supervisión: sin latidos, el servidor la daría por perdida y suspendería
    if (serverSessionRef.current && socketRef.current) {
      socketRef.current.emit('end_exam');
    }
    serverSessionRef.current = false;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      isWorkerReadyRef.current = false;
      isProcessingFrameRef.current = false;
    }
    if (videoRef.current) {
      // Remove the stored play listener to prevent memory leaks
      if (onPlayListenerRef.current) {
        videoRef.current.removeEventListener('play', onPlayListenerRef.current);
        onPlayListenerRef.current = null;
      }
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, []);

  return {
    videoRef,
    isModelLoaded,
    faceDetected,
    isFaceMatch,
    examSuspended,
    proctoringWarning,
    webcamError,
    isMockMode,
    startProctoring,
    stopProctoring
  };
}