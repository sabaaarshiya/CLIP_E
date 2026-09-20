# CLIP-E Arm Controller

Current ESP32-S3 firmware for the CLIP-E robotic haircut arm.

## Hardware

- ESP32-S3
- PCA9685 servo driver at `0x40`
- SDA: GPIO 2
- SCL: GPIO 1
- OE: GPIO 4

### Servo channels

| Channel | Function |
| --- | --- |
| CH0 | Base |
| CH1 | Shoulder |
| CH2 | Elbow |
| CH3 | Wrist Pitch |
| CH4 | Wrist Roll |
| CH5 | Left Plunger |
| CH6 | Right Plunger |

## Current firmware

**CLIP-E Arm Controller v5.19.0**

This is the current safe baseline used on the arm.

Included control modes and features:

- Manual joint control
- Phone gyro control
- Full-arm and clipper-only gyro modes
- Forward/back reach joystick
- Home and safe-retreat poses
- E-stop output disable
- Persistent servo direction settings
- Persistent safe motion limits
- Calibration page with one live slider per arm joint
- Calibration override that can move beyond saved SAFE MIN/MAX while still respecting absolute hardware limits
- Camera-assist approach nudges
- Cloud arm status and command endpoints

## Calibration behavior

Inside the **CALIBRATE** tab, the selected arm joint can travel across its full firmware hardware range so an old SAFE MIN/MAX does not prevent recalibration.

Everywhere outside CALIBRATE, the saved SAFE MIN/MAX remain enforced.

## Important

This directory is the canonical Arduino arm firmware location in the CLIP-E repository.

Functional network identifiers and the existing control behavior are intentionally preserved from the working baseline.
