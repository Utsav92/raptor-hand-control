# Third-party components

- **Three.js 0.158.0** — MIT. License text is included as `assets/three-LICENSE.txt`. Source: https://github.com/mrdoob/three.js/tree/r158.
- **MediaPipe Tasks Vision 1.1.0** — Apache-2.0. License text is included as `assets/mediapipe-LICENSE.txt`. Source: https://github.com/google-ai-edge/mediapipe; package: https://www.npmjs.com/package/@mediapipe/tasks-vision.
- **Google Hand Landmarker model, float16 revision 1** — model distributed by Google for MediaPipe. Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task. Usage documentation: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker.

The no-SIMD loader wrapper adds a `globalThis.ModuleFactory` assignment to make the loader usable in a module worker. The rest of the runtime files are vendor assets. The model checksum is recorded in `assets/hand_landmarker.sha256`.

The optional test image is downloaded separately from Google's MediaPipe test assets; it is not included in this repository.
