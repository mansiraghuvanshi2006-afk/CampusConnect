import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import toast from "react-hot-toast";

import {
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiLoader,
  FiMessageCircle,
  FiMoreVertical,
  FiPaperclip,
  FiPhone,
  FiPlus,
  FiSearch,
  FiSend,
  FiSmile,
  FiUsers,
  FiVideo,
  FiWifi,
  FiWifiOff,
  FiX,
} from "react-icons/fi";
import { MdOutlinePushPin } from "react-icons/md";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import NewChatModal from "../../components/chat/NewChatModal.jsx";
import CreateGroupModal from "../../components/chat/CreateGroupModal.jsx";

import { useAuth } from "../../context/AuthContext.jsx";
import useSocket from "../../socket/useSocket.js";
import { emitWithAck } from "../../socket/socketClient.js";

import {
  createDirectConversation,
  createGroup,
  getConversations,
  getMessages,
  markConversationRead,
  sendMessageRest,
  toggleConversationPin,
} from "../../services/chatService.js";

import getErrorMessage, {
  getStructuredErrorFeedback,
} from "../../utils/getErrorMessage.js";

import {
  createTemporaryId,
  formatConversationTime,
  formatDateSeparator,
  formatMessageTime,
  getConversationTitle,
  getInitials,
  getUserId,
  mergeMessages,
  sortConversations,
  upsertConversation,
} from "../../utils/chatHelpers.js";

import {
  applyDeliveryReceipt,
  applyMemberRemoved,
  applyMessageNew,
  applyOptimisticReplace,
  applyReadReceipt,
  applyStopTyping,
  applyTypingUsers,
} from "../../utils/chatRealtimeState.js";

const ChatPage = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const {
    socket,
    isConnected,
    connectionError,
    isUserOnline,
  } = useSocket();

  const currentUserId = getUserId(user);
  const chatBasePath = `/${user?.role}/chat`;

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] =
    useState(true);
  const [conversationError, setConversationError] =
    useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] =
    useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] =
    useState(false);
  const [activeConversation, setActiveConversation] =
    useState(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] =
    useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const lastReadKeyRef = useRef("");
  const joinedConversationRef = useRef(null);

  const canCreateGroup =
    user?.role === "teacher" || user?.role === "admin";

  const filteredConversations = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = getConversationTitle(conversation)
        .toLowerCase();
      const preview = (
        conversation.lastMessage?.text || ""
      ).toLowerCase();

      return (
        title.includes(query) || preview.includes(query)
      );
    });
  }, [conversations, sidebarSearch]);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationError("");

    try {
      const list = await getConversations();
      setConversations(sortConversations(list));
    } catch (error) {
      setConversationError(
        getErrorMessage(
          error,
          "Unable to load conversations"
        )
      );
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversations();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    });
  }, []);

  const openConversation = useCallback(
    (id) => {
      if (!id) {
        navigate(chatBasePath);
        return;
      }

      navigate(`${chatBasePath}/${id}`);
    },
    [chatBasePath, navigate]
  );

  const markActiveRead = useCallback(
    async (targetConversationId, messageList) => {
      if (
        !targetConversationId ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const unreadIncoming = (messageList || []).filter(
        (message) =>
          message.sender?.id &&
          message.sender.id !== currentUserId &&
          !(message.seenBy || []).some(
            (entry) => entry.userId === currentUserId
          )
      );

      const key = `${targetConversationId}:${unreadIncoming
        .map((message) => message.id)
        .join(",")}`;

      if (key === lastReadKeyRef.current) {
        return;
      }

      lastReadKeyRef.current = key;

      try {
        if (socket?.connected) {
          await emitWithAck("message:read", {
            conversationId: targetConversationId,
          });
        } else {
          await markConversationRead(targetConversationId);
        }

        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === targetConversationId
              ? {
                  ...conversation,
                  unreadCount: 0,
                }
              : conversation
          )
        );

        setActiveConversation((previous) =>
          previous?.id === targetConversationId
            ? {
                ...previous,
                unreadCount: 0,
              }
            : previous
        );
      } catch {
        lastReadKeyRef.current = "";
      }
    },
    [currentUserId, socket]
  );

  const loadConversationMessages = useCallback(
    async (id, { preserveScroll = false } = {}) => {
      if (!id) {
        setMessages([]);
        setActiveConversation(null);
        return;
      }

      setLoadingMessages(true);

      try {
        const [conversationList, messageResult] =
          await Promise.all([
            getConversations(),
            getMessages(id, { limit: 40 }),
          ]);

        const sorted = sortConversations(conversationList);
        setConversations(sorted);

        const found =
          sorted.find((item) => item.id === id) || null;

        setActiveConversation(found);
        setMessages(messageResult.messages || []);
        setHasMoreMessages(
          Boolean(messageResult.pagination?.hasMore)
        );

        if (!preserveScroll) {
          scrollToBottom(false);
        }

        await markActiveRead(
          id,
          messageResult.messages || []
        );
      } catch (error) {
        toast.error(
          getErrorMessage(
            error,
            "Unable to open conversation"
          )
        );
      } finally {
        setLoadingMessages(false);
      }
    },
    [markActiveRead, scrollToBottom]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversationMessages(conversationId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [conversationId, loadConversationMessages]);

  useEffect(() => {
    if (!socket || !isConnected || !conversationId) {
      return undefined;
    }

    let cancelled = false;

    const joinConversation = async () => {
      try {
        if (
          joinedConversationRef.current &&
          joinedConversationRef.current !== conversationId
        ) {
          await emitWithAck("conversation:leave", {
            conversationId: joinedConversationRef.current,
          }).catch(() => null);
        }

        const data = await emitWithAck(
          "conversation:join",
          { conversationId }
        );

        if (cancelled) {
          return;
        }

        joinedConversationRef.current = conversationId;

        if (data.conversation) {
          setActiveConversation(data.conversation);
          setConversations((previous) =>
            upsertConversation(
              previous,
              data.conversation
            )
          );
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            getErrorMessage(
              error,
              "Unable to join conversation"
            )
          );
        }
      }
    };

    joinConversation();

    return () => {
      cancelled = true;
    };
  }, [socket, isConnected, conversationId]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleMessageNew = (payload) => {
      const message = payload?.message;

      if (!message?.conversationId) {
        return;
      }

      setMessages((previousMessages) => {
        const result = applyMessageNew({
          conversations,
          messages: previousMessages,
          activeConversationId: conversationId,
          currentUserId,
          message,
        });

        if (result.shouldMarkRead) {
          markActiveRead(conversationId, [message]);
        }

        if (conversationId === message.conversationId) {
          scrollToBottom(true);
        }

        return result.messages;
      });

      setConversations((previousConversations) => {
        const result = applyMessageNew({
          conversations: previousConversations,
          messages,
          activeConversationId: conversationId,
          currentUserId,
          message,
        });

        if (result.shouldReloadList) {
          loadConversations();
          return previousConversations;
        }

        return result.conversations;
      });
    };

    const handleDelivered = (payload) => {
      setMessages((previous) =>
        applyDeliveryReceipt({
          messages: previous,
          payload,
        })
      );
    };

    const handleRead = (payload) => {
      setMessages((previous) => {
        const result = applyReadReceipt({
          messages: previous,
          conversations,
          payload,
          currentUserId,
        });

        setConversations(result.conversations);
        return result.messages;
      });
    };

    const handleTyping = (payload) => {
      setTypingUsers((previous) =>
        applyTypingUsers({
          typingUsers: previous,
          payload,
          currentUserId,
          activeConversationId: conversationId,
        })
      );
    };

    const handleStopTyping = (payload) => {
      setTypingUsers((previous) =>
        applyStopTyping({
          typingUsers: previous,
          payload,
          activeConversationId: conversationId,
        })
      );
    };

    const handleConversationUpdated = (payload) => {
      const conversation = payload?.conversation;

      if (conversation?.id) {
        setConversations((previous) =>
          upsertConversation(previous, conversation)
        );

        if (conversation.id === conversationId) {
          setActiveConversation(conversation);
        }

        return;
      }

      if (payload?.conversationId) {
        setConversations((previous) =>
          previous.map((item) => {
            if (item.id !== payload.conversationId) {
              return item;
            }

            return {
              ...item,
              lastMessage:
                payload.lastMessage || item.lastMessage,
              lastMessageAt:
                payload.lastMessageAt ||
                item.lastMessageAt,
              unreadCount:
                payload.unreadCount ?? item.unreadCount,
            };
          })
        );
      }
    };

    const handleMemberRemoved = (payload) => {
      const result = applyMemberRemoved({
        conversations,
        activeConversationId: conversationId,
        payload,
        currentUserId,
      });

      if (result.shouldNavigateAway) {
        toast("You were removed from a conversation");
        navigate(chatBasePath);
      } else if (payload?.removedUserId !== currentUserId) {
        loadConversations();
        return;
      }

      setConversations(result.conversations);
    };

    const handleMemberAdded = (payload) => {
      if (payload?.member?.id === currentUserId) {
        loadConversations();
      } else if (
        payload?.conversationId === conversationId
      ) {
        loadConversationMessages(conversationId, {
          preserveScroll: true,
        });
      }
    };

    const handleReconnect = () => {
      loadConversations();

      if (conversationId) {
        loadConversationMessages(conversationId);
        emitWithAck("conversation:join", {
          conversationId,
        }).catch(() => null);
      }
    };

    socket.on("message:new", handleMessageNew);
    socket.on("message:delivered", handleDelivered);
    socket.on("message:read", handleRead);
    socket.on("message:typing", handleTyping);
    socket.on("message:stop-typing", handleStopTyping);
    socket.on(
      "conversation:updated",
      handleConversationUpdated
    );
    socket.on("member:removed", handleMemberRemoved);
    socket.on("member:added", handleMemberAdded);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("message:new", handleMessageNew);
      socket.off("message:delivered", handleDelivered);
      socket.off("message:read", handleRead);
      socket.off("message:typing", handleTyping);
      socket.off("message:stop-typing", handleStopTyping);
      socket.off(
        "conversation:updated",
        handleConversationUpdated
      );
      socket.off("member:removed", handleMemberRemoved);
      socket.off("member:added", handleMemberAdded);
      socket.off("connect", handleReconnect);
    };
  }, [
    socket,
    conversationId,
    currentUserId,
    chatBasePath,
    navigate,
    loadConversations,
    loadConversationMessages,
    markActiveRead,
    messages,
    scrollToBottom,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        conversationId
      ) {
        markActiveRead(conversationId, messages);
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [conversationId, markActiveRead, messages]);

  const emitStopTyping = useCallback(async () => {
    if (!conversationId || !socket?.connected) {
      return;
    }

    try {
      await emitWithAck("message:stop-typing", {
        conversationId,
      });
    } catch {
      // ignore
    }
  }, [conversationId, socket]);

  const handleDraftChange = (value) => {
    setDraft(value);

    if (!conversationId || !socket?.connected) {
      return;
    }

    if (!value.trim()) {
      emitStopTyping();
      return;
    }

    if (typingTimeoutRef.current) {
      return;
    }

    typingTimeoutRef.current = setTimeout(async () => {
      typingTimeoutRef.current = null;

      try {
        await emitWithAck("message:typing", {
          conversationId,
        });
      } catch {
        // ignore
      }
    }, 400);

    if (stopTypingTimeoutRef.current) {
      clearTimeout(stopTypingTimeoutRef.current);
    }

    stopTypingTimeoutRef.current = setTimeout(() => {
      emitStopTyping();
    }, 2500);
  };

  const handleSend = async () => {
    const text = draft.trim();

    if (
      !text ||
      !conversationId ||
      sending ||
      activeConversation?.permissions?.canSend === false
    ) {
      return;
    }

    const temporaryId = createTemporaryId();
    const optimistic = {
      id: temporaryId,
      temporaryId,
      conversationId,
      text,
      type: "text",
      sender: {
        id: currentUserId,
        name: user?.name,
        role: user?.role,
      },
      deliveredTo: [],
      seenBy: [],
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setDraft("");
    setSending(true);
    setMessages((previous) =>
      mergeMessages(previous, [optimistic])
    );
    scrollToBottom(true);
    emitStopTyping();

    try {
      let saved;

      if (socket?.connected) {
        const data = await emitWithAck("message:send", {
          conversationId,
          text,
          temporaryId,
        });

        saved = data.message;
      } else {
        saved = await sendMessageRest(conversationId, {
          text,
          temporaryId,
        });
      }

      setMessages((previous) =>
        applyOptimisticReplace({
          messages: previous,
          temporaryId,
          savedMessage: saved,
        })
      );
    } catch (error) {
      setMessages((previous) =>
        previous.map((message) =>
          message.temporaryId === temporaryId
            ? {
                ...message,
                status: "failed",
              }
            : message
        )
      );

      const feedback = getStructuredErrorFeedback(error);
      toast.error(feedback.message);
    } finally {
      setSending(false);
    }
  };

  const retryFailedMessage = async (message) => {
    if (!message?.temporaryId || !conversationId) {
      return;
    }

    setMessages((previous) =>
      previous.map((item) =>
        item.temporaryId === message.temporaryId
          ? {
              ...item,
              status: "pending",
            }
          : item
      )
    );

    try {
      let saved;

      if (socket?.connected) {
        const data = await emitWithAck("message:send", {
          conversationId,
          text: message.text,
          temporaryId: message.temporaryId,
        });

        saved = data.message;
      } else {
        saved = await sendMessageRest(conversationId, {
          text: message.text,
          temporaryId: message.temporaryId,
        });
      }

      setMessages((previous) =>
        mergeMessages(
          previous.filter(
            (item) =>
              item.temporaryId !== message.temporaryId
          ),
          [saved]
        )
      );
    } catch (error) {
      setMessages((previous) =>
        previous.map((item) =>
          item.temporaryId === message.temporaryId
            ? {
                ...item,
                status: "failed",
              }
            : item
        )
      );

      toast.error(
        getErrorMessage(error, "Retry failed")
      );
    }
  };

  const loadOlderMessages = async () => {
    if (
      !conversationId ||
      !hasMoreMessages ||
      loadingOlder ||
      messages.length === 0
    ) {
      return;
    }

    const oldest = messages[0];
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight || 0;

    setLoadingOlder(true);

    try {
      const result = await getMessages(conversationId, {
        before: oldest.id,
        limit: 30,
      });

      setMessages((previous) =>
        mergeMessages(result.messages || [], previous)
      );
      setHasMoreMessages(
        Boolean(result.pagination?.hasMore)
      );

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop =
            container.scrollHeight - previousHeight;
        }
      });
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to load older messages"
        )
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSelectUser = async (selectedUser) => {
    try {
      const result = await createDirectConversation(
        getUserId(selectedUser)
      );

      const conversation = result.conversation;

      setConversations((previous) =>
        upsertConversation(previous, conversation)
      );
      setNewChatOpen(false);
      openConversation(conversation.id);

      if (result.wasCreated) {
        toast.success("Conversation started");
      }
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to start conversation"
        )
      );
      throw error;
    }
  };

  const handleCreateGroup = async (payload) => {
    const result = await createGroup(payload);
    const conversation = result.conversation;

    setConversations((previous) =>
      upsertConversation(previous, conversation)
    );
    setCreateGroupOpen(false);
    openConversation(conversation.id);
    toast.success("Group created");
  };

  const handlePin = async () => {
    if (!conversationId) {
      return;
    }

    try {
      const conversation =
        await toggleConversationPin(conversationId);

      setConversations((previous) =>
        upsertConversation(previous, conversation)
      );
      setActiveConversation(conversation);
      setMenuOpen(false);
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Unable to update pin state"
        )
      );
    }
  };

  const partnerOnline =
    activeConversation?.type === "direct" &&
    activeConversation?.partner?.id
      ? isUserOnline(activeConversation.partner.id)
      : false;

  const typingLabel = typingUsers.length
    ? typingUsers.length === 1
      ? `${typingUsers[0].name} is typing...`
      : `${typingUsers.length} people are typing...`
    : "";

  const showChatPane = Boolean(conversationId);

  const renderReceipt = (message) => {
    if (message.sender?.id !== currentUserId) {
      return null;
    }

    if (message.status === "failed") {
      return (
        <button
          type="button"
          className="text-[10px] text-red-300 underline"
          onClick={() => retryFailedMessage(message)}
        >
          Failed · Retry
        </button>
      );
    }

    if (message.status === "pending") {
      return (
        <FiLoader className="h-3 w-3 animate-spin text-white/70" />
      );
    }

    const otherMemberIds = (
      activeConversation?.members || []
    )
      .map((member) => member.id)
      .filter((id) => id !== currentUserId);

    const seen = otherMemberIds.length
      ? otherMemberIds.every((id) =>
          (message.seenBy || []).some(
            (entry) => entry.userId === id
          )
        )
      : (message.seenBy || []).length > 0;

    const delivered = otherMemberIds.length
      ? otherMemberIds.every((id) =>
          (message.deliveredTo || []).some(
            (entry) => entry.userId === id
          )
        )
      : (message.deliveredTo || []).length > 0;

    if (seen) {
      return (
        <FiCheckCircle
          className="h-3.5 w-3.5 text-sky-300"
          aria-label="Read"
        />
      );
    }

    if (delivered) {
      return (
        <span className="inline-flex" aria-label="Delivered">
          <FiCheck className="h-3.5 w-3.5 text-white/70" />
          <FiCheck className="-ml-1.5 h-3.5 w-3.5 text-white/70" />
        </span>
      );
    }

    return (
      <FiCheck
        className="h-3.5 w-3.5 text-white/50"
        aria-label="Sent"
      />
    );
  };

  const messageNodes = useMemo(() => {
    return messages.reduce((nodes, message) => {
      const dateLabel = formatDateSeparator(
        message.createdAt
      );
      const previousDateLabel =
        nodes.length > 0
          ? nodes[nodes.length - 1].dateLabel
          : null;

      nodes.push({
        message,
        dateLabel,
        showSeparator: dateLabel !== previousDateLabel,
        isMine: message.sender?.id === currentUserId,
        isSystem: message.type === "system",
      });

      return nodes;
    }, []);
  }, [messages, currentUserId]);

  return (
    <DashboardLayout
      title="Campus Chat"
      description="Realtime campus messaging"
    >
      <div className="-mx-4 -my-8 flex h-[calc(100vh-8.5rem)] min-h-[32rem] overflow-hidden border-y border-white/10 bg-[#313338] sm:-mx-6 lg:-mx-8 lg:rounded-2xl lg:border">
        {/* Sidebar */}
        <aside
          className={`${
            showChatPane ? "hidden md:flex" : "flex"
          } w-full flex-col border-r border-white/10 bg-[#2b2d31] md:w-[22rem] lg:w-[24rem]`}
        >
          <div className="border-b border-white/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Chats</h2>
                {isConnected ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                    title="Connected"
                  >
                    <FiWifi className="h-3 w-3" />
                    Live
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
                    title={
                      connectionError || "Disconnected"
                    }
                  >
                    <FiWifiOff className="h-3 w-3" />
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Start new chat"
                  onClick={() => setNewChatOpen(true)}
                  className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                >
                  <FiPlus className="h-5 w-5" />
                </button>

                {canCreateGroup && (
                  <button
                    type="button"
                    aria-label="Create group"
                    onClick={() =>
                      setCreateGroupOpen(true)
                    }
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiUsers className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />
              <input
                value={sidebarSearch}
                onChange={(event) =>
                  setSidebarSearch(event.target.value)
                }
                placeholder="Search chats"
                className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-purple-400"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#b5bac1]">
                <FiLoader className="h-4 w-4 animate-spin" />
                Loading chats...
              </div>
            )}

            {!loadingConversations &&
              conversationError && (
                <p className="px-4 py-8 text-center text-sm text-red-300">
                  {conversationError}
                </p>
              )}

            {!loadingConversations &&
              !conversationError &&
              filteredConversations.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-[#b5bac1]">
                  <FiMessageCircle className="h-8 w-8" />
                  <p className="text-sm">
                    No conversations yet. Start a new chat.
                  </p>
                </div>
              )}

            {filteredConversations.map((conversation) => {
              const title =
                getConversationTitle(conversation);
              const isActive =
                conversation.id === conversationId;
              const online =
                conversation.type === "direct" &&
                conversation.partner?.id
                  ? isUserOnline(conversation.partner.id)
                  : false;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() =>
                    openConversation(conversation.id)
                  }
                  className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition ${
                    isActive
                      ? "bg-purple-600/20"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
                      {conversation.type === "direct" ? (
                        getInitials(title)
                      ) : (
                        <FiUsers className="h-5 w-5" />
                      )}
                    </div>

                    {online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#2b2d31] bg-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1 truncate font-semibold text-white">
                        {conversation.isPinned && (
                          <MdOutlinePushPin className="h-3.5 w-3.5 shrink-0 text-purple-300" />
                        )}
                        <span className="truncate">
                          {title}
                        </span>
                      </p>

                      <span className="shrink-0 text-[11px] text-[#949ba4]">
                        {formatConversationTime(
                          conversation.lastMessageAt
                        )}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[#b5bac1]">
                        {conversation.lastMessage?.text ||
                          "No messages yet"}
                      </p>

                      {conversation.unreadCount > 0 && (
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {conversation.unreadCount > 99
                            ? "99+"
                            : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main chat pane */}
        <section
          className={`${
            showChatPane ? "flex" : "hidden md:flex"
          } min-w-0 flex-1 flex-col bg-[#313338]`}
        >
          {!conversationId && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-[#b5bac1]">
              <FiMessageCircle className="h-12 w-12 text-purple-300/70" />
              <h3 className="text-xl font-bold text-white">
                CampusConnect Chat
              </h3>
              <p className="max-w-sm text-sm">
                Select a conversation or start a new chat
                with eligible students and teachers.
              </p>
            </div>
          )}

          {conversationId && (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#2b2d31] px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label="Back to conversations"
                    onClick={() => navigate(chatBasePath)}
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white md:hidden"
                  >
                    <FiArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
                      {activeConversation?.type ===
                      "direct" ? (
                        getInitials(
                          getConversationTitle(
                            activeConversation
                          )
                        )
                      ) : (
                        <FiUsers className="h-5 w-5" />
                      )}
                    </div>

                    {partnerOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#2b2d31] bg-emerald-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {getConversationTitle(
                        activeConversation
                      )}
                    </p>
                    <p className="truncate text-xs text-[#b5bac1]">
                      {typingLabel ||
                        (activeConversation?.type ===
                        "direct"
                          ? partnerOnline
                            ? "Online"
                            : activeConversation?.partner
                                ?.lastSeenAt
                              ? `Last seen ${formatConversationTime(
                                  activeConversation
                                    .partner.lastSeenAt
                                )}`
                              : "Offline"
                          : `${
                              activeConversation
                                ?.memberCount ||
                              activeConversation?.members
                                ?.length ||
                              0
                            } members`)}
                    </p>
                  </div>
                </div>

                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Start audio call"
                    onClick={() =>
                      toast(
                        "Audio calling will be available in the calling phase."
                      )
                    }
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiPhone className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="Start video call"
                    onClick={() =>
                      toast(
                        "Video calling will be available in the calling phase."
                      )
                    }
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiVideo className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="More options"
                    onClick={() =>
                      setMenuOpen((previous) => !previous)
                    }
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiMoreVertical className="h-5 w-5" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22] shadow-xl">
                      <button
                        type="button"
                        onClick={handlePin}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                      >
                        <MdOutlinePushPin className="h-4 w-4" />
                        {activeConversation?.isPinned
                          ? "Unpin chat"
                          : "Pin chat"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                      >
                        <FiX className="h-4 w-4" />
                        Close menu
                      </button>
                    </div>
                  )}
                </div>
              </header>

              <div
                ref={messagesContainerRef}
                className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4"
              >
                {hasMoreMessages && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                      className="inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-xs font-semibold text-[#b5bac1] transition hover:bg-black/30 disabled:opacity-50"
                    >
                      {loadingOlder ? (
                        <FiLoader className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Load older messages
                    </button>
                  </div>
                )}

                {loadingMessages && (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#b5bac1]">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading messages...
                  </div>
                )}

                {!loadingMessages &&
                  messages.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center text-[#b5bac1]">
                      <FiMessageCircle className="h-8 w-8" />
                      <p className="text-sm">
                        No messages yet. Say hello.
                      </p>
                    </div>
                  )}

                {messageNodes.map(
                  ({
                    message,
                    dateLabel,
                    showSeparator,
                    isMine,
                    isSystem,
                  }) => (
                    <div
                      key={
                        message.id ||
                        message.temporaryId
                      }
                    >
                      {showSeparator && (
                        <div className="my-4 flex justify-center">
                          <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-[#b5bac1]">
                            {dateLabel}
                          </span>
                        </div>
                      )}

                      {isSystem ? (
                        <div className="flex justify-center py-1">
                          <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] text-[#b5bac1]">
                            {message.text}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`flex ${
                            isMine
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[70%] ${
                              isMine
                                ? "rounded-br-md bg-purple-600 text-white"
                                : "rounded-bl-md bg-[#2b2d31] text-[#dbdee1]"
                            }`}
                          >
                            {!isMine &&
                              activeConversation?.type !==
                                "direct" && (
                                <p className="mb-1 text-[11px] font-semibold text-purple-200">
                                  {message.sender?.name}
                                </p>
                              )}

                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.text}
                            </p>

                            <div
                              className={`mt-1 flex items-center gap-1 ${
                                isMine
                                  ? "justify-end"
                                  : "justify-start"
                              }`}
                            >
                              <span className="text-[10px] opacity-70">
                                {formatMessageTime(
                                  message.createdAt
                                )}
                              </span>
                              {renderReceipt(message)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                <div ref={messagesEndRef} />
              </div>

              <footer className="border-t border-white/10 bg-[#2b2d31] px-3 py-3 sm:px-4">
                {activeConversation?.permissions
                  ?.canSend === false ? (
                  <p className="rounded-xl bg-black/20 px-3 py-3 text-center text-sm text-[#b5bac1]">
                    Only group administrators can send
                    messages in this conversation.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      aria-label="Emoji"
                      onClick={() =>
                        toast(
                          "Emoji picker coming soon"
                        )
                      }
                      className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                    >
                      <FiSmile className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      aria-label="Attach file"
                      onClick={() =>
                        toast(
                          "Attachments coming soon"
                        )
                      }
                      className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                    >
                      <FiPaperclip className="h-5 w-5" />
                    </button>

                    <textarea
                      value={draft}
                      onChange={(event) =>
                        handleDraftChange(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey
                        ) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      placeholder="Type a message"
                      className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                    />

                    <button
                      type="button"
                      aria-label="Send message"
                      onClick={handleSend}
                      disabled={
                        !draft.trim() || sending
                      }
                      className="rounded-xl bg-purple-600 p-3 text-white transition hover:bg-purple-500 disabled:opacity-50"
                    >
                      {sending ? (
                        <FiLoader className="h-5 w-5 animate-spin" />
                      ) : (
                        <FiSend className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>
      </div>

      {newChatOpen ? (
        <NewChatModal
          onClose={() => setNewChatOpen(false)}
          onSelectUser={handleSelectUser}
          currentUser={user}
          isUserOnline={isUserOnline}
        />
      ) : null}

      {createGroupOpen ? (
        <CreateGroupModal
          onClose={() => setCreateGroupOpen(false)}
          onCreate={handleCreateGroup}
          currentUser={user}
        />
      ) : null}
    </DashboardLayout>
  );
};

export default ChatPage;
