import numpy as np


def normalize_landmarks(samples):
    """Center each hand at the wrist and scale by its farthest joint."""
    samples = np.asarray(samples, dtype=np.float32)
    points = samples.reshape(*samples.shape[:-1], 21, 3)
    centered = points - points[..., :1, :]
    scale = np.max(np.linalg.norm(centered, axis=-1), axis=-1)
    return (centered / np.maximum(scale[..., None, None], 1e-6)).reshape(samples.shape)
