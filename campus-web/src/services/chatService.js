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
