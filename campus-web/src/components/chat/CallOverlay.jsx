import { useEffect, useRef, useState } from "react";

import {
  FiCamera,
  FiMaximize,
  FiMic,
  FiMicOff,
  FiMinimize2,
  FiMonitor,
  FiPhone,
  FiPhoneOff,
  FiRefreshCw,
  FiVideo,
  FiVideoOff,
} from "react-icons/fi";

const VideoTile = ({ stream, muted = false, label, mirror }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirror ? "scale-x-[-1]" : ""}`}
      />
      {label && (
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          {label}
        </span>
      )}
    </div>
  );
};

const ControlButton = ({
  label,
  onClick,
  children,
  danger = false,
  active = false,
  className = "",
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={`flex min-h-12 min-w-12 items-center justify-center rounded-full p-3 text-white transition ${
      danger
        ? "bg-red-500 hover:bg-red-600"
        : active
          ? "bg-purple-600 hover:bg-purple-500"
          : "bg-white/10 hover:bg-white/20"
    } ${className}`}
  >
    {children}
  </button>
);

const CallOverlay = ({
  call,
  incomingCall,
  currentUserId,
  localStream,
  remoteStreams,
  muted,
  cameraOff,
  screenSharing,
  connectionState,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleScreenShare,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const containerRef = useRef(null);

  useEffect(() => {
    if (!call?.startedAt && call?.status !== "active") {
      return undefined;
    }

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [call?.startedAt, call?.status]);

  if (incomingCall && !call) {
    const callerName = incomingCall.caller?.name || "Incoming call";

    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1e1f22] p-6 text-center shadow-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-purple-300">
            Incoming {incomingCall.type} call
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white">
            {callerName}
          </h2>
          <p className="mt-1 text-sm text-[#b5bac1]">Ringing…</p>

          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <ControlButton label="Reject call" onClick={onReject} danger>
                <FiPhoneOff className="h-6 w-6" />
              </ControlButton>
              <span className="text-xs text-[#b5bac1]">Reject</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ControlButton
                label="Accept call"
                onClick={onAccept}
                className="!bg-emerald-500 hover:!bg-emerald-600"
              >
                {incomingCall.type === "video" ? (
                  <FiVideo className="h-6 w-6" />
                ) : (
                  <FiPhone className="h-6 w-6" />
                )}
              </ControlButton>
              <span className="text-xs text-[#b5bac1]">Accept</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!call) {
    return null;
  }

  const startedAtMs = call.startedAt
    ? new Date(call.startedAt).getTime()
    : null;
  const elapsed =
    startedAtMs && Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((nowTick - startedAtMs) / 1000))
      : 0;
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  const remoteEntries = Object.entries(remoteStreams || {});
  const isOutgoingRinging =
    call.status === "ringing" &&
    (call.caller?.id === currentUserId ||
      call.callerId === currentUserId);
  const endLabel = isOutgoingRinging ? "Cancel call" : "End call";
  const title =
    call.mode === "group"
      ? "Group call"
      : call.participants?.find((p) => p.userId !== currentUserId)?.user
          ?.name || "Call";

  const endControl = (
    <div className="flex flex-col items-center gap-1">
      <ControlButton label={endLabel} onClick={onEnd} danger>
        <FiPhoneOff className="h-6 w-6" />
      </ControlButton>
      <span className="text-[10px] font-semibold text-red-200">
        {isOutgoingRinging ? "Cancel" : "End"}
      </span>
    </div>
  );

  if (minimized) {
    return (
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[80] flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1e1f22] p-2 text-white shadow-2xl">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5"
          aria-label="Expand call"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-[11px] text-[#b5bac1]">
              {minutes}:{seconds} · {connectionState}
            </p>
          </div>
        </button>
        <ControlButton
          label={endLabel}
          onClick={onEnd}
          danger
          className="!min-h-11 !min-w-11 !p-2.5"
        >
          <FiPhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0b0c0f] pt-[env(safe-area-inset-top)]"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-[#b5bac1]">
            {call.status === "ringing"
              ? isOutgoingRinging
                ? "Calling…"
                : "Connecting…"
              : `${minutes}:${seconds}`}
            {" · "}
            <span className="capitalize">{connectionState}</span>
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label="Minimize call"
            onClick={() => setMinimized(true)}
            className="rounded-xl bg-white/10 p-2"
          >
            <FiMinimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Toggle fullscreen"
            onClick={() => {
              if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }}
            className="rounded-xl bg-white/10 p-2"
          >
            <FiMaximize className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        className={`relative grid min-h-0 flex-1 gap-2 overflow-hidden p-3 ${
          remoteEntries.length > 1
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-1"
        }`}
      >
        {remoteEntries.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl bg-black/40 text-[#b5bac1]">
            {isOutgoingRinging
              ? "Waiting for answer…"
              : "Waiting for participants…"}
          </div>
        ) : (
          remoteEntries.map(([userId, stream]) => (
            <VideoTile
              key={userId}
              stream={stream}
              label={
                call.participants?.find((p) => p.userId === userId)
                  ?.user?.name || "Participant"
              }
            />
          ))
        )}

        <div
          className={`${
            remoteEntries.length === 0
              ? "absolute bottom-4 right-4 h-36 w-24 sm:h-40 sm:w-28"
              : "min-h-[7rem]"
          }`}
        >
          <VideoTile stream={localStream} muted mirror label="You" />
        </div>
      </div>

      <footer className="z-10 flex flex-wrap items-end justify-center gap-3 border-t border-white/5 bg-black/40 px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        {!isOutgoingRinging && (
          <>
            <ControlButton
              label={muted ? "Unmute" : "Mute"}
              onClick={onToggleMute}
            >
              {muted ? (
                <FiMicOff className="h-5 w-5" />
              ) : (
                <FiMic className="h-5 w-5" />
              )}
            </ControlButton>

            {call.type === "video" && (
              <>
                <ControlButton
                  label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  onClick={onToggleCamera}
                >
                  {cameraOff ? (
                    <FiVideoOff className="h-5 w-5" />
                  ) : (
                    <FiCamera className="h-5 w-5" />
                  )}
                </ControlButton>
                <ControlButton
                  label="Switch camera"
                  onClick={onSwitchCamera}
                >
                  <FiRefreshCw className="h-5 w-5" />
                </ControlButton>
                <ControlButton
                  label={
                    screenSharing ? "Stop screen share" : "Share screen"
                  }
                  onClick={onToggleScreenShare}
                  active={screenSharing}
                >
                  <FiMonitor className="h-5 w-5" />
                </ControlButton>
              </>
            )}
          </>
        )}

        {endControl}
      </footer>
    </div>
  );
};

export default CallOverlay;
