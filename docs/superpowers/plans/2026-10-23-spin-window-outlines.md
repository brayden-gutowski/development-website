# SPIN city atmosphere and mobile contours

The final selected direction is to keep the city/apartment view and add Western
lighting and windblown dust while SPIN plays. No desert replacement video or new
artwork is needed. The existing genuine Tokyo footage and its license remain.

- Preserve the city footage, framing, buildings, streets, and uninterrupted motion.
  Its fully buffered source loops continuously for the whole 305-second recording.
- Fade warm sunlight, a warm city grade, and restrained drifting dust in during
  the song, and restore the normal view on pause, ending, hidden tab, and departure.
  Keep the needle lead-in/runout behavior. Reduced motion freezes the city/dust.
- Remove the extra media loader and unused desert MP4/JPEG/credits. The atmosphere
  is driven by song state and the existing room clock, independently of clip loops.
- Keep persistent mobile contours only on the five room actions. Preserve native
  depth visibility and reader suppression. Physical iPhone verification remains
  outstanding for the reported contour jumps.
- Verify that the city retains the same image edges through the color change,
  that the real song plays through all 305 seconds (accelerated for the check),
  and that the city video crosses repeated loop boundaries without pausing.
  Check restoration, reduced motion, ordinary Tokyo playback, and fog as well.

## Sandstorm refinement

The requested Terraria-like motion uses two depths of antialiased sideways sand
trails, with different speeds, turbulent drift, and broad rolling gusts. Everything
is shaded on the existing exterior plane, leaving the apartment in front of it.
The same song blend and room clock control all storm layers. There are no new
draw calls, media assets, or downloads; the expensive branch is skipped when off.
The new sandstorm check holds the camera and source video still, measures rapid
outdoor particle motion, checks that walls remain clear, and verifies freeze/clear
behavior for reduced motion and song pause.

## Verification

Chrome and WebKit both played the actual full 305-second song at accelerated
speed while the buffered city video crossed 11–12 real loop boundaries. The
atmosphere stayed active at 60, 120, 180, 240, and 300 seconds, then restored on
the natural ended event. City edge correlation remained above 0.91 through the
color change; pausing restored the baseline window pixels exactly. Reduced motion,
hidden-tab/door behavior, ordinary video playback/fallback, and outdoor fog checks
pass, as do seven unit checks and syntax/whitespace validation. Review found no
actionable issues. The local preview was refreshed and inspected during playback.

The final sandstorm checks pass in Chrome and WebKit: over 1,000 window pixels
change rapidly between weather frames, with zero changed pixels on the sampled
indoor wall. Reduced motion freezes the storm, and pausing clears the rapid sand.
The full 305-second check still passes with 11–12 native city-video loops.
