import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useRoomData } from "./hooks/useRoomData";
import JoinPage from "./pages/JoinPage";
import SuggestionsPage from "./pages/SuggestionsPage";
import SchedulePage from "./pages/SchedulePage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

export type RoomData = ReturnType<typeof useRoomData>;

function IconUtensils() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const NAV = [
  { to: "/suggestions", label: "Suggestions", icon: <IconUtensils /> },
  { to: "/schedule", label: "Schedule", icon: <IconCalendar /> },
  { to: "/history", label: "History", icon: <IconClock /> },
  { to: "/settings", label: "Settings", icon: <IconGear /> },
];

export default function App() {
  const data = useRoomData();

  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!data.joined) {
    return (
      <div className="mx-auto h-full max-w-xl">
        <Routes>
          <Route path="/join/:code" element={<JoinPage data={data} />} />
          <Route path="*" element={<JoinPage data={data} />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-brand">Restaurant Planner</h1>
          <p className="text-xs text-slate-500">
            {data.room ? data.room.room_name : "Loading…"}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/suggestions" element={<SuggestionsPage data={data} />} />
          <Route path="/schedule" element={<SchedulePage data={data} />} />
          <Route path="/history" element={<HistoryPage data={data} />} />
          <Route path="/settings" element={<SettingsPage data={data} />} />
          <Route path="*" element={<Navigate to="/suggestions" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-xl border-t border-slate-200 bg-white">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors duration-150 active:scale-[0.97] ${
                isActive ? "text-brand" : "text-slate-400 pointer-fine:hover:text-slate-600"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
