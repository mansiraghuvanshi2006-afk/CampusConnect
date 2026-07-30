import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { emitWithAck } from "../socket/socketClient.js";

/**
 * Minimal multi-peer WebRTC mesh for CampusConnect Phase 5.
 * Signaling goes through Socket.IO (call:offer/answer/ice).
 */
export default function useWebRTCCall({
  socket,
  currentUserId,
  activeCall,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState("new");

  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const callIdRef = useRef(null);

  const iceServers = useMemo(
    () =>
      activeCall?.iceServers || [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    [activeCall?.iceServers]
  );

  const cleanupPeer = useCallback((userId) => {
    const peer = peersRef.current.get(userId);

    if (peer) {
      peer.close();
      peersRef.current.delete(userId);
    }

    setRemoteStreams((previous) => {
      const next = { ...previous };
      delete next[userId];
      return next;
    });
  }, []);

  const stopLocalMedia = useCallback(() => {
    for (const track of localStreamRef.current?.getTracks() || []) {
      track.stop();
    }

    for (const track of screenStreamRef.current?.getTracks() || []) {
      track.stop();
    }

    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenSharing(false);
  }, []);

  const cleanupAll = useCallback(() => {
    for (const userId of [...peersRef.current.keys()]) {
      cleanupPeer(userId);
    }

    stopLocalMedia();
    setConnectionState("closed");
    callIdRef.current = null;
  }, [cleanupPeer, stopLocalMedia]);

  const ensureLocalStream = useCallback(
    async ({ audio = true, video = false } = {}) => {
      if (localStreamRef.current) {
        return localStreamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video
          ? {
              facingMode: "user",
            }
          : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    },
    []
  );

  const createPeer = useCallback(
    async (remoteUserId, { polite = false } = {}) => {
      if (!activeCall?.id || !currentUserId) {
        return null;
      }

      if (peersRef.current.has(remoteUserId)) {
        return peersRef.current.get(remoteUserId);
      }

      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        emitWithAck("call:ice", {
          callId: activeCall.id,
          targetUserId: remoteUserId,
          candidate: event.candidate.toJSON(),
        }).catch(() => {});
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;

        if (!stream) {
          return;
        }

        setRemoteStreams((previous) => ({
          ...previous,
          [remoteUserId]: stream,
        }));
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          // Best-effort ICE restart
          pc.restartIce?.();
        }
      };

      const stream = localStreamRef.current;

      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      peersRef.current.set(remoteUserId, pc);

      if (!polite) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await emitWithAck("call:offer", {
          callId: activeCall.id,
          targetUserId: remoteUserId,
          sdp: pc.localDescription,
        });
      }

      return pc;
    },
    [activeCall, currentUserId, iceServers]
  );

  const startMediaForCall = useCallback(async () => {
    if (!activeCall) {
      return;
    }

    callIdRef.current = activeCall.id;

    await ensureLocalStream({
      audio: true,
      video: activeCall.type === "video",
    });

    const others = (activeCall.participants || [])
      .filter(
        (participant) =>
          participant.userId !== currentUserId &&
          participant.status === "joined"
      )
      .map((participant) => participant.userId);

    // Caller initiates offers; callee waits for offers then answers
    const isCaller = activeCall.caller?.id === currentUserId;

    if (isCaller) {
      for (const remoteUserId of others) {
        await createPeer(remoteUserId, { polite: false });
      }
    }
  }, [
    activeCall,
    createPeer,
    currentUserId,
    ensureLocalStream,
  ]);

  useEffect(() => {
    if (!socket || !activeCall?.id || !currentUserId) {
      return undefined;
    }

    const onOffer = async (payload) => {
      if (payload.callId !== activeCall.id) {
        return;
      }

      await ensureLocalStream({
        audio: true,
        video: activeCall.type === "video",
      });

      const pc = await createPeer(payload.fromUserId, {
        polite: true,
      });

      if (!pc) {
        return;
      }

      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await emitWithAck("call:answer", {
        callId: activeCall.id,
        targetUserId: payload.fromUserId,
        sdp: pc.localDescription,
      });
    };

    const onAnswer = async (payload) => {
      if (payload.callId !== activeCall.id) {
        return;
      }

      const pc = peersRef.current.get(payload.fromUserId);

      if (!pc) {
        return;
      }

      await pc.setRemoteDescription(payload.sdp);
    };

    const onIce = async (payload) => {
      if (payload.callId !== activeCall.id || !payload.candidate) {
        return;
      }

      const pc = peersRef.current.get(payload.fromUserId);

      if (!pc) {
        return;
      }

      try {
        await pc.addIceCandidate(payload.candidate);
      } catch {
        // ignore late candidates
      }
    };

    const onParticipantJoined = async (payload) => {
      if (
        payload.callId !== activeCall.id ||
        payload.userId === currentUserId
      ) {
        return;
      }

      if (activeCall.caller?.id === currentUserId) {
        await createPeer(payload.userId, { polite: false });
      }
    };

    const onParticipantLeft = (payload) => {
      if (payload.callId !== activeCall.id) {
        return;
      }

      cleanupPeer(payload.userId);
    };

    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:participantJoined", onParticipantJoined);
    socket.on("call:participantLeft", onParticipantLeft);

    startMediaForCall().catch(() => {
      setConnectionState("failed");
    });

    return () => {
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce);
      socket.off("call:participantJoined", onParticipantJoined);
      socket.off("call:participantLeft", onParticipantLeft);
    };
  }, [
    activeCall,
    cleanupPeer,
    createPeer,
    currentUserId,
    ensureLocalStream,
    socket,
    startMediaForCall,
  ]);

  useEffect(() => {
    if (!activeCall) {
      cleanupAll();
    }
  }, [activeCall, cleanupAll]);

  const toggleMute = useCallback(async () => {
    const next = !muted;

    for (const track of localStreamRef.current?.getAudioTracks() || []) {
      track.enabled = !next;
    }

    setMuted(next);

    if (activeCall?.id) {
      await emitWithAck("call:mute", {
        callId: activeCall.id,
        muted: next,
      }).catch(() => {});
    }
  }, [activeCall, muted]);

  const toggleCamera = useCallback(async () => {
    const next = !cameraOff;

    for (const track of localStreamRef.current?.getVideoTracks() || []) {
      track.enabled = !next;
    }

    setCameraOff(next);

    if (activeCall?.id) {
      await emitWithAck("call:camera", {
        callId: activeCall.id,
        cameraOff: next,
      }).catch(() => {});
    }
  }, [activeCall, cameraOff]);

  const switchCamera = useCallback(async () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];

    if (!videoTrack || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    const currentFacing =
      videoTrack.getSettings?.().facingMode || "user";
    const nextFacing =
      currentFacing === "environment" ? "user" : "environment";

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: nextFacing },
      audio: false,
    });

    const newTrack = newStream.getVideoTracks()[0];

    for (const pc of peersRef.current.values()) {
      const sender = pc
        .getSenders()
        .find((item) => item.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    videoTrack.stop();

    localStreamRef.current.removeTrack(videoTrack);
    localStreamRef.current.addTrack(newTrack);
    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      for (const pc of peersRef.current.values()) {
        const sender = pc
          .getSenders()
          .find((item) => item.track?.kind === "video");

        if (sender) {
          await sender.replaceTrack(cameraTrack);
        }
      }

      for (const track of screenStreamRef.current?.getTracks() || []) {
        track.stop();
      }

      screenStreamRef.current = null;
      setScreenSharing(false);

      await emitWithAck("call:screenShare", {
        callId: activeCall.id,
        screenSharing: false,
      }).catch(() => {});

      return;
    }

    const displayStream =
      await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

    screenStreamRef.current = displayStream;
    const screenTrack = displayStream.getVideoTracks()[0];

    for (const pc of peersRef.current.values()) {
      const sender = pc
        .getSenders()
        .find((item) => item.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(screenTrack);
      }
    }

    screenTrack.onended = () => {
      setScreenSharing(false);
    };

    setScreenSharing(true);

    await emitWithAck("call:screenShare", {
      callId: activeCall.id,
      screenSharing: true,
    }).catch(() => {});
  }, [activeCall, screenSharing]);

  return {
    localStream,
    remoteStreams,
    muted,
    cameraOff,
    screenSharing,
    connectionState,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleScreenShare,
    cleanupAll,
  };
}
