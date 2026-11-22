"""Evaluate the static classifier on held-out landmark frames."""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

from .landmarks import normalize_landmarks
from .paths import MODEL_DIR, REPORTS_DIR
from .train_classifier import load_benchmark, load_data, split_data

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source_dir", type=Path, help="The landmark source directory used to train the model")
args = parser.parse_args()

labels = np.load(MODEL_DIR / "label_map.npy")
model = tf.keras.models.load_model(MODEL_DIR / "asl_landmark_model.h5")
_, _, (benchmark_test, benchmark_labels) = split_data(*load_data(args.source_dir))
_, _, (webcam_test, webcam_labels) = split_data(
    *load_benchmark(args.source_dir, "self"), required_labels=labels[labels != "SPACE"]
)
X_test = normalize_landmarks(np.concatenate([benchmark_test, webcam_test]))
y_test = np.concatenate([benchmark_labels, webcam_labels])

OUTPUT_DIR = REPORTS_DIR
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)
TOP_K = 5

# run predictions on test set in batches (and show top-k terminal output)
batch_size = 64
preds = model.predict(X_test, batch_size=batch_size)
if preds.ndim == 2:
    probs = preds
else:
    probs = preds.reshape(len(X_test), -1)

y_pred = np.argmax(probs, axis=1)

# classification report
report = classification_report(y_test, y_pred, target_names=[str(l) for l in labels], digits=4)
print("\n=== Classification Report ===\n")
print(report)
(OUTPUT_DIR / "classification_report.txt").write_text(report, encoding="utf8")

# confusion matrix
cm = confusion_matrix(y_test, y_pred)
plt.figure(figsize=(10,8))
sns.set(font_scale=0.8)
ax = sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=labels, yticklabels=labels)
ax.set_xlabel("Predicted")
ax.set_ylabel("True")
plt.xticks(rotation=90)
plt.yticks(rotation=0)
plt.title("Confusion Matrix")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "confusion_matrix.png", dpi=200)
plt.close()
print("Saved confusion matrix to", OUTPUT_DIR / "confusion_matrix.png")

# terminal output: sample predictions with top-K
def top_k_probs(prob_row, k=5):
    idx = np.argsort(prob_row)[::-1][:k]
    return [(i, prob_row[i]) for i in idx]

out_lines = []
sample_indices = np.random.default_rng(42).choice(len(X_test), min(50, len(X_test)), replace=False)
out_lines.append(f"Sample predictions ({len(sample_indices)} held-out samples):\n")
for sample_number, i in enumerate(sample_indices):
    true_idx = int(y_test[i])
    prob_row = probs[i]
    topk = top_k_probs(prob_row, k=TOP_K)
    topk_str = ", ".join([f"{labels[idx]}:{p:.4f}" for idx,p in topk])
    line = f"Sample {i}: True={labels[true_idx]} Pred={labels[y_pred[i]]} (conf={prob_row[y_pred[i]]:.4f}) Top-{TOP_K} -> {topk_str}"
    out_lines.append(line)
    # also print some to terminal
    if sample_number < 10:
        print(line)

(OUTPUT_DIR / "predictions_sample.txt").write_text("\n".join(out_lines), encoding="utf8")
print("Saved sample predictions to", OUTPUT_DIR / "predictions_sample.txt")

# Save overall metrics summary
acc = np.mean(y_pred == y_test)
summary = f"Test accuracy: {acc:.4f}\nSamples test: {len(y_test)}\n"
(OUTPUT_DIR / "metrics_summary.txt").write_text(summary, encoding="utf8")
print(summary)
print("All outputs saved to", OUTPUT_DIR)
