/**
 * Full Page Chat Component
 * Provides a dedicated chat experience with conversation history
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Loader2, Car, Plus, MessageSquare, Trash2, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserAvatar from "@/components/UserAvatar";
import {
  chatApi, ChatVehicle,
  getCurrentUser, isAuthenticated
} from '@/lib/api';
import ChatVehicleCards from '@/components/ChatVehicleCards';
import { useChatSessions, useChatSessionMessages, useDeleteChatSession } from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import MarkdownMessage from '@/components/MarkdownMessage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  vehicles?: ChatVehicle[];
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const user = getCurrentUser();
  const loggedIn = isAuthenticated();
  const { data: sessions, refetch: refetchSessions } = useChatSessions(loggedIn);
  const deleteSession = useDeleteChatSession();
  // Only load past messages when the user explicitly OPENS a session from the
  // sidebar (openSessionId). A live conversation reuses `sessionId` for context
  // but must NOT re-fetch/overwrite the messages it's already showing — that race
  // was resetting state and spawning a new session on every turn.
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const { data: sessionMessages } = useChatSessionMessages(openSessionId);

  // When a past session's messages load (after openSession), render them.
  useEffect(() => {
    if (sessionMessages && sessionMessages.length > 0) {
      setMessages(sessionMessages.map((m, i) => ({
        id: `db-${i}`,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        vehicles: m.vehicles,
        timestamp: m.created_at ? new Date(m.created_at) : new Date(),
      })));
    }
  }, [sessionMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load welcome message for new conversation
  useEffect(() => {
    if (messages.length === 0 && !sessionId) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hello! 👋 I'm your AI car shopping assistant. I can help you:\n\n• Find vehicles that match your needs and budget\n• Compare different makes and models\n• Answer questions about features and specifications\n• Provide personalized recommendations\n\nWhat kind of car are you looking for today?",
        timestamp: new Date()
      }]);
    }
  }, [messages.length, sessionId]);

  const openSession = (id: string) => {
    setSessionId(id);       // reuse this id for the next turn (continue the conversation)
    setOpenSessionId(id);   // triggers useChatSessionMessages(id) → effect loads its messages
  };

  const startNewConversation = () => {
    // For guests, reset clears the in-memory server session. For logged-in users
    // we must NOT call reset on a saved session (the logged-in backend path has
    // no reset handling — it would persist a junk "reset" turn). New chat = just
    // drop the session_id; the saved conversation stays intact in history.
    if (sessionId && !loggedIn) {
      chatApi.reset(sessionId).catch(() => { /* ignore — local reset is enough */ });
    }
    setSessionId(null);
    setOpenSessionId(null);
    setMessages([]);
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(userMessage.content, sessionId || undefined);

      // Server assigns a session_id on the first turn; reuse it for context.
      if (response.session_id) {
        setSessionId(response.session_id);
        if (loggedIn) refetchSessions();
      }

      const assistantMessage: Message = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: response.answer,
        vehicles: response.vehicles,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, loggedIn, refetchSessions]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick suggestion prompts
  const suggestions = [
    "I'm looking for a reliable SUV under $30,000",
    "What are the best fuel-efficient sedans?",
    "Show me luxury cars with low mileage",
    "Compare Honda Accord vs Toyota Camry",
  ];

  return (
    <div className="h-screen bg-background flex flex-col">
      <Header />

      {/* pt-20 clears the fixed h-20 header so the sidebar + chat aren't hidden under it */}
      <div className="flex-1 flex overflow-hidden pt-20">
        {/* History Sidebar (logged-in only) */}
        {loggedIn && (
          <aside className="hidden lg:flex lg:flex-col w-72 border-r border-border/60 bg-card/50 backdrop-blur-sm">
            <div className="p-4">
              <button
                onClick={startNewConversation}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#A87601] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(168,118,1,0.8)] transition-all duration-200 hover:bg-[#c48c07]"
              >
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                New chat
              </button>
            </div>
            <p className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Recent
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {(sessions ?? []).length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground/60">
                  No conversations yet.
                </p>
              )}
              {(sessions ?? []).map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors",
                    sessionId === s.id
                      ? "bg-[#A87601]/12 text-[#A87601]"
                      : "text-foreground/80 hover:bg-accent/40"
                  )}
                  onClick={() => openSession(s.id)}
                >
                  <MessageSquare className={cn("h-4 w-4 flex-shrink-0", sessionId === s.id ? "text-[#A87601]" : "text-muted-foreground/50")} />
                  <span className="flex-1 truncate">{s.title || "New conversation"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession.mutate(s.id, { onSuccess: () => { if (sessionId === s.id) startNewConversation(); } }); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-muted/20">
          {/* Chat Header */}
          <div className="h-16 border-b border-border/60 bg-card/40 backdrop-blur-sm flex items-center px-6 gap-3">
            <div className="relative">
              <Avatar className="h-9 w-9 ring-2 ring-[#A87601]/25">
                <AvatarImage src="/carmarket-mark.svg" alt="CarMarket" />
                <AvatarFallback className="bg-[#A87601] text-white"><Car className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div className="flex-1">
              <h2 className="font-poppins font-semibold leading-tight">Car Shopping Assistant</h2>
              <p className="text-xs text-emerald-600/90 font-medium">● Online · Powered by AI</p>
            </div>
            {/* Guests have no sidebar — keep a New Chat button here for them only. */}
            {!loggedIn && (
              <Button onClick={startNewConversation} variant="outline" size="sm" className="gap-2 rounded-lg">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={cn(
                  "flex gap-4",
                  message.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}>
                  {message.role === 'user' ? (
                    <UserAvatar user={user} className="h-10 w-10 flex-shrink-0" />
                  ) : (
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src="/carmarket-mark.svg" alt="CarMarket" />
                      <AvatarFallback className="bg-primary text-primary-foreground"><Car className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] space-y-1.5",
                    message.role === 'user' && "text-right"
                  )}>
                    <div className={cn(
                      "inline-block px-4 py-3 shadow-sm",
                      message.role === 'user'
                        ? "rounded-2xl rounded-tr-md bg-[#A87601] text-white"
                        : "rounded-2xl rounded-tl-md border border-border/60 bg-card"
                    )}>
                      {message.role === 'assistant' ? (
                        <div className="text-left">
                          <MarkdownMessage content={message.content} />
                          {message.vehicles && message.vehicles.length > 0 && (
                            <ChatVehicleCards vehicles={message.vehicles} />
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-left">{message.content}</p>
                      )}
                    </div>

                    <p className="px-1 text-[11px] text-muted-foreground/70">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-[#A87601]/20">
                    <AvatarImage src="/carmarket-mark.svg" alt="CarMarket" />
                    <AvatarFallback className="bg-[#A87601] text-white">
                      <Car className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl rounded-tl-md border border-border/60 bg-card px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#A87601]/70 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 rounded-full bg-[#A87601]/70 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 rounded-full bg-[#A87601]/70 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions for new conversations */}
              {messages.length <= 1 && !isLoading && (
                <div className="mt-10">
                  <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Try asking
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto">
                    {suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                        className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left text-sm text-foreground/85 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#A87601]/50 hover:shadow-md animate-fade-in opacity-0"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "forwards" }}
                      >
                        <Sparkles className="h-4 w-4 flex-shrink-0 text-[#A87601]/70 transition-colors group-hover:text-[#A87601]" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border/60 bg-card/40 backdrop-blur-sm p-4">
            <div className="max-w-3xl mx-auto flex items-end gap-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about cars…"
                disabled={isLoading}
                className="flex-1 h-12 rounded-2xl border-border/70 bg-background px-5 focus-visible:ring-2 focus-visible:ring-[#A87601]/50"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-12 w-12 rounded-2xl bg-[#A87601] text-white shadow-[0_8px_24px_-10px_rgba(168,118,1,0.9)] transition-all hover:bg-[#c48c07] disabled:opacity-40 disabled:shadow-none"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
