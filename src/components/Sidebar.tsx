import {
  AppWindow,
  Binary,
  LayoutDashboard,
  Monitor,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import type { PageKey } from "./Layout";
import logoColor from "../assets/dev_clean_color.png";
import { detectRendererOsFamily } from "../app/platform";

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const Sidebar = ({ activePage, onNavigate }: SidebarProps) => {
  const platform = detectRendererOsFamily();
  const maintenanceLabel = platform === "macos" ? "Mac Cleaner" : "System Cleaner";

  return (
    <aside
      className="fixed left-0 top-0 flex h-screen w-64 flex-col gap-2 border-r border-slate-800 bg-slate-950/70 p-6"
      style={{ paddingTop: "calc(var(--titlebar-height) + 4px)" }}
    >
      <div className="flex items-center gap-1.5">
        <img
          src={logoColor}
          alt="Dev Cleaner logo"
          className="h-20 w-20 object-contain"
        />
        <div>
          <p className="text-sm font-semibold uppercase  text-white">
            Dev Cleaner
          </p>
          <p className="mt-1 text-xs text-slate-300">Workspace Assistant</p>
        </div>
      </div>
      <nav className="flex flex-col gap-2 text-sm">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "dashboard"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard size={16} />
            Dashboard
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("general-scan")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "general-scan"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Binary size={16} />
            General Scan
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("system")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "system"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Monitor size={16} />
            System
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("mac-cleaner")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "mac-cleaner"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Sparkles size={16} />
            {maintenanceLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("cleanup")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "cleanup"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Trash2 size={16} />
            Cleanup Preview
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("applications")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "applications"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <AppWindow size={16} />
            Applications
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("devtools")}
          className={`rounded-lg border px-3 py-2 text-left font-medium ${
            activePage === "devtools"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Wrench size={16} />
            Dev Tools
          </span>
        </button>
      </nav>
      <div className="mt-auto">
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium ${
            activePage === "settings"
              ? "border-slate-800 bg-slate-900/60 text-slate-100"
              : "border-transparent text-muted hover:border-slate-800 hover:bg-slate-900/40"
          }`}
        >
          <span className="flex items-center gap-2">
            <Settings size={16} />
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
