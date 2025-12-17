import { Outlet, NavLink } from "react-router-dom";
import {
  Home, QrCode, Users, FileText, UserCog
} from "lucide-react";

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 bg-indigo-700 text-white p-4">
        <nav className="space-y-4">
          <NavItem to="/" icon={<Home />} label="Dashboard" />
          <NavItem to="/scan" icon={<QrCode />} label="Scanner" />
          <NavItem to="/employees" icon={<Users />} label="Employés" />
          <NavItem to="/reports" icon={<FileText />} label="Rapports" />
          <NavItem to="/users" icon={<UserCog />} label="Utilisateurs" />
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 w-full md:hidden bg-white shadow flex justify-around py-2">
        <NavItem to="/" icon={<Home />} />
        <NavItem to="/scan" icon={<QrCode />} />
        <NavItem to="/employees" icon={<Users />} />
      </nav>

      <main className="flex-1 p-4 pb-16 md:pb-4 bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className="flex items-center gap-2 p-2 rounded hover:bg-indigo-600"
    >
      {icon}
      {label && <span>{label}</span>}
    </NavLink>
  );
}
