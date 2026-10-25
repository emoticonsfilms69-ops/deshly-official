"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [userLikes, setUserLikes] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [feedFilter, setFeedFilter] = useState("all");
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => { checkUser(); }, []);
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);
  useEffect(() => {
    if (profile) { 
      setEditName(profile.full_name || ""); 
      setEditUsername(profile.username || ""); 
      setEditBio(profile.bio || "");
      setIsPrivate(profile.is_private || false);
    }
  }, [profile]);
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotifications(false);
      if (showSearch && !event.target.closest('.search-container')) setShowSearch(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, showSearch]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) { 
      fetchProfile(user.id); 
      fetchPosts(); 
      fetchUserLikes(user.id); 
      fetchComments(); 
      fetchFollowing(user.id); 
      fetchNotifications();
      fetchStories();
    }
  }
  async function fetchProfile(userId) { const { data } = await supabase.from("profiles").select("*").eq("id", userId).single(); if (data) setProfile(data); }
  async function fetchPosts() {
    const { data } = await supabase.from("posts").select("*, profiles(full_name, username, is_coi, avatar_url), likes(count)").order("created_at", { ascending: false });
    if (data) setPosts(data.map(post => ({ ...post, like_count: post.likes[0]?.count || 0 })));
  }
  async function fetchUserLikes(userId) { const { data } = await supabase.from("likes").select("post_id").eq("user_id", userId); if (data) setUserLikes(data.map(like => like.post_id)); }
  async function fetchComments() { const { data } = await supabase.from("comments").select("*, profiles(full_name, username, avatar_url)").order("created_at", { ascending: true }); if (data) setComments(data); }
  async function fetchFollowing(userId) { const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId); if (data) setFollowingIds(data.map(f => f.following_id)); }
  
  async function fetchNotifications() {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*, from_user:profiles!notifications_from_user_id_fkey(full_name, username, avatar_url)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (data) { setNotifications(data); setUnreadCount(data.filter(n => !n.is_read).length); }
  }
  async function markAsRead(id) { await supabase.from("notifications").update({ is_read: true }).eq("id", id); fetchNotifications(); }
  async function createNotification(targetUserId, type, fromUserId, postId = null) {
    if (targetUserId === fromUserId) return;
    await supabase.from("notifications").insert({ user_id: targetUserId, from_user_id: fromUserId, type: type, post_id: postId, is_read: false });
  }

  async function fetchStories() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from("stories").select("*, profiles(full_name, username, avatar_url)").gte("created_at", twentyFourHoursAgo).order("created_at", { ascending: false });
    if (data) setStories(data);
  }

  async function handleStoryUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStoryLoading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('stories').upload(filePath, file);
    if (uploadError) { setMessage("Error uploading story"); setStoryLoading(false); return; }
    const { data } = supabase.storage.from('stories').getPublicUrl(filePath);
    await supabase.from("stories").insert([{ user_id: user.id, image_url: data.publicUrl }]);
    fetchStories();
    setStoryLoading(false);
  }

  async function handleSearch(e) {
    const query = e.target.value; setSearchQuery(query);
    if (query.length > 0) { const { data } = await supabase.from("profiles").select("*").ilike("username", `%${query}%`).limit(5); setSearchResults(data || []); setShowSearch(true); } 
    else { setShowSearch(false); }
  }
  async function handleSignUp() {
    setLoading(true); const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message); else { setUser(data.user); setTimeout(() => { fetchProfile(data.user.id); fetchPosts(); }, 2000); } setLoading(false);
  }
  async function handleLogin() {
    setLoading(true); const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message); else { setUser(data.user); fetchProfile(data.user.id); fetchPosts(); } setLoading(false);
  }
  async function handleAvatarUpload(e) {
    const file = e.target.files[0]; if (!file) return; setLoading(true);
    const fileExt = file.name.split('.').pop(); const filePath = `${user.id}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) { setMessage("Error uploading avatar"); setLoading(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    fetchProfile(user.id); setLoading(false);
  }
  async function handleClaimCOI() { setLoading(true); await supabase.from("profiles").update({ is_coi: true }).eq("id", profile.id); fetchProfile(profile.id); setLoading(false); }
  async function handleUpdateProfile() {
    setLoading(true); 
    await supabase.from("profiles").update({ full_name: editName, username: editUsername, bio: editBio, is_private: isPrivate }).eq("id", profile.id);
    fetchProfile(profile.id); fetchPosts(); setIsEditing(false); setLoading(false);
  }
  function handleImageChange(e) { const file = e.target.files[0]; if (file) { setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); } }
  async function handleCreatePost() {
    if (!newPostContent.trim() && !selectedImage) return; 
    setLoading(true); 
    let imageUrl = null; 
    let videoUrl = null;
    if (selectedImage) {
      const fileExt = selectedImage.name.split('.').pop();
      const isVideo = selectedImage.type.startsWith('video/');
      const bucketName = isVideo ? 'post-videos' : 'post-images';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, selectedImage);
      if (uploadError) { setMessage("Error uploading media"); setLoading(false); return; }
      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      if (isVideo) videoUrl = data.publicUrl;
      else imageUrl = data.publicUrl;
    }
    await supabase.from("posts").insert([{ user_id: user.id, content: newPostContent, image_url: imageUrl, video_url: videoUrl }]);
    setNewPostContent(""); setSelectedImage(null); setImagePreview(null); fetchPosts(); setLoading(false);
  }
  async function handleDeletePost(postId) { if (!confirm("Delete this post?")) return; await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id); fetchPosts(); }
  
  async function handleToggleLike(postId) {
    const post = posts.find(p => p.id === postId); if (!post) return;
    const isLiked = userLikes.includes(postId);
    if (isLiked) { await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId); } 
    else { await supabase.from("likes").insert({ user_id: user.id, post_id: postId }); await createNotification(post.user_id, 'like', user.id, postId); }
    fetchPosts(); fetchUserLikes(user.id);
  }
  async function handleToggleFollow(targetUserId) {
    const isFollowing = followingIds.includes(targetUserId);
    if (isFollowing) { await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId); } 
    else { await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId }); await createNotification(targetUserId, 'follow', user.id); }
    fetchFollowing(user.id);
  }
  async function handleAddComment(postId) {
    const text = commentInputs[postId]; if (!text || !text.trim()) return;
    const post = posts.find(p => p.id === postId);
    if (post) {
      await supabase.from("comments").insert([{ post_id: postId, user_id: user.id, content: text }]);
      await createNotification(post.user_id, 'comment', user.id, postId);
      setCommentInputs({ ...commentInputs, [postId]: "" }); fetchComments();
    }
  }
  async function handleSignOut() { await supabase.auth.signOut(); setUser(null); setProfile(null); setPosts([]); setUserLikes([]); setComments([]); setFollowingIds([]); setNotifications([]); }

  let displayPosts = posts;
  if (feedFilter === 'following') displayPosts = posts.filter(post => followingIds.includes(post.user_id));
  else if (feedFilter === 'trending') displayPosts = [...posts].sort((a, b) => b.like_count - a.like_count);

  const getAvatar = (p, s = "w-10 h-10") => p?.avatar_url ? <img src={p.avatar_url} className={`${s} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm`} alt="Avatar" /> : <div className={`${s} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-green-600 border-2 border-white dark:border-slate-800 shadow-sm`}>{p?.full_name?.[0] || "U"}</div>;
  const timeAgo = (d) => { const s = Math.floor((new Date() - new Date(d)) / 1000); if (s > 31536000) return Math.floor(s/31536000)+"y"; if (s > 2592000) return Math.floor(s/2592000)+"mo"; if (s > 86400) return Math.floor(s/86400)+"d"; if (s > 3600) return Math.floor(s/3600)+"h"; if (s > 60) return Math.floor(s/60)+"m"; return "now"; };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/"><img src="/logo.png" alt="Deshly" className="h-8 sm:h-10 w-auto" /></Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 sm:right-0 top-full mt-2 w-[85vw] sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto notifications-container">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center"><h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3><button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">✕</button></div>
                  {notifications.length === 0 ? <div className="p-8 text-center text-slate-500"><p className="text-2xl mb-2">🔔</p><p className="text-sm">No notifications yet</p></div> : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.map((notif) => (
                        <div key={notif.id} onClick={() => markAsRead(notif.id)} className={`p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                          <div className="flex items-start gap-3">
                            {getAvatar(notif.from_user, "w-8 h-8 sm:w-10 sm:h-10")}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-slate-900 dark:text-white truncate"><span className="font-bold">{notif.from_user?.full_name || 'Someone'}</span> {notif.type === 'like' && 'liked your post'}{notif.type === 'comment' && 'commented on your post'}{notif.type === 'follow' && 'started following you'}</p>
                              <p className="text-[10px] sm:text-xs text-slate-500 mt-1">{timeAgo(notif.created_at)}</p>
                            </div>
                            {!notif.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base sm:text-lg">{isDarkMode ? '☀️' : '🌙'}</button>
            {user && <div className="relative group">{getAvatar(profile, "w-7 h-7 sm:w-8 sm:h-8")}<button onClick={handleSignOut} className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">Sign Out</button></div>}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-6">
        {!user ? (
          <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 mt-4 sm:mt-10">
            <div className="relative h-64 sm:h-80">
              <img src="/cover.jpg" alt="Indian Culture" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
              <div className
