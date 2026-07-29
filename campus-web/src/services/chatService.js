import api from "./api.js";

export const getEligibleChatUsers = async (params = {}) => {
  const response = await api.get("/chat/eligible-users", {
    params,
  });

  return response.data?.data || {
    users: [],
    pagination: {},
  };
};

export const getConversations = async () => {
  const response = await api.get("/chat/conversations");
  return response.data?.data?.conversations || [];
};

export const getConversationById = async (conversationId) => {
  const response = await api.get(
    `/chat/conversations/${conversationId}`
  );

  return response.data?.data?.conversation;
};

export const createDirectConversation = async (userId) => {
  const response = await api.post(
    "/chat/conversations/direct",
    { userId }
  );

  return {
    conversation: response.data?.data?.conversation,
    wasCreated: Boolean(response.data?.data?.wasCreated),
  };
};

export const createGroup = async (payload) => {
  const response = await api.post(
    "/chat/conversations/groups",
    payload
  );

  return response.data?.data;
};

export const getMessages = async (
  conversationId,
  params = {}
) => {
  const response = await api.get(
    `/chat/conversations/${conversationId}/messages`,
    { params }
  );

  return response.data?.data || {
    messages: [],
    pagination: {},
  };
};

export const sendMessageRest = async (
  conversationId,
  payload
) => {
  const response = await api.post(
    `/chat/conversations/${conversationId}/messages`,
    payload
  );

  return response.data?.data?.message;
};

export const updateConversation = async (
  conversationId,
  payload
) => {
  const response = await api.patch(
    `/chat/conversations/${conversationId}`,
    payload
  );

  return response.data?.data?.conversation;
};

export const addConversationMembers = async (
  conversationId,
  memberIds
) => {
  const response = await api.post(
    `/chat/conversations/${conversationId}/members`,
    { memberIds }
  );

  return response.data?.data;
};

export const removeConversationMember = async (
  conversationId,
  userId
) => {
  const response = await api.delete(
    `/chat/conversations/${conversationId}/members/${userId}`
  );

  return response.data?.data;
};

export const markConversationRead = async (
  conversationId,
  payload = {}
) => {
  const response = await api.patch(
    `/chat/conversations/${conversationId}/read`,
    payload
  );

  return response.data?.data;
};

export const toggleConversationPin = async (
  conversationId
) => {
  const response = await api.patch(
    `/chat/conversations/${conversationId}/pin`
  );

  return response.data?.data?.conversation;
};

export const editMessage = async (messageId, text) => {
  const response = await api.patch(`/chat/messages/${messageId}`, {
    text,
  });

  return response.data?.data?.message;
};

export const deleteMessageForMe = async (messageId) => {
  const response = await api.delete(
    `/chat/messages/${messageId}/me`
  );

  return response.data?.data;
};

export const deleteMessageForEveryone = async (messageId) => {
  const response = await api.delete(
    `/chat/messages/${messageId}/everyone`
  );

  return response.data?.data?.message;
};

export const reactToMessage = async (messageId, emoji) => {
  const response = await api.post(
    `/chat/messages/${messageId}/reactions`,
    { emoji }
  );

  return response.data?.data?.message;
};

export const pinMessage = async (messageId, pinned = true) => {
  const response = await api.post(
    `/chat/messages/${messageId}/pin`,
    { pinned }
  );

  return response.data?.data?.message;
};

export const forwardMessage = async (messageId, conversationIds) => {
  const response = await api.post(
    `/chat/messages/${messageId}/forward`,
    { conversationIds }
  );

  return response.data?.data;
};

export const searchMessages = async (conversationId, params = {}) => {
  const response = await api.get(
    `/chat/conversations/${conversationId}/search`,
    { params }
  );

  return response.data?.data || { messages: [] };
};

export const getPinnedMessages = async (conversationId) => {
  const response = await api.get(
    `/chat/conversations/${conversationId}/pinned`
  );

  return response.data?.data?.messages || [];
};

export const uploadChatAttachments = async (
  conversationId,
  {
    files,
    text = "",
    temporaryId,
    replyTo,
    asVoice = false,
    duration,
    waveForm,
    onProgress,
  }
) => {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  if (text) formData.append("text", text);
  if (temporaryId) formData.append("temporaryId", temporaryId);
  if (replyTo) formData.append("replyTo", replyTo);
  if (asVoice) formData.append("asVoice", "true");
  if (duration != null) formData.append("duration", String(duration));
  if (waveForm) formData.append("waveForm", JSON.stringify(waveForm));

  const response = await api.post(
    `/chat/conversations/${conversationId}/attachments`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) {
          return;
        }

        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    }
  );

  return response.data?.data?.message;
};

export const listNotifications = async (params = {}) => {
  const response = await api.get("/chat/notifications", { params });
  return response.data?.data || {
    notifications: [],
    unreadCount: 0,
  };
};

export const getUnreadNotificationCount = async () => {
  const response = await api.get("/chat/notifications/unread-count");
  return response.data?.data?.unreadCount || 0;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.patch(
    `/chat/notifications/${notificationId}/read`
  );

  return response.data?.data?.notification;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch("/chat/notifications/read-all");
  return response.data?.data;
};

export const startCall = async (conversationId, payload = {}) => {
  const response = await api.post(
    `/chat/conversations/${conversationId}/calls`,
    payload
  );

  return response.data?.data?.call;
};

export const acceptCall = async (callId) => {
  const response = await api.post(`/chat/calls/${callId}/accept`);
  return response.data?.data?.call;
};

export const rejectCall = async (callId) => {
  const response = await api.post(`/chat/calls/${callId}/reject`);
  return response.data?.data;
};

export const endCall = async (callId) => {
  const response = await api.post(`/chat/calls/${callId}/end`);
  return response.data?.data;
};

export const getActiveCall = async (conversationId) => {
  const response = await api.get(
    `/chat/conversations/${conversationId}/calls/active`
  );

  return response.data?.data?.call || null;
};

export const getUploadAbsoluteUrl = (url) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const apiBase =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api/v1";

  const origin = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
};
