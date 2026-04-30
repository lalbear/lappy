# Lappy

Lappy is a floating desktop AI assistant built with Electron + Vite.

It runs as an always-on-top overlay on your computer, with a compact floating icon that can expand into tools and chat.

## What This App Does

- Shows a floating assistant icon on top of other apps.
- Supports quick actions from the icon (chat, screenshot, lasso, settings).
- Captures full-screen screenshots and sends them to a vision-capable AI flow.
- Opens chat sidebar for follow-up questions on captured content.
- Supports provider/model selection (OpenRouter and Grok) with API key configuration.

## How It Works

### Architecture

- **Electron Main Process** (`electron/main.js`)
  - Creates the transparent floating window.
  - Manages always-on-top behavior.
  - Handles native screen capture via `desktopCapturer`.
  - Launches lasso overlay window for area selection.
  - Exposes IPC handlers for resize/move/capture/lasso actions.

- **Preload Bridge** (`electron/preload.js`)
  - Exposes a safe `window.lappyAPI` interface to the renderer.
  - Provides methods like:
    - `captureScreen()`
    - `startLasso()`
    - `resizeWindow()`
    - `moveWindowBy()`
    - `onLassoResult(...)`

- **Renderer UI** (`src/main.js`, `src/style.css`, `index.html`)
  - Controls floating icon interactions (hold, double-click, tool actions).
  - Opens sidebar chat and settings flows.
  - Sends prompts + optional images to AI providers.
  - Stores local config in `localStorage`.

### AI Request Flow

1. User triggers screenshot or lasso.
2. Image is captured and added to chat context.
3. Renderer sends prompt + image payload to provider API.
4. Assistant response is shown in sidebar chat.

## Run Locally

Install dependencies:

```bash
npm install
```

Start desktop mode (Vite + Electron):

```bash
npm run dev
```

Optional web-only mode:

```bash
npm run dev:web
```

Build frontend bundle:

```bash
npm run build
```

Package desktop app:

```bash
npm run pack
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set at least:

- `VITE_OPENROUTER_API_KEY=...`
- `VITE_FREE_MODE_ENABLED=true|false`

## Current UX Model

- Compact floating icon by default.
- Hold icon to reveal quick tools.
- Double-click icon to open larger chat panel.
- Sidebar/settings resize the native window so content is fully visible.

## Tech Stack

- Electron
- Vite
- Vanilla JavaScript
- CSS (custom design system)

