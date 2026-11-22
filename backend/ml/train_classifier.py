import argparse
import csv
import pickle
from pathlib import Path

import numpy as np
import tensorflow as tf

from .landmarks import normalize_landmarks
from .paths import DATASET_DIR, MODEL_DIR

ALPHABET = np.array(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ"))
STATIC_LABELS = np.array(sorted([letter for letter in ALPHABET if letter not in "JZ"] + ["SPACE"]))


def load_benchmark(source_dir, source="signalpha"):
    samples = np.load(source_dir / f"X_{source}.npy").astype(np.float32)
    labels = ALPHABET[np.load(source_dir / f"y_{source}.npy")]
    return samples, labels


def load_data(source_dir):
    samples, labels = load_benchmark(source_dir)
    space_files = sorted((DATASET_DIR / "SPACE").glob("*.csv"), key=lambda file: int(file.stem))
    space = np.array([np.loadtxt(file, delimiter=",") for file in space_files], dtype=np.float32)
    samples = np.concatenate([samples, space])
    labels = np.concatenate([labels, np.full(len(space), "SPACE")])
    return samples, labels


def split_data(samples, labels, required_labels=STATIC_LABELS):
    rng = np.random.default_rng(42)
    train, validation, test = [], [], []
    for label in required_labels:
        indices = rng.permutation(np.flatnonzero(labels == label))
        if len(indices) < 10:
            raise ValueError(f"Too few samples for {label}")
        validation_end = len(indices) // 10
        test_end = len(indices) // 5
        validation.extend(indices[:validation_end])
        test.extend(indices[validation_end:test_end])
        train.extend(indices[test_end:])
    return [(samples[indices], np.searchsorted(STATIC_LABELS, labels[indices]))
            for indices in (train, validation, test)]


def augment(samples, rng):
    points = normalize_landmarks(samples).reshape(-1, 21, 3)
    angle = rng.uniform(-0.24, 0.24, size=(len(points), 1))
    x, y = points[..., 0].copy(), points[..., 1].copy()
    points[..., 0] = (np.cos(angle) * x - np.sin(angle) * y) * rng.choice([-1, 1], (len(points), 1))
    points[..., 1] = (np.sin(angle) * x + np.cos(angle) * y) * rng.uniform(0.8, 1.3, (len(points), 1))
    points += rng.normal(0, 0.008, points.shape)
    return normalize_landmarks(points.reshape(-1, 63))


def main():
    parser = argparse.ArgumentParser(description="Train the static ASL and Space classifier.")
    parser.add_argument("source_dir", type=Path, help="Folder containing the SignAlphaSet and webcam landmark arrays")
    parser.add_argument("--output-dir", type=Path, default=MODEL_DIR)
    args = parser.parse_args()
    tf.keras.utils.set_random_seed(42)
    rng = np.random.default_rng(42)
    labels = STATIC_LABELS
    samples, sample_labels = load_data(args.source_dir)
    (train, train_y), (val, val_y), (test, test_y) = split_data(samples, sample_labels)
    webcam = load_benchmark(args.source_dir, "self")
    (webcam_train, webcam_y), (webcam_val, webcam_val_y), (webcam_test, webcam_test_y) = split_data(
        *webcam, required_labels=labels[labels != "SPACE"]
    )
    val = normalize_landmarks(np.concatenate([val, webcam_val]))
    val_y = np.concatenate([val_y, webcam_val_y])

    features = np.concatenate([
        normalize_landmarks(train), *(augment(train, rng) for _ in range(4)),
        normalize_landmarks(webcam_train), *(augment(webcam_train, rng) for _ in range(19)),
    ])
    targets = np.concatenate([np.tile(train_y, 5), np.tile(webcam_y, 20)])
    counts = np.bincount(targets)
    sample_weights = np.sqrt(len(targets) / (len(labels) * counts))[targets]

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(63,)),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dropout(0.15),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dropout(0.15),
        tf.keras.layers.Dense(len(labels), activation="softmax"),
    ])
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    history = model.fit(
        features, targets, sample_weight=sample_weights, validation_data=(val, val_y),
        epochs=60, batch_size=256, verbose=2,
        callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)],
    )

    _, accuracy = model.evaluate(normalize_landmarks(test), test_y, verbose=0)
    print(f"Held-out static accuracy: {accuracy:.2%} ({len(test)} samples)", flush=True)
    _, accuracy = model.evaluate(normalize_landmarks(webcam_test), webcam_test_y, verbose=0)
    print(f"Held-out webcam accuracy: {accuracy:.2%} ({len(webcam_test)} samples)", flush=True)

    output = args.output_dir
    output.mkdir(parents=True, exist_ok=True)
    model.save(output / "asl_landmark_model.h5")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    (output / "asl_landmark_model.tflite").write_bytes(converter.convert())
    np.save(output / "label_map.npy", labels)
    with (output / "training_history.pkl").open("wb") as file:
        pickle.dump(history.history, file)

    # Use a representative example from the new landmarks for each guide entry.
    references = output / "references"
    references.mkdir(exist_ok=True)
    for label in ALPHABET:
        examples = normalize_landmarks(samples[sample_labels == label])
        if label in labels:
            matches = model.predict(examples, verbose=0).argmax(axis=1) == np.searchsorted(labels, label)
            examples = examples[matches]
        median = np.median(examples, axis=0)
        example = examples[np.argmin(np.linalg.norm(examples - median, axis=1))]
        with (references / f"{label}.csv").open("w", newline="") as file:
            csv.writer(file).writerow(example)


if __name__ == "__main__":
    main()
