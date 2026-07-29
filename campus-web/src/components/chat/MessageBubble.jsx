import { useEffect, useRef, useState } from "react";

import {
  FiDownload,
  FiMoreHorizontal,
  FiPause,
  FiPlay,
} from "react-icons/fi";
import { MdOutlinePushPin } from "react-icons/md";

import {
  getUploadAbsoluteUrl,
} from "../../services/chatService.js";
import { REACTION_EMOJIS } from "../../utils/chatPhase5State.js";
import { formatMessageTime } from "../../utils/chatHelpers.js";

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
    <div className="my-1 flex min-w-[180px] items-center gap-2 rounded-xl bg-black/20 px-2 py-1.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
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
        className="rounded-full bg-white/10 p-1.5"
      >
        {playing ? (
          <FiPause className="h-3.5 w-3.5" />
        ) : (
          <FiPlay className="h-3.5 w-3.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex gap-[2px]">
          {(voice.waveForm?.length
            ? voice.waveForm
            : Array.from({ length: 24 }, () => 0.35)
          ).map((value, index) => (
            <span
              key={index}
              className="w-[2px] rounded-full bg-current opacity-70"
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
        className="rounded px-1 text-[10px] font-bold opacity-80"
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

      <span className="text-[10px] opacity-70">
        {Math.round(voice.duration || 0)}s
      </span>
    </div>
  );
};

const MessageBubble = ({
  message,
  isMine,
  isGroup,
  currentUserId,
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

  if (message.deletedForEveryone) {
    return (
      <div
        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
      >
        <div className="rounded-2xl bg-black/20 px-3 py-2 text-sm italic text-[#949ba4]">
          This message was deleted
          <div className="mt-1 text-[10px] not-italic opacity-70">
            {formatMessageTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      className={`group relative flex ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[70%] ${
          isMine
            ? "rounded-br-md bg-purple-600 text-white"
            : "rounded-bl-md bg-[#2b2d31] text-[#dbdee1]"
        }`}
      >
        {!isMine && isGroup && (
          <p className="mb-1 text-[11px] font-semibold text-purple-200">
            {message.sender?.name}
          </p>
        )}

        {message.forwardedFrom && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
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
            className="mb-2 w-full rounded-lg border-l-2 border-purple-300/70 bg-black/20 px-2 py-1 text-left text-[11px] opacity-90"
          >
            <span className="font-semibold">
              {message.replyTo.sender?.name || "Message"}
            </span>
            <p className="truncate">
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
            <div key={attachment.id || attachment.fileName} className="mb-2">
              {isImage ? (
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={getUploadAbsoluteUrl(
                      attachment.thumbnailUrl || attachment.url
                    )}
                    alt={attachment.originalName}
                    className="max-h-56 rounded-xl object-cover"
                  />
                </a>
              ) : (
                <a
                  href={url}
                  download={attachment.originalName}
                  className="inline-flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs"
                >
                  <FiDownload className="h-3.5 w-3.5" />
                  <span className="max-w-[160px] truncate">
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
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
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
            className="mt-2 block rounded-xl border border-white/10 bg-black/20 p-2 text-[11px]"
          >
            <p className="font-semibold">
              {message.linkPreview.title || message.linkPreview.siteName}
            </p>
            <p className="truncate opacity-70">{message.linkPreview.url}</p>
          </a>
        )}

        {(message.reactionSummary || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactionSummary.map((item) => (
              <button
                key={item.emoji}
                type="button"
                onClick={() => onReact?.(message, item.emoji)}
                className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                  item.userIds?.includes(currentUserId)
                    ? "bg-white/25"
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
      </div>

      <div
        className={`absolute top-0 z-20 flex max-w-[min(100vw-2rem,20rem)] items-center gap-0.5 rounded-full border border-white/10 bg-[#1e1f22] p-1 shadow-lg opacity-0 pointer-events-none transition group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto max-md:opacity-100 max-md:pointer-events-auto ${
          isMine
            ? "left-0 -translate-x-full pr-1"
            : "right-0 translate-x-full pl-1"
        }`}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            title={`React ${emoji}`}
            onClick={() => {
              setMenuOpen(false);
              setReactOpen(false);
              onReact?.(message, emoji);
            }}
            className="rounded-lg px-1 py-0.5 text-base leading-none hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label="Message actions"
          onClick={() => {
            setMenuOpen((previous) => !previous);
            setReactOpen(false);
          }}
          className="rounded-lg p-1.5 text-[#b5bac1] hover:bg-white/10"
        >
          <FiMoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {menuOpen && (
        <div
          className={`absolute z-30 top-8 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22] text-sm shadow-xl ${
            isMine ? "right-0" : "left-0"
          }`}
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              setReactOpen(true);
            }}
          >
            React
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              onReply?.(message);
            }}
          >
            Reply
          </button>
          {isMine && message.type === "text" && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-white/5"
              onClick={() => {
                setMenuOpen(false);
                onEdit?.(message);
              }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              onForward?.(message);
            }}
          >
            Forward
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              onPin?.(message);
            }}
          >
            {message.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              onDeleteMe?.(message);
            }}
          >
            Delete for me
          </button>
          {(isMine || true) && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-red-300 hover:bg-white/5"
              onClick={() => {
                setMenuOpen(false);
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
          className={`absolute z-30 top-8 flex gap-1 rounded-xl border border-white/10 bg-[#1e1f22] p-2 shadow-xl ${
            isMine ? "right-0" : "left-0"
          }`}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-lg px-1.5 py-1 text-base hover:bg-white/10"
              onClick={() => {
                setReactOpen(false);
                onReact?.(message, emoji);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
