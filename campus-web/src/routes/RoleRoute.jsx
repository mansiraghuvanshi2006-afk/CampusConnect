import {
    Navigate,
    useLocation,
  } from "react-router-dom";
  
  import { useAuth } from "../context/AuthContext.jsx";
  
  const getLoginPath = (pathname) => {
    if (pathname.startsWith("/admin")) {
      return "/admin/login";
    }
  
    return "/login";
  };
  
  const getDashboardPath = (role) => {
    switch (role) {
      case "admin":
        return "/admin/dashboard";
  
      case "teacher":
        return "/teacher/dashboard";
  
      case "student":
        return "/student/dashboard";
  
      default:
        return "/";
    }
  };
  
  const RoleRoute = ({
    children,
    allowedRoles = [],
  }) => {
    const location = useLocation();
  
    const {
      user,
      isLoading,
    } = useAuth();
  
    if (isLoading) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#313338] px-4 text-white">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-purple-400" />
  
            <p className="mt-4 text-sm text-[#b5bac1]">
              Checking your account...
            </p>
          </div>
        </main>
      );
    }
  
    if (!user) {
      return (
        <Navigate
          to={getLoginPath(location.pathname)}
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
  
    return children;
  };
  
  export default RoleRoute;