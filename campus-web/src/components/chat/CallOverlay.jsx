import { useEffect, useRef, useState } from "react";

import {
  FiCamera,
  FiMaximize,
  FiMic,
  FiMicOff,
  FiMonitor,
  FiPhoneOff,
  FiRefreshCw,
  FiVideo,
  FiVideoOff,
  FiX,
} from "react-icons/fi";

const VideoTile = ({ stream, muted = false, label, mirror }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
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
  const [elapsed, setElapsed] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!call?.startedAt && call?.status !== "active") {
      setElapsed(0);
      return undefined;
    }

    const started = call.startedAt
      ? new Date(call.startedAt).getTime()
      : Date.now();

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [call?.startedAt, call?.status]);

  if (incomingCall && !call) {
    const callerName = incomingCall.caller?.name || "Incoming call";

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1e1f22] p-6 text-center shadow-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-purple-300">
            Incoming {incomingCall.type} call
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white">
            {callerName}
          </h2>
          <p className="mt-1 text-sm text-[#b5bac1]">Ringing…</p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onReject}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white"
              aria-label="Reject call"
            >
              <FiPhoneOff className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white"
              aria-label="Accept call"
            >
              <FiVideo className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!call) {
    return null;
  }

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  const remoteEntries = Object.entries(remoteStreams || {});
  const title =
    call.mode === "group"
      ? "Group call"
      : call.participants?.find((p) => p.userId !== currentUserId)?.user
          ?.name || "Call";

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[80] flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1e1f22] px-4 py-3 text-white shadow-2xl"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="text-left">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-[#b5bac1]">
            {minutes}:{seconds} · {connectionState}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[80] flex flex-col bg-[#0b0c0f]/
    >
      <header className="flex items-center justify-between px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-[#b5bac1]">
            {call.status === "ringing"
              ? "Calling…"
              : `${minutes}:${seconds}`}
            {" · "}
            <span className="capitalize">{connectionState}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => setMinimized(true)}
            className="rounded-xl bg-white/10 p-2"
          >
            <FiX className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Fullscreen"
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
        className={`grid flex-1 gap-2 p-3 ${
          remoteEntries.length > 1
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-1"
        }`}
      >
        {remoteEntries.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl bg-black/40 text-[#b5bac1]">
            Waiting for participants…
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
              ? "absolute bottom-28 right-4 h-40 w-28"
              : ""
          }`}
        >
          <VideoTile
            stream={localStream}
            muted
            mirror
            label="You"
          />
        </div>
      </div>

      <footer className="flex items-center justify-center gap-3 px-4 py-5">
        <button
          type="button"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
          className="rounded-full bg-white/10 p-3 text-white"
        >
          {muted ? <FiMicOff className="h-5 w-5" /> : <FiMic className="h-5 w-5" />}
        </button>

        {call.type === "video" && (
          <>
            <button
              type="button"
              aria-label={cameraOff ? "Camera on" : "Camera off"}
              onClick={onToggleCamera}
              className="rounded-full bg-white/10 p-3 text-white"
            >
              {cameraOff ? (
                <FiVideoOff className="h-5 w-5" />
              ) : (
                <FiCamera className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Switch camera"
              onClick={onSwitchCamera}
              className="rounded-full bg-white/10 p-3 text-white"
            >
              <FiRefreshCw className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Screen share"
              onClick={onToggleScreenShare}
              className={`rounded-full p-3 text-white ${
                screenSharing ? "bg-purple-600" : "bg-white/10"
              }`}
            >
              <FiMonitor className="h-5 w-5" />
            </button>
          </>
        )}

        <button
          type="button"
          aria-label="End call"
          onClick={onEnd}
          className="rounded-full bg-red-500 p-3 text-white"
        >
          <FiPhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
};

export default CallOverlay;
