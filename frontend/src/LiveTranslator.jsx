import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const HANDS_DIR = '/node_modules/@mediapipe/hands/';
const HANDS_ASSETS = import.meta.glob(
  '/node_modules/@mediapipe/hands/{hands.js,hands.binarypb,hand_landmark_*.tflite,hands_solution*}',
  { eager: true, exhaustive: true, import: 'default', query: '?url&no-inline' },
);
const handsAsset = (file) => HANDS_ASSETS[HANDS_DIR + file];
let handsScript;

function loadHands() {
  if (!handsScript) {
    handsScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = handsAsset('hands.js');
      script.onload = () => {
        if (window.Hands) resolve(window.Hands);
        else reject(new Error('Hand tracking could not load.'));
      };
      script.onerror = () => reject(new Error('Hand tracking could not load.'));
      document.head.append(script);
    }).catch((error) => {
      handsScript = null;
      throw error;
    });
  }
  return handsScript;
}

function drawHand(canvas, landmarks, connections) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  ctx.strokeStyle = '#41e8bf';
  ctx.lineWidth = 4;
  for (const [from, to] of connections) {
    const start = landmarks[from];
    const end = landmarks[to];
    ctx.beginPath();
    ctx.moveTo((1 - start.x) * width, start.y * height);
    ctx.lineTo((1 - end.x) * width, end.y * height);
    ctx.stroke();
  }
  ctx.fillStyle = '#e6fff8';
  for (const { x, y } of landmarks) {
    ctx.beginPath();
    ctx.arc((1 - x) * width, y * height, 3, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export default function LiveTranslator() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Camera is off.');
  const [error, setError] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [sentence, setSentence] = useState('');

  useEffect(() => {
    if (!cameraOn) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const controller = new AbortController();
    let stream;
    let hands;
    let frameId;
    let frameWork;
    let lastFrame = -1;
    let lastLabel = '';
    let agreedFrames = 0;
    let typedLabel = '';

    async function updatePrediction(landmarks) {
      if (!landmarks) {
        setPrediction(null);
        setCameraStatus('Show one hand to the camera.');
        lastLabel = '';
        agreedFrames = 0;
        typedLabel = '';
        return;
      }

      try {
        const { data } = await axios.post('/predict', {
          landmarks: landmarks.flatMap(({ x, y, z }) => [1 - x, y, z]),
        }, { signal: controller.signal, timeout: 5000 });
        if (controller.signal.aborted) return;

        const { label, confidence } = data;
        setError('');
        setCameraStatus('Hand detected');
        setPrediction({ label: label === 'YY' ? 'Y' : label, confidence });
        agreedFrames = label === lastLabel ? agreedFrames + 1 : 1;
        lastLabel = label;
        if (agreedFrames >= 3 && typedLabel !== label) {
          const character = label === 'SPACE' ? ' ' : label === 'YY' ? 'Y' : label;
          setSentence((previous) => previous + character);
          typedLabel = label;
        }
      } catch {
        if (controller.signal.aborted) return;
        setPrediction(null);
        setError('The prediction service is unavailable.');
        lastLabel = '';
        agreedFrames = 0;
      }
    }

    function stopOnError(error) {
      if (controller.signal.aborted) return;
      setError(error.name === 'NotAllowedError' ? 'Allow camera access and try again.' : error.message);
      setCameraStatus('Camera is off.');
      setPrediction(null);
      setCameraOn(false);
    }

    function nextFrame() {
      if (controller.signal.aborted) return;
      frameId = requestAnimationFrame(() => {
        if (video.readyState < 2 || video.currentTime === lastFrame) {
          nextFrame();
          return;
        }
        lastFrame = video.currentTime;
        frameWork = hands.send({ image: video });
        frameWork.then(nextFrame, stopOnError);
      });
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access requires localhost or a secure connection.');
      }
      const Hands = await loadHands();
      if (controller.signal.aborted) return;
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (controller.signal.aborted) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = cameraStream;
      video.srcObject = stream;
      await video.play();
      if (controller.signal.aborted) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      hands = new Hands({ locateFile: handsAsset });
      hands.setOptions({
        maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7,
      });
      hands.onResults(async (result) => {
        if (controller.signal.aborted) return;
        const landmarks = result.multiHandLandmarks?.[0];
        drawHand(canvas, landmarks, window.HAND_CONNECTIONS);
        await updatePrediction(landmarks);
      });
      setCameraStatus('Show one hand to the camera.');
      nextFrame();
    }

    start().catch(stopOnError);
    return () => {
      controller.abort();
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      if (hands) Promise.resolve(frameWork).catch(() => {}).then(() => hands.close()).catch(() => {});
    };
  }, [cameraOn]);

  function toggleCamera() {
    setError('');
    setPrediction(null);
    setCameraStatus(cameraOn ? 'Camera is off.' : 'Starting camera…');
    setCameraOn(!cameraOn);
  }

  const confidence = prediction ? Math.round(prediction.confidence * 100) : 0;

  return (
    <div className="layout-grid">
      <section className="glass-card camera-card" aria-labelledby="camera-heading">
        <div className="panel-header">
          <h2 id="camera-heading">Live camera</h2>
          <button type="button" className={cameraOn ? '' : 'primary'} onClick={toggleCamera}>
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
        <div className="video-wrapper">
          <video ref={videoRef} className="webcam-view" autoPlay playsInline muted aria-label="Webcam preview" />
          <canvas ref={canvasRef} className="webcam-canvas" aria-hidden="true" />
          {!cameraOn && <p className="camera-placeholder">Start your camera to translate a gesture.</p>}
        </div>
        <p className="muted camera-status" role="status">{cameraStatus}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted">Hold a sign steady to add it to your text. Lower your hand before repeating a letter.</p>
      </section>

      <div className="side-panel">
        <section className="glass-card" aria-labelledby="prediction-heading">
          <h2 id="prediction-heading">Detected letter</h2>
          <div className="prediction">{prediction?.label === 'SPACE' ? 'Space' : prediction?.label || '—'}</div>
          <div className="confidence-label">
            <span>Model confidence</span>
            <span>{prediction ? confidence + '%' : '—'}</span>
          </div>
          <progress aria-label="Model confidence" value={confidence} max={100} />
        </section>

        <section className="glass-card" aria-labelledby="translation-heading">
          <h2 id="translation-heading">Translated text</h2>
          <label className="sr-only" htmlFor="translation">Edit translated text</label>
          <textarea id="translation" value={sentence} onChange={(event) => setSentence(event.target.value)}
            placeholder="Your letters appear here" rows="3" />
          <div className="button-group">
            <button type="button" disabled={!sentence} onClick={() => setSentence('')}>Clear</button>
            {window.speechSynthesis && (
              <button type="button" disabled={!sentence.trim()} onClick={() => {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(sentence));
              }}>Speak</button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
