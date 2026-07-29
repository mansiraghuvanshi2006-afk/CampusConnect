import { useEffect, useState } from "react";

import { FiBell } from "react-icons/fi";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/chatService.js";
import { formatConversationTime } from "../../utils/chatHelpers.js";

const NotificationCenter = ({
  socket,
  unreadCount,
  setUnreadCount,
  onOpenConversation,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    try {
      const result = await listNotifications({ limit: 30 });
      setItems(result.notifications || []);
      setUnreadCount?.(result.unreadCount || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const onNew = (payload) => {
      if (!payload?.notification) {
        return;
      }

      setItems((previous) => [
        payload.notification,
        ...previous.filter(
          (item) => item.id !== payload.notification.id
        ),
      ]);
      setUnreadCount?.((previous) => (previous || 0) + 1);
    };

    const onAllRead = () => {
      setItems((previous) =>
        previous.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
      setUnreadCount?.(0);
    };

    socket.on("notification:new", onNew);
    socket.on("notification:all-read", onAllRead);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:all-read", onAllRead);
    };
  }, [socket, setUnreadCount]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((previous) => !previous);

          if (!open) {
            load();
          }
        }}
        className="relative rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
      >
        <FiBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#1e1f22] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="text-sm font-semibold text-white">
              Notifications
            </p>
            <button
              type="button"
              className="text-xs text-purple-300"
              onClick={async () => {
                await markAllNotificationsRead();
                setItems((previous) =>
                  previous.map((item) => ({ ...item, isRead: true }))
                );
                setUnreadCount?.(0);
              }}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-3 py-6 text-center text-xs text-[#b5bac1]">
                Loading…
              </p>
            )}

            {!loading && items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[#b5bac1]">
                No notifications yet
              </p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={async () => {
                  if (!item.isRead) {
                    await markNotificationRead(item.id);
                    setItems((previous) =>
                      previous.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, isRead: true }
                          : entry
                      )
                    );
                    setUnreadCount?.((previous) =>
                      Math.max(0, (previous || 0) - 1)
                    );
                  }

                  if (item.conversationId) {
                    onOpenConversation?.(item.conversationId);
                    setOpen(false);
                  }
                }}
                className={`block w-full border-b border-white/5 px-3 py-2.5 text-left transition hover:bg-white/5 ${
                  item.isRead ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <span className="shrink-0 text-[10px] text-[#949ba4]">
                    {formatConversationTime(item.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#b5bac1]">
                  {item.body}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-purple-300">
                  {item.type}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
