// Carga de @vladmandic/face-api (fork mantenido de face-api.js; ver DOCUMENTATION.md, sección 8).
// La librería trae TensorFlow.js empaquetado y no puede evaluarse en el servidor: un import
// estático rompe el prerender de Next. Por eso se importa bajo demanda, solo en el navegador,
// y una única vez. Si falla la descarga del chunk, la siguiente llamada lo reintenta.
let faceApiPromise = null;

export function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = import('@vladmandic/face-api').catch((err) => {
      faceApiPromise = null;
      throw err;
    });
  }
  return faceApiPromise;
}
