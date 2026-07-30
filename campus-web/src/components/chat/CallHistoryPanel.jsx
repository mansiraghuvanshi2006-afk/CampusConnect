import { useEffect, useState } from "react";

import {
  FiLoader,
  FiPhone,
  FiPhoneIncoming,
  FiPhoneMissed,
  FiPhoneOutgoing,
  FiVideo,
  FiX,
} from "react-icons/fi";

import { listConversationCalls } from "../../services/chatService.js";
import getErrorMessage from "../../utils/getErrorMessage.js";

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = total % 60;

  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatWhen = (value) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusLabel = (status) => {
  switch (status) {
    case "missed":
      return "Missed";
    case "rejected":
      return "Rejected";
    case "busy":
      return "Busy";
    case "failed":
      return "Failed";
    case "ended":
      return "Completed";
    case "active":
      return "Active";
    case "ringing":
      return "Ringing";
    default:
      return status || "Unknown";
  }
};

const CallHistoryPanel = ({
  conversationId,
  currentUserId,
  onClose,
}) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await listConversationCalls(
          conversationId,
          { limit: 30 }
        );

        if (!cancelled) {
          setCalls(result.calls || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              loadError,
              "Unable to load call history"
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-white/10 bg-[#2b2d31]">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <FiPhone className="h-4 w-4 text-purple-300" />
          Call history
        </h3>

        <button
          type="button"
          aria-label="Close call history"
          onClick={onClose}
          className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
        >
          <FiX className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#b5bac1]">
            <FiLoader className="h-4 w-4 animate-spin" />
            Loading calls...
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && calls.length === 0 && (
          <p className="px-2 py-10 text-center text-sm text-[#b5bac1]">
            No calls in this conversation yet.
          </p>
        )}

        <ul className="space-y-2">
          {calls.map((call) => {
            const outgoing =
              call.caller?.id === currentUserId;
            const other =
              (call.participants || []).find(
                (participant) =>
                  participant.userId !== currentUserId
              )?.user || null;

            const Icon =
              call.status === "missed"
                ? FiPhoneMissed
                : outgoing
                  ? FiPhoneOutgoing
                  : FiPhoneIncoming;

            return (
              <li
                key={call.id}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 rounded-lg p-2 ${
                      call.status === "missed" ||
                      call.status === "rejected" ||
                      call.status === "failed"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-purple-600/20 text-purple-200"
                    }`}
                  >
                    {call.type === "video" ? (
                      <FiVideo className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {outgoing ? "Outgoing" : "Incoming"}{" "}
                      {call.type === "video"
                        ? "video"
                        : "audio"}
                      {other?.name ? ` · ${other.name}` : ""}
                    </p>

                    <p className="mt-1 text-xs text-[#b5bac1]">
                      {statusLabel(call.status)}
                      {call.duration > 0
                        ? ` · ${formatDuration(call.duration)}`
                        : ""}
                    </p>

                    <p className="mt-1 text-[11px] text-[#949ba4]">
                      {formatWhen(
                        call.startedAt || call.createdAt
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default CallHistoryPanel;
