# iOS Safari Tester

A standalone macOS desktop app for testing websites against iOS Safari quirks. It renders pages in WKWebView (the same WebKit engine as iOS Safari), spoofs an iOS user agent, and lets you toggle known iOS-specific bugs on the fly — without needing a device or simulator.

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey) ![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Real WebKit rendering** — uses WKWebView, the same engine as iOS Safari on macOS
- **iOS 18.3 user agent** — injected before any page JS runs, non-writable via `Object.defineProperty`
- **8 device profiles** — from iPhone SE to iPhone 16 Pro Max, with correct logical resolution, physical resolution, DPR, and safe area insets
- **Visual iPhone frame** — Dynamic Island, notch, or forehead/chin chrome depending on the selected device
- **8 bug simulation toggles** — inject/remove CSS overrides that replicate known iOS Safari issues
- **Persist preferences** — last URL, device, and active toggles are saved across restarts

---

## Requirements

- macOS 11+
- [Rust](https://rustup.rs/) (1.70+)
- Node.js 18+

---

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (hot-reload)
npm run dev

# Build a distributable .app
npm run build
```

---

## Device Profiles

| Device | CSS Resolution | DPR | Safe Area (top/bottom) | Frame Style |
|---|---|---|---|---|
| iPhone SE (3rd gen) | 375 × 667 | @2x | 20px / 0px | Forehead + chin |
| iPhone 12 mini | 360 × 780 | @3x | 50px / 34px | Notch |
| iPhone 14 | 390 × 844 | @3x | 47px / 34px | Notch |
| iPhone 14 Plus | 428 × 926 | @3x | 47px / 34px | Notch |
| iPhone 16 | 393 × 852 | @3x | 59px / 34px | Dynamic Island |
| iPhone 16 Pro | 402 × 874 | @3x | 59px / 34px | Dynamic Island |
| iPhone 16 Pro Max | 440 × 956 | @3x | 59px / 34px | Dynamic Island |
| iPhone Air | 420 × 932 | @3x | 59px / 34px | Dynamic Island |

Switching device updates the webview content area size, the frame chrome, the `devicePixelRatio` override, and (if active) the safe area inset values.

---

## Bug Simulation Toggles

| Toggle | What it injects |
|---|---|
| **100vh includes toolbar** | Reduces 100vh elements by ~84px via a CSS custom property |
| **No backdrop-filter** | `backdrop-filter: none !important` on all elements |
| **No overscroll** | `overscroll-behavior: auto !important` on all elements |
| **No gap in flex (iOS <14)** | `gap: 0 !important` — simulates iOS 13 flex gap bug |
| **No sticky in overflow** | Forces `position: sticky` to `relative` inside overflow containers |
| **Safe area insets** | Injects `env(safe-area-inset-*)` values matching the selected device |
| **No smooth scroll** | `scroll-behavior: auto !important` on all elements |
| **Disable hover states** | `@media (hover: none) { *:hover { all: revert; } }` — simulates touch-only input |

Toggles can be switched at any time. If a page is loaded, changes take effect immediately. The **Reload** button re-navigates and re-applies all active toggles after the page loads.

---

## Project Structure

```
src/                        # Frontend (vanilla HTML/JS/CSS)
  index.html                # App shell and iPhone frame DOM
  styles.css                # Theme, phone chrome, toggle chips
  app.js                    # Device/toggle logic, Tauri invoke calls

src-tauri/                  # Rust backend
  src/lib.rs                # Tauri commands + UA initialization script
  src/main.rs               # Entry point
  tauri.conf.json           # App config (window, bundle, permissions)
  capabilities/default.json # Tauri v2 permission grants
  Cargo.toml
```

---

## How It Works

**User agent spoofing** is done via an `initialization_script` that runs before any page JavaScript, using `Object.defineProperty` to make `navigator.userAgent` non-writable:

```js
Object.defineProperty(navigator, 'userAgent', {
  get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 ...) Safari/604.1',
  configurable: false
});
```

**Bug toggles** inject or remove `<style>` tags by ID into the live page via the Tauri `inject_css` / `remove_css` commands. No page reload is required.

**Persistence** uses `tauri-plugin-store` to save preferences to a local JSON file in the app's data directory.

---

## License

MIT
