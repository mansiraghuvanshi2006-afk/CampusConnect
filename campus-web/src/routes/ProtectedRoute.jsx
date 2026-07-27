import {
    Navigate,
    Outlet,
    useLocation,
  } from "react-router-dom";
  
  import useAuth from "../hooks/useAuth.js";
  
  const ProtectedRoute = ({
    allowedRoles = [],
  }) => {
    const {
      user,
      isLoading,
      isAuthenticated,
      getDashboardPath,
    } = useAuth();
  
    const location = useLocation();
  
    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
          Loading Campus Connect...
        </div>
      );
    }
  
    if (!isAuthenticated) {
      return (
        <Navigate
          to="/login"
          replace
          state={{
            from: location.pathname,
          }}
        />
      );
    }
  
    if (
      allowedRoles.length > 0 &&
      !allowedRoles.includes(user.role)
    ) {
      return (
        <Navigate
          to={getDashboardPath(user.role)}
          replace
        />
      );
    }
  
    return <Outlet />;
  };
  
  export default ProtectedRoute;