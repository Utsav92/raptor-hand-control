# Raptor engine: left-hand computer vision controls

Requires Python 3. All runtime assets are included, so no npm install is needed to use the app. From this directory, run `python serve.py` and open http://localhost:54821/ in Chrome or Edge. On Windows you can instead run `powershell -ExecutionPolicy Bypass -File start.ps1`. Click **Start camera** and allow the browser's camera permission. No microphone is requested.

- Open your **left** palm for 180 ms: explode the engine's 20 major assemblies.
- Close your left hand into a fist: assemble the engine.
- Rotate or tilt your palm: change the engine's orientation and view.
- Move your hand: translate the engine. Move toward or away from the camera to change depth.
- Select **Selected assembly**, then choose a part in **Inspect**, to move and rotate that assembly alone.
- **Recenter hand** establishes a new neutral position while preserving the current model pose. **Reset view** clears hand transformations.
- Intermediate gestures preserve the last stable assembly state. Losing tracking holds the last pose. No right-hand pose drives the model.
- The preview and inference input are mirrored consistently. Use **Swap left/right labels** if the camera driver already mirrors the stream.

Stop, hiding the page, or closing it stops capture. Local MediaPipe inference runs in a worker; frames and landmarks are never uploaded, recorded, or persisted. All runtime dependencies and the 7.8 MB hand model are local assets; normal use requires no external network requests.

The source model is the same conceptual Raptor explainer shown in chat. It depicts major functional assemblies, not a complete SpaceX manufacturing CAD model. Slider limits and performance are educational approximations.

Dependencies: Three.js 0.158.0 (MIT), MediaPipe Tasks Vision 1.1.0 (Apache-2.0). `assets/hand_landmarker.task` is the official Google hand-landmarker model. `prepare.py` rebuilds the browser app from `source/raptor-engine.html` and downloads pinned runtime assets. The checked-in `index.html`, `engine.js` and assets are ready to run.

## Validation

Run `node tests/gesture-check.mjs` for deterministic gesture and pose checks. For browser checks, install the optional development dependency with `npm install`, download the official test fixture with `python tests/download-fixture.py`, start the server, and run `npm run test:browser`. Browser checks use installed Chrome and generated camera streams, without accessing the real webcam. The recorded validation covers model inference, anatomical left/right labels, open/fist assembly, part transforms, tracking loss, camera lifecycle, permission denial, and mobile layout; actual webcam tracking still needs an interactive check on your camera.

Implementation references: [Google Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [MediaPipe selfie handedness](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md), [camera permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
