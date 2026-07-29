import {
    useNavigate,
  } from "react-router-dom";
  
  import toast from "react-hot-toast";
  
  import useAuth from "../../hooks/useAuth.js";
  
  const TeacherApprovalPendingPage = () => {
    const navigate = useNavigate();
  
    const {
      user,
      logout,
      refreshUser,
    } = useAuth();
  
    const handleRefreshStatus = async () => {
      try {
        if (
          typeof refreshUser ===
          "function"
        ) {
          const updatedUser =
            await refreshUser();
  
          if (
            updatedUser
              ?.teacherApprovalStatus ===
            "approved"
          ) {
            toast.success(
              "Your account has been approved"
            );
  
            navigate(
              "/teacher/dashboard",
              {
                replace: true,
              }
            );
  
            return;
          }
  
          if (
            updatedUser
              ?.teacherApprovalStatus ===
            "rejected"
          ) {
            navigate(
              "/teacher/approval-rejected",
              {
                replace: true,
              }
            );
  
            return;
          }
        }
  
        toast.success(
          "Approval status refreshed"
        );
      } catch {
        toast.error(
          "Unable to refresh approval status"
        );
      }
    };
  
    const handleLogout = async () => {
      try {
        if (
          typeof logout ===
          "function"
        ) {
          await logout();
        }
  
        navigate("/login", {
          replace: true,
        });
      } catch {
        toast.error(
          "Unable to log out"
        );
      }
    };
  
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#313338] px-4 py-10 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#1e1f22] p-6 text-center shadow-2xl sm:p-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-400/10 text-4xl">
            ⏳
          </div>
  
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-yellow-300">
            Approval pending
          </p>
  
          <h1 className="text-3xl font-bold">
            Your profile is under review
          </h1>
  
          <p className="mt-4 leading-7 text-white/60">
            Hello{" "}
            <span className="font-semibold text-white">
              {user?.name || "Teacher"}
            </span>
            . Your teacher profile has been
            submitted successfully and is
            waiting for administrator approval.
          </p>
  
          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-left">
            <p className="text-sm text-white/50">
              Current status
            </p>
  
            <p className="mt-1 font-semibold capitalize text-yellow-300">
              {user?.teacherApprovalStatus ||
                "pending"}
            </p>
          </div>
  
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRefreshStatus}
              className="flex-1 rounded-xl bg-purple-600 px-4 py-3 font-semibold transition hover:bg-purple-500"
            >
              Refresh status
            </button>
  
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold transition hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </section>
      </main>
    );
  };
  
  export default TeacherApprovalPendingPage;