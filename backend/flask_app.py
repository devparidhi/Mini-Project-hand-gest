import os
from pathlib import Path
from threading import Lock
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import numpy as np
import tensorflow as tf
from .auth import configure_auth
from .ml.paths import DATASET_DIR, MODEL_DIR

PROJECT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_DIR / ".env")

app = Flask(__name__, static_folder=str(PROJECT_DIR / "frontend" / "dist"), static_url_path="/")
CORS(app, resources={r"/predict": {}, r"/get_reference": {}})
configure_auth(app)

@app.route("/")
def index():
    return app.send_static_file("index.html")

# Load the TFLite model and allocate tensors.
interpreter = tf.lite.Interpreter(model_path=str(MODEL_DIR / "asl_landmark_model.tflite"))
interpreter.allocate_tensors()
interpreter_lock = Lock()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'SPACE', 'T', 'U', 'V', 'W', 'X', 'YY', 'Z']

@app.get('/health')
def health():
    return jsonify(status='ok')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json(silent=True) or {}
        landmarks = data.get('landmarks')
        
        if not landmarks or len(landmarks) != 63:
            return jsonify({'error': 'Invalid landmarks data'}), 400

        input_data = np.array(landmarks, dtype=np.float32).reshape(1, 63)
        
        with interpreter_lock:
            interpreter.set_tensor(input_details[0]['index'], input_data)
            interpreter.invoke()
            output_data = interpreter.get_tensor(output_details[0]['index'])
        prediction_index = np.argmax(output_data)
        confidence = float(np.max(output_data))
        
        return jsonify({
            'label': LABELS[prediction_index],
            'confidence': confidence
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_reference', methods=['GET'])
def get_reference():
    label = request.args.get('label')
    if not label or label not in LABELS:
        return jsonify({'error': 'Invalid label'}), 400
        
    file_path = DATASET_DIR / label / "0.csv"
    if not os.path.exists(file_path):
        return jsonify({'error': 'Reference data not found'}), 404
        
    try:
        import csv
        with open(file_path, 'r') as f:
            reader = csv.reader(f)
            landmarks = next(reader)
            # Convert strings to floats
            landmarks = [float(x) for x in landmarks]
        return jsonify({'landmarks': landmarks})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
