export interface ChangelogEntry {
  version: string;
  date: string;
  time: string;
  title: string;
  summary: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.4.0',
    date: '2026-10-01',
    time: '16:43',
    title: 'Map fixes and train control',
    summary: 'Trainteleports and track reversals eliminated, plus interactive trains and turntables.',
    added: [
      'Floating train details panel on map or queue selection with speed, consist, entry node, occupied edge, direction, route legs and hold timer',
      'Clickable turntables on the map opening a 45 degree snap dial with deck preview, current angle and movement state',
      'Confirmation dialog before leaving a shift, with cancel and end-shift actions',
      'Infinite canvas surface with the grid extending far past the yard bounds for unrestricted panning',
    ],
    changed: [
      'Turntables highlight in sky blue on the map when idle and dim while rotating',
      'Cancelled drags no longer swallow the next click, so map controls respond immediately after panning',
    ],
    fixed: [
      'Trains no longer jump or reverse direction mid-edge; curvature sampling across all 135 yard edges is now free of direction reversals',
      'Reverse running, run-round and back-off movements keep the correct orientation instead of teleporting across the layout',
      'Trains entering their final edge are no longer treated as already arrived, so arrivals complete at the right platform',
      'Deadlocked trains withdrawn to the entry signal no longer flip across the spawn road',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-01',
    time: '15:38',
    title: 'Presentation pass',
    summary: 'Map navigation, clearer station select and louder arrival alerts.',
    added: [
      'Three second logo splash with fade in, fade out and a progress rail before station select',
      'Splash screen scales up on desktop with a larger logo and title',
      'Mechanical sound pack for every control, plus arrival, signal and incident alerts',
      'Triple-ring arrival notification so incoming trains stand out',
      'One page changelog reachable from station select and the dispatcher top bar',
      'Logo used as the browser favicon',
      'Pan, wheel zoom, double-click zoom and +/−/Fit controls for the yard canvas',
    ],
    changed: [
      'Station select reworked to fit comfortably at 100% on 1920x1080 with shorter cards and bigger text',
      'Yard labels and markers scale with layout size to stay readable at all zoom levels',
      'Map zooming respects sidebar/HUD insets and prevents accidental train selection while dragging',
    ],
    fixed: [
      'Confirm dispatch now disappears once the road is accepted, instead of lingering as a dead button',
      'Sidebar expand button shows an amber pulse and count when urgent trains are waiting while collapsed',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-01',
    time: '13:05',
    title: 'Dispatcher console rewrite',
    summary: 'The interface was rebuilt around the live simulation snapshot instead of placeholder data.',
    added: [
      'Dynamic yard rendering with cars, headlights, smoke, signals and crash effects',
      'Inbound queue panel with destination picker and due-timers for the next movements',
      'Switch and turntable dock with point states, locks and rotation targets',
      'Top status bar with clock, speed control, all-stop and live score statistics',
      'Scrolling event log with severity colouring',
    ],
    changed: [
      'Route previews draw as animated dashed overlays with block and warning markers',
      'Snapshot reactivity fixed so the UI updates every frame instead of freezing on the first render',
    ],
    fixed: [],
  },
  {
    version: '0.1.0',
    date: '2026-10-01',
    time: '09:12',
    title: 'Simulation core',
    summary: 'Track graph, train physics, routing and scoring for the first playable shift.',
    added: [
      'Three layouts: Local Loop, Grand Junction and Freight Terminal',
      'Track graph with switches, turntable bridges, merge nodes and entry lanes',
      'Route requests: pass through, stop by, last stop and repair',
      'Train acceleration, braking curves, dwell, repair and run-round servicing',
      'On-time percentage, score, incident and collision tracking',
    ],
    changed: [
      'Schedule gaps widened to 150s, 165s and 200s so each yard is playable rather than instant',
    ],
    fixed: [
      'On-time scoring now measures dispatcher waiting time instead of raw dwell delay',
      'Turntable rotation rejects angles with no connecting track',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-10-01',
    time: '08:40',
    title: 'Project start',
    summary: 'Vite, React and Tailwind scaffold for the dispatcher simulator.',
    added: ['Project scaffold', 'Dark full-screen shell', 'Station select shell'],
    changed: [],
    fixed: [],
  },
];