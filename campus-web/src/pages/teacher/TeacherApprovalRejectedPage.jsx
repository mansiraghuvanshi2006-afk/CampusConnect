import {
    useNavigate,
  } from "react-router-dom";
  
  import toast from "react-hot-toast";
  
  import useAuth from "../../hooks/useAuth.js";
  
  const TeacherApprovalRejectedPage = () => {
    const navigate = useNavigate();
  
    const {
      user,
      logout,
    } = useAuth();
  
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
        <section className="w-full max-w-xl rounded-2xl border border-red-400/20 bg-[#1e1f22] p-6 text-center shadow-2xl sm:p-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-4xl">
            ✕
          </div>
  
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-red-400">
            Approval rejected
          </p>
  
          <h1 className="text-3xl font-bold">
            Your teacher profile was rejected
          </h1>
  
          <p className="mt-4 leading-7 text-white/60">
            The administrator did not approve
            your teacher account.
          </p>
  
          <div className="mt-6 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-left">
            <p className="text-sm font-medium text-red-300">
              Rejection reason
            </p>
  
            <p className="mt-2 text-sm leading-6 text-white/70">
              {user?.teacherRejectionReason ||
                "No rejection reason was provided."}
            </p>
          </div>
  
          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl bg-red-600 px-4 py-3 font-semibold transition hover:bg-red-500"
          >
            Log out
          </button>
        </section>
      </main>
    );
  };
  
  export default TeacherApprovalRejectedPage;