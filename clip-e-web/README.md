# The Clip Lab — Clip-E Web

Vercel-ready Vite + React frontend for the VT Hacks Clip-E robotic haircut prototype.

## Local development

```bash
npm install
npm run dev
```

## Vercel

Import the `sabaaarshiya/CLIP_E` repository and set **Root Directory** to `clip-e-web`. Vercel should detect Vite automatically.

## Architecture

The frontend intentionally models a high-level workflow: See → Understand → Plan → Verify → Move → Learn. The UI does not send raw motor/servo angles. The **Send Cut Plan to Clip-E** control is currently a UI/demo handoff point and should be wired to the team's validated robot-side API once its contract is finalized.

The current robot visual is a lightweight CSS digital-twin interpretation so the hackathon site remains fast and deployable without a heavy 3D dependency.
