import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <AppSidebar />
      <main className="ml-[220px] min-h-screen flex-1 p-7">
        <Outlet />
      </main>
    </div>
  );
}
