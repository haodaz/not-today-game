---
inclusion: fileMatch
fileMatchPattern: "src/room/**"
---

# three.js rules (only when touching the room)

- Read `package.json` for the installed three version first and write for that version. Prefer `Timer` over the deprecated `Clock`; use `renderer.setAnimationLoop`.
- The room is background. All gameplay UI is DOM or canvas layered above it. Never put text in the 3D scene.
- Post-processing (if used, via `postprocessing`): one `EffectComposer` pass. Effects keyed to SAN thresholds 70 / 50 / 30 / 10: faint noise + vignette, then depth of field focused on the screens, then chromatic aberration + pixelation of the room (never the screens). If the frame rate drops below 40, disable depth of field.
- Kuro's red-blue "plain" text is CSS on the DOM layer, not a post effect.
