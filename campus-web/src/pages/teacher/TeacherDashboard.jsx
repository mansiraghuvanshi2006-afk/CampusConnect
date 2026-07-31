import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getConversations } from "../../services/chatService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingChats(true);
      setChatError("");

      try {
        const list = await getConversations();
        if (!cancelled) {
          setConversations(list || []);
        }
      } catch (error) {
        if (!cancelled) {
          setChatError(
            getErrorMessage(error, "Unable to load chats")
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingChats(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const unreadChats = useMemo(
    () =>
      conversations.reduce(
        (sum, item) => sum + (item.unreadCount || 0),
        0
      ),
    [conversations]
  );

  const activeGroups = useMemo(
    () =>
      conversations.filter(
        (item) => item.type && item.type !== "direct"
      ).length,
    [conversations]
  );

  const departmentLabel =
    user?.department?.name || "Not set";

  const teachingYears = Array.isArray(user?.teachingYears)
    ? user.teachingYears
    : [];

  const teachingYearsLabel =
    teachingYears.length > 0
      ? teachingYears.map((year) => `Y${year}`).join(", ")
      : "Not set";

  const approvalStatus =
    user?.teacherApprovalStatus || "approved";

  const cards = [
    {
      title: "Department",
      value: departmentLabel,
      description: "Your teaching department",
      numeric: false,
    },
    {
      title: "Teaching years",
      value: teachingYearsLabel,
      description: "Years you currently teach",
      numeric: false,
    },
    {
      title: "Unread chats",
      value: String(unreadChats),
      description: loadingChats
        ? "Loading chat activity…"
        : "Unread messages across conversations",
      numeric: true,
    },
    {
      title: "Active chat groups",
      value: String(activeGroups),
      description: loadingChats
        ? "Loading groups…"
        : "Group conversations you belong to",
      numeric: true,
    },
    {
      title: "Approval status",
      value: String(approvalStatus),
      description: "Teacher account approval",
      numeric: false,
    },
  ];

  return (
    <DashboardLayout
      title="Teacher Dashboard"
      description={`Welcome back, ${user?.name || "Teacher"}.`}
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

            <h2
              className={`mt-3 font-bold capitalize ${
                card.numeric ? "text-4xl" : "text-xl"
              }`}
            >
              {card.value}
            </h2>

            <p className="mt-3 text-sm text-[#b5bac1]">
              {card.description}
            </p>
          </article>
        ))}
      </section>

      {chatError && (
        <p className="mt-4 text-sm text-red-300">{chatError}</p>
      )}

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Teacher account</h2>
            <p className="mt-2 text-sm text-[#b5bac1]">
              Your teacher account has been approved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold capitalize text-green-300">
              {approvalStatus}
            </span>
            <Link
              to="/teacher/chat"
              className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/20"
            >
              Open chat
            </Link>
          </div>
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
              {user?.email || "Not available"}
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Role
            </p>
            <p className="mt-2 font-semibold capitalize">
              {user?.role || "Not available"}
            </p>
          </div>

          <div className="rounded-xl bg-black/20 p-4">
            <p className="text-xs uppercase tracking-wide text-[#949ba4]">
              Approval status
            </p>
            <p className="mt-2 font-semibold capitalize text-green-300">
              {approvalStatus}
            </p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
