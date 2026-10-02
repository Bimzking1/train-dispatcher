# Train Dispatcher

A playable train-dispatch sim. Pick a yard, accept trains on the approach, set the road for each
one, and keep the traffic moving without collisions.

```bash
npm install
npm run dev
npm run build
```

## How it plays

- **Choose a station** — Local Junction (tier 1), Grand Central Terminal (tier 2) or the
  Industrial Freight Hub (tier 3).
- **Inbound queue** shows every train on the approach with its request: `PASS`, `STOP`, `LAST` or
  `FIX`. Every train has a patience timer; let it expire and the train is cut away.
- **Assign route** previews a destination, highlights the road, applies and locks the points it
  needs, and shows any conflicts before you commit.
- **Confirm dispatch** sets the road, then clears the preview so the button gets out of the way.
  Switches lock while a train holds them and release when it clears. Turntables only bridge when
  two ports line up and are controllable from the map and controls dock.
- **Train details** — select any train on the map or queue to open a floating details panel showing
  speed, consist, route, direction and any hold status.
- **Turntable controls** — click a turntable on the map (or use the dock) to open a 45° snap dial
  with its current deck angle and movement state.
- **Quit shift** — the top bar "Quit" now asks for confirmation before returning to station select.
- **Run round** — trains sent to a final stand reverse out through the ladder and off the layout.
- Collisions, derailments and blocked roads are all your responsibility: the panel log tells you
  what happened and when.

## Map & Controls

- **Infinite canvas** — the grid and yard surface extend well beyond the layout bounds, so you can
  pan and zoom freely without hitting the edge of the drawing.
- **Pan & zoom** — drag the yard to explore, use the mouse wheel, double-click to zoom, or the
  +/−/Fit controls in the bottom right. Your manual zoom is preserved between layout resizes.
- **Scalable labels** — track names, switch labels, destinations and signals scale with each yard
  so text stays readable even when zoomed out on larger layouts.
- **Sidebar alert** — when the inbound queue is collapsed and there are urgent trains (holding or
  low patience), the expand button pulses amber with a small count badge to pull your attention.
- **Triple arrival rings** — when a train approaches the yard, the arrival notification flashes
  three times so you don't miss it in the heat of the shift.

## Presentation

- **Splash** — a three second logo splash fades in, runs a progress rail and hands over to station
  select automatically. The logo and title are larger on desktop for a stronger first impression.
- **Sound** — every control has a mechanical click, plus alerts for arriving trains, signals at
  danger, blocked roads, collisions and derailments. The mute button in the top bar silences both
  the panel and the audio. Audio unlocks on your first click or keypress, as browsers require.
- **Changelog** — the book button in station select, or the top bar in a shift, opens a single page
  of dated releases with everything added, changed and fixed.

## Layout

- `src/sim/yard.ts` builds and validates the track geometry for each station.
- `src/sim/graph.ts` turns the yard into a graph (turntables become live bridges).
- `src/sim/routing.ts` plans roads, point requirements, occupancy and conflicts.
- `src/sim/engine.ts` runs the simulation: movement, braking, dwell, repair, crashes, stats.
- `src/sim/useSimulation.ts` drives the engine on `requestAnimationFrame`.
- `src/audio/sfx.ts` owns the single `uisfx` player (mechanical pack) and maps log events to cues.
- `src/data/layouts.ts` holds the station definitions and specs.
- `src/data/changelog.ts` holds the release notes rendered by the changelog page.
- `src/components/` holds the dispatcher panel UI.