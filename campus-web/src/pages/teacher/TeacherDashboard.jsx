import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const TeacherDashboard = () => {
  const {
    user,
  } = useAuth();

  const cards = [
    {
      title: "Courses",
      value: "0",
      description:
        "Your teaching courses will appear here.",
    },
    {
      title: "Assignments",
      value: "0",
      description:
        "Assignments created by you will appear here.",
    },
    {
      title: "Students",
      value: "0",
      description:
        "Students enrolled in your courses will appear here.",
    },
  ];

  return (
    <DashboardLayout
      title="Teacher Dashboard"
      description={`Welcome back, ${
        user?.name || "Teacher"
      }.`}
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-lg shadow-black/10"
          >
            <p className="text-sm font-semibold text-purple-300">
              {card.title}
            </p>

            <h2 className="mt-3 text-4xl font-bold">
              {card.value}
            </h2>

            <p className="mt-3 text-sm text-[#b5bac1]">
              {card.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Teacher account
            </h2>

            <p className="mt-2 text-sm text-[#b5bac1]">
              Your teacher account has been approved.
            </p>
          </div>

          <span className="w-fit rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300">
            Approved
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Name
            </p>

            <p className="mt-2 font-semibold">
              {user?.name || "Not available"}
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Email
            </p>

            <p className="mt-2 break-all font-semibold">
              {user?.email ||
                "Not available"}
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Role
            </p>

            <p className="mt-2 font-semibold capitalize">
              {user?.role ||
                "Not available"}
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Approval status
            </p>

            <p className="mt-2 font-semibold capitalize text-green-300">
              {user?.teacherApprovalStatus ||
                "approved"}
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default TeacherDashboard;