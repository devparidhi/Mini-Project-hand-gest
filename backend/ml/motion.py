import numpy as np

# Try different stroke speeds using the same time windows in the web and desktop apps.
MOTION_WINDOW_MS = 1800
MAX_FRAME_GAP_MS = 220
WINDOW_LENGTHS_MS = (280, 350, 500, 700, 950, 1200, 1500, 1800)


def _finger_shape(points, start):
    joints = points[:, start:start + 4]
    lengths = np.linalg.norm(np.diff(joints, axis=1), axis=-1).sum(axis=1)
    return np.linalg.norm(joints[:, -1] - joints[:, 0], axis=-1) / np.maximum(lengths, 1e-6)


def _z_stroke(tip):
    # The three strokes alternate horizontally, with a downward middle stroke.
    for first in range(2, 7):
        for second in range(first + 2, 10):
            strokes = np.diff(tip[[0, first, second, -1]], axis=0)
            x, y = strokes.T
            direction = np.sign(x[0])
            horizontal = x * [direction, -direction, direction]
            if (
                np.min(horizontal) > 0.25
                and y[1] > 0.22
                and abs(y[0]) < horizontal[0] * 1.05
                and abs(y[2]) < horizontal[2] * 1.05
            ):
                return True
    return False


def _j_stroke(tip):
    # The pinky moves down first, then sweeps sideways and hooks upward.
    for turn in range(3, 10):
        down = tip[turn] - tip[0]
        hook = tip[-1] - tip[turn]
        if down[1] > 0.35 and abs(down[0]) < down[1] * 0.8 and hook[1] < -0.22 and abs(hook[0]) > 0.28:
            return True
    return False


def detect_motion(milliseconds, landmarks):
    """Return J or Z only when the active finger traces the corresponding stroke."""
    if len(milliseconds) < 5:
        return None
    gaps = np.flatnonzero(np.diff(milliseconds) > MAX_FRAME_GAP_MS)
    if len(gaps):
        start = gaps[-1] + 1
        milliseconds, landmarks = milliseconds[start:], landmarks[start:]
    points = landmarks.reshape(-1, 21, 3)
    # Smooth the tracked fingertip path while retaining its translation through the image.
    smooth = points.copy()
    smooth[1:-1] = (points[:-2] + 2 * points[1:-1] + points[2:]) / 4
    palm_lengths = np.linalg.norm(points[:, 9] - points[:, 0], axis=-1)
    extension = np.stack([_finger_shape(points, joint) for joint in (5, 9, 13, 17)], axis=1)
    reach = np.linalg.norm(points[:, [8, 12, 16, 20]] - points[:, :1], axis=-1)
    z_shape = (extension[:, 0] > 0.70) & (reach[:, 0] - np.max(reach[:, 1:], axis=1) > palm_lengths * 0.24)
    j_shape = (extension[:, 3] > 0.75) & (np.max(extension[:, :3], axis=1) < 0.72)

    for duration in WINDOW_LENGTHS_MS:
        start_time = milliseconds[-1] - duration
        start = np.searchsorted(milliseconds, start_time)
        if start_time < milliseconds[0] or len(points) - start < 5:
            continue
        scale = float(np.median(palm_lengths[start:]))
        if scale < 1e-5:
            continue
        times = np.linspace(start_time, milliseconds[-1], 12)
        for label, shape, tip_index, is_stroke in (("J", j_shape, 20, _j_stroke), ("Z", z_shape, 8, _z_stroke)):
            if np.mean(shape[start:]) < 0.60:
                continue
            tip = np.stack([np.interp(times, milliseconds, axis) for axis in smooth[:, tip_index, :2].T], axis=1)
            if is_stroke(tip / scale):
                return label
    return None
