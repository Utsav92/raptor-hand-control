from pathlib import Path
import urllib.request

target = Path(__file__).resolve().parent / 'right_hands.jpg'
url = 'https://storage.googleapis.com/mediapipe-assets/right_hands.jpg'
try:
    with urllib.request.urlopen(url, timeout=30) as response:
        target.write_bytes(response.read())
    print('Official MediaPipe hand fixture downloaded:', target.stat().st_size)
except Exception as error:
    print('Official hand fixture unavailable:', error)
