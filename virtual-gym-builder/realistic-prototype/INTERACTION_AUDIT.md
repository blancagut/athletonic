# Interaction audit

Baseline captured on 2026-07-26 from the unmodified configurator at
`http://127.0.0.1:4190/?controls-audit=before`.

## Reproduction summary

| Input / gesture | 3D result before changes | Top result before changes | Expected result |
| --- | --- | --- | --- |
| Short click on ring | Selected; coordinates unchanged | Same event path | Select without transform |
| 2 px pointer movement | Ring changed from `x=-3.00` to `x=-2.75` | Same event path | Remain a click below drag threshold |
| Drag from visible ring surface | Grab offset remained stable, but direct drag and gizmo were both enabled | Same competing authorities | One movement authority with stable grab offset |
| Change 3D to Top | Selection was cleared | Selection was cleared on view change | Preserve selection and transform mode |
| Wheel / trackpad-equivalent scroll | Camera zoomed; equipment state unchanged | Camera zoomed; equipment state unchanged | Camera only |
| Pointer leaves/cancels | `pointercancel` commits provisional position | Same event path | Cancel and restore, always release capture |
| Escape | No active-transform cancellation | No active-transform cancellation | Restore exact starting transform |
| Room boundary | Position was not clamped | Position was not clamped | Clamp the rotated full footprint |
| Touch controls | 32 x 30 px mode targets; every pointer can start object drag | Same | 44 px targets; two fingers reserved for camera |
| Persistence | One store write on direct pointer-up, another possible from gizmo mouse-up | Same | Exactly one write per completed gesture |

No browser console errors were present in the clean baseline. The baseline canvas
rendered correctly in Chromium. Trackpad behavior was represented by wheel events;
touch behavior is validated below with touch pointer events and a mobile viewport.

## Gesture ownership before changes

| Gesture | Existing owner(s) | Conflict |
| --- | --- | --- |
| Object move | `EquipmentObject` direct plane drag and `TransformControls` translate | Two writers can transform the selected object |
| Object rotate | `TransformControls` and inspector +/-15 degree buttons | Separate commit and normalization paths |
| Camera orbit/pan/zoom | Per-view `OrbitControls` | Never disabled while an object transform is active |
| Selection | Object click, object pointer-down, scene pointer-miss | Pointer-down selects and immediately enables movement |

## Chosen architecture

Direct floor-plane dragging is the only translation authority. It preserves the
surface grab offset, supports a pixel threshold, and can preview imperatively without
writing React/Zustand state per pointer event. `TransformControls` is retained only
for deliberate Y-axis rotation. It cannot translate or scale. Both paths report to
one interaction state and use the same normalization, room-footprint clamp, cancel,
history, and final commit functions. `OrbitControls` is disabled for every active
object transformation.

```text
idle -> selected -> pending-drag -> dragging -> selected
  |         |             |            |          |
camera <----+-------------+            +--Esc-----+
            +-----------------> rotating ----------+
```

`camera` is exclusive with `pending-drag`, `dragging`, and `rotating`. A second touch
cancels a pending one-finger object gesture and reserves the gesture for the camera.