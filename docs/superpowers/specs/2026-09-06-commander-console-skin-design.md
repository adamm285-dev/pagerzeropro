# PagerZero commander console skin

Date: 2026-09-06  
Status: approved in conversation; awaiting spec review before implementation

## Goal

Keep every existing demo behavior. Restyle the client as a Midnight Commander–style ops console so judges see a 3am NOC, not a generic SaaS dashboard.

## Non-goals

- No new APIs, chaos scenarios, CALL-E flows, or WebSocket events
- No CRT scanline shaders, ASCII-art logos, or fake progress bars on every widget
- No server/worker changes unless a class rename is required for styling

## Visual language

- Background: near-black green (`#070905`)
- Idle text: phosphor green
- Alerts / ringing: amber
- Errors / reject: dull red
- Type: JetBrains Mono (already loaded); drop Plus Jakarta Sans as the UI face
- Chrome: 1px box borders, square corners, no gradients, no rounded pills
- Lucide icons may remain as small glyphs next to labels; they are not the visual identity

## Layout

```
[ status line: PAGERZERO · TTY-1 · quiet hours · live/sim ]
[ left: SERVICES pane          | right: INCIDENTS pane     ]
[ F1 Chaos  F2 Voice test  F5 Clear  F9 Mode  F10 Settings ]
```

- Remove the large marketing hero banner. Pitch copy stays in README / deck.
- Chaos scenarios attach to F1 (second strip or command menu), not a separate SaaS pill bar.
- Service cluster is a list/table (name, metric, OK / DEGRADED / RING).
- Incident stream is selectable rows, not a card stack.
- Post-mortem and settings are boxed dialogs in the same chrome.

## Voice (demo climax)

Centered commander dialog over a dimmed dual pane:

- Title: `INCOMING CALL`
- One-line incident brief
- Live transcript (existing speech / simulator)
- Actions: `[ APPROVED ] [ REJECT ] [ ESCALATE ]`

Same `voice-decision` API and recognition behavior as today.

## Functionality that must keep working

- WebSocket live updates
- Chaos triggers
- Voice simulator and live CALL-E mode toggle
- Approve / reject / escalate
- Post-mortem modal content
- On-call settings and API key save
- Clear resolved / clear all / delete incident

## Implementation shape

Restructure `client/src/App.tsx` layout and restyle existing components (`Navbar` → status line, `ChaosBar` → F-key menu, `ServiceClusterGrid`, `IncidentCard` as rows, `LiveVoiceDrawer` → modal, `PostMortemModal`, `SettingsModal`). Theme tokens live in `index.css` / Tailwind config. No backend edits.

## Success

A judge can run the same demo path (chaos → diagnose → auto-fix or voice approve) on `pagerzero.pro` with the commander look, without learning new controls beyond the F-key labels mapping to existing buttons.
