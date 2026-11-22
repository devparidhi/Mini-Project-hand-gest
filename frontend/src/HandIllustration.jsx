import { useEffect, useRef } from 'react';

const WIDTH = 400;
const HEIGHT = 300;
const FINGERS = [
  { joints: [1, 2, 3, 4], widths: [0.19, 0.15, 0.12, 0.1] },
  { joints: [5, 6, 7, 8], widths: [0.13, 0.12, 0.1, 0.09] },
  { joints: [9, 10, 11, 12], widths: [0.14, 0.125, 0.105, 0.09] },
  { joints: [13, 14, 15, 16], widths: [0.13, 0.115, 0.095, 0.08] },
  { joints: [17, 18, 19, 20], widths: [0.11, 0.095, 0.08, 0.07] },
];
const LANDMARK_CHAINS = [
  [0, 5, 9, 13, 17, 0],
  [0, ...FINGERS[0].joints],
  ...FINGERS.slice(1).map(({ joints }) => joints),
];

function offset(point, dx, dy) {
  return { x: point.x + dx, y: point.y + dy };
}

function fingerShape(points, radii, border = 0) {
  const path = new Path2D();

  // Overlap the tapered segments and round joints to form one continuous finger.
  points.forEach(({ x, y }, index) => {
    const radius = radii[index] + border;
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, 2 * Math.PI);
  });
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const nx = -dy / length;
    const ny = dx / length;
    const a = radii[index - 1] + border;
    const b = radii[index] + border;
    path.moveTo(start.x - nx * a, start.y - ny * a);
    path.lineTo(end.x - nx * b, end.y - ny * b);
    path.lineTo(end.x + nx * b, end.y + ny * b);
    path.lineTo(start.x + nx * a, start.y + ny * a);
    path.closePath();
  }

  return path;
}

function drawLandmarks(ctx, points) {
  const paths = new Path2D();
  for (const [first, ...rest] of LANDMARK_CHAINS) {
    paths.moveTo(points[first].x, points[first].y);
    for (const index of rest) paths.lineTo(points[index].x, points[index].y);
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6d8cee';
  ctx.lineWidth = 4;
  ctx.stroke(paths);

  const dots = new Path2D();
  for (const { x, y } of points) {
    dots.moveTo(x + 3.5, y);
    dots.arc(x, y, 3.5, 0, 2 * Math.PI);
  }
  ctx.fillStyle = '#dce7ff';
  ctx.fill(dots);
  ctx.lineWidth = 1.5;
  ctx.stroke(dots);
}

function projectLandmarks(coordinates) {
  const landmarks = Array.from({ length: 21 }, (_, index) => ({
    x: coordinates[index * 3] * 4 / 3,
    y: coordinates[index * 3 + 1],
    depth: coordinates[index * 3 + 2],
  }));
  const xs = landmarks.map(({ x }) => x);
  const ys = landmarks.map(({ y }) => y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min((WIDTH - 120) / spanX, (HEIGHT - 112) / spanY);

  if (!Number.isFinite(scale)) return null;

  const left = (WIDTH - spanX * scale) / 2;
  const top = (HEIGHT - spanY * scale) / 2;
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return landmarks.map(({ x, y, depth }) => ({
    x: left + (x - minX) * scale,
    y: top + (y - minY) * scale,
    depth,
  }));
}

function drawHand(ctx, points) {
  const wrist = points[0];
  const thumbBase = points[1];
  const [indexKnuckle, middleKnuckle, ringKnuckle, pinkyKnuckle] = [5, 9, 13, 17].map(
    (index) => points[index],
  );
  const palmX = (middleKnuckle.x + ringKnuckle.x) / 2 - wrist.x;
  const palmY = (middleKnuckle.y + ringKnuckle.y) / 2 - wrist.y;
  const length = Math.max(Math.hypot(palmX, palmY), 24);
  const wristEnd = offset(wrist, -palmX * 0.16, -palmY * 0.16);

  const palm = new Path2D();
  palm.moveTo(wristEnd.x, wristEnd.y);
  palm.quadraticCurveTo(wrist.x, wrist.y, thumbBase.x, thumbBase.y);
  palm.lineTo(indexKnuckle.x, indexKnuckle.y);
  palm.lineTo(middleKnuckle.x, middleKnuckle.y);
  palm.lineTo(ringKnuckle.x, ringKnuckle.y);
  palm.lineTo(pinkyKnuckle.x, pinkyKnuckle.y);
  palm.quadraticCurveTo(wrist.x, wrist.y, wristEnd.x, wristEnd.y);
  palm.closePath();

  const outline = '#162f79';
  const palmColor = ctx.createLinearGradient(wrist.x, wrist.y, middleKnuckle.x, middleKnuckle.y);
  palmColor.addColorStop(0, '#91adeb');
  palmColor.addColorStop(1, '#dce8ff');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = length * 0.29;
  ctx.stroke(palm);
  ctx.fillStyle = palmColor;
  ctx.lineWidth = length * 0.24;
  ctx.strokeStyle = palmColor;
  ctx.stroke(palm);
  ctx.fill(palm);

  const fingers = FINGERS.map(({ joints, widths }) => ({
    joints: joints.map((joint) => points[joint]),
    radii: widths.map((width) => width * length),
    depth: (points[joints[2]].depth + points[joints[3]].depth) / 2,
  }));
  // MediaPipe places closer landmarks at lower depth values.
  fingers.sort((first, second) => second.depth - first.depth);
  for (const { joints, radii } of fingers) {
    const [root, , , tip] = joints;
    const skin = ctx.createLinearGradient(root.x, root.y, tip.x, tip.y);
    skin.addColorStop(0, '#9ab5ef');
    skin.addColorStop(0.55, '#dce8ff');
    skin.addColorStop(1, '#fff');
    ctx.fillStyle = outline;
    ctx.fill(fingerShape(joints, radii, length * 0.022));
    ctx.fillStyle = skin;
    ctx.fill(fingerShape(joints, radii));
  }
}

export default function HandIllustration({ coordinates, label, landmarksOnly = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = WIDTH * pixelRatio;
    canvas.height = HEIGHT * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(pixelRatio, pixelRatio);
    const points = projectLandmarks(coordinates);
    if (!points) return;
    const draw = landmarksOnly ? drawLandmarks : drawHand;
    draw(ctx, points);
  }, [coordinates, landmarksOnly]);

  return (
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} role="img"
      aria-label={label + (landmarksOnly ? ' hand landmarks' : ' hand pose illustration')} />
  );
}
