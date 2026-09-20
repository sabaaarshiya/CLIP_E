# Clip-E AR Head Mapping Architecture

## Goal

Show the user, in the live camera feed, which areas of the hair are planned to be cut, blended, preserved, or protected. The AR layer is a visualization and operator-assistance system. It is not robot execution geometry.

## Representation layers

1. Visual tracking layer
   - MediaPipe Face Landmarker for front/side head anchoring.
   - MediaPipe Hair Segmenter for a live hair mask.
   - Hair-mask fallback for rear-head anchoring when facial landmarks are not visible.

2. Semantic cut-plan layer
   - Top target length.
   - Side target length.
   - Blend transition.
   - Protected hairline / neckline.
   - Rear semantic regions: Crown, Upper Back, Rear Sides, Behind Ears, Neckline.
   - Selected haircut determines whether a region is CUT / BLEND / PRESERVE / PROTECT.

3. Robot execution layer
   - Separate from AR pixels.
   - Must use calibrated metric coordinates, tool offsets, collision envelopes, speed/acceleration limits, joint limits, and hardware E-stop state.
   - No LLM or AR overlay output may directly command the clipper path near a person.

## Current implementation

### Front / side camera

LiveHeadAR.jsx:
- Loads MediaPipe Face Landmarker in IMAGE or VIDEO mode.
- Loads MediaPipe Hair Segmenter.
- Tracks the head and hair.
- Smooths the tracked geometry frame-to-frame.
- Draws zones over the live camera:
  - TOP · CUT TO N mm
  - BLEND TRANSITION
  - SIDE · CUT TO N mm
  - HAIRLINE · PROTECTED
- Shows tracking state, approximate tracking FPS, lock confidence, and hair-mask state.

### Rear phone camera

PhoneLiveView.jsx:
- Uses WebRTC when available.
- Falls back to the uploaded camera frame.
- Passes the rear video/image into LiveHeadAR.
- When facial landmarks are unavailable, LiveHeadAR derives a head anchor from the live hair mask.
- Rear labels are driven by the selected haircut's rearCutPlan:
  - Crown
  - Upper Back
  - Rear Sides
  - Neckline

### Calibration

The computer camera calibration view now uses the AR overlay, allowing the operator to verify that:
- the head is detected,
- the hair mask is present,
- the cut zones remain attached to the head as it moves.

### Assisted workspace

The Arducam live view now uses the same AR layer.

## Next accuracy upgrades

### A. Worker-based segmentation

MediaPipe segmentation runs synchronously in the browser. Move hair segmentation into a Web Worker so the UI and live video remain smooth on slower computers.

Target:
- Face tracking: 20–30 FPS.
- Hair mask: 6–10 FPS.
- UI: 60 FPS.

### B. Per-view calibration

Store a calibration transform for each camera:
- camera-01 front/side workspace,
- phone rear camera.

The transform should include:
- image scale,
- image crop,
- lens orientation,
- mirrored/non-mirrored state,
- expected head position.

### C. Better scalp model

Generate a normalized head surface:
- crown,
- top-front,
- top-back,
- left temple,
- right temple,
- left parietal,
- right parietal,
- upper occipital,
- lower occipital,
- left/right ear guard,
- neckline.

Store cut targets in normalized head coordinates rather than browser pixels.

### D. Metric 3D execution geometry

Before any autonomous cutting:
- use depth/stereo/LiDAR or validated multi-view reconstruction,
- register the head to robot coordinates,
- calibrate clipper tool center point,
- build collision and no-go volumes,
- validate paths on a mannequin.

AR overlays must never be used as direct motor coordinates.

## Safety rule

The AR layer may:
- highlight a region,
- describe a target length,
- show CUT / BLEND / PRESERVE / PROTECT,
- assist manual positioning.

The AR layer may not:
- autonomously drive the arm,
- determine collision clearance,
- override hardware limits,
- bypass plan approval or E-stop checks.
