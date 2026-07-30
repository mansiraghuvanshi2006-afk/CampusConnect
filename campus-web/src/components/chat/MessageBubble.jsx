import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  FiChevronDown,
  FiDownload,
  FiPause,
  FiPlay,
} from "react-icons/fi";
import { MdOutlinePushPin } from "react-icons/md";

import { getUploadAbsoluteUrl } from "../../services/chatService.js";
import { REACTION_EMOJIS } from "../../utils/chatPhase5State.js";
import { formatMessageTime } from "../../utils/chatHelpers.js";
import {
  getMessageActionPermissions,
  getMessagePinPermission,
} from "../../utils/messagePermissions.js";

const VoicePlayer = ({ voice }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return undefined;
    }

    const onTime = () => {
      if (!audio.duration) {
        return;
      }

      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  if (!voice?.url) {
    return null;
  }

  const src = getUploadAbsoluteUrl(voice.url);

  return (
    <div className="my-1 flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-black/20 px-2 py-1.5 sm:min-w-[180px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        onClick={() => {
          const audio = audioRef.current;

          if (!audio) {
            return;
          }

          if (playing) {
            audio.pause();
            setPlaying(false);
          } else {
            audio.playbackRate = speed;
            audio.play();
            setPlaying(true);
          }
        }}
        className="shrink-0 rounded-full bg-white/10 p-1.5"
      >
        {playing ? (
          <FiPause className="h-3.5 w-3.5" />
        ) : (
          <FiPlay className="h-3.5 w-3.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex gap-[2px] overflow-hidden">
          {(voice.waveForm?.length
            ? voice.waveForm
            : Array.from({ length: 24 }, () => 0.35)
          ).map((value, index) => (
            <span
              key={index}
              className="w-[2px] shrink-0 rounded-full bg-current opacity-70"
              style={{
                height: `${Math.max(4, Math.min(18, value * 18))}px`,
              }}
            />
          ))}
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          aria-label="Voice note progress"
          onChange={(event) => {
            const audio = audioRef.current;

            if (!audio?.duration) {
              return;
            }

            const next = Number(event.target.value);
            audio.currentTime = (next / 100) * audio.duration;
            setProgress(next);
          }}
          className="w-full accent-purple-300"
        />
      </div>

      <button
        type="button"
        aria-label={`Playback speed ${speed}x`}
        className="shrink-0 rounded px-1 text-[10px] font-bold opacity-80"
        onClick={() => {
          const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
          setSpeed(next);

          if (audioRef.current) {
            audioRef.current.playbackRate = next;
          }
        }}
      >
        {speed}x
      </button>

      <span className="shrink-0 text-[10px] opacity-70">
        {Math.round(voice.duration || 0)}s
      </span>
    </div>
  );
};

const useViewportSafeMenu = (open, triggerRef, menuRef) => {
  const [placement, setPlacement] = useState({
    openUp: false,
    alignEnd: false,
  });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) {
      return;
    }

    const trigger = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - trigger.bottom;
    const spaceRight = window.innerWidth - trigger.left;

    setPlacement({
      openUp: spaceBelow < menu.height + 12 && trigger.top > menu.height,
      alignEnd: spaceRight < menu.width + 8,
    });
  }, [open, triggerRef, menuRef]);

  return placement;
};

const MessageBubble = ({
  message,
  isMine,
  isGroup,
  currentUserId,
  canSend = true,
  canManage = false,
  isMember = true,
  userRole = null,
  conversationType = "direct",
  onReply,
  onReact,
  onEdit,
  onDeleteMe,
  onDeleteEveryone,
  onForward,
  onPin,
  onJumpToReply,
  renderReceipt,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const rootRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const reactRef = useRef(null);

  const permissions = getMessageActionPermissions({
    message,
    isMine,
    canSend,
    canManage,
    isMember,
    userRole,
  });

  const canPin = getMessagePinPermission({
    message,
    isMember,
    canManage,
    userRole,
    conversationType,
  });

  const menuPlacement = useViewportSafeMenu(menuOpen, menuButtonRef, menuRef);
  const reactPlacement = useViewportSafeMenu(
    reactOpen,
    menuButtonRef,
    reactRef
  );

  useEffect(() => {
    if (!menuOpen && !reactOpen) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setReactOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setReactOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, reactOpen]);

  if (message.deletedForEveryone) {
    return (
      <div
        id={`message-${message.id}`}
        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      >
        <div className="max-w-[85%] rounded-2xl bg-black/20 px-3 py-2 text-sm italic text-[#949ba4] sm:max-w-[70%]">
          This message was deleted
          <div className="mt-1 text-[10px] not-italic opacity-70">
            {formatMessageTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  const closeMenus = () => {
    setMenuOpen(false);
    setReactOpen(false);
  };

  return (
    <div
      id={`message-${message.id}`}
      ref={rootRef}
      className={`flex min-w-0 ${isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`relative max-w-[min(100%,24rem)] min-w-0 rounded-2xl px-3 py-2 sm:max-w-[70%] ${
          isMine
            ? "rounded-br-md bg-purple-600 text-white"
            : "rounded-bl-md bg-[#2b2d31] text-[#dbdee1]"
        }`}
      >
        <div className="absolute right-1 top-1 z-10">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Message actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((previous) => !previous);
              setReactOpen(false);
            }}
            className="rounded-lg p-1 text-current opacity-70 transition hover:bg-black/20 hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <FiChevronDown className="h-4 w-4" />
          </button>
        </div>

        {!isMine && isGroup && (
          <p className="mb-1 pr-7 text-[11px] font-semibold text-purple-200">
            {message.sender?.name}
          </p>
        )}

        {message.forwardedFrom && (
          <p className="mb-1 pr-7 text-[10px] font-semibold uppercase tracking-wide opacity-70">
            Forwarded
            {message.forwardedFrom.sender?.name
              ? ` · ${message.forwardedFrom.sender.name}`
              : ""}
          </p>
        )}

        {message.replyTo && (
          <button
            type="button"
            onClick={() => onJumpToReply?.(message.replyTo.id)}
            className="mb-2 w-full max-w-full rounded-lg border-l-2 border-purple-300/70 bg-black/20 px-2 py-1 text-left text-[11px] opacity-90"
          >
            <span className="font-semibold">
              {message.replyTo.sender?.name || "Message"}
            </span>
            <p className="truncate break-all">
              {message.replyTo.deletedForEveryone
                ? "Deleted message"
                : message.replyTo.text || "Attachment"}
            </p>
          </button>
        )}

        {message.pinned && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold opacity-80">
            <MdOutlinePushPin className="h-3 w-3" />
            Pinned
          </p>
        )}

        {(message.attachments || []).map((attachment) => {
          const url = getUploadAbsoluteUrl(attachment.url);
          const isImage = attachment.mimeType?.startsWith("image/");

          return (
            <div
              key={attachment.id || attachment.fileName}
              className="mb-2 min-w-0 max-w-full"
            >
              {isImage ? (
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={getUploadAbsoluteUrl(
                      attachment.thumbnailUrl || attachment.url
                    )}
                    alt={attachment.originalName}
                    className="max-h-56 max-w-full rounded-xl object-cover"
                  />
                </a>
              ) : (
                <a
                  href={url}
                  download={attachment.originalName}
                  className="inline-flex max-w-full items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs"
                >
                  <FiDownload className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 truncate break-all">
                    {attachment.originalName}
                  </span>
                </a>
              )}
            </div>
          );
        })}

        {message.voice || message.type === "voice" ? (
          <VoicePlayer voice={message.voice} />
        ) : null}

        {message.type === "call" && (
          <p className="text-sm font-medium">{message.text}</p>
        )}

        {message.text && (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed pr-6">
            {message.text.split(/(@\w[\w\s]*)/g).map((part, index) =>
              part.startsWith("@") ? (
                <span
                  key={`${part}-${index}`}
                  className="font-semibold text-amber-200"
                >
                  {part}
                </span>
              ) : (
                <span key={`${part}-${index}`}>{part}</span>
              )
            )}
          </p>
        )}

        {message.linkPreview?.url && (
          <a
            href={message.linkPreview.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block max-w-full rounded-xl border border-white/10 bg-black/20 p-2 text-[11px]"
          >
            <p className="font-semibold">
              {message.linkPreview.title || message.linkPreview.siteName}
            </p>
            <p className="break-all opacity-70">{message.linkPreview.url}</p>
          </a>
        )}

        {(message.reactionSummary || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactionSummary.map((item) => (
              <button
                key={item.emoji}
                type="button"
                aria-label={`Reaction ${item.emoji}, ${item.count}`}
                onClick={() => onReact?.(message, item.emoji)}
                className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                  item.userIds?.includes(currentUserId)
                    ? "bg-white/25 ring-1 ring-white/40"
                    : "bg-black/20"
                }`}
              >
                {item.emoji} {item.count}
              </button>
            ))}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-1 ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          {message.edited && (
            <span className="text-[10px] opacity-70">Edited</span>
          )}
          <span className="text-[10px] opacity-70">
            {formatMessageTime(message.createdAt)}
          </span>
          {renderReceipt?.(message)}
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className={`absolute z-40 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22] text-sm text-[#dbdee1] shadow-xl ${
              menuPlacement.openUp ? "bottom-8" : "top-8"
            } ${menuPlacement.alignEnd || isMine ? "right-0" : "left-0"}`}
          >
            {permissions.canReact && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false);
                  setReactOpen(true);
                }}
              >
                React
              </button>
            )}
            {permissions.canReply && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onReply?.(message);
                }}
              >
                Reply
              </button>
            )}
            {permissions.canForward && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onForward?.(message);
                }}
              >
                Forward
              </button>
            )}
            {permissions.canEdit && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onEdit?.(message);
                }}
              >
                Edit
              </button>
            )}
            {canPin && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onPin?.(message);
                }}
              >
                {message.pinned ? "Unpin" : "Pin"}
              </button>
            )}
            {permissions.canDeleteMe && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onDeleteMe?.(message);
                }}
              >
                Delete for me
              </button>
            )}
            {permissions.canDeleteEveryone && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left text-red-300 hover:bg-white/5"
                onClick={() => {
                  closeMenus();
                  onDeleteEveryone?.(message);
                }}
              >
                Delete for everyone
              </button>
            )}
          </div>
        )}

        {reactOpen && (
          <div
            ref={reactRef}
            role="listbox"
            aria-label="Quick reactions"
            className={`absolute z-40 flex max-w-[min(100vw-2rem,20rem)] flex-wrap gap-1 rounded-xl border border-white/10 bg-[#1e1f22] p-2 shadow-xl ${
              reactPlacement.openUp ? "bottom-8" : "top-8"
            } ${reactPlacement.alignEnd || isMine ? "right-0" : "left-0"}`}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="option"
                aria-label={`React with ${emoji}`}
                className="rounded-lg px-1.5 py-1 text-base hover:bg-white/10"
                onClick={() => {
                  closeMenus();
                  onReact?.(message, emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
