import { FiUsers } from "react-icons/fi";
import { MdOutlinePushPin } from "react-icons/md";

import {
  formatConversationTime,
  getConversationTitle,
  getInitials,
} from "../../utils/chatHelpers.js";
import { getUploadAbsoluteUrl } from "../../services/chatService.js";

/**
 * Single conversation row for the chat sidebar.
 */
const ConversationListItem = ({
  conversation,
  isActive,
  online,
  onOpen,
}) => {
  const title = getConversationTitle(conversation);
  const isGroup = conversation.type !== "direct";

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation.id)}
      className={`flex w-full min-w-0 items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-purple-400 ${
        isActive ? "bg-purple-600/20" : "hover:bg-white/5"
      }`}
    >
      <div className="relative shrink-0">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
          {isGroup && conversation.image ? (
            <img
              src={getUploadAbsoluteUrl(conversation.image)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : isGroup ? (
            <FiUsers className="h-5 w-5" aria-hidden />
          ) : (
            getInitials(title)
          )}
        </div>

        {online && (
          <span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#2b2d31] bg-emerald-400"
            aria-label="Online"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 truncate font-semibold text-white">
            {conversation.isPinned && (
              <MdOutlinePushPin
                className="h-3.5 w-3.5 shrink-0 text-purple-300"
                aria-hidden
              />
            )}
            <span className="truncate">{title}</span>
          </p>

          <span className="shrink-0 text-[11px] text-[#949ba4]">
            {formatConversationTime(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-[#b5bac1]">
            {conversation.lastMessage?.text || "No messages yet"}
          </p>

          {conversation.unreadCount > 0 && (
            <span className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {conversation.unreadCount > 99
                ? "99+"
                : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationListItem;
