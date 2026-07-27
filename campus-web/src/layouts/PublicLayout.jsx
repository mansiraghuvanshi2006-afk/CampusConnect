import { Outlet } from "react-router-dom";

import PublicHeader from "../components/common/PublicHeader.jsx";
import PublicFooter from "../components/common/PublicFooter.jsx";

const PublicLayout = () => {
  return (
    <div className="flex min-h-screen flex-col text-white">
      <PublicHeader />

      <main className="flex-1">
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
};

export default PublicLayout;