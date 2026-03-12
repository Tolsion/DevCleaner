import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import type { PageHeaderProps } from "./PageHeader";
import ActivityOverlay from "./ActivityOverlay";
import ToastStack from "./ToastStack";

type PageKey =
  | "dashboard"
  | "system"
  | "cleanup"
  | "settings"
  | "devtools"
  | "mac-cleaner"
  | "applications";

interface LayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  header?: PageHeaderProps | null;
  children: ReactNode;
}

const Layout = ({ activePage, onNavigate, header, children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-canvas text-slate-100">
      <div className="min-h-screen">
        <div className="app-titlebar border-b border-slate-800">
          <div className="flex h-full items-center justify-center text-xs font-semibold tracking-[0.3em] text-slate-200">
            Dev Cleaner
          </div>
        </div>
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        {header ? <PageHeader {...header} /> : null}
        <main
          className="h-screen overflow-y-auto pl-64"
          style={{
            paddingTop: "calc(var(--titlebar-height) + var(--header-height))",
          }}
        >
          {children}
        </main>
        <ToastStack />
        <ActivityOverlay />
      </div>
    </div>
  );
};

export default Layout;
export type { PageKey };
