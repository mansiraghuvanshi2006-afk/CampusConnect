import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  FiCopy,
  FiEdit2,
  FiLoader,
  FiMenu,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";

import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import getErrorMessage from "../../utils/getErrorMessage.js";
import {
  clearAiHistory,
  createAiConversation,
  deleteAiConversation,
  deleteAiMessage,
  getAiAutocomplete,
  getAiMessages,
  getAiStarters,
  getAiStatus,
  listAiConversations,
  renameAiConversation,
  streamAiMessage,
  streamEditAiPrompt,
  streamRegenerateAiMessage,
} from "../../services/aiService.js";

import "highlight.js/styles/github-dark.css";

const LOCAL_FALLBACK = [
  "Explain React Hooks",
  "Show my groups",
  "Latest AI news",
  "Help write an assignment",
  "Platform statistics",
];

const AI_MODEL_STORAGE_KEY = "campus_connect_ai_model";

const CampusAiPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleBase = `/${user?.role || "student"}`;

  const [configured, setConfigured] = useState(true);
  const [statusChecked, setStatusChecked] = useState(false);
  const [allowedModels, setAllowedModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [starters, setStarters] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const bottomRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId) || null,
    [conversations, conversationId]
  );

  const goToConversation = useCallback(
    (id, { replace = false } = {}) => {
      navigate(`${roleBase}/ai${id ? `/${id}` : ""}`, { replace });
    },
    [navigate, roleBase]
  );

  const loadConversations = useCallback(async (search = "") => {
    setLoadingList(true);
    try {
      const list = await listAiConversations({ search, limit: 50 });
      setConversations(list);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load AI history"));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) {
      return;
    }

    setLoadingMessages(true);
    try {
      const result = await getAiMessages(id, { limit: 30 });
      setMessages(result.messages || []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load messages"));
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [status, starterList] = await Promise.all([
          getAiStatus(),
          getAiStarters(),
        ]);
        if (cancelled) {
          return;
        }
        setConfigured(Boolean(status?.configured));
        setStarters(starterList);
        const models = status?.allowedModels || [];

        if (models.length > 0) {
          setAllowedModels(models);

          const savedModel = localStorage.getItem(AI_MODEL_STORAGE_KEY);
          const initialModel =
            savedModel && models.includes(savedModel)
              ? savedModel
              : status?.defaultModel || status?.model || models[0];

          if (savedModel && !models.includes(savedModel)) {
            localStorage.removeItem(AI_MODEL_STORAGE_KEY);
          }

          setSelectedModel(initialModel);
          localStorage.setItem(AI_MODEL_STORAGE_KEY, initialModel);
        }
      } catch {
        if (!cancelled) {
          setConfigured(false);
          setStarters([]);
        }
      } finally {
        if (!cancelled) {
          setStatusChecked(true);
        }
      }
    })();

    (async () => {
      try {
        const list = await listAiConversations({ limit: 50 });
        if (!cancelled) {
          setConversations(list);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Unable to load AI history"));
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!conversationId || streaming) {
      return undefined;
    }

    (async () => {
      try {
        const result = await getAiMessages(conversationId, { limit: 30 });
        if (!cancelled) {
          setMessages(result.messages || []);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, "Unable to load messages"));
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, streaming]);

  // Clear the thread when leaving a conversation route
  useEffect(() => {
    if (!conversationId) {
      queueMicrotask(() => setMessages([]));
    }
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const ensureConversation = async () => {
    if (conversationId) {
      return conversationId;
    }

    const created = await createAiConversation();
    setConversations((prev) => [created, ...prev]);
    goToConversation(created.id, { replace: true });
    return created.id;
  };

  const handleStreamResult = async (result) => {
    if (result?.aborted) {
      return;
    }

    if (result?.userMessage) {
      setMessages((prev) => {
        const withoutTemp = prev.filter((item) => !item._temp);
        const exists = withoutTemp.some(
          (item) => item.id === result.userMessage.id
        );
        return exists
          ? withoutTemp
          : [...withoutTemp, result.userMessage];
      });
    }

    if (result?.assistantMessage) {
      setMessages((prev) => {
        const withoutStream = prev.filter((item) => !item._streaming);
        const exists = withoutStream.some(
          (item) => item.id === result.assistantMessage.id
        );
        return exists
          ? withoutStream.map((item) =>
              item.id === result.assistantMessage.id
                ? result.assistantMessage
                : item
            )
          : [...withoutStream, result.assistantMessage];
      });
    }

    if (result?.conversation) {
      setConversations((prev) => {
        const others = prev.filter(
          (item) => item.id !== result.conversation.id
        );
        return [result.conversation, ...others];
      });
    }

    setStreamText("");
  };

  const handleModelChange = (event) => {
    const nextModel = event.target.value;
    setSelectedModel(nextModel);
    localStorage.setItem(AI_MODEL_STORAGE_KEY, nextModel);
    toast.success(`Model switched to ${nextModel}`);
  };

  const runPrompt = async (rawPrompt, { editId = null } = {}) => {
    const text = rawPrompt.trim();

    if (!text || streaming) {
      return;
    }

    if (!configured) {
      toast.error("Campus AI is not configured.");
      return;
    }

    setPrompt("");
    setSuggestions([]);
    setEditingMessageId(null);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const id = editId
        ? conversationId
        : await ensureConversation();

      if (!editId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `temp-user-${Date.now()}`,
            role: "user",
            content: text,
            _temp: true,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      const handlers = {
        signal: controller.signal,
        onDelta: (chunk) => {
          setStreamText((prev) => prev + chunk);
        },
        onDone: async (payload) => {
          await handleStreamResult(payload);
        },
        onError: (payload) => {
          toast.error(
            payload?.message || "Campus AI could not complete this request."
          );
        },
      };

      if (editId) {
        await streamEditAiPrompt({
          conversationId: id,
          messageId: editId,
          prompt: text,
          model: selectedModel,
          ...handlers,
        });
        await loadMessages(id);
      } else {
        await streamAiMessage({
          conversationId: id,
          prompt: text,
          model: selectedModel,
          ...handlers,
        });
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      toast.error(
        getErrorMessage(error, "Campus AI could not complete this request.")
      );
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
      loadConversations(historySearch);
    }
  };

  const handleAutocomplete = (value) => {
    setPrompt(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const localHits = LOCAL_FALLBACK.filter((item) =>
      item.toLowerCase().includes(value.trim().toLowerCase())
    ).slice(0, 4);

    setSuggestions(localHits.map((text) => ({ text, source: "local" })));

    debounceRef.current = setTimeout(async () => {
      try {
        const remote = await getAiAutocomplete({
          query: value.trim(),
          includeAi: false,
        });
        setSuggestions(remote);
      } catch {
        // Keep local suggestions
      }
    }, 500);
  };

  const handleNewConversation = async () => {
    try {
      const created = await createAiConversation();
      setConversations((prev) => [created, ...prev]);
      setMessages([]);
      goToConversation(created.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to start conversation"));
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await deleteAiConversation(id);
      setConversations((prev) => prev.filter((item) => item.id !== id));
      if (id === conversationId) {
        goToConversation(null);
        setMessages([]);
      }
      toast.success("Conversation deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete conversation"));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Delete all Campus AI conversations?")) {
      return;
    }

    try {
      await clearAiHistory();
      setConversations([]);
      setMessages([]);
      goToConversation(null);
      toast.success("AI history cleared");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to clear history"));
    }
  };

  const handleRename = async (id) => {
    const current = conversations.find((item) => item.id === id);
    const next = window.prompt("Rename conversation", current?.title || "");

    if (!next?.trim()) {
      return;
    }

    try {
      const updated = await renameAiConversation(id, next.trim());
      setConversations((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to rename"));
    }
  };

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const handleRegenerate = async (messageId) => {
    if (!conversationId || streaming) {
      return;
    }

    setStreaming(true);
    setStreamText("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamRegenerateAiMessage({
        conversationId,
        messageId,
        model: selectedModel,
        signal: controller.signal,
        onDelta: (chunk) => setStreamText((prev) => prev + chunk),
        onDone: async (payload) => {
          await handleStreamResult(payload);
          await loadMessages(conversationId);
        },
        onError: (payload) => {
          toast.error(payload?.message || "Regeneration failed");
        },
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(getErrorMessage(error, "Regeneration failed"));
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      abortRef.current = null;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteAiMessage(conversationId, messageId);
      setMessages((prev) => prev.filter((item) => item.id !== messageId));
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete message"));
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  return (
    <DashboardLayout
      title="Campus AI"
      description="Your campus assistant for general help, live info and campus data"
    >
      <div className="relative -mx-4 -my-8 flex h-[calc(100dvh-8.5rem)] min-h-[28rem] overflow-hidden border-y border-white/10 bg-[#313338] sm:-mx-6 lg:-mx-8 lg:h-[calc(100dvh-7.5rem)] lg:rounded-2xl lg:border">
        {showHistory && (
          <button
            type="button"
            aria-label="Close history"
            className="absolute inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setShowHistory(false)}
          />
        )}

        <aside
          className={`${
            showHistory ? "translate-x-0" : "-translate-x-full"
          } absolute inset-y-0 left-0 z-30 flex w-[min(100%,18rem)] shrink-0 flex-col border-r border-white/10 bg-[#2b2d31] transition-transform md:static md:translate-x-0 md:w-72`}
        >
          <div className="border-b border-white/10 p-3">
            <button
              type="button"
              onClick={handleNewConversation}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-purple-500"
            >
              <FiPlus className="h-4 w-4" />
              New conversation
            </button>

            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]" />
              <input
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(event.target.value);
                  loadConversations(event.target.value);
                }}
                placeholder="Search history"
                className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-purple-400"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingList && (
              <p className="px-4 py-8 text-center text-sm text-[#b5bac1]">
                Loading...
              </p>
            )}

            {!loadingList && conversations.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[#b5bac1]">
                No AI conversations yet
              </p>
            )}

            {conversations.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-1 border-b border-white/5 px-2 py-2 ${
                  item.id === conversationId ? "bg-purple-600/20" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    goToConversation(item.id);
                    setShowHistory(false);
                  }}
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                >
                  <p className="truncate text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#949ba4]">
                    {item.messageCount || 0} messages
                  </p>
                </button>

                <button
                  type="button"
                  aria-label="Rename"
                  onClick={() => handleRename(item.id)}
                  className="rounded p-1.5 text-[#949ba4] opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                >
                  <FiEdit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={() => handleDeleteConversation(item.id)}
                  className="rounded p-1.5 text-[#949ba4] opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#b5bac1] hover:bg-white/5"
            >
              Clear all history
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label="Open conversation history"
                onClick={() => setShowHistory(true)}
                className="rounded-xl p-2 text-[#b5bac1] hover:bg-white/10 hover:text-white md:hidden"
              >
                <FiMenu className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600/30 text-purple-200">
                <HiSparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-bold text-white">
                  {activeConversation?.title || "Campus AI"}
                </h2>
                <p className="text-xs text-[#949ba4]">
                  {statusChecked && !configured
                    ? "Not configured"
                    : "General · Live search · Campus tools"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {configured && allowedModels.length > 0 && (
                <label className="hidden items-center gap-2 sm:flex">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
                    Model
                  </span>
                  <select
                    value={selectedModel}
                    onChange={handleModelChange}
                    disabled={streaming}
                    className="max-w-[11rem] rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none focus:border-purple-400 disabled:opacity-60"
                    aria-label="Select Gemini model"
                  >
                    {allowedModels.map((model) => (
                      <option key={model} value={model} className="bg-[#2b2d31]">
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={handleNewConversation}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#b5bac1] hover:bg-white/5"
              >
                New
              </button>
            </div>
          </header>

          {configured && allowedModels.length > 0 && (
            <div className="border-b border-white/10 px-4 py-2 sm:hidden">
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
                  Model
                </span>
                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  disabled={streaming}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-xs text-white outline-none focus:border-purple-400 disabled:opacity-60"
                  aria-label="Select Gemini model"
                >
                  {allowedModels.map((model) => (
                    <option key={model} value={model} className="bg-[#2b2d31]">
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {statusChecked && !configured && (
              <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                <p className="font-semibold text-amber-100">
                  Campus AI is not configured.
                </p>
                <p className="mt-2 text-sm text-amber-100/80">
                  An administrator needs to set GEMINI_API_KEY on the API
                  server.
                </p>
              </div>
            )}

            {configured &&
              !conversationId &&
              messages.length === 0 &&
              !streaming && (
                <div className="mx-auto max-w-2xl">
                  <div className="mb-6 text-center">
                    <HiSparkles className="mx-auto h-10 w-10 text-purple-300" />
                    <h3 className="mt-3 text-xl font-bold text-white">
                      How can Campus AI help?
                    </h3>
                    <p className="mt-1 text-sm text-[#b5bac1]">
                      Ask a general question, request live info, or query your
                      campus data.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {starters.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => runPrompt(item)}
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left text-sm text-[#dbdee1] transition hover:border-purple-400/50 hover:bg-purple-600/10"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {loadingMessages && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#b5bac1]">
                <FiLoader className="h-4 w-4 animate-spin" />
                Loading messages...
              </div>
            )}

            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-2xl border border-white/10 px-4 py-3 ${
                    message.role === "user"
                      ? "ml-8 bg-purple-600/20"
                      : "mr-8 bg-black/25"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-[#949ba4]">
                    <span>{message.role === "user" ? "You" : "Campus AI"}</span>
                    <span>
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleString()
                        : ""}
                    </span>
                  </div>

                  {message.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none overflow-x-auto prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:bg-[#1e1f22] prose-table:block prose-table:overflow-x-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-white">
                      {message.content}
                    </p>
                  )}

                  {message.citations?.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                      <p className="text-xs font-semibold text-[#949ba4]">
                        Sources
                      </p>
                      {message.citations.map((citation) => (
                        <a
                          key={citation.uri}
                          href={citation.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-purple-300 hover:underline"
                        >
                          {citation.title || citation.uri}
                        </a>
                      ))}
                    </div>
                  )}

                  {message.toolsUsed?.length > 0 && (
                    <p className="mt-2 text-[11px] text-[#949ba4]">
                      Tools:{" "}
                      {message.toolsUsed
                        .map((tool) => tool.name)
                        .join(", ")}
                    </p>
                  )}

                  {(message.promptTokens > 0 ||
                    message.completionTokens > 0) && (
                    <p className="mt-1 text-[11px] text-[#949ba4]">
                      Tokens: {message.promptTokens || 0} in /{" "}
                      {message.completionTokens || 0} out
                    </p>
                  )}

                  {message.followUpSuggestions?.length > 0 &&
                    message.role === "assistant" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.followUpSuggestions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => runPrompt(item)}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#dbdee1] hover:border-purple-400/40 hover:bg-purple-600/10"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(message.content)}
                      className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
                      aria-label="Copy"
                    >
                      <FiCopy className="h-3.5 w-3.5" />
                    </button>

                    {message.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => handleRegenerate(message.id)}
                        className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
                        aria-label="Regenerate"
                      >
                        <FiRefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {message.role === "user" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(message.id);
                          setPrompt(message.content);
                        }}
                        className="rounded-lg p-1.5 text-[#949ba4] hover:bg-white/10 hover:text-white"
                        aria-label="Edit prompt"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(message.id)}
                      className="rounded-lg p-1.5 text-[#949ba4] hover:bg-red-500/20 hover:text-red-300"
                      aria-label="Delete message"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}

              {streaming && streamText && (
                <article className="mr-8 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <p className="mb-2 text-[11px] uppercase tracking-wide text-[#949ba4]">
                    Campus AI
                  </p>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {streamText}
                    </ReactMarkdown>
                  </div>
                </article>
              )}

              {streaming && !streamText && (
                <div className="flex items-center gap-2 text-sm text-[#b5bac1]">
                  <FiLoader className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="border-t border-white/10 p-4">
            {editingMessageId && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                <span>Editing previous prompt</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessageId(null);
                    setPrompt("");
                  }}
                  className="rounded p-1 hover:bg-white/10"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={`${item.source}-${item.text}`}
                    type="button"
                    onClick={() => {
                      setPrompt(item.text);
                      setSuggestions([]);
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#dbdee1] hover:bg-white/5"
                  >
                    {item.text}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                runPrompt(prompt, { editId: editingMessageId });
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={prompt}
                onChange={(event) => handleAutocomplete(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) {
                    return;
                  }

                  event.preventDefault();

                  if (!configured || streaming || !prompt.trim()) {
                    return;
                  }

                  runPrompt(prompt, { editId: editingMessageId });
                }}
                rows={2}
                placeholder={
                  configured
                    ? "Message Campus AI... (Enter to send, Shift+Enter for new line)"
                    : "Campus AI is not configured"
                }
                disabled={!configured || streaming}
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400 disabled:opacity-60"
              />

              {streaming ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!configured || !prompt.trim()}
                  className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  <FiSend className="h-4 w-4" />
                </button>
              )}
            </form>
          </footer>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default CampusAiPage;
