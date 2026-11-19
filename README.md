# 🖐️ Real-Time American Sign Language (ASL) & Hand Gesture Recognition

A full-stack, deep-learning powered application for recognizing American Sign Language (ASL) gestures in real time using **MediaPipe**, **TensorFlow / TFLite**, **Flask**, and **React (Vite)**.

---

## 🌟 Key Features

- **Real-Time Landmark Detection:** 21 3D hand landmarks (63 spatial coordinates: X, Y, Z) extracted at low latency via MediaPipe Hands directly in the browser.
- **Deep Learning Classification:** Fully-connected Neural Network trained on ASL gesture landmarks and quantized into lightweight TensorFlow Lite format (`.tflite`).
- **Supports 27 Classes:** Recognizes 26 English Alphabet letters (`A`-`Z`, including `YY`) plus `SPACE`.
- **Gesture Stabilization & Sentence Formation:** Implements a stability buffer and cooldown mechanism to assemble recognized signs into coherent words and sentences.
- **Modular Architecture:** Decoupled training pipeline, REST API backend, and responsive React frontend.

---

## 🏗️ System Architecture

```mermaid
flowchart LR
    A[Webcam Feed] --> B[MediaPipe Hands (Frontend)]
    B -->|63 Normalized Coordinates| C[React App / Vite]
    C -->|POST /predict| D[Flask REST API]
    D --> E[TFLite Classifier]
    E -->|Predicted Label + Confidence| D
    D --> C
    C --> F[Real-Time Sentence Builder & Display]
```

---

## 📊 Model Overview

- **Input:** 63 features (21 landmarks $\times$ 3 coordinates $[x, y, z]$ normalized relative to the wrist).
- **Architecture:**
  - Dense (128 units, ReLU) + Dropout (0.2)
  - Dense (128 units, ReLU) + Dropout (0.2)
  - Dense (27 classes, Softmax)
- **Model Size:** Lightweight (~110 KB TFLite model, ~28k parameters).
- **Optimization:** Adam optimizer ($\text{learning rate} = 0.001$), Sparse Categorical Crossentropy.
- **Evaluation:** Evaluated on 1,640 held-out test samples with high classification accuracy across all 27 gestures.

---

## 📁 Repository Structure

```
hand-gestures-main/
├── analysis_outputs/        # Model architecture, metrics, and training evaluation reports
├── dataset/                 # Raw extracted landmark CSV files organized by sign letter (A-Z)
├── frontend/                # React (Vite) single-page application
│   ├── src/
│   │   ├── App.jsx          # MediaPipe camera integration, stabilization & sentence builder
│   │   ├── index.css        # UI styling
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js       # Vite server and API reverse-proxy configuration
├── model/
│   ├── asl_landmark_model.h5       # Keras HDF5 model
│   ├── asl_landmark_model.tflite   # Production-ready TFLite model
│   ├── label_map.npy               # Class label mappings
│   └── training_history.pkl        # Loss and accuracy history
├── asl_landmarks.csv        # Consolidated landmarks dataset
├── collect_landmarks.py     # Script to record custom gesture landmarks via webcam
├── merge_dataset.py         # Merges per-letter CSV folders into one master CSV
├── train_classifier.py      # Trains the MLP model and exports H5 + TFLite models
├── analyze_model.py         # Generates classification reports, confusion metrics, and plots
├── plot_training_curve.py   # Plots training & validation loss/accuracy curves
├── flask_app.py             # Flask API serving predictions & reference signs
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container deployment configuration
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+ / 3.11**
- **Node.js 18+** & npm
- A functional **webcam**

---

### 1. Installation

#### Backend (Python)
From the project root directory:
```bash
# Optional: create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Note:** For TensorFlow 2.15 compatibility, ensure `numpy<2` (e.g. `numpy==1.26.4`) is installed.

#### Frontend (React)
```bash
cd frontend
npm install
cd ..
```

---

### 2. Running the Application

You need both the Flask backend and the React frontend running concurrently:

#### Terminal 1 — Start Backend Server:
```bash
python flask_app.py
```
- Server starts on `http://127.0.0.1:5000`
- Provides endpoints:
  - `POST /predict` — Receives `landmarks: [63 floats]`, returns `{ label, confidence }`
  - `GET /get_reference?label=A` — Retrieves reference landmark skeleton

#### Terminal 2 — Start Frontend Application:
```bash
cd frontend
npm run dev
```
- Open your browser at: **`http://localhost:5173/`**
- Grant camera permissions when prompted. Position your hand in view to start translating signs!

---

## 🧪 Training & Custom Dataset Collection

If you wish to collect your own gesture data or retrain the classifier:

1. **Collect Landmarks:**
   ```bash
   python collect_landmarks.py
   ```
   Follow on-screen instructions to record frames for desired letters into `dataset/<LABEL>/`.

2. **Merge Dataset:**
   ```bash
   python merge_dataset.py
   ```
   Aggregates individual gesture recordings into `asl_landmarks.csv`.

3. **Train Model:**
   ```bash
   python train_classifier.py
   ```
   Trains the neural network, logs validation performance, and saves updated models into `model/`.

4. **Evaluate Model:**
   ```bash
   python analyze_model.py
   python plot_training_curve.py
   ```
   Outputs performance tables and loss curves into `analysis_outputs/`.

---

## 🐳 Docker Deployment

To build and run the application inside a container:

```bash
docker build -t hand-gesture-recognition .
docker run -p 5000:5000 hand-gesture-recognition
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React 19, Vite, MediaPipe Hands JS, Axios |
| **Backend** | Python, Flask, Flask-CORS |
| **Machine Learning** | TensorFlow, Keras, TensorFlow Lite, NumPy, Scikit-Learn |
| **Computer Vision** | OpenCV, MediaPipe |
| **Containerization** | Docker |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
