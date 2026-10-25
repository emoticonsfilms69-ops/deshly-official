"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function MessagesPage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => { checkUser(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      // Pass the user object directly to avoid timing issues
      fetchConversations(user); 
    } else {
      setLoading(false);
    }
  }

  // Updated to accept currentUser
  async function fetchConversations(currentUser) {
    if (!currentUser) return;
    
    const { data } = await supabase
      .from("messages")
      .select("sender_id, receiver_id, content, created_at")
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false });

    if (data) {
      const partnerIds = [...new Set(data.map(m => m.sender_id === currentUser.id ? m.receiver_id : m.sender_id))];
      
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", partnerIds);
        
        setConversations(profiles || []);
      }
    }
    setLoading(false);
  }

  async function openChat(partner) {
    setActiveChat(partner);
    setMessages([]);
    setSearchQuery("");
    setSearchResults([]);
    
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
      
    if (data) setMessages(data);
  }

  async function handleSearch(e) {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 1 && user) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .ilike("username", `%${query}%`)
        .neq("id", user.id)
        .limit(5);
      setSearchResults(data || []);
    } else {
      setSearchResults([]);
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeChat || !user) return;
    
    const msgText = newMessage;
    setNewMessage(""); 
    
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: activeChat.id,
      content: msgText
    });

    if (!error) {
      setMessages(prev => [...prev, { sender_id: user.id, content: msgText, created_at: new Date().toISOString() }]);
    }
  }

  const getAvatar = (p, s = "w-10 h-10") => p?.avatar_url 
    ? <img src={p.avatar_url} className={`${s} rounded-full object-cover`} alt="Avatar" />
    : <div className={`${s} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-green-600`}>{p?.full_name?.[0] || "?"}</div>;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500">Loading messages...</div>;
  if (!user) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><Link href="/" className="text-orange-500 font-bold">Please log in</Link></div>;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <svg className="w-5 h-5 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div className="flex-1 flex items-center gap-3">
          {activeChat && getAvatar(activeChat, "w-8 h-8")}
          <h1 className="font-bold text-slate-900 dark:text-white text-lg truncate">
            {activeChat ? activeChat.full_name : "Messages"}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeChat ? (
          <>
            {/* SEARCH BAR */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search for people to message..." 
                value={searchQuery} 
                onChange={handleSearch}
                className="w-full p-3 pl-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
                  {searchResults.map((r) => (
                    <button key={r.id} onClick={() => openChat(r)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800 last:border-0">
                      {getAvatar(r, "w-10 h-10")}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{r.full_name}</p>
                        <p className="text-xs text-slate-500">@{r.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CONVERSATIONS LIST */}
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 py-10">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="font-medium">No messages yet.</p>
                  <p className="text-sm mt-1">Search above to start a chat!</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button key={c.id} onClick={() => openChat(c)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-900 transition-colors text-left">
                    {getAvatar(c, "w-12 h-12")}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{c.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">@{c.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* CHAT WINDOW */
          <div className="space-y-3 pb-4">
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === user.id;
              return (
                <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl ${
                    isMe 
                      ? 'bg-gradient-to-r from-orange-500 to-green-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none border border-slate-200 dark:border-slate-700'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* INPUT AREA */}
      {activeChat && (
        <div className="sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2 items-center">
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 p-3 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button 
            onClick={handleSend} 
            disabled={!newMessage.trim()}
            className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-green-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      )}
    </main>
  );
}
