import {
    Navigate,
    Outlet,
  } from "react-router-dom";
  
  import useAuth from "../hooks/useAuth.js";
  
  const GuestRoute = () => {
    const {
      user,
      isLoading,
      getDashboardPath,
    } = useAuth();
  
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
          Loading Campus Connect...
        </div>
      );
    }
  
    if (user) {
      return (
        <Navigate
          to={getDashboardPath(user.role)}
          replace
        />
      );
    }
  
    return <Outlet />;
  };
  
  export default GuestRoute;