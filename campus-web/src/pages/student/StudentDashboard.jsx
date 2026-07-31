import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getConversations } from "../../services/chatService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  formatConversationTime,
  getConversationTitle,
} from "../../utils/chatHelpers.js";

const StudentDashboard = () => {
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

  const recentConversations = useMemo(
    () => conversations.slice(0, 5),
    [conversations]
  );

  const departmentLabel =
    user?.department?.name || "Not set";

  const yearLabel =
    user?.year != null ? `Year ${user.year}` : "Not set";

  const profileStatus = user?.profileCompleted
    ? "Complete"
    : "Incomplete";

  const cards = [
    {
      title: "Department",
      value: departmentLabel,
      description: "Your academic department",
      numeric: false,
    },
    {
      title: "Academic year",
      value: yearLabel,
      description: "Your current year of study",
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
      title: "Profile status",
      value: profileStatus,
      description: "Campus profile completion",
      numeric: false,
    },
  ];

  return (
    <DashboardLayout
      title="Student Dashboard"
      description={`Welcome back, ${user?.name || "Student"}.`}
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-white/10 bg-[#2b2d31] p-6 shadow-lg shadow-black/10"
          >
            <p className="text-sm font-semibold text-purple-300">
              {card.title}
            </p>

            <h2
              className={`mt-3 font-bold ${
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

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Recent conversations</h2>
          <Link
            to="/student/chat"
            className="text-sm font-semibold text-purple-300 hover:text-purple-200"
          >
            Open chat
          </Link>
        </div>

        {loadingChats && (
          <p className="mt-4 text-sm text-[#b5bac1]">Loading chats…</p>
        )}

        {!loadingChats && chatError && (
          <p className="mt-4 text-sm text-red-300">{chatError}</p>
        )}

        {!loadingChats && !chatError && recentConversations.length === 0 && (
          <p className="mt-4 text-sm text-[#b5bac1]">
            No conversations yet. Start chatting with classmates and
            teachers.
          </p>
        )}

        {!loadingChats && recentConversations.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5">
            {recentConversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  to={`/student/chat/${conversation.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {getConversationTitle(conversation)}
                    </p>
                    <p className="truncate text-xs text-[#b5bac1]">
                      {conversation.lastMessage?.text ||
                        "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#949ba4]">
                    {formatConversationTime(conversation.lastMessageAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#2b2d31] p-6">
        <h2 className="text-xl font-bold">Account information</h2>

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
              Account status
            </p>
            <p className="mt-2 font-semibold text-green-300">Active</p>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
};

export default StudentDashboard;
