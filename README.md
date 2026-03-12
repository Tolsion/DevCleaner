# Dev Cleaner

<p align="center">
  <img src="assets/dev_clean_color.png" width="140" alt="Dev Cleaner logo" />
</p>
<p align="center" style="font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: #94a3b8;">
  Dev Cleaner Desktop
</p>
<p align="center" style="font-size: 28px; font-weight: 700; margin-top: 6px;">
  Workspace Health Dashboard
</p>
<p align="center" style="font-size: 14px; color: #cbd5f5; max-width: 720px; margin: 8px auto 0;">
  Scan, visualize, and safely clean heavyweight artifacts across your developer workspaces — with system telemetry and a configurable menu bar widget.
</p>

<div align="center">
  <table>
    <tr>
      <td align="center">🧹<br/><strong>Scan</strong><br/><span>Multi‑root cleanup</span></td>
      <td align="center">📊<br/><strong>System</strong><br/><span>Telemetry & health</span></td>
      <td align="center">🧭<br/><strong>Menu Bar</strong><br/><span>Configurable widget</span></td>
      <td align="center">🧰<br/><strong>Mac Tools</strong><br/><span>Junk, large files, memory relief</span></td>
    </tr>
  </table>
</div>

## Table of Contents

- ✨ Features
- 🧭 Screens & Workflows
- 🧩 Menu Bar Widget
- ⏱️ Scheduled Scans
- 🔒 Data & Safety
- 🛠️ Tech Stack
- 🗂️ Project Structure
- 🧪 Development
- 📦 Build & Packaging
- 🧯 Troubleshooting
- 📄 License

## ✨ Features

- 🧹 **Workspace scanning**: Multi‑root scans for developer junk folders, grouped by root with per‑project totals and quick clean actions.
- 🧪 **Cleanup previews**: See sizes, paths, and folder counts before deleting; confirmation included and totals are persisted locally.
- 📊 **System telemetry**: CPU load, memory/swap/pageouts, disk I/O, network throughput, battery health, Wi‑Fi, Bluetooth, and open ports (where available).
- 🧭 **Menu bar widget**: Compact system snapshot with per‑section visibility toggles and a 3 GB junk warning.
- ⏱️ **Scheduled scans**: Configurable interval in Settings; runs while the app is open.
- 🧰 **Mac maintenance tools**: System junk scan, large file scan/delete, memory relief, and startup items list.
- 📦 **Applications (macOS)**: List installed apps, reveal in Finder, and uninstall (move to Trash).
- 🧩 **Developer tools inventory**: Detect installed tooling (Python, Node, Docker, Git, etc.).
- ⚙️ **Preferences**: Target selection by ecosystem, ignore list, menu bar configuration, and scheduled scans.

## 🧭 Screens & Workflows

- **Dashboard**: Workspace health summary, quick actions (Pick Folders, Start Scan), and a scan results preview.
- **Scan Results**: Sortable project list, root grouping with subtotals, and selective cleanup with confirmation.
- **System**: Telemetry cards, network interfaces, Wi‑Fi details, and battery health/power saving controls.
- **Mac Cleaner**: Junk categories with size/file count, large file scan/delete, memory relief, and startup items.
- **Applications**: Installed apps list with icons/metadata plus reveal/uninstall actions.
- **Settings**: Scan defaults, ignore list, scan schedule, menu bar visibility, and cleanup totals.

## 🧭 Menu Bar Widget

Configure which sections appear in **Settings → Menu Bar**:

- Disk usage
- Memory usage + swap pressure
- CPU load
- Battery status + power saving toggle
- Latest scan summary + quick scan button
- 3 GB warning banner

You can also toggle the entire widget visibility from the same section.

## ⏱️ Scheduled Scans

Scheduled scans run in the background while the app is open (including when the main window is hidden). Configure in **Settings → Scheduled Scans**.

## 🔒 Data & Safety

- All scan configuration and totals are stored locally.
- Cleanup uses a preview + confirmation step.
- Deletions can be configured to move to Trash (where supported).
- Only current‑user processes can be terminated in Memory Relief.

## 🛠️ Tech Stack

- **Electron** (main/renderer)
- **React 18** + **TypeScript**
- **Vite** + **electron‑vite**
- **Zustand** (state management)
- **Tailwind CSS**
- **Electron Builder** (packaging)

## ⬇️ Downloads

- macOS (Apple Silicon): [Download DMG](https://github.com/Tolsion/DevCleaner/releases/download/v0.1.5/Dev.Cleaner-0.1.5-arm64-apple-silicon.dmg)
- Windows (x64): [Download EXE](https://github.com/Tolsion/DevCleaner/releases/download/v0.1.5/Dev.Cleaner.0.1.5-win.exe)

## 🗂️ Project Structure

- `electron/main` – main process services, IPC handlers, scheduler
- `electron/preload` – secure API bridge
- `electron/shared` – shared types/constants/schemas
- `src/app` – global styles + app shell
- `src/features` – feature pages and widgets
- `src/store` – Zustand stores
- `assets` – app icons and artwork

## 🧪 Development

```bash
npm install
npm run dev
```

## 📦 Build & Packaging

```bash
# macOS (arm64)
npm run dist:mac

# Windows (x64)
npm run dist:win
```

## 🧯 Troubleshooting

- **Dock icon doesn’t appear in DMG**  
  Ensure `assets/dev_clean_color.icns` is valid and rebuild the DMG.

- **Menu bar widget doesn’t update**  
  Check Settings → Menu Bar and ensure the widget is enabled.

## 📄 License

Private. All rights reserved.
