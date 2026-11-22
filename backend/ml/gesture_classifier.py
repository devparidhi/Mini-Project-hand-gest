from threading import Lock

import numpy as np
import tensorflow as tf

from .landmarks import normalize_landmarks
from .motion import detect_motion
from .paths import MODEL_DIR


class GestureClassifier:
    def __init__(self):
        self.labels = np.load(MODEL_DIR / "label_map.npy")
        model = (MODEL_DIR / "asl_landmark_model.tflite").read_bytes()
        self.interpreter = tf.lite.Interpreter(model_content=model)
        self.interpreter.allocate_tensors()
        self.input_index = self.interpreter.get_input_details()[0]["index"]
        output = self.interpreter.get_output_details()[0]
        if output["shape"][-1] != len(self.labels):
            raise ValueError("The gesture model and its label map disagree")
        self.output_index = output["index"]
        self.lock = Lock()

    def predict(self, landmarks, motion=None):
        if motion is not None and len(motion):
            label = detect_motion(motion[:, 0], motion[:, 1:])
            if label:
                return {"label": label, "confidence": 1.0, "motion": True}

        features = normalize_landmarks(landmarks).reshape(1, 63)
        with self.lock:
            self.interpreter.set_tensor(self.input_index, features)
            self.interpreter.invoke()
            scores = self.interpreter.get_tensor(self.output_index)[0]

        index = int(scores.argmax())
        return {"label": str(self.labels[index]), "confidence": float(scores[index])}
