# Surround Mixer

Browser surround tester — discrete ChannelMerger spat (VBAP + FOA), walls/floors, click-to-walk listener.

## Layout

| File | Role |
|------|------|
| `spat-engine.js` | **Engine** — VBAP/FOA, occlusion, room bus, `SurroundEngine` API (no Three.js / DOM) |
| `app.js` | **Demo app** — Three.js scene, UI, walkers, birds, FOA beds |
| `index.html` | Shell |

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765/`.