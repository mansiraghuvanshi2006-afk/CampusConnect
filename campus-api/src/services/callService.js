import Call, {
  CALL_TYPES,
  CALL_MODES,
  CALL_STATUSES,
} from "../models/Call.js";

import Message, { MESSAGE_TYPES } from "../models/Message.js";
import Conversation, {
  CONVERSATION_TYPES,
} from "../models/Conversation.js";

import User, { USER_ROLES } from "../models/User.js";
import ApiError from "../utils/ApiError.js";

import {
  assertCanUseChat,
  assertCanViewConversation,
  assertCanManageConversation,
  getActiveMembership,
  isValidObjectId,
} from "./chatPolicyService.js";

import {
  createNotificationsForMembers,
  NOTIFICATION_TYPES,
} from "./notificationService.js";

import { formatMessage } from "../utils/chatSerializers.js";
import { isUserOnline } from "../sockets/socketPresence.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

export const getIceServers = () => {
  const stunUrls = (
    process.env.WEBRTC_STUN_URLS ||
    "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const iceServers = stunUrls.map((url) => ({ urls: url }));

  if (process.env.WEBRTC_TURN_URL) {
    iceServers.push({
      urls: process.env.WEBRTC_TURN_URL,
      username: process.env.WEBRTC_TURN_USERNAME || undefined,
      credential: process.env.WEBRTC_TURN_CREDENTIAL || undefined,
    });
  }

  return iceServers;
};

export const formatCall = (call, options = {}) => {
  if (!call) {
    return null;
  }

  const includeIceServers = options.includeIceServers !== false;

  const formatted = {
    id: toId(call),
    conversationId: toId(call.conversation),
    caller: call.caller
      ? typeof call.caller === "object"
        ? {
            id: toId(call.caller),
            name: call.caller.name,
            role: call.caller.role,
          }
        : { id: toId(call.caller) }
      : null,
    type: call.type,
    mode: call.mode,
    status: call.status,
    participants: (call.participants || []).map((participant) => ({
      userId: toId(participant.user),
      user:
        participant.user && typeof participant.user === "object"
          ? {
              id: toId(participant.user),
              name: participant.user.name,
              role: participant.user.role,
            }
          : { id: toId(participant.user) },
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt,
      muted: Boolean(participant.muted),
      cameraOff: Boolean(participant.cameraOff),
      screenSharing: Boolean(participant.screenSharing),
      status: participant.status,
    })),
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    endedBy: toId(call.endedBy),
    duration: call.duration || 0,
    isActive: Boolean(call.isActive),
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };

  if (includeIceServers) {
    formatted.iceServers = getIceServers();
  }

  return formatted;
};

const loadConversation = async (conversationId) => {
  if (!isValidObjectId(conversationId)) {
    throw new ApiError(400, "Invalid conversation ID");
  }

  const conversation = await Conversation.findById(conversationId);

  if (!conversation || !conversation.isActive) {
    throw new ApiError(404, "Conversation not found");
  }

  return conversation;
};

const assertCanStartCall = (user, conversation, mode) => {
  assertCanViewConversation(user, conversation);

  if (mode === CALL_MODES.GROUP) {
    if (conversation.type === CONVERSATION_TYPES.DIRECT) {
      throw new ApiError(400, "Use direct call mode for DMs");
    }

    if (user.role === USER_ROLES.STUDENT) {
      throw new ApiError(
        403,
        "Students cannot start group calls"
      );
    }

    if (
      conversation.type === CONVERSATION_TYPES.TEACHER_GROUP ||
      conversation.type === CONVERSATION_TYPES.OFFICIAL_GROUP ||
      conversation.type === CONVERSATION_TYPES.ANNOUNCEMENT
    ) {
      try {
        assertCanManageConversation(user, conversation);
      } catch {
        if (user.role !== USER_ROLES.ADMIN) {
          throw new ApiError(
            403,
            "Only teachers or admins can start group calls"
          );
        }
      }
    }
  }
};

const createCallSystemMessage = async (call, statusLabel) => {
  const message = await Message.create({
    conversation: call.conversation,
    sender: call.caller,
    type: MESSAGE_TYPES.CALL,
    text: statusLabel,
    callMeta: {
      callId: toId(call),
      callType: call.type,
      status: call.status,
      duration: call.duration || 0,
    },
  });

  await Conversation.updateOne(
    { _id: call.conversation },
    {
      $set: {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
      },
    }
  );

  const populated = await Message.findById(message._id)
    .populate("sender", "name role email")
    .lean();

  return formatMessage(populated, { receipts: [] });
};

const STALE_RINGING_MS = Number.parseInt(
  process.env.CALL_STALE_RINGING_MS || "120000",
  10
);

const STALE_ACTIVE_MS = Number.parseInt(
  process.env.CALL_STALE_ACTIVE_MS ||
    String(4 * 60 * 60 * 1000),
  10
);

const finalizeStaleCall = (call) => {
  call.isActive = false;
  call.endedAt = new Date();

  if (call.status === CALL_STATUSES.RINGING) {
    call.status = CALL_STATUSES.MISSED;

    for (const item of call.participants) {
      if (item.status === "ringing") {
        item.status = "missed";
      }

      if (item.status === "joined" && !item.leftAt) {
        item.status = "left";
        item.leftAt = new Date();
      }
    }

    return;
  }

  call.status = CALL_STATUSES.ENDED;

  for (const item of call.participants) {
    if (["ringing", "joined"].includes(item.status)) {
      item.status = "left";
      item.leftAt = item.leftAt || new Date();
    }
  }

  if (call.startedAt) {
    call.duration = Math.max(
      0,
      Math.floor((call.endedAt - call.startedAt) / 1000)
    );
  }
};

/**
 * Close abandoned calls so they do not block new ones.
 */
export const expireStaleCallsForMembers = async (
  memberIds = []
) => {
  const ids = [
    ...new Set(
      memberIds.map(toId).filter(Boolean)
    ),
  ];

  if (ids.length === 0) {
    return;
  }

  const now = Date.now();
  const ringingCutoff = new Date(
    now -
      (Number.isFinite(STALE_RINGING_MS) &&
      STALE_RINGING_MS > 0
        ? STALE_RINGING_MS
        : 120_000)
  );
  const activeCutoff = new Date(
    now -
      (Number.isFinite(STALE_ACTIVE_MS) &&
      STALE_ACTIVE_MS > 0
        ? STALE_ACTIVE_MS
        : 4 * 60 * 60 * 1000)
  );

  const staleCalls = await Call.find({
    isActive: true,
    status: {
      $in: [
        CALL_STATUSES.RINGING,
        CALL_STATUSES.ACTIVE,
      ],
    },
    "participants.user": { $in: ids },
    $or: [
      {
        status: CALL_STATUSES.RINGING,
        updatedAt: { $lt: ringingCutoff },
      },
      {
        status: CALL_STATUSES.ACTIVE,
        updatedAt: { $lt: activeCutoff },
      },
    ],
  });

  for (const call of staleCalls) {
    finalizeStaleCall(call);
    await call.save();
  }
};

/**
 * End every active call for a user (e.g. socket disconnect).
 */
export const endActiveCallsForUser = async (userId) => {
  const normalizedUserId = toId(userId);

  if (!normalizedUserId) {
    return [];
  }

  await expireStaleCallsForMembers([
    normalizedUserId,
  ]);

  const user = await User.findById(normalizedUserId);

  if (!user) {
    return [];
  }

  const activeCalls = await Call.find({
    isActive: true,
    status: {
      $in: [
        CALL_STATUSES.RINGING,
        CALL_STATUSES.ACTIVE,
      ],
    },
    "participants.user": normalizedUserId,
  });

  const results = [];

  for (const call of activeCalls) {
    try {
      results.push(
        await endCall(user, call._id)
      );
    } catch {
      finalizeStaleCall(call);
      await call.save();

      results.push({
        call: formatCall(call.toObject()),
        message: null,
      });
    }
  }

  return results;
};

export const startCall = async (
  currentUser,
  conversationId,
  { type = CALL_TYPES.AUDIO, mode }
) => {
  assertCanUseChat(currentUser);

  if (!Object.values(CALL_TYPES).includes(type)) {
    throw new ApiError(400, "Invalid call type");
  }

  const conversation = await loadConversation(conversationId);

  const resolvedMode =
    mode ||
    (conversation.type === CONVERSATION_TYPES.DIRECT
      ? CALL_MODES.DIRECT
      : CALL_MODES.GROUP);

  assertCanStartCall(currentUser, conversation, resolvedMode);

  const memberIds = (conversation.members || [])
    .filter((member) => member.isActive)
    .map((member) => member.user);

  await expireStaleCallsForMembers(memberIds);

  const currentUserId = toId(currentUser);
  const otherMemberIds = memberIds
    .map(toId)
    .filter((memberId) => memberId !== currentUserId);

  const existingActive = await Call.findOne({
    conversation: conversationId,
    isActive: true,
    status: {
      $in: [CALL_STATUSES.RINGING, CALL_STATUSES.ACTIVE],
    },
  });

  if (existingActive) {
    throw new ApiError(409, "A call is already active in this chat", {
      code: "CALL_BUSY",
      callId: toId(existingActive),
    });
  }

  if (
    resolvedMode === CALL_MODES.DIRECT &&
    otherMemberIds.length > 0
  ) {
    const busyCall = await Call.findOne({
      isActive: true,
      status: {
        $in: [CALL_STATUSES.RINGING, CALL_STATUSES.ACTIVE],
      },
      "participants.user": { $in: otherMemberIds },
    });

    if (busyCall) {
      const otherBusy = (busyCall.participants || []).some(
        (participant) =>
          otherMemberIds.includes(
            toId(participant.user)
          ) &&
          ["ringing", "joined"].includes(
            participant.status
          )
      );

      if (otherBusy) {
        throw new ApiError(409, "User is busy on another call", {
          code: "CALL_BUSY",
        });
      }
    }
  }

  const participants = memberIds.map((userId) => ({
    user: userId,
    status:
      toId(userId) === toId(currentUser) ? "joined" : "ringing",
    joinedAt:
      toId(userId) === toId(currentUser) ? new Date() : null,
  }));

  const call = await Call.create({
    conversation: conversationId,
    caller: currentUser._id,
    type,
    mode: resolvedMode,
    status: CALL_STATUSES.RINGING,
    participants,
    isActive: true,
  });

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return formatCall(populated);
};

export const acceptCall = async (currentUser, callId) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call || !call.isActive) {
    throw new ApiError(404, "Call not found");
  }

  const conversation = await loadConversation(call.conversation);
  assertCanViewConversation(currentUser, conversation);

  const participant = call.participants.find(
    (item) => toId(item.user) === toId(currentUser)
  );

  if (!participant) {
    throw new ApiError(403, "You are not a participant of this call");
  }

  if (
    ![CALL_STATUSES.RINGING, CALL_STATUSES.ACTIVE].includes(
      call.status
    )
  ) {
    throw new ApiError(400, "Call cannot be accepted in its current state");
  }

  participant.status = "joined";
  participant.joinedAt = participant.joinedAt || new Date();

  if (call.status === CALL_STATUSES.RINGING) {
    call.status = CALL_STATUSES.ACTIVE;
    call.startedAt = new Date();
  }

  await call.save();

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return formatCall(populated);
};

export const rejectCall = async (currentUser, callId) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call || !call.isActive) {
    throw new ApiError(404, "Call not found");
  }

  const conversation = await loadConversation(call.conversation);
  assertCanViewConversation(currentUser, conversation);

  const participant = call.participants.find(
    (item) => toId(item.user) === toId(currentUser)
  );

  if (!participant) {
    throw new ApiError(403, "You are not a participant of this call");
  }

  participant.status = "rejected";
  participant.leftAt = new Date();

  if (call.mode === CALL_MODES.DIRECT) {
    call.status = CALL_STATUSES.REJECTED;
    call.isActive = false;
    call.endedAt = new Date();
    call.endedBy = currentUser._id;
  } else {
    const stillRingingOrJoined = call.participants.some(
      (item) =>
        toId(item.user) !== toId(currentUser) &&
        ["ringing", "joined"].includes(item.status)
    );

    if (!stillRingingOrJoined) {
      call.status = CALL_STATUSES.ENDED;
      call.isActive = false;
      call.endedAt = new Date();
      call.endedBy = currentUser._id;
    }
  }

  await call.save();

  let systemMessage = null;

  if (!call.isActive) {
    systemMessage = await createCallSystemMessage(
      call,
      "Call declined"
    );
  }

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return {
    call: formatCall(populated),
    message: systemMessage,
  };
};

export const markCallBusy = async (currentUser, callId) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call || !call.isActive) {
    throw new ApiError(404, "Call not found");
  }

  const participant = call.participants.find(
    (item) => toId(item.user) === toId(currentUser)
  );

  if (!participant) {
    throw new ApiError(403, "You are not a participant of this call");
  }

  participant.status = "busy";
  participant.leftAt = new Date();

  if (call.mode === CALL_MODES.DIRECT) {
    call.status = CALL_STATUSES.BUSY;
    call.isActive = false;
    call.endedAt = new Date();
    call.endedBy = currentUser._id;
  }

  await call.save();

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return formatCall(populated);
};

export const endCall = async (currentUser, callId) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call) {
    throw new ApiError(404, "Call not found");
  }

  const conversation = await loadConversation(call.conversation);
  assertCanViewConversation(currentUser, conversation);

  const participant = call.participants.find(
    (item) => toId(item.user) === toId(currentUser)
  );

  if (!participant && currentUser.role !== USER_ROLES.ADMIN) {
    throw new ApiError(403, "You are not a participant of this call");
  }

  if (participant) {
    participant.status = "left";
    participant.leftAt = new Date();
  }

  const joinedOthers = call.participants.filter(
    (item) =>
      toId(item.user) !== toId(currentUser) &&
      item.status === "joined"
  );

  const shouldEndEntirely =
    call.mode === CALL_MODES.DIRECT ||
    toId(call.caller) === toId(currentUser) ||
    joinedOthers.length === 0 ||
    currentUser.role === USER_ROLES.ADMIN;

  let systemMessage = null;

  if (shouldEndEntirely && call.isActive) {
    call.isActive = false;
    call.endedAt = new Date();
    call.endedBy = currentUser._id;

    if (
      call.status === CALL_STATUSES.RINGING &&
      toId(call.caller) === toId(currentUser)
    ) {
      // Caller cancelled before answer → missed for others
      call.status = CALL_STATUSES.MISSED;
      for (const item of call.participants) {
        if (item.status === "ringing") {
          item.status = "missed";
        }
      }
    } else if (call.status === CALL_STATUSES.RINGING) {
      call.status = CALL_STATUSES.MISSED;
    } else {
      call.status = CALL_STATUSES.ENDED;
    }

    if (call.startedAt) {
      call.duration = Math.max(
        0,
        Math.floor((call.endedAt - call.startedAt) / 1000)
      );
    }

    const label =
      call.status === CALL_STATUSES.MISSED
        ? `Missed ${call.type} call`
        : `${call.type === CALL_TYPES.VIDEO ? "Video" : "Audio"} call · ${call.duration}s`;

    systemMessage = await createCallSystemMessage(call, label);

    await createNotificationsForMembers({
      memberIds: call.participants.map((item) => item.user),
      excludeUserId: currentUser._id,
      type: NOTIFICATION_TYPES.CALL,
      title: call.status === CALL_STATUSES.MISSED
        ? "Missed call"
        : "Call ended",
      body: label,
      conversationId: call.conversation,
      callId: call._id,
      actorId: currentUser._id,
      meta: {
        status: call.status,
        duration: call.duration,
      },
    });
  }

  await call.save();

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return {
    call: formatCall(populated),
    message: systemMessage,
  };
};

export const updateCallMediaState = async (
  currentUser,
  callId,
  { muted, cameraOff, screenSharing }
) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId);

  if (!call || !call.isActive) {
    throw new ApiError(404, "Active call not found");
  }

  const participant = call.participants.find(
    (item) => toId(item.user) === toId(currentUser)
  );

  if (!participant || participant.status !== "joined") {
    throw new ApiError(403, "Join the call before updating media state");
  }

  if (typeof muted === "boolean") {
    participant.muted = muted;
  }

  if (typeof cameraOff === "boolean") {
    participant.cameraOff = cameraOff;
  }

  if (typeof screenSharing === "boolean") {
    participant.screenSharing = screenSharing;
  }

  await call.save();

  const populated = await Call.findById(call._id)
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return formatCall(populated);
};

export const getCallById = async (currentUser, callId) => {
  assertCanUseChat(currentUser);

  if (!isValidObjectId(callId)) {
    throw new ApiError(400, "Invalid call ID");
  }

  const call = await Call.findById(callId)
    .populate("caller", "name role")
    .populate("participants.user", "name role");

  if (!call) {
    throw new ApiError(404, "Call not found");
  }

  const isParticipant = (call.participants || []).some(
    (item) => toId(item.user) === toId(currentUser._id)
  );

  if (!isParticipant) {
    throw new ApiError(403, "You are not a participant in this call");
  }

  return formatCall(call, {
    includeIceServers: Boolean(call.isActive),
  });
};

/**
 * Participant IDs stored on a call document (ObjectId or populated).
 */
export const getCallParticipantIds = (call) =>
  (call?.participants || [])
    .map((participant) => toId(participant.user))
    .filter(Boolean);

/**
 * WebRTC signaling must only relay SDP/ICE between verified
 * participants of the same active call. Never trust targetUserId
 * from the client beyond this check.
 */
export const assertCallSignalPermission = ({
  call,
  actorUserId,
  targetUserId,
}) => {
  if (!call || !call.isActive) {
    throw new ApiError(404, "Active call not found");
  }

  if (
    ![CALL_STATUSES.RINGING, CALL_STATUSES.ACTIVE].includes(
      call.status
    )
  ) {
    throw new ApiError(
      400,
      "Call is not in a state that accepts signaling"
    );
  }

  const actorId = toId(actorUserId);
  const targetId = toId(targetUserId);

  if (!actorId) {
    throw new ApiError(401, "Authentication required");
  }

  if (!targetId) {
    throw new ApiError(400, "targetUserId is required");
  }

  if (actorId === targetId) {
    throw new ApiError(400, "Cannot signal yourself");
  }

  const participantIds = getCallParticipantIds(call);

  if (!participantIds.includes(actorId)) {
    throw new ApiError(
      403,
      "You are not a participant in this call"
    );
  }

  if (!participantIds.includes(targetId)) {
    throw new ApiError(
      403,
      "Target user is not a participant in this call"
    );
  }

  return {
    actorId,
    targetId,
    participantIds,
  };
};

export const assertCallParticipant = async (userId, callId) => {
  const call = await Call.findById(callId);

  if (!call || !call.isActive) {
    throw new ApiError(404, "Active call not found");
  }

  const isParticipant = call.participants.some(
    (item) => toId(item.user) === toId(userId)
  );

  if (!isParticipant) {
    throw new ApiError(403, "Not a call participant");
  }

  return call;
};

const MAX_CALL_HISTORY_PAGE = 50;

/**
 * Calls the authenticated user participated in, newest first.
 * Never returns SDP/ICE payloads — only safe metadata.
 */
export const listCallsForUser = async (currentUser, filters = {}) => {
  assertCanUseChat(currentUser);

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(
    MAX_CALL_HISTORY_PAGE,
    Math.max(1, Number(filters.limit) || 20)
  );
  const skip = (page - 1) * limit;

  const query = {
    "participants.user": currentUser._id,
  };

  if (filters.conversationId) {
    if (!isValidObjectId(filters.conversationId)) {
      throw new ApiError(400, "Invalid conversation ID");
    }

    const conversation = await loadConversation(
      filters.conversationId
    );
    assertCanViewConversation(currentUser, conversation);
    query.conversation = filters.conversationId;
  }

  if (filters.status) {
    const statuses = String(filters.status)
      .split(",")
      .map((value) => value.trim())
      .filter((value) =>
        Object.values(CALL_STATUSES).includes(value)
      );

    if (statuses.length === 1) {
      query.status = statuses[0];
    } else if (statuses.length > 1) {
      query.status = { $in: statuses };
    }
  }

  if (filters.type) {
    if (!Object.values(CALL_TYPES).includes(filters.type)) {
      throw new ApiError(400, "Invalid call type");
    }

    query.type = filters.type;
  }

  const [calls, total] = await Promise.all([
    Call.find(query)
      .populate("caller", "name role")
      .populate("participants.user", "name role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Call.countDocuments(query),
  ]);

  return {
    calls: calls.map((call) =>
      formatCall(call, { includeIceServers: false })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

export const getActiveCallForConversation = async (
  currentUser,
  conversationId
) => {
  assertCanUseChat(currentUser);

  const conversation = await loadConversation(conversationId);
  assertCanViewConversation(currentUser, conversation);

  const call = await Call.findOne({
    conversation: conversationId,
    isActive: true,
    status: {
      $in: [CALL_STATUSES.RINGING, CALL_STATUSES.ACTIVE],
    },
  })
    .populate("caller", "name role")
    .populate("participants.user", "name role")
    .lean();

  return formatCall(call);
};

void isUserOnline;
void getActiveMembership;
void User;
