from collections import deque
from time import monotonic

import cv2
import mediapipe as mp
import numpy as np

from .gesture_classifier import GestureClassifier
from .motion import MOTION_WINDOW_MS, MAX_FRAME_GAP_MS


def main():
    classifier = GestureClassifier()
    hand_api = mp.solutions.hands
    history = deque(maxlen=64)
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise SystemExit("Could not open camera")

    print("Press 'q' to quit")
    try:
        with hand_api.Hands(max_num_hands=1, min_detection_confidence=0.6, min_tracking_confidence=0.6) as hands:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                frame = cv2.flip(frame, 1)
                result = hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                timestamp = monotonic() * 1000
                text = "No hand"
                if result.multi_hand_landmarks:
                    hand = result.multi_hand_landmarks[0]
                    mp.solutions.drawing_utils.draw_landmarks(frame, hand, hand_api.HAND_CONNECTIONS)
                    points = np.array([[lm.x, lm.y, lm.z] for lm in hand.landmark])
                    raw = points.flatten()
                    points[:, 1] *= frame.shape[0] / frame.shape[1]
                    history.append([timestamp, *points.flat])
                    while timestamp - history[0][0] > MOTION_WINDOW_MS + 100:
                        history.popleft()
                    prediction = classifier.predict(raw, np.asarray(history))
                    label = prediction["label"]
                    text = f"Pred: {label}"
                    if not prediction.get("motion"):
                        text += f" ({prediction['confidence']:.2f})"
                elif history and timestamp - history[-1][0] > MAX_FRAME_GAP_MS:
                    history.clear()

                cv2.rectangle(frame, (10, 10), (350, 60), (0, 0, 0), -1)
                cv2.putText(frame, text, (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
                cv2.imshow("ASL Landmark Live", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
