from pathlib import Path


ML_DIR = Path(__file__).resolve().parent
DATASET_DIR = ML_DIR / "data" / "dataset"
LANDMARKS_CSV = DATASET_DIR.parent / "asl_landmarks.csv"
MODEL_DIR = ML_DIR / "model"
REPORTS_DIR = ML_DIR / "analysis_outputs"
