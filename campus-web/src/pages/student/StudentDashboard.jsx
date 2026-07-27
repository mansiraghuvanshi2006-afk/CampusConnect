import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const StudentDashboard = () => {
  const {
    user,
  } = useAuth();

  const cards = [
    {
      title: "Courses",
      value: "0",
      description:
        "Your enrolled courses will appear here.",
    },
    {
      title: "Assignments",
      value: "0",
      description:
        "Your pending assignments will appear here.",
    },
    {
      title: "Announcements",
      value: "0",
      description:
        "Recent campus announcements will appear here.",
    },
  ];

  return (
    <DashboardLayout
      title="Student Dashboard"
      description={`Welcome back, ${
        user?.name || "Student"
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
        <h2 className="text-xl font-bold">
          Account information
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              Account status
            </p>

            <p className="mt-2 font-semibold text-green-300">
              Active
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default StudentDashboard;