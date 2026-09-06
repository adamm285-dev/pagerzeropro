# Commander Console Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the PagerZero client as a Midnight Commander dual-pane ops console without changing APIs, WebSocket events, chaos scenarios, or CALL-E / voice-simulator behavior.

**Architecture:** Theme tokens in Tailwind + `index.css`. `App.tsx` becomes a three-row shell (status line, dual pane, F-key bar). Existing components keep their props and handlers; only markup/classes change. Voice drawer becomes a centered dialog over a dimmed pane.

**Tech Stack:** React, Vite, Tailwind CSS, existing Express/WebSocket backend (untouched).

---

## File map

| File | Role |
| :--- | :--- |
| `client/index.html` | Mono font only; body classes |
| `client/tailwind.config.js` | Phosphor / amber / crt colors, JetBrains Mono as `font.sans` and `font.mono` |
| `client/src/index.css` | Base body, selection, scrollbar, pane utilities |
| `client/src/App.tsx` | Dual-pane shell; drop hero; F-key bar hosts chaos + clear + mode + settings |
| `client/src/components/Navbar.tsx` | Status line |
| `client/src/components/ChaosBar.tsx` | F1 expandable chaos menu |
| `client/src/components/ServiceClusterGrid.tsx` | Left pane table |
| `client/src/components/IncidentCard.tsx` | Incident row (expandable) |
| `client/src/components/LiveVoiceDrawer.tsx` | Centered `INCOMING CALL` dialog |
| `client/src/components/PostMortemModal.tsx` | Boxed dialog chrome |
| `client/src/components/SettingsModal.tsx` | Boxed dialog chrome |

Do not edit `server/**`, `worker/**`, or API routes.

Shared class tokens (use these strings everywhere):

```
pane:   "border border-crt-line bg-crt-panel text-phosphor font-mono"
status: "h-8 px-3 flex items-center justify-between border-b border-crt-line bg-crt-bar text-phosphor text-xs font-mono tracking-wide"
fkey:   "h-8 px-3 flex items-center gap-4 border-t border-crt-line bg-crt-bar text-phosphor-dim text-xs font-mono"
btn:    "border border-phosphor-dim px-2 py-0.5 text-phosphor hover:bg-phosphor/10 uppercase"
btn-am: "border border-amber-term px-2 py-0.5 text-amber-term hover:bg-amber-term/10 uppercase"
btn-rd: "border border-red-term px-2 py-0.5 text-red-term hover:bg-red-term/10 uppercase"
```

---

### Task 1: Theme tokens and document chrome

**Files:**
- Modify: `client/tailwind.config.js`
- Modify: `client/src/index.css`
- Modify: `client/index.html`

- [ ] **Step 1: Replace Tailwind theme extend**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        crt: { bg: "#070905", panel: "#0c1008", bar: "#0a0e07", line: "#4a6a28" },
        phosphor: { DEFAULT: "#b8e06a", dim: "#7a9a4a", bright: "#9adf4a" },
        "amber-term": "#ffbf3c",
        "red-term": "#ff8888",
      },
      fontFamily: {
        sans: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: { none: "0px" },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Replace `index.css` base**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #070905;
    color: #b8e06a;
    font-family: "JetBrains Mono", ui-monospace, monospace;
  }
}

@keyframes ring-pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 191, 60, 0.6); }
  70% { box-shadow: 0 0 0 12px rgba(255, 191, 60, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 191, 60, 0); }
}

.animate-ring {
  animation: ring-pulse 1.8s infinite;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #070905; }
::-webkit-scrollbar-thumb { background: #4a6a28; }
::-webkit-scrollbar-thumb:hover { background: #7a9a4a; }
```

- [ ] **Step 3: Fonts and body in `client/index.html`**

Keep OG tags. Change Google Fonts href to JetBrains Mono only. Change body class to:

```html
<body class="bg-crt-bg text-phosphor font-mono antialiased selection:bg-phosphor/20 selection:text-phosphor-bright">
```

- [ ] **Step 4: Build client to confirm CSS compiles**

```powershell
cd C:\Users\adamm_000\desktop\pagerzero
npm --prefix client run build
```

Expected: Vite build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add client/tailwind.config.js client/src/index.css client/index.html
git commit -m "style: commander phosphor theme tokens"
```

---

### Task 2: Status line (Navbar)

**Files:**
- Modify: `client/src/components/Navbar.tsx`

- [ ] **Step 1: Rewrite Navbar as a single status line**

Keep props: `config`, `services`, `onOpenSettings`, `onToggleMode`.

Layout (one `header` row, `h-8`, no logo blob):

Left: `PAGERZERO · TTY-1 · CALL-E`  
Right: quiet hours if enabled (`QUIET {start}–{end}`), cluster state (`ALL OK` / `DEGRADED` / `CRITICAL` from existing `hasCritical` / `hasDegraded`), `● LIVE` / `○ LINK` is **not** here yet — `wsConnected` stays on App until Task 5 passes it, or add optional `wsConnected?: boolean` prop now:

Add prop `wsConnected: boolean`.

Mode and settings buttons move to F-key bar in Task 5. Navbar only displays status; **remove** the mode and settings buttons from Navbar (App will call those from F-keys). So drop `onOpenSettings` and `onToggleMode` from Navbar.

New props:

```ts
interface NavbarProps {
  config: OnCallConfig;
  services: ServiceHealth[];
  wsConnected: boolean;
}
```

Update App in the same commit to stop passing the removed callbacks and pass `wsConnected`. Temporarily leave settings/mode only in the old places until Task 5 — **do not** leave the app without settings/mode. Until F-key bar exists, keep a tiny `[F9]` `[F10]` text buttons on the status line that still call `onToggleMode` / `onOpenSettings`, then Task 5 moves them.

Safer: keep `onOpenSettings` and `onToggleMode` on Navbar as text links `[F9 MODE]` `[F10 CFG]` on the right of the status line. Task 5 duplicates them on the F-key bar; then remove from Navbar if redundant. Spec wants F-keys on the bottom, so Task 5 removes them from Navbar.

For this task: status line + keep `[F9]` `[F10]` on the right so nothing is stranded.

- [ ] **Step 2: Confirm TypeScript**

```powershell
npx --prefix client tsc -p client/tsconfig.json --noEmit
```

If that script is missing, `npm --prefix client run build`.

- [ ] **Step 3: Commit**

```powershell
git add client/src/components/Navbar.tsx client/src/App.tsx
git commit -m "style: commander status line"
```

---

### Task 3: Services pane as a table

**Files:**
- Modify: `client/src/components/ServiceClusterGrid.tsx`

- [ ] **Step 1: Replace card grid with a boxed table**

Outer: `border border-crt-line bg-crt-panel h-full flex flex-col overflow-hidden`  
Header: `px-2 py-1 border-b border-crt-line text-phosphor-dim` text `SERVICES`  
Body: one row per service: `id` padded, primary metric (prefer `diskUsagePercent`, else `memoryPercent`, else `cpuPercent`), status word:

- healthy → `OK` (`text-phosphor-bright`)
- degraded → `DEGRADED` (`text-amber-term`)
- critical → `RING` (`text-amber-term` + `animate-pulse`) if any incident is awaiting voice, else `CRIT` (`text-red-term`)

Keep showing latency and error rate as extra columns if space: `LAT` `ERR%`.

No rounded cards, no Lucide `Server` hero box.

- [ ] **Step 2: Build**

```powershell
npm --prefix client run build
```

- [ ] **Step 3: Commit**

```powershell
git add client/src/components/ServiceClusterGrid.tsx
git commit -m "style: commander services table pane"
```

---

### Task 4: Incident rows

**Files:**
- Modify: `client/src/components/IncidentCard.tsx`

- [ ] **Step 1: Restyle as a boxed row, not a SaaS card**

Collapsed row: `INC-{short id}` `T{1|2|3}` `title` `STATUS`  
Status labels (plain text, not pills):

| status | label |
| :--- | :--- |
| RESOLVED | RESOLVED |
| AWAITING_VOICE_APPROVAL | AWAITING VOICE |
| AUTO_REMEDIATING | AUTO-FIX |
| INVESTIGATING | DIAGNOSING |
| EXECUTING_REMEDIATION | EXECUTING |
| ESCALATED | ESCALATED |
| default | FIRING |

Expand still shows diagnosis, recommended action, and the same buttons: open voice, open post-mortem, dismiss. Buttons use `[ VOICE ]` `[ POSTMORTEM ]` `[ X ]` bordered text, not rounded pills.

Awaiting-voice row: `border-amber-term text-amber-term`.

Keep all handlers and `expanded` state.

- [ ] **Step 2: Build**

```powershell
npm --prefix client run build
```

- [ ] **Step 3: Commit**

```powershell
git add client/src/components/IncidentCard.tsx
git commit -m "style: commander incident rows"
```

---

### Task 5: Dual-pane App shell and F-key bar

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/ChaosBar.tsx`

- [ ] **Step 1: ChaosBar becomes an F1 menu strip**

When collapsed, ChaosBar renders nothing visible (App shows `F1 Chaos` which toggles `chaosOpen` state in App) **or** ChaosBar owns expand state and App always renders it in the F-key row.

Preferred: App state `chaosMenuOpen`. ChaosBar props:

```ts
interface ChaosBarProps {
  onTriggerChaos: (scenario: string) => Promise<void>;
  open: boolean;
}
```

If `open`, render a second strip above the F-key bar listing the same five scenarios as `[ disk_full ]` `[ db_pool ]` etc. Same `handleTrigger` / `loadingScenario`. No emoji tags; use `T1` / `T2` prefixes.

- [ ] **Step 2: Rewrite App layout**

Remove hero banner and footer marketing block (optional one-line footer: `PAGERZERO · CALL-E`).

Structure:

```tsx
<div className="h-screen bg-crt-bg text-phosphor font-mono flex flex-col overflow-hidden">
  <Navbar config={config} services={services} wsConnected={wsConnected} onOpenSettings={...} onToggleMode={...} />
  {chaosMenuOpen && <ChaosBar open onTriggerChaos={handleTriggerChaos} />}
  <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 p-1 min-h-0">
    <ServiceClusterGrid services={services} />
    <section className="border border-crt-line bg-crt-panel flex flex-col min-h-0 overflow-hidden">
      <div className="px-2 py-1 border-b border-crt-line text-phosphor-dim text-xs">
        INCIDENTS  {activeIncidents.length} active / {incidents.length} total
      </div>
      <div className="flex-1 overflow-auto">
        {incidents.length === 0 ? (
          <div className="p-4 text-phosphor-dim text-xs">
            NO INCIDENTS. F1 CHAOS TO INJECT.
          </div>
        ) : (
          <>
            {activeIncidents.map(...IncidentCard...)}
            {resolvedIncidents.map(...IncidentCard...)}
          </>
        )}
      </div>
    </section>
  </main>
  <nav className="h-8 px-3 flex items-center gap-4 border-t border-crt-line bg-crt-bar text-xs font-mono text-phosphor-dim">
    <button type="button" onClick={() => setChaosMenuOpen((v) => !v)}>F1 Chaos</button>
    <button type="button" onClick={() => handleTriggerChaos('db_pool_exhaustion')}>F2 Voice test</button>
    <button type="button" onClick={() => handleClearIncidents('resolved')}>F5 Clear resolved</button>
    <button type="button" onClick={() => handleClearIncidents('all')}>F5+ Clear all</button>
    <button type="button" onClick={handleToggleMode}>F9 {config.callMode === 'calle_live' ? 'LIVE' : 'SIM'}</button>
    <button type="button" onClick={() => setIsSettingsOpen(true)}>F10 Settings</button>
  </nav>
  {/* existing LiveVoiceDrawer, PostMortemModal, SettingsModal */}
</div>
```

Wire real `keydown` for F1, F2, F9, F10 (prevent browser help on F1). F5: if shift, clear all, else clear resolved.

Pass `wsConnected` into Navbar.

- [ ] **Step 3: Build and run existing tests**

```powershell
npm --prefix client run build
npm test
```

Expected: client build OK; vitest server tests still pass.

- [ ] **Step 4: Commit**

```powershell
git add client/src/App.tsx client/src/components/ChaosBar.tsx client/src/components/Navbar.tsx
git commit -m "feat: dual-pane commander shell and F-key bar"
```

---

### Task 6: Incoming-call modal

**Files:**
- Modify: `client/src/components/LiveVoiceDrawer.tsx`

- [ ] **Step 1: Keep all speech/recognition/submit logic; restyle shell**

Overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/70`  
Dialog: `w-full max-w-lg border-2 border-amber-term bg-crt-panel p-4 text-amber-term font-mono shadow-[0_0_40px_rgba(255,191,60,0.2)]`

Header centered: `INCOMING CALL`  
Subhead: `{service} — {actionName}`  
Transcript as pre-wrapped lines `agent>` / `you>`  
Actions: `[ APPROVED ]` `[ REJECT ]` `[ ESCALATE ]` calling existing `submit(...)`.  
Keep listen toggle as `[ MIC ]`.  
Close control `[ ESC ]` calling `onClose`.

Do not change `speak`, recognition, or `handleSpokenDecision`.

- [ ] **Step 2: Build**

```powershell
npm --prefix client run build
```

- [ ] **Step 3: Commit**

```powershell
git add client/src/components/LiveVoiceDrawer.tsx
git commit -m "style: commander incoming-call dialog"
```

---

### Task 7: Settings and post-mortem dialogs

**Files:**
- Modify: `client/src/components/SettingsModal.tsx`
- Modify: `client/src/components/PostMortemModal.tsx`

- [ ] **Step 1: Same overlay pattern as voice dialog, phosphor borders (`border-crt-line`), square, mono inputs (`bg-crt-bg border border-crt-line`). Keep all fields and save handlers.**

- [ ] **Step 2: Build + tests**

```powershell
npm --prefix client run build
npm test
```

- [ ] **Step 3: Commit**

```powershell
git add client/src/components/SettingsModal.tsx client/src/components/PostMortemModal.tsx
git commit -m "style: commander settings and post-mortem dialogs"
```

---

### Task 8: Demo verification and deploy

- [ ] **Step 1: Manual path (local `npm run dev` or production after build)**

1. Load app: dual pane, green phosphor, no hero banner.
2. F1 opens chaos scenarios; trigger `disk_full` → Tier 1 auto-fix incident appears in right pane; left service metrics update.
3. F2 / `db_pool_exhaustion` → incoming-call modal; Approve still posts `/api/incidents/:id/voice-decision`.
4. F9 toggles SIM/LIVE; F10 opens settings; save still hits `/api/incidents/config/oncall`.
5. F5 clears resolved.

- [ ] **Step 2: Production**

```powershell
cd C:\Users\adamm_000\desktop\pagerzero
npm run build
npx wrangler deploy
```

Must run deploy **from the project directory**. Custom domains already attached.

- [ ] **Step 3: Commit any leftover class nits, then stop**

No README pitch rewrite unless a screenshot caption is wrong.

---

## Spec coverage

| Spec item | Task |
| :--- | :--- |
| Phosphor / amber / mono / square chrome | 1 |
| Status line | 2 |
| Dual pane services / incidents | 3, 4, 5 |
| Drop hero | 5 |
| F-key bar + chaos on F1 | 5 |
| Incoming-call modal | 6 |
| Settings / post-mortem boxed | 7 |
| Functionality unchanged | all (no server edits) |
| Demo path | 8 |
