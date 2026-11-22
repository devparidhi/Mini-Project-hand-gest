import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Icon from './Icon.jsx';

const HANDS_DIR = '/node_modules/@mediapipe/hands/';
const HANDS_ASSETS = import.meta.glob(
  '/node_modules/@mediapipe/hands/{hands.js,hands.binarypb,hand_landmark_*.tflite,hands_solution*}',
  { eager: true, exhaustive: true, import: 'default', query: '?url&no-inline' },
);
const handsAsset = (file) => HANDS_ASSETS[HANDS_DIR + file];
const MOTION_WINDOW_MS = 1900;
const MAX_FRAME_GAP_MS = 220;
const MOTION_STARTERS = { J: 'I', Z: 'D' };
const TRACKED_JOINTS = [0, 4, 8, 12, 16, 20];
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

function handIsMoving(history) {
  const latest = history.at(-1);
  const palm = Math.hypot(latest[28] - latest[1], latest[29] - latest[2]);
  return history.some((frame) => latest[0] - frame[0] <= 300
    && TRACKED_JOINTS.some((joint) => {
      const x = 1 + joint * 3;
      return Math.hypot(latest[x] - frame[x], latest[x + 1] - frame[x + 1]) > palm * 0.24;
    }));
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
    let candidateSince = 0;
    let history = [];
    let tracking = false;
    let trackingSession = 0;
    let predicting = false;
    let lastRequest = -Infinity;
    let lastMotion = -Infinity;

    async function updatePrediction(landmarks, now) {
      if (!landmarks) {
        if (tracking && now - history.at(-1)?.[0] < MAX_FRAME_GAP_MS) return;
        if (tracking) trackingSession += 1;
        tracking = false;
        history = [];
        setPrediction(null);
        setCameraStatus('Show one hand to the camera.');
        lastLabel = '';
        agreedFrames = 0;
        typedLabel = '';
        return;
      }

      tracking = true;
      const raw = landmarks.flatMap(({ x, y, z }) => [1 - x, y, z]);
      const aspect = video.videoHeight / video.videoWidth;
      history.push([now, ...raw.map((value, index) => index % 3 === 1 ? value * aspect : value)]);
      history = history.filter(([time]) => now - time <= MOTION_WINDOW_MS).slice(-64);
      if (predicting || now - lastRequest < 60) return;
      predicting = true;
      lastRequest = now;
      const session = trackingSession;
      const frames = history.slice();

      try {
        const { data } = await axios.post('/predict', {
          landmarks: raw,
          motion: frames,
        }, { signal: controller.signal, timeout: 5000 });
        if (controller.signal.aborted || trackingSession !== session) return;

        const { label, confidence, motion } = data;
        setError('');
        setCameraStatus('Hand detected');
        setPrediction({ label, confidence, motion });

        if (motion) {
          if (typedLabel !== label) {
            setSentence((previous) => previous + label);
            typedLabel = label;
            lastMotion = now;
          }
          // Discard stroke frames so a later sign cannot replay the same letter.
          history = history.filter(([time]) => time > now);
          lastLabel = '';
          agreedFrames = 0;
          return;
        }

        const motionStarter = label === 'I' || label === 'D';
        if (now - lastMotion < 350 || confidence < 0.75 || handIsMoving(frames)) {
          lastLabel = '';
          agreedFrames = 0;
          return;
        }
        if (lastLabel !== label) candidateSince = now;
        agreedFrames = label === lastLabel ? agreedFrames + 1 : 1;
        lastLabel = label;
        if (agreedFrames >= 3 && now - candidateSince >= (motionStarter ? 750 : 180)
          && typedLabel !== label && MOTION_STARTERS[typedLabel] !== label) {
          const character = label === 'SPACE' ? ' ' : label;
          setSentence((previous) => previous + character);
          typedLabel = label;
        }
      } catch {
        if (controller.signal.aborted || trackingSession !== session) return;
        setPrediction(null);
        setError('The prediction service is unavailable.');
        lastLabel = '';
        agreedFrames = 0;
      } finally {
        predicting = false;
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
      hands.onResults((result) => {
        if (controller.signal.aborted) return;
        const landmarks = result.multiHandLandmarks?.[0];
        drawHand(canvas, landmarks, window.HAND_CONNECTIONS);
        void updatePrediction(landmarks, performance.now());
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
          <h3 id="camera-heading">Live camera</h3>
          <button type="button" className={cameraOn ? 'camera-toggle' : 'primary camera-toggle'} onClick={toggleCamera}>
            <Icon name={cameraOn ? 'camera-off' : 'camera'} />
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
        </div>
        <div className="video-wrapper">
          <video ref={videoRef} className="webcam-view" autoPlay playsInline muted aria-label="Webcam preview" />
          <canvas ref={canvasRef} className="webcam-canvas" aria-hidden="true" />
          {!cameraOn && <div className="camera-placeholder watermark">
            <span className="camera-symbol" aria-hidden="true">
              <Icon name="camera" />
            </span>
            <p>Start your camera to try a letter.</p>
          </div>}
          <p className={cameraOn ? 'camera-status' : 'sr-only'} role="status">{cameraStatus}</p>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {cameraOn && <p className="muted camera-tip">Hold steady for letters and Space. Trace J with your pinky and Z with your index finger. Lower your hand before repeating a letter.</p>}
      </section>

      <div className="side-panel">
        <section className="glass-card" aria-labelledby="prediction-heading">
          <h3 id="prediction-heading">Detected letter</h3>
          <div className="prediction">{prediction?.label === 'SPACE' ? 'Space' : prediction?.label || '—'}</div>
          {prediction?.motion ? <p className="confidence-caption">Motion detected</p> : <>
            <div className="confidence-label">
              <span className="confidence-caption">Model confidence</span>
              <span>{prediction ? confidence + '%' : '—'}</span>
            </div>
            <progress aria-label="Model confidence" value={confidence} max={100} />
          </>}
        </section>

        <section className="glass-card translation-card" aria-labelledby="translation-heading">
          <h3 id="translation-heading">Translated text</h3>
          <label className="sr-only" htmlFor="translation">Edit translated text</label>
          <textarea id="translation" value={sentence} onChange={(event) => setSentence(event.target.value)}
            placeholder="Your letters appear here" rows="2" />
          <div className="button-group">
            <button type="button" disabled={!sentence} onClick={() => setSentence('')}>
              <span className="translation-action-label">Clear</span>
              <Icon name="trash" />
            </button>
            {window.speechSynthesis && (
              <button type="button" disabled={!sentence.trim()} onClick={() => {
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(sentence));
              }}>
                <span className="translation-action-label">Speak</span>
                <Icon name="volume" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
