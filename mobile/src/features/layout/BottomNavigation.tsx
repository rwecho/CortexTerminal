import {
  Activity,
  LayoutDashboard,
  Settings as SettingsIcon,
  Terminal as TermIcon,
} from "lucide-react";
import type { View } from "../app/appTypes";

type BottomNavigationProps = {
  activeView: View;
  onSelect: (view: View) => void | Promise<void>;
};

const tabs: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: "home", icon: LayoutDashboard, label: "概览" },
  { id: "terminal", icon: TermIcon, label: "终端" },
  { id: "audit", icon: Activity, label: "审计" },
  { id: "settings", icon: SettingsIcon, label: "设置" },
];

function isTabActive(activeView: View, tabId: View): boolean {
  if (tabId === "home" && activeView === "newSession") {
    return true;
  }

  if (tabId === "settings" && activeView === "workerAuth") {
    return true;
  }

  return activeView === tabId;
}

export function BottomNavigation({
  activeView,
  onSelect,
}: BottomNavigationProps) {
  return (
    <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 pb-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {tabs.map((tab) => {
          const active = isTabActive(activeView, tab.id);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                void onSelect(tab.id);
              }}
              className={`flex flex-col items-center gap-1 ${
                active ? "text-cyan-500" : "text-gray-600"
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[9px] font-bold uppercase">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
