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
import GroupDetailsPanel from "../../components/chat/GroupDetailsPanel.jsx";
import CallHistoryPanel from "../../components/chat/CallHistoryPanel.jsx";
import MessageBubble from "../../components/chat/MessageBubble.jsx";
import VoiceRecorder from "../../components/chat/VoiceRecorder.jsx";
import ChatEmojiPicker from "../../components/chat/ChatEmojiPicker.jsx";
import CallOverlay from "../../components/chat/CallOverlay.jsx";
import NotificationCenter from "../../components/chat/NotificationCenter.jsx";
import ConfirmDialog from "../../components/chat/ConfirmDialog.jsx";

import { useAuth } from "../../context/AuthContext.jsx";
import useSocket from "../../socket/useSocket.js";
import useWebRTCCall from "../../hooks/useWebRTCCall.js";
import useResizableSidebar from "../../hooks/useResizableSidebar.js";
import { emitWithAck } from "../../socket/socketClient.js";

import {
  acceptCall,
  clearConversationForMe,
  createDirectConversation,
  createGroup,
  deleteGroupConversation,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  endCall,
  forwardMessage,
  getConversations,
  getMessages,
  getPinnedMessages,
  getUnreadNotificationCount,
  getUploadAbsoluteUrl,
  hideConversationForMe,
  leaveConversation,
  markConversationRead,
  pinMessage,
  reactToMessage,
  rejectCall,
  searchMessages,
  sendMessageRest,
  startCall,
  toggleConversationPin,
  uploadChatAttachments,
} from "../../services/chatService.js";

import getErrorMessage, {
  getStructuredErrorFeedback,
} from "../../utils/getErrorMessage.js";

import {
  createTemporaryId,
  formatConversationTime,
  formatDateSeparator,
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

import {
  applyMessageDeletedForEveryone,
  applyMessageDeletedForMe,
  applyMessageUpdated,
} from "../../utils/chatPhase5State.js";

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
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardSelectedIds, setForwardSelectedIds] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [notificationUnread, setNotificationUnread] =
    useState(0);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDesktopLayout, setIsDesktopLayout] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true
  );

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] =
    useState(false);
  /*
    The panel is tied to a conversation ID so switching chats
    closes it without an extra effect.
  */
  const [groupPanelConversationId, setGroupPanelConversationId] =
    useState(null);
  const [callHistoryConversationId, setCallHistoryConversationId] =
    useState(null);

  const fileInputRef = useRef(null);
  const composerRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const conversationMenuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);
  const lastReadKeyRef = useRef("");
  const joinedConversationRef = useRef(null);

  const canCreateGroup =
    user?.role === "teacher" || user?.role === "admin";

  const {
    width: sidebarWidth,
    isResizing,
    onResizePointerDown,
    onResizeKeyDown,
  } = useResizableSidebar({ enabled: isDesktopLayout });

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktopLayout(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!emojiPickerOpen && !menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        emojiPickerOpen &&
        !emojiPickerRef.current?.contains(event.target)
      ) {
        setEmojiPickerOpen(false);
      }

      if (
        menuOpen &&
        !conversationMenuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setEmojiPickerOpen(false);
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [emojiPickerOpen, menuOpen]);

  const insertComposerEmoji = (emoji) => {
    const textarea = composerRef.current;

    if (!textarea) {
      setDraft((previous) => `${previous}${emoji}`);
      setEmojiPickerOpen(false);
      return;
    }

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    setEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      const cursor = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const {
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
  } = useWebRTCCall({
    socket,
    currentUserId,
    activeCall:
      activeCall?.status === "active" ||
      activeCall?.status === "ringing"
        ? activeCall
        : null,
  });

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

  /**
   * Pinned chats stay on top, then groups, then direct chats.
   * Ordering inside each block already follows last activity.
   */
  const conversationSections = useMemo(() => {
    const pinned = [];
    const groups = [];
    const directs = [];

    for (const conversation of filteredConversations) {
      if (conversation.isPinned) {
        pinned.push(conversation);
      } else if (conversation.type === "direct") {
        directs.push(conversation);
      } else {
        groups.push(conversation);
      }
    }

    return [
      { id: "pinned", label: "Pinned", items: pinned },
      { id: "groups", label: "Groups", items: groups },
      {
        id: "direct",
        label: "Direct chats",
        items: directs,
      },
    ].filter((section) => section.items.length > 0);
  }, [filteredConversations]);

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
      getUnreadNotificationCount()
        .then(setNotificationUnread)
        .catch(() => {});
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

  const groupPanelOpen =
    Boolean(conversationId) &&
    groupPanelConversationId === conversationId;

  const callHistoryOpen =
    Boolean(conversationId) &&
    callHistoryConversationId === conversationId;

  const setGroupPanelOpen = (open) => {
    setGroupPanelConversationId(
      open ? conversationId || null : null
    );

    if (open) {
      setCallHistoryConversationId(null);
    }
  };

  const setCallHistoryOpen = (open) => {
    setCallHistoryConversationId(
      open ? conversationId || null : null
    );

    if (open) {
      setGroupPanelConversationId(null);
    }
  };

  const toggleGroupPanel = () => {
    setCallHistoryConversationId(null);
    setGroupPanelConversationId((previous) =>
      previous === conversationId
        ? null
        : conversationId || null
    );
  };

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

    const handleMessageEdited = (payload) => {
      if (!payload?.message) return;
      setMessages((previous) =>
        applyMessageUpdated({
          messages: previous,
          message: payload.message,
        })
      );
    };

    const handleMessageDeleted = (payload) => {
      if (payload?.scope === "me" && payload.messageId) {
        setMessages((previous) =>
          applyMessageDeletedForMe({
            messages: previous,
            messageId: payload.messageId,
          })
        );
        return;
      }

      if (payload?.message) {
        setMessages((previous) =>
          applyMessageDeletedForEveryone({
            messages: previous,
            message: payload.message,
          })
        );
      }
    };

    const handleMessageReaction = (payload) => {
      if (!payload?.message) return;
      setMessages((previous) =>
        applyMessageUpdated({
          messages: previous,
          message: payload.message,
        })
      );
    };

    const handleMessagePinned = (payload) => {
      if (!payload?.message) return;
      setMessages((previous) =>
        applyMessageUpdated({
          messages: previous,
          message: payload.message,
        })
      );
    };

    const handleCallIncoming = (payload) => {
      if (payload?.call) {
        setIncomingCall(payload.call);
      }
    };

    const handleCallRinging = (payload) => {
      if (payload?.call) {
        setActiveCall(payload.call);
      }
    };

    const handleCallAccept = (payload) => {
      if (payload?.call) {
        setActiveCall(payload.call);
        setIncomingCall(null);
      }
    };

    const handleCallEndLike = (payload) => {
      if (!payload?.call) return;
      setActiveCall((previous) =>
        previous?.id === payload.call.id ? null : previous
      );
      setIncomingCall((previous) =>
        previous?.id === payload.call.id ? null : previous
      );
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
    socket.on("message:edited", handleMessageEdited);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:reaction", handleMessageReaction);
    socket.on("message:pinned", handleMessagePinned);
    socket.on("call:incoming", handleCallIncoming);
    socket.on("call:ringing", handleCallRinging);
    socket.on("call:accept", handleCallAccept);
    socket.on("call:end", handleCallEndLike);
    socket.on("call:reject", handleCallEndLike);
    socket.on("call:busy", handleCallEndLike);

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
      socket.off("message:edited", handleMessageEdited);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:reaction", handleMessageReaction);
      socket.off("message:pinned", handleMessagePinned);
      socket.off("call:incoming", handleCallIncoming);
      socket.off("call:ringing", handleCallRinging);
      socket.off("call:accept", handleCallAccept);
      socket.off("call:end", handleCallEndLike);
      socket.off("call:reject", handleCallEndLike);
      socket.off("call:busy", handleCallEndLike);
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

    if (editingMessage) {
      setSending(true);

      try {
        let saved;

        if (socket?.connected) {
          const data = await emitWithAck("message:edit", {
            messageId: editingMessage.id,
            text,
          });
          saved = data.message;
        } else {
          saved = await editMessage(editingMessage.id, text);
        }

        setMessages((previous) =>
          applyMessageUpdated({
            messages: previous,
            message: saved,
          })
        );
        setEditingMessage(null);
        setDraft("");
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to edit"));
      } finally {
        setSending(false);
      }

      return;
    }

    const temporaryId = createTemporaryId();
    const replyToId = replyTo?.id || null;
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
      replyTo: replyTo
        ? {
            id: replyTo.id,
            text: replyTo.text,
            sender: replyTo.sender,
          }
        : null,
      deliveredTo: [],
      seenBy: [],
      createdAt: new Date().toISOString(),
      status: "pending",
    };

    setDraft("");
    setReplyTo(null);
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
          replyTo: replyToId,
        });

        saved = data.message;
      } else {
        saved = await sendMessageRest(conversationId, {
          text,
          temporaryId,
          replyTo: replyToId,
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

  const handleGroupUpdated = (conversation) => {
    if (!conversation?.id) {
      return;
    }

    setConversations((previous) =>
      upsertConversation(previous, conversation)
    );

    setActiveConversation((previous) =>
      previous && previous.id === conversation.id
        ? { ...previous, ...conversation }
        : previous
    );
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

  const upsertMessageLocal = (message) => {
    setMessages((previous) =>
      applyMessageUpdated({ messages: previous, message })
    );
  };

  const handleReact = async (message, emoji) => {
    try {
      let saved;

      if (socket?.connected) {
        const data = await emitWithAck("message:react", {
          messageId: message.id,
          emoji,
        });
        saved = data.message;
      } else {
        saved = await reactToMessage(message.id, emoji);
      }

      upsertMessageLocal(saved);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to react"));
    }
  };

  const handleDeleteMe = (message) => {
    setConfirmAction({
      type: "deleteMe",
      message,
      title: "Delete for me",
      description:
        "This message will be removed only from your view.",
      confirmLabel: "Delete for me",
      destructive: true,
    });
  };

  const handleDeleteEveryone = (message) => {
    setConfirmAction({
      type: "deleteEveryone",
      message,
      title: "Delete for everyone",
      description:
        'This message will be replaced with "This message was deleted" for conversation members.',
      confirmLabel: "Delete for everyone",
      destructive: true,
    });
  };

  const runDeleteMe = async (message) => {
    try {
      if (socket?.connected) {
        await emitWithAck("message:delete", {
          messageId: message.id,
          scope: "me",
        });
      } else {
        await deleteMessageForMe(message.id);
      }

      setMessages((previous) =>
        applyMessageDeletedForMe({
          messages: previous,
          messageId: message.id,
        })
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete"));
      throw error;
    }
  };

  const runDeleteEveryone = async (message) => {
    try {
      let saved;

      if (socket?.connected) {
        const data = await emitWithAck("message:delete", {
          messageId: message.id,
          scope: "everyone",
        });
        saved = data.message;
      } else {
        saved = await deleteMessageForEveryone(message.id);
      }

      setMessages((previous) =>
        applyMessageDeletedForEveryone({
          messages: previous,
          message: saved,
        })
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete"));
      throw error;
    }
  };

  const handlePinMessage = async (message) => {
    try {
      let saved;

      if (socket?.connected) {
        const data = await emitWithAck("message:pin", {
          messageId: message.id,
          pinned: !message.pinned,
        });
        saved = data.message;
      } else {
        saved = await pinMessage(message.id, !message.pinned);
      }

      upsertMessageLocal(saved);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to pin"));
    }
  };

  const handleForward = async (message) => {
    setForwardTarget(message);
    setForwardSelectedIds([]);
  };

  const toggleForwardSelection = (id) => {
    setForwardSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const confirmForward = async () => {
    if (!forwardTarget || forwardSelectedIds.length === 0) return;

    try {
      if (socket?.connected) {
        await emitWithAck("message:forward", {
          messageId: forwardTarget.id,
          conversationIds: forwardSelectedIds,
        });
      } else {
        await forwardMessage(forwardTarget.id, forwardSelectedIds);
      }

      toast.success(
        forwardSelectedIds.length === 1
          ? "Message forwarded"
          : `Message forwarded to ${forwardSelectedIds.length} chats`
      );
      setForwardTarget(null);
      setForwardSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to forward"));
    }
  };

  const openClearChatConfirm = () => {
    setMenuOpen(false);
    setConfirmText("");
    setConfirmAction({
      type: "clearChat",
      title: "Clear chat for me",
      description:
        "This clears the chat only for you. Other members keep their message history.",
      confirmLabel: "Clear chat",
      destructive: true,
    });
  };

  const openHideDirectConfirm = () => {
    setMenuOpen(false);
    setConfirmText("");
    setConfirmAction({
      type: "hideDirect",
      title: "Delete conversation",
      description:
        "This removes the conversation from your list only. The other person keeps the chat. It may reappear if they message you again.",
      confirmLabel: "Delete for me",
      destructive: true,
    });
  };

  const openLeaveGroupConfirm = () => {
    setMenuOpen(false);
    setConfirmText("");
    setConfirmAction({
      type: "leaveGroup",
      title: "Leave group",
      description:
        "You will leave this group and lose access until you are added again.",
      confirmLabel: "Leave group",
      destructive: true,
    });
  };

  const openDeleteGroupConfirm = () => {
    setMenuOpen(false);
    setConfirmText("");
    setConfirmAction({
      type: "deleteGroup",
      title: "Delete group",
      description:
        "This permanently deactivates the group for all members. Type the group name to confirm.",
      confirmLabel: "Delete group",
      destructive: true,
      requireText: getConversationTitle(activeConversation),
    });
  };

  const runConfirmAction = async () => {
    if (!confirmAction || !conversationId) {
      return;
    }

    setConfirmBusy(true);

    try {
      if (confirmAction.type === "deleteMe") {
        await runDeleteMe(confirmAction.message);
      } else if (confirmAction.type === "deleteEveryone") {
        await runDeleteEveryone(confirmAction.message);
      } else if (confirmAction.type === "clearChat") {
        await clearConversationForMe(conversationId);
        setMessages([]);
        setHasMoreMessages(false);
        toast.success("Chat cleared for you");
      } else if (confirmAction.type === "hideDirect") {
        await hideConversationForMe(conversationId);
        setConversations((previous) =>
          previous.filter((item) => item.id !== conversationId)
        );
        setActiveConversation(null);
        navigate(chatBasePath);
        toast.success("Conversation removed from your list");
      } else if (confirmAction.type === "leaveGroup") {
        await leaveConversation(conversationId);
        setConversations((previous) =>
          previous.filter((item) => item.id !== conversationId)
        );
        setActiveConversation(null);
        navigate(chatBasePath);
        toast.success("You left the group");
      } else if (confirmAction.type === "deleteGroup") {
        await deleteGroupConversation(conversationId);
        setConversations((previous) =>
          previous.filter((item) => item.id !== conversationId)
        );
        setActiveConversation(null);
        navigate(chatBasePath);
        toast.success("Group deleted");
      }

      setConfirmAction(null);
      setConfirmText("");
    } catch (error) {
      if (
        !["deleteMe", "deleteEveryone"].includes(confirmAction.type)
      ) {
        toast.error(
          getErrorMessage(error, "Unable to complete action")
        );
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleAttachFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";

    if (!files.length || !conversationId) {
      return;
    }

    setSending(true);
    setUploadProgress(0);

    try {
      const saved = await uploadChatAttachments(conversationId, {
        files,
        text: draft.trim(),
        replyTo: replyTo?.id,
        temporaryId: createTemporaryId(),
        onProgress: setUploadProgress,
      });

      setMessages((previous) => mergeMessages(previous, [saved]));
      setDraft("");
      setReplyTo(null);
      scrollToBottom(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload failed"));
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  const handleVoiceSend = async ({ file, duration, waveForm }) => {
    if (!conversationId) return;

    setRecordingVoice(false);
    setSending(true);
    setUploadProgress(0);

    try {
      const saved = await uploadChatAttachments(conversationId, {
        files: [file],
        asVoice: true,
        duration,
        waveForm,
        replyTo: replyTo?.id,
        temporaryId: createTemporaryId(),
        onProgress: setUploadProgress,
      });

      setMessages((previous) => mergeMessages(previous, [saved]));
      setReplyTo(null);
      scrollToBottom(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Voice upload failed"));
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  };

  const handleThreadSearch = async (value) => {
    setThreadSearch(value);

    if (!conversationId || !value.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const result = await searchMessages(conversationId, {
        q: value.trim(),
      });
      setSearchResults(result.messages || []);
    } catch {
      setSearchResults([]);
    }
  };

  const loadPinned = async () => {
    if (!conversationId) return;

    try {
      const list = await getPinnedMessages(conversationId);
      setPinnedMessages(list);
      setShowPinned(true);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load pins"));
    }
  };

  const jumpToMessage = (messageId) => {
    const node = document.getElementById(`message-${messageId}`);

    if (!node) {
      toast.error("Original message is unavailable");
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("ring-2", "ring-purple-400", "rounded-2xl");
    window.setTimeout(() => {
      node.classList.remove(
        "ring-2",
        "ring-purple-400",
        "rounded-2xl"
      );
    }, 1600);
  };

  const handleStartCall = async (type) => {
    if (!conversationId) return;

    try {
      let call;

      if (socket?.connected) {
        const data = await emitWithAck("call:start", {
          conversationId,
          type,
        });
        call = data.call;
      } else {
        call = await startCall(conversationId, { type });
      }

      setActiveCall(call);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to start call"));
    }
  };

  const handleAcceptIncoming = async () => {
    if (!incomingCall) return;

    try {
      let call;

      if (socket?.connected) {
        const data = await emitWithAck("call:accept", {
          callId: incomingCall.id,
        });
        call = data.call;
      } else {
        call = await acceptCall(incomingCall.id);
      }

      setActiveCall(call);
      setIncomingCall(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to accept call"));
    }
  };

  const handleRejectIncoming = async () => {
    if (!incomingCall) return;

    try {
      if (socket?.connected) {
        await emitWithAck("call:reject", {
          callId: incomingCall.id,
        });
      } else {
        await rejectCall(incomingCall.id);
      }
    } catch {
      // ignore
    } finally {
      setIncomingCall(null);
    }
  };

  const handleEndActiveCall = async () => {
    if (!activeCall) return;

    try {
      if (socket?.connected) {
        await emitWithAck("call:end", {
          callId: activeCall.id,
        });
      } else {
        await endCall(activeCall.id);
      }
    } catch {
      // ignore
    } finally {
      setActiveCall(null);
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

  const renderConversationItem = (conversation) => {
    const title = getConversationTitle(conversation);
    const isActive = conversation.id === conversationId;
    const isGroup = conversation.type !== "direct";
    const online =
      !isGroup && conversation.partner?.id
        ? isUserOnline(conversation.partner.id)
        : false;

    return (
      <button
        key={conversation.id}
        type="button"
        onClick={() => openConversation(conversation.id)}
        className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition ${
          isActive
            ? "bg-purple-600/20"
            : "hover:bg-white/5"
        }`}
      >
        <div className="relative shrink-0">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
            {isGroup && conversation.image ? (
              <img
                src={getUploadAbsoluteUrl(
                  conversation.image
                )}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : isGroup ? (
              <FiUsers className="h-5 w-5" />
            ) : (
              getInitials(title)
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

              <span className="truncate">{title}</span>
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

  return (
    <DashboardLayout
      title="Campus Chat"
      description="Realtime campus messaging"
    >
      <div
        className={`-mx-4 -my-8 flex h-[calc(100dvh-8.5rem)] min-h-[28rem] overflow-hidden border-y border-white/10 bg-[#313338] sm:-mx-6 lg:-mx-8 lg:h-[calc(100dvh-7.5rem)] lg:rounded-2xl lg:border ${
          isResizing ? "select-none" : ""
        }`}
      >
        {/* Sidebar */}
        <aside
          className={`${
            showChatPane ? "hidden md:flex" : "flex"
          } w-full min-w-0 flex-col border-r border-white/10 bg-[#2b2d31] md:shrink-0`}
          style={
            isDesktopLayout
              ? { width: `${sidebarWidth}px`, maxWidth: "45vw" }
              : undefined
          }
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

            {conversationSections.map((section) => (
              <div key={section.id}>
                <p className="sticky top-0 z-10 bg-[#2b2d31]/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#949ba4] backdrop-blur">
                  {section.label}
                </p>

                {section.items.map(renderConversationItem)}
              </div>
            ))}
          </div>
        </aside>

        {isDesktopLayout && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize conversation list"
            aria-valuemin={260}
            aria-valuemax={520}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={onResizePointerDown}
            onKeyDown={onResizeKeyDown}
            className="relative z-10 hidden w-1 shrink-0 cursor-col-resize bg-transparent md:block"
          >
            <span className="absolute inset-y-0 -left-1 -right-1" />
            <span
              className={`absolute inset-y-0 left-0 w-px bg-white/10 transition ${
                isResizing ? "bg-purple-400" : "hover:bg-purple-400/70"
              }`}
            />
          </div>
        )}

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

                  <button
                    type="button"
                    disabled={
                      activeConversation?.type ===
                      "direct"
                    }
                    onClick={toggleGroupPanel}
                    className="flex min-w-0 items-center gap-3 rounded-xl text-left transition enabled:hover:bg-white/5"
                  >
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-purple-600/30 text-sm font-bold text-purple-100">
                      {activeConversation?.type !==
                        "direct" &&
                      activeConversation?.image ? (
                        <img
                          src={getUploadAbsoluteUrl(
                            activeConversation.image
                          )}
                          alt={getConversationTitle(
                            activeConversation
                          )}
                          className="h-full w-full object-cover"
                        />
                      ) : activeConversation?.type ===
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
                  </button>
                </div>

                <div className="relative flex shrink-0 items-center gap-1" ref={conversationMenuRef}>
                  <NotificationCenter
                    socket={socket}
                    unreadCount={notificationUnread}
                    setUnreadCount={setNotificationUnread}
                    onOpenConversation={(id) =>
                      navigate(`${chatBasePath}/${id}`)
                    }
                  />

                  <button
                    type="button"
                    aria-label="Search messages"
                    onClick={() => setShowSearch((prev) => !prev)}
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiSearch className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="Start audio call"
                    onClick={() => handleStartCall("audio")}
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiPhone className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="Start video call"
                    onClick={() => handleStartCall("video")}
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiVideo className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="Conversation options"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() =>
                      setMenuOpen((previous) => !previous)
                    }
                    className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                  >
                    <FiMoreVertical className="h-5 w-5" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1e1f22] shadow-xl"
                    >
                      {activeConversation?.type !==
                        "direct" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            setGroupPanelOpen(true);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                        >
                          <FiUsers className="h-4 w-4" />
                          Group info
                        </button>
                      )}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setShowSearch(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                      >
                        <FiSearch className="h-4 w-4" />
                        Search messages
                      </button>

                      <button
                        type="button"
                        role="menuitem"
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
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          loadPinned();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                      >
                        <MdOutlinePushPin className="h-4 w-4" />
                        Pinned messages
                      </button>

                      {activeConversation?.type ===
                        "direct" && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuOpen(false);
                            setCallHistoryOpen(true);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                        >
                          <FiPhone className="h-4 w-4" />
                          Call history
                        </button>
                      )}

                      {activeConversation?.permissions?.canClear !==
                        false && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={openClearChatConfirm}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                        >
                          Clear chat for me
                        </button>
                      )}

                      {activeConversation?.type === "direct" &&
                        activeConversation?.permissions?.canHide !==
                          false && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={openHideDirectConfirm}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-white/5"
                          >
                            Delete conversation
                          </button>
                        )}

                      {activeConversation?.type !== "direct" &&
                        activeConversation?.permissions?.canLeave && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={openLeaveGroupConfirm}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#dbdee1] transition hover:bg-white/5"
                          >
                            Leave group
                          </button>
                        )}

                      {activeConversation?.type !== "direct" &&
                        activeConversation?.permissions
                          ?.canDeleteGroup && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={openDeleteGroupConfirm}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-white/5"
                          >
                            Delete group
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </header>

              {showSearch && (
                <div className="border-b border-white/10 bg-[#2b2d31] px-3 py-2">
                  <input
                    value={threadSearch}
                    onChange={(event) =>
                      handleThreadSearch(event.target.value)
                    }
                    placeholder="Search in conversation…"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#1e1f22]">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => jumpToMessage(item.id)}
                          className="block w-full truncate px-3 py-2 text-left text-xs text-[#dbdee1] hover:bg-white/5"
                        >
                          {item.text || item.type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showPinned && (
                <div className="border-b border-white/10 bg-[#2b2d31] px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold text-purple-200">
                      Pinned messages
                    </p>
                    <button
                      type="button"
                      className="text-xs text-[#b5bac1]"
                      onClick={() => setShowPinned(false)}
                    >
                      Close
                    </button>
                  </div>
                  {pinnedMessages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => jumpToMessage(item.id)}
                      className="mb-1 block w-full truncate rounded-lg bg-black/20 px-2 py-1.5 text-left text-xs text-[#dbdee1]"
                    >
                      {item.text || item.type}
                    </button>
                  ))}
                </div>
              )}

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

                      {isSystem || message.type === "call" ? (
                        <div className="flex justify-center py-1">
                          <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] text-[#b5bac1]">
                            {message.text}
                          </span>
                        </div>
                      ) : (
                        <MessageBubble
                          message={message}
                          isMine={isMine}
                          isGroup={
                            activeConversation?.type !== "direct"
                          }
                          currentUserId={currentUserId}
                          canSend={
                            activeConversation?.permissions
                              ?.canSend !== false
                          }
                          canManage={Boolean(
                            activeConversation?.permissions
                              ?.canManage
                          )}
                          isMember={
                            activeConversation?.permissions
                              ?.isMember !== false
                          }
                          userRole={user?.role}
                          conversationType={
                            activeConversation?.type || "direct"
                          }
                          onReply={setReplyTo}
                          onReact={handleReact}
                          onEdit={(item) => {
                            setEditingMessage(item);
                            setReplyTo(null);
                            setDraft(item.text || "");
                          }}
                          onDeleteMe={handleDeleteMe}
                          onDeleteEveryone={handleDeleteEveryone}
                          onForward={handleForward}
                          onPin={handlePinMessage}
                          onJumpToReply={jumpToMessage}
                          renderReceipt={renderReceipt}
                        />
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
                  <div className="space-y-2">
                    {(replyTo || editingMessage) && (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-[#b5bac1]">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">
                            {editingMessage
                              ? "Editing message"
                              : `Replying to ${
                                  replyTo?.sender?.name || "message"
                                }`}
                          </p>
                          {!editingMessage && (
                            <p className="truncate">
                              {replyTo?.text ||
                                (replyTo?.attachments?.length
                                  ? "Attachment"
                                  : replyTo?.type === "voice"
                                    ? "Voice note"
                                    : "")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={
                            editingMessage
                              ? "Cancel edit"
                              : "Cancel reply"
                          }
                          onClick={() => {
                            setReplyTo(null);
                            if (editingMessage) {
                              setEditingMessage(null);
                              setDraft("");
                            }
                          }}
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {uploadProgress != null && (
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    <div className="flex min-w-0 items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleAttachFiles}
                      />

                      {!recordingVoice && (
                        <button
                          type="button"
                          aria-label="Attach file"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-xl p-2 text-[#b5bac1] transition hover:bg-white/10 hover:text-white"
                        >
                          <FiPaperclip className="h-5 w-5" />
                        </button>
                      )}

                      {!recordingVoice && (
                        <div className="relative" ref={emojiPickerRef}>
                          <button
                            type="button"
                            aria-label="Insert emoji"
                            aria-expanded={emojiPickerOpen}
                            onClick={() =>
                              setEmojiPickerOpen((open) => !open)
                            }
                            className={`rounded-xl p-2 transition hover:bg-white/10 hover:text-white ${
                              emojiPickerOpen
                                ? "bg-white/10 text-white"
                                : "text-[#b5bac1]"
                            }`}
                          >
                            <FiSmile className="h-5 w-5" />
                          </button>

                          {emojiPickerOpen && (
                            <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(calc(100vw-2rem),22rem)] max-w-[calc(100vw-1rem)]">
                              <ChatEmojiPicker
                                onSelect={insertComposerEmoji}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <VoiceRecorder
                        disabled={sending}
                        onRecordingChange={setRecordingVoice}
                        onCancel={() => setRecordingVoice(false)}
                        onSend={handleVoiceSend}
                      />

                      {!recordingVoice && (
                        <textarea
                          ref={composerRef}
                          value={draft}
                          onChange={(event) =>
                            handleDraftChange(event.target.value)
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
                          placeholder={
                            editingMessage
                              ? "Edit message"
                              : "Type a message"
                          }
                          className="max-h-32 min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400"
                        />
                      )}

                      {!recordingVoice && (
                        <button
                          type="button"
                          aria-label="Send message"
                          onClick={handleSend}
                          disabled={!draft.trim() || sending}
                          className="rounded-xl bg-purple-600 p-3 text-white transition hover:bg-purple-500 disabled:opacity-50"
                        >
                          {sending ? (
                            <FiLoader className="h-5 w-5 animate-spin" />
                          ) : (
                            <FiSend className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>

        {groupPanelOpen &&
        activeConversation &&
        activeConversation.type !== "direct" ? (
          <div className="fixed inset-0 z-40 bg-[#2b2d31] md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 lg:w-96">
            <GroupDetailsPanel
              conversation={activeConversation}
              currentUserId={currentUserId}
              onClose={() => setGroupPanelOpen(false)}
              onConversationUpdated={handleGroupUpdated}
              onLeaveGroup={() => {
                setGroupPanelOpen(false);
                openLeaveGroupConfirm();
              }}
              onDeleteGroup={() => {
                setGroupPanelOpen(false);
                openDeleteGroupConfirm();
              }}
            />
          </div>
        ) : null}

        {callHistoryOpen &&
        activeConversation &&
        activeConversation.type === "direct" ? (
          <div className="fixed inset-0 z-40 bg-[#2b2d31] md:relative md:inset-auto md:z-auto md:w-80 md:shrink-0 lg:w-96">
            <CallHistoryPanel
              conversationId={activeConversation.id}
              currentUserId={currentUserId}
              onClose={() => setCallHistoryOpen(false)}
            />
          </div>
        ) : null}
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

      {forwardTarget ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-white/10 bg-[#1e1f22] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">
                  Forward message
                </h3>
                <p className="text-xs text-[#949ba4]">
                  {forwardSelectedIds.length} selected
                </p>
              </div>
              <button
                type="button"
                aria-label="Close forward dialog"
                onClick={() => {
                  setForwardTarget(null);
                  setForwardSelectedIds([]);
                }}
              >
                <FiX className="h-5 w-5 text-[#b5bac1]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {conversations
                .filter((item) => item.id !== conversationId)
                .map((item) => {
                  const selected = forwardSelectedIds.includes(
                    item.id
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        toggleForwardSelection(item.id)
                      }
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5 ${
                        selected ? "bg-purple-600/20" : ""
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          selected
                            ? "border-purple-400 bg-purple-500 text-white"
                            : "border-white/20"
                        }`}
                      >
                        {selected ? (
                          <FiCheck className="h-3.5 w-3.5" />
                        ) : null}
                      </span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600/30 text-xs font-bold text-purple-100">
                        {getInitials(getConversationTitle(item))}
                      </span>
                      <span className="min-w-0 truncate text-sm text-white">
                        {getConversationTitle(item)}
                      </span>
                    </button>
                  );
                })}
            </div>
            <button
              type="button"
              disabled={forwardSelectedIds.length === 0}
              onClick={confirmForward}
              className="mt-4 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Forward
              {forwardSelectedIds.length > 0
                ? ` (${forwardSelectedIds.length})`
                : ""}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        description={confirmAction?.description || ""}
        confirmLabel={confirmAction?.confirmLabel}
        destructive={Boolean(confirmAction?.destructive)}
        requireText={confirmAction?.requireText || null}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmAction(null);
            setConfirmText("");
          }
        }}
        onConfirm={runConfirmAction}
      />

      <CallOverlay
        call={activeCall}
        incomingCall={incomingCall}
        currentUserId={currentUserId}
        localStream={localStream}
        remoteStreams={remoteStreams}
        muted={muted}
        cameraOff={cameraOff}
        screenSharing={screenSharing}
        connectionState={connectionState}
        onAccept={handleAcceptIncoming}
        onReject={handleRejectIncoming}
        onEnd={handleEndActiveCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onToggleScreenShare={toggleScreenShare}
      />
    </DashboardLayout>
  );
};

export default ChatPage;
