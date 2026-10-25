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
    if (profile) { setEditName(profile.full_name || ""); setEditUsername(profile.username || ""); setEditBio(profile.bio || ""); }
       setIsPrivate(profile.is_private || false);
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
    if (user) { fetchProfile(user.id); fetchPosts(); fetchUserLikes(user.id); fetchComments(); fetchFollowing(user.id); fetchNotifications(); }
  }
  async function fetchProfile(userId) { const { data } = await supabase.from("profiles").select("*").eq("id", userId).single(); if (data) setProfile(data); }
  async function fetchPosts() {
    const { data } = await supabase.from("posts").select("*, profiles(full_name, username, is_coi, avatar_url), likes(count)").order("created_at", { ascending: false });
    if (data) setPosts(data.map(post => ({ ...post, like_count: post.likes[0]?.count || 0 })));
  }
  async function fetchUserLikes(userId) { const { data } = await supabase.from("likes").select("post_id").eq("user_id", userId); if (data) setUserLikes(data.map(like => like.post_id)); }
  async function fetchComments() { const { data } = await supabase.from("comments").select("*, profiles(full_name, username, avatar_url)").order("created_at", { ascending: true }); if (data) setComments(data); }
  async function fetchFollowing(userId) { const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId); if (data) setFollowingIds(data.map(f => f.following_id)); }
  async function fetchStories() {
  // Fetch stories from the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("stories")
    .select("*, profiles(full_name, username, avatar_url)")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false });
  if (data) setStories(data);
}
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
      await supabase.from("profiles").update({ full_name: editName, username: editUsername, bio: editBio, is_private: isPrivate }).eq("id", profile.id);
    fetchProfile(profile.id); fetchPosts(); setIsEditing(false); setLoading(false);
  }
  function handleImageChange(e) { const file = e.target.files[0]; if (file) { setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); } }
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
    fetchFollowing(user.id);fetchStories();
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
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base sm:text-lg">{isDarkMode ? '☀️' : ''}</button>
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
              <div className="absolute bottom-6 left-6 right-6">
                <img src="/logo.png" alt="Deshly" className="h-10 sm:h-12 w-auto mb-3" />
                <h2 className="text-2xl sm:text-3xl font-black text-white">Welcome to Deshly</h2>
                <p className="text-white/80 text-xs sm:text-sm mt-1">Join the community of proud citizens</p>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setIsLoginMode(false)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLoginMode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Sign Up</button>
                <button onClick={() => setIsLoginMode(true)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLoginMode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Log In</button>
              </div>
              <div className="space-y-3">
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <button onClick={isLoginMode ? handleLogin : handleSignUp} disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg">{loading ? "Processing..." : (isLoginMode ? "Log In" : "Create Account")}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex gap-3 sm:gap-4 items-center">
              <div className="relative group cursor-pointer">{getAvatar(profile, "w-12 h-12 sm:w-14 sm:h-14")}<label className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-[10px] font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">EDIT<input type="file" accept="image/*,video/*" onChange={handleAvatarUpload} className="hidden" /></label></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate">{profile?.full_name}</p>{profile?.is_coi && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600 shrink-0">COI</span>}</div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">@{profile?.username}</p>
                {profile?.bio && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic truncate">{profile.bio}</p>}
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shrink-0">{isEditing ? "Cancel" : "Edit"}</button>
            </div>

            {isEditing && (
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <input type="text" placeholder="Your Name" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" />
                <input type="text" placeholder="Username" value={editUsername} onChange={(e) => setEditUsername(e.target.value.replace(/\s/g, ''))} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" />
                <textarea placeholder="Write a short bio..." value={editBio} onChange={(e) => setEditBio(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none h-20 resize-none" />
                 <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
     <div>
       <p className="font-bold text-sm text-slate-900 dark:text-white">Private Account</p>
       <p className="text-xs text-slate-500">Only followers can see your posts</p>
     </div>
     <button 
       onClick={() => setIsPrivate(!isPrivate)} 
       className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${isPrivate ? 'bg-orange-500 justify-end' : 'bg-slate-300 dark:bg-slate-600 justify-start'}`}
     >
       <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
     </button>
   </div>  
              <button onClick={handleUpdateProfile} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-bold">Save Changes</button>
              </div>
            )}

            <div className="relative search-container">
              <input type="text" placeholder="Search for friends..." value={searchQuery} onChange={handleSearch} className="w-full px-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden">
                  {searchResults.map((r) => (<Link key={r.id} href={`/profile/${r.username}`} onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0">{getAvatar(r, "w-10 h-10")}<div><p className="font-bold text-slate-900 dark:text-white text-sm">{r.full_name}</p><p className="text-xs text-slate-500">@{r.username}</p></div></Link>))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex gap-3">
                {getAvatar(profile, "w-10 h-10")}
                <div className="flex-1">
                  <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="What's happening?" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none resize-none h-24 text-slate-900 dark:text-white"></textarea>
                  {imagePreview && <div className="mt-3 relative rounded-xl overflow-hidden"><img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" /><button onClick={() => { setImagePreview(null); setSelectedImage(null); }} className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5">✕</button></div>}
                  <div className="flex justify-between items-center mt-4">
                    <label className="cursor-pointer flex items-center gap-2 text-orange-500 font-medium text-sm">📷 Photo<input id="image-upload" type="file" accept="image/*,video/*" onChange={handleImageChange} className="hidden" /></label>
                    <button onClick={handleCreatePost} disabled={loading} className="bg-gradient-to-r from-orange-500 to-green-600 text-white px-6 py-2 rounded-full font-bold text-sm">{loading ? "Posting..." : "Post"}</button>
                  </div>
                </div>
              </div>
            </div>
            {/* STORIES BAR */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
              <div className="flex gap-4 min-w-max">
                {/* Add Story Button */}
                <div className="flex flex-col items-center gap-1 cursor-pointer">
                  <div className="relative w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                    {storyLoading ? <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-orange-500"></div> : (
                      <>
                        <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        <input type="file" accept="image/*" onChange={handleStoryUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">Add Story</span>
                </div>

                {/* Other Users' Stories */}
                {stories.map((story) => (
                  <button key={story.id} onClick={() => setActiveStory(story)} className="flex flex-col items-center gap-1">
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-orange-500 to-green-600">
                      <div className="p-0.5 bg-white dark:bg-slate-900 rounded-full">
                        {story.profiles?.avatar_url ? (
                          <img src={story.profiles.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="Story" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-slate-300 flex items-center justify-center font-bold text-white">{story.profiles?.full_name?.[0] || '?'}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 truncate w-16 text-center">{story.profiles?.full_name || 'User'}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit mx-auto">
              <button onClick={() => setFeedFilter('all')} className={`flex-1 sm:flex-none px-4 sm:px-8 py-2 rounded-xl text-xs sm:text-sm font-bold ${feedFilter === 'all' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-500'}`}>For You</button>
              <button onClick={() => setFeedFilter('following')} className={`flex-1 sm:flex-none px-4 sm:px-8 py-2 rounded-xl text-xs sm:text-sm font-bold ${feedFilter === 'following' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-500'}`}>Following</button>
              <button onClick={() => setFeedFilter('trending')} className={`flex-1 sm:flex-none px-4 sm:px-8 py-2 rounded-xl text-xs sm:text-sm font-bold ${feedFilter === 'trending' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-500'}`}>Trending 🔥</button>          <Link href="/messages" className="flex flex-col items-center gap-1 text-slate-400 hover:text-orange-500 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            <span className="text-[10px] font-bold">Messages</span>
          </Link>
            </div>

            <div className="space-y-4">
              {displayPosts.map((post) => {
                const isLiked = userLikes.includes(post.id);
                const postComments = comments.filter(c => c.post_id === post.id);
                const isAuthor = post.user_id === user.id;
                const isFollowing = followingIds.includes(post.user_id);
                return (
                  <div key={post.id} className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${post.profiles?.username}`}>{getAvatar(post.profiles)}</Link>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap"><Link href={`/profile/${post.profiles?.username}`} className="font-bold text-slate-900 dark:text-white hover:text-orange-500 truncate">{post.profiles?.full_name || "Anonymous"}</Link>{post.profiles?.is_coi && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600 shrink-0">COI</span>}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="truncate">@{post.profiles?.username}</span><span>•</span><span>{timeAgo(post.created_at)}</span></div>
                        </div>
                      </div>
                      {isAuthor && <button onClick={() => handleDeletePost(post.id)} className="text-slate-400 hover:text-red-500 p-2"></button>}
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap text-sm sm:text-[15px]">{post.content}</p>
                    {post.image_url && <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800"><img src={post.image_url} alt="Post" className="w-full h-auto object-cover max-h-[500px]" /></div>}
                                          {post.video_url && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black">
                        <video src={post.video_url} controls className="w-full h-auto max-h-[500px]" />
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => handleToggleLike(post.id)} className={`flex items-center gap-2 text-sm font-medium ${isLiked ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>❤️ {post.like_count || 0}</button>
                      <span className="text-sm text-slate-500">💬 {postComments.length}</span>
                      {!isAuthor && <button onClick={() => handleToggleFollow(post.user_id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${isFollowing ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-blue-200 dark:border-blue-800'}`}>{isFollowing ? 'Following' : 'Follow'}</button>}
                    </div>
                    {postComments.length > 0 && (
                      <div className="mt-4 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {postComments.map((c) => (<div key={c.id} className="flex gap-2.5 text-sm items-start">{getAvatar(c.profiles, "w-7 h-7")}<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none flex-1"><span className="font-bold text-slate-900 dark:text-white text-xs">{c.profiles?.full_name}</span><p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5">{c.content}</p></div></div>))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <input type="text" placeholder="Write a comment..." value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)} className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none" />
                      <button onClick={() => handleAddComment(post.id)} className="text-orange-500 font-bold text-sm">Post</button>
                    </div>
                  </div>
                );
              })}
              {displayPosts.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-16"><p className="font-medium">No posts yet.</p></div>}
            </div>
          </>
        )}
        {message && <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl font-medium z-50">{message}</div>}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
        <div className="max-w-2xl mx-auto flex justify-around py-2 sm:py-3">
          <button onClick={() => setFeedFilter('all')} className={`flex flex-col items-center gap-1 ${feedFilter === 'all' ? 'text-orange-500' : 'text-slate-400'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button onClick={() => setFeedFilter('trending')} className={`flex flex-col items-center gap-1 ${feedFilter === 'trending' ? 'text-orange-500' : 'text-slate-400'}`}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
            <span className="text-[10px] font-bold">Trending</span>
          </button>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center gap-1 text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>
      </nav>
                {/* STORY VIEWER MODAL */}
      {activeStory && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4">
          <button onClick={() => setActiveStory(null)} className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full z-10">✕</button>
          <div className="relative max-w-md w-full h-[80vh] rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
            <img src={activeStory.image_url} alt="Story" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                {activeStory.profiles?.avatar_url ? <img src={activeStory.profiles.avatar_url} className="w-10 h-10 rounded-full border-2 border-white" /> : <div className="w-10 h-10 rounded-full bg-orange-500"></div>}
                <div>
                  <p className="font-bold text-white">{activeStory.profiles?.full_name}</p>
                  <p className="text-xs text-white/70">{timeAgo(activeStory.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
