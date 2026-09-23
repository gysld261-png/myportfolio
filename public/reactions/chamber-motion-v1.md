# Integrated glass reaction — TCHAIKIM pilot

TCHAIKIM now enters the project through the approved glass still, a fixed-scale falling specimen, water drag, ripple/refraction and vapor. The other three projects retain the short dissolve while this pilot is reviewed in context.

## Assets and rendering

- Cup: `chamber-still-v1.png` (1672 × 941), unchanged from the reviewed still.
- Vapor: `chamber-vapor-v1.png` (1671 × 941), generated with the built-in image generation tool by editing the still. Copied at native resolution.
- Ice: the existing `/specimens/tchaikim-cut.png`; no replacement specimen.
- The scene is a photographic Canvas 2D composition with a fixed camera view, not a fluid simulation or freely rotatable glass mesh. Photographic masks and ice material layers are prepared once and cached, rather than processed per pixel on every frame.
- Vapor is extracted from the difference between the clean and misty photographs. Only this added layer is displaced, so the glass and ground stay stable.
- File paths, crops and timing are in `src/lib/reactionScene.js` and `src/lib/reactionTimeline.js`.

## Motion

One source-image coordinate system aligns the rim, water, ice and foreground glass across desktop/mobile crops. Gravity accelerates the fixed-size ice to first contact at 1.02 seconds. Continuous drag then slows it in the water, with no bounce, size change or floor penetration. The cover at 3.10 seconds conceals the route hand-off; the overlay clears by 3.72 seconds.

The public UI has skip and Escape/cancel paths. Reduced-motion users open the project directly. Canvas setup or asset-load failures also open the project. Hidden tabs pause the clock; visible-tab time follows wall time even if the browser schedules fewer frames. The field renderer pauses while the transition/detail is active.

For local visual inspection, open `/?reaction-study#/portfolio` and select TCHAIKIM. Development-only time controls allow inspection at 0.85 (air), 1.25 (contact/sink), 1.9 (submerged) and 2.4 (vapor). Normal URLs and production builds do not show these controls.

## Exact vapor generation prompt

Use case: precise-object-edit. Edit target: the supplied dark glass-and-water photograph. Preserve the exact camera, entire framing and dimensions, black background, glass position, rim geometry, water line, glass base, lighting direction, ground and contact reflection. Do not move, resize, redesign, duplicate or add a glass. Add only photorealistic cold white dry-ice vapor beginning inside this existing water-filled glass: a softly lit dense, low cap of vapor accumulates around the water surface, curls gently over the top rim, then spills down BOTH OUTSIDE WALLS in delicate, irregular, layered tendrils. Keep the body of the glass partly visible through translucent wisps, with rich dark gaps. The vapor is silvery gray/off-white, never self-luminous, lit by the same narrow left strip light as the original glass, darker on the right. Preserve fine filament detail and photographic volume like a real long-lens studio shot. Vapor is restricted to the glass and its immediate vicinity, with a small soft pool near its base. The upper third and outer sides stay nearly black. No floating balls or isolated blobs of smoke, no mushroom cloud, no explosion, no cartoon, no illustration, no bloom. No ice, no extra objects, no droplets flying out, no splashes, no typography or watermark. This is the next locked-camera frame of the SAME photograph, used as a matching vapor layer in a website animation. The unchanged transparent glass and water must align pixel-for-pixel with the source wherever no vapor is present.
