import csv
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np

from .auth import configure_auth
from .ml.gesture_classifier import GestureClassifier
from .ml.paths import DATASET_DIR, MODEL_DIR

PROJECT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_DIR / ".env")

app = Flask(__name__, static_folder=str(PROJECT_DIR / "frontend" / "dist"), static_url_path="/")
CORS(app, resources={r"/predict": {}, r"/get_reference": {}})
configure_auth(app)

classifier = GestureClassifier()
REFERENCE_LABELS = set(classifier.labels) | {"J", "Z"}


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/predict")
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Invalid landmarks data"), 400

    try:
        landmarks = np.asarray(data.get("landmarks"), dtype=np.float32)
        motion = np.asarray(data["motion"], dtype=np.float64) if "motion" in data else None
    except (TypeError, ValueError, OverflowError):
        return jsonify(error="Invalid landmarks data"), 400

    if landmarks.shape != (63,) or not np.isfinite(landmarks).all():
        return jsonify(error="Invalid landmarks data"), 400

    if motion is not None:
        if motion.ndim != 2 or motion.shape[1] != 64 or not 1 <= len(motion) <= 64:
            return jsonify(error="Invalid motion history"), 400
        if not np.isfinite(motion).all() or np.any(np.diff(motion[:, 0]) <= 0):
            return jsonify(error="Invalid motion history"), 400

    return jsonify(classifier.predict(landmarks, motion))


@app.get("/get_reference")
def get_reference():
    label = request.args.get("label")
    if label == "YY":
        label = "Y"
    if label not in REFERENCE_LABELS:
        return jsonify(error="Invalid label"), 400

    file_path = DATASET_DIR / "SPACE" / "0.csv" if label == "SPACE" else MODEL_DIR / "references" / f"{label}.csv"
    try:
        with file_path.open(newline="") as file:
            landmarks = [float(value) for value in next(csv.reader(file))]
    except FileNotFoundError:
        return jsonify(error="Reference data not found"), 404
    return jsonify(landmarks=landmarks)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
