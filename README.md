# 🖐️ Real-Time American Sign Language (ASL) & Hand Gesture Recognition

A full-stack, deep-learning powered application for recognizing American Sign Language (ASL) gestures in real time using **MediaPipe**, **TensorFlow / TFLite**, **Flask**, and **React (Vite)**.

---

## 🌟 Key Features

- **Accounts and dashboard:** Create an account or sign in to a personalized dashboard. Neon Postgres stores accounts and sessions.
- **Gesture guide:** Browse A–Z and Space using hand landmarks recorded in this project's dataset.
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
hand_gesture_final/
├── backend/
│   ├── flask_app.py         # Flask API and built frontend
│   ├── auth.py              # Account and session routes
│   ├── auth_schema.sql      # Neon Postgres schema
│   ├── requirements.txt     # Python dependencies
│   └── ml/
│       ├── data/
│       │   ├── dataset/     # Raw landmark recordings, grouped by gesture
│       │   └── asl_landmarks.csv
│       ├── model/          # Trained models, label map, and training history
│       ├── analysis_outputs/
│       └── *.py            # Data collection, training, and evaluation scripts
├── frontend/
│   ├── src/                # React sign-in, dashboard, camera, and gesture guide
│   ├── public/
│   ├── package.json
│   └── vite.config.js      # Development server and API proxy
├── .env.example
├── Dockerfile
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10 or 3.11**
- **Node.js 22.13+ or 24.x** & npm
- A **Neon Postgres** database
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
pip install -r backend/requirements.txt
```

> **Note:** For TensorFlow 2.15 compatibility, ensure `numpy<2` (e.g. `numpy==1.26.4`) is installed.

#### Frontend (React)
```bash
cd frontend
npm install
cd ..
```

---

### 2. Set up account storage

Copy `.env.example` to `.env` in the project root and set `DATABASE_URL` to your Neon connection string. Keep it in the Flask environment.

```bash
python -m flask --app backend.flask_app init-auth-db
```

Run this once per database. When deploying behind an HTTPS proxy, set `AUTH_COOKIE_SECURE=1` in the backend environment.

### 3. Running the Application

You need both the Flask backend and the React frontend running concurrently:

#### Terminal 1 — Start the backend from the project root
```bash
python -m backend.flask_app
```
- Server starts on `http://127.0.0.1:5000`
- Provides endpoints:
  - `/api/auth` — Registration, sign-in, session lookup, and sign-out
  - `POST /predict` — Receives `landmarks: [63 floats]`, returns `{ label, confidence }`
  - `GET /get_reference?label=A` — Retrieves reference landmark skeleton

#### Terminal 2 — Start Frontend Application:
```bash
cd frontend
npm run dev
```
- Open your browser at: **`http://localhost:5173/`**
- Create an account or sign in. Use **Start camera** to translate a sign, or open the **Gesture guide** to view examples.

---

## 🧪 Training & Custom Dataset Collection

Run these commands from the project root to collect data or retrain the classifier.

1. **Collect Landmarks:**
   ```bash
   python -m backend.ml.collect_landmarks
   ```
   Follow the prompts to record frames into `backend/ml/data/dataset/<LABEL>/`.

2. **Merge Dataset:**
   ```bash
   python -m backend.ml.merge_dataset
   ```
   Aggregates individual gesture recordings into `backend/ml/data/asl_landmarks.csv`.

3. **Train Model:**
   ```bash
   python -m backend.ml.train_classifier
   ```
   Trains the neural network and saves updated models into `backend/ml/model/`.

4. **Evaluate Model:**
   ```bash
   python -m backend.ml.analyze_model
   python -m backend.ml.plot_training_curve
   ```
   Writes performance tables and loss curves to `backend/ml/analysis_outputs/`.

---

## Deployment on Vercel, Render, and Neon

1. **Neon** — Select your database and role in the Neon console and copy its PostgreSQL connection string. Keep the SSL settings included in the URL. The role must be able to create the `gesture_auth` schema and its tables. [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app)
2. **Render** — Create a Blueprint from this repository using `render.yaml`. Set `DATABASE_URL` to the Neon connection string. The Blueprint uses the paid Standard instance (2 GB RAM) for TensorFlow, initializes the auth schema before each release, and checks `/health` before routing traffic. Once it is live, copy the service's HTTPS origin, such as `https://hand-gesture-api.onrender.com`. [Render Blueprint guide](https://render.com/docs/infrastructure-as-code)
3. **Vercel** — Import the same repository and set **Root Directory** to `frontend` and **Node.js Version** to 22.x or 24.x. Set `RENDER_BACKEND_URL` to your Render service's HTTPS origin without a trailing slash in Production and in any Preview environment you plan to deploy. `frontend/vercel.json` builds the Vite frontend and proxies the auth, prediction, and gesture reference requests, so the browser uses the Vercel origin for session cookies. [Vercel configuration guide](https://vercel.com/docs/project-configuration/vercel-json)

To verify the release, open `/health` on Render, then register or sign in on the Vercel site. Refresh to check that the session persists, open a gesture in the guide, and allow camera access to test prediction.

## 🐳 Combined Docker Deployment

To build and run the application inside a container:

```bash
docker build -t hand-gesture-recognition .
docker run --rm --env-file .env hand-gesture-recognition python -m flask --app backend.flask_app init-auth-db
docker run --env-file .env -p 5000:7860 hand-gesture-recognition
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React 19, Vite, MediaPipe Hands JS, Axios |
| **Backend** | Python, Flask, Flask-CORS, Neon Postgres, Psycopg |
| **Machine Learning** | TensorFlow, Keras, TensorFlow Lite, NumPy, Scikit-Learn |
| **Computer Vision** | OpenCV, MediaPipe |
| **Containerization** | Docker |

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
