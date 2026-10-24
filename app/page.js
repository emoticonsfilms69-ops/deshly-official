"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m";
  return "now";
}

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
  const [commentInputs, setCommentInputs] = useState({}); 
  const [feedFilter, setFeedFilter] = useState("all"); 
  const [isLoginMode, setIsLoginMode] = useState(false); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { checkUser(); }, []);
  
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    if (profile) { setEditName(profile.full_name || ""); setEditUsername(profile.username || ""); }
  }, [profile]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      fetchProfile(user.id);
      fetchPosts();
      fetchUserLikes(user.id);
      fetchComments();
      fetchFollowing(user.id);
    }
  }

  async function fetchProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (data) setProfile(data);
  }

  async function fetchPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(full_name, username, is_coi, avatar_url), likes(count)")
      .order("created_at", { ascending: false });
      
    if (data) {
      const formattedData = data.map(post => ({
        ...post,
        like_count: post.likes[0]?.count || 0
      }));
      setPosts(formattedData);
    }
  }

  async function fetchUserLikes(userId) {
    const { data } = await supabase.from("likes").select("post_id").eq("user_id", userId);
    if (data) setUserLikes(data.map(like => like.post_id));
  }

  async function fetchComments() {
    const { data } = await supabase.from("comments").select("*, profiles(full_name, username, avatar_url)").order("created_at", { ascending: true });
    if (data) setComments(data);
  }

  async function fetchFollowing(userId) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (data) setFollowingIds(data.map(f => f.following_id));
  }

  async function handleSearch(e) {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 0) {
      const { data } = await supabase.from("profiles").select("*").ilike("username", `%${query}%`).limit(5);
      setSearchResults(data || []);
      setShowSearch(true);
    } else { setShowSearch(false); }
  }

  async function handleSignUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else { setUser(data.user); setTimeout(() => { fetchProfile(data.user.id); fetchPosts(); }, 2000); }
    setLoading(false);
  }

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else { setUser(data.user); fetchProfile(data.user.id); fetchPosts(); }
    setLoading(false);
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) { setMessage("Error uploading avatar"); setLoading(false); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    fetchProfile(user.id);
    setLoading(false);
  }

  async function handleClaimCOI() {
    setLoading(true);
    await supabase.from("profiles").update({ is_coi: true }).eq("id", profile.id);
    fetchProfile(profile.id);
    setLoading(false);
  }

  async function handleUpdateProfile() {
    setLoading(true);
    await supabase.from("profiles").update({ full_name: editName, username: editUsername }).eq("id", profile.id);
    fetchProfile(profile.id); fetchPosts(); setIsEditing(false);
    setLoading(false);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) { setSelectedImage(file); setImagePreview(URL.createObjectURL(file)); }
  }

  async function handleCreatePost() {
    if (!newPostContent.trim() && !selectedImage) return;
    setLoading(true);
    let imageUrl = null;
    if (selectedImage) {
      const fileExt = selectedImage.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      await supabase.storage.from('post-images').upload(filePath, selectedImage);
      const { data } = supabase.storage.from('post-images').getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }
    await supabase.from("posts").insert([{ user_id: user.id, content: newPostContent, image_url: imageUrl }]);
    setNewPostContent(""); setSelectedImage(null); setImagePreview(null); 
    fetchPosts(); setLoading(false);
  }

  async function handleDeletePost(postId) {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    fetchPosts();
  }

  async function handleToggleLike(postId) {
    const isLiked = userLikes.includes(postId);
    if (isLiked) await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    else await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    fetchPosts(); fetchUserLikes(user.id);
  }

  async function handleToggleFollow(targetUserId) {
    const isFollowing = followingIds.includes(targetUserId);
    if (isFollowing) await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    else await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
    fetchFollowing(user.id);
  }

  async function handleAddComment(postId) {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    await supabase.from("comments").insert([{ post_id: postId, user_id: user.id, content: text }]);
    setCommentInputs({ ...commentInputs, [postId]: "" }); fetchComments();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setPosts([]); setUserLikes([]); setComments([]); setFollowingIds([]);
  }

  const filteredPosts = feedFilter === 'all' ? posts : posts.filter(post => followingIds.includes(post.user_id));

  const getAvatar = (profileData, sizeClass = "w-10 h-10") => {
    if (profileData?.avatar_url) {
      return <img src={profileData.avatar_url} className={`${sizeClass} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm`} alt="Avatar" />;
    }
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-green-600 border-2 border-white dark:border-slate-800 shadow-sm`}>
        {profileData?.full_name?.[0] || "U"}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* MODERN STICKY HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Deshly" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            {user && (
              <div className="relative group">
                {getAvatar(profile, "w-8 h-8")}
                <button onClick={handleSignOut} className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {!user ? (
          /* LOGIN / SIGNUP CARD WITH COVER PHOTO */
          <div className="relative overflow-hidden rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 mt-10">
            <div className="relative h-64 sm:h-80">
              <img src="/cover.jpg" alt="Indian Culture" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <img src="/logo.png" alt="Deshly" className="h-12 w-auto mb-3" />
                <h2 className="text-3xl font-black text-white">Welcome to Deshly</h2>
                <p className="text-white/80 text-sm mt-1">Join the community of proud citizens</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 space-y-6">
              <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setIsLoginMode(false)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!isLoginMode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Sign Up</button>
                <button onClick={() => setIsLoginMode(true)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${isLoginMode ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Log In</button>
              </div>
              <div className="space-y-3">
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all" />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all" />
              </div>
              <button onClick={isLoginMode ? handleLogin : handleSignUp} disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-95">
                {loading ? "Processing..." : (isLoginMode ? "Log In" : "Create Account")}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* PROFILE CARD */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex gap-4 items-center">
              <div className="relative group cursor-pointer">
                {getAvatar(profile, "w-14 h-14")}
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-[10px] font-bold rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  EDIT
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 dark:text-white text-lg">{profile?.full_name}</p>
                  {profile?.is_coi && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI</span>}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{profile?.username}</p>
              </div>
              <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>

            {isEditing && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
                <input type="text" placeholder="Your Name" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" />
                <input type="text" placeholder="Username" value={editUsername} onChange={(e) => setEditUsername(e.target.value.replace(/\s/g, ''))} className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={handleUpdateProfile} disabled={loading} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-bold">Save Changes</button>
              </div>
            )}

            {/* SEARCH BAR */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search for friends..." 
                value={searchQuery}
                onChange={handleSearch}
                className="w-full pl-11 pr-4 py-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all shadow-sm"
              />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 overflow-hidden">
                  {searchResults.map((result) => (
                    <Link key={result.id} href={`/profile/${result.username}`} onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
                      {getAvatar(result, "w-10 h-10")}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">{result.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">@{result.username}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* POST CREATOR */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex gap-3">
                {getAvatar(profile, "w-10 h-10")}
                <div className="flex-1">
                  <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder={`What's happening?`} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none h-24 text-slate-900 dark:text-white placeholder-slate-400"></textarea>
                  {imagePreview && (
                    <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                      <button onClick={() => { setImagePreview(null); setSelectedImage(null); }} className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5 hover:bg-black transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <label className="cursor-pointer flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium text-sm transition-colors">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Photo
                      <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                    <button onClick={handleCreatePost} disabled={loading} className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-orange-500/20 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50">
                      {loading ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FEED FILTER */}
            <div className="flex gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit mx-auto shadow-sm">
              <button onClick={() => setFeedFilter('all')} className={`px-8 py-2 rounded-xl text-sm font-bold transition-all ${feedFilter === 'all' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>For You</button>
              <button onClick={() => setFeedFilter('following')} className={`px-8 py-2 rounded-xl text-sm font-bold transition-all ${feedFilter === 'following' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Following</button>
            </div>

            {/* THE FEED */}
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isLiked = userLikes.includes(post.id);
                const postComments = comments.filter(c => c.post_id === post.id);
                const isAuthor = post.user_id === user.id;
                const isFollowing = followingIds.includes(post.user_id);

                return (
                  <div key={post.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${post.profiles?.username}`}>
                          {getAvatar(post.profiles)}
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${post.profiles?.username}`} className="font-bold text-slate-900 dark:text-white hover:text-orange-500 transition-colors">
                              {post.profiles?.full_name || "Anonymous"}
                            </Link>
                            {post.profiles?.is_coi && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>@{post.profiles?.username}</span>
                            <span>•</span>
                            <span>{timeAgo(post.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      {isAuthor && (
                        <button onClick={() => handleDeletePost(post.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                    
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap text-[15px]">{post.content}</p>
                    
                    {post.image_url && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <img src={post.image_url} alt="Post" className="w-full h-auto object-cover max-h-[500px]" />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => handleToggleLike(post.id)} className={`flex items-center gap-2 text-sm font-medium transition-all ${isLiked ? 'text-red-500' : 'text-slate-500 dark:text-slate-400 hover:text-red-500'}`}>
                        <svg className="h-5 w-5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        {post.like_count || 0}
                      </button>
                      
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {postComments.length}
                      </span>

                      {!isAuthor && (
                        <button onClick={() => handleToggleFollow(post.user_id)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${isFollowing ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-500 hover:border-red-200' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100'}`}>
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>

                    {postComments.length > 0 && (
                      <div className="mt-4 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {postComments.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 text-sm items-start">
                            {getAvatar(comment.profiles, "w-7 h-7")}
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none flex-1">
                              <span className="font-bold text-slate-900 dark:text-white text-xs">{comment.profiles?.full_name}</span>
                              <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5 leading-relaxed">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <input type="text" placeholder="Write a comment..." value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)} className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50" />
                      <button onClick={() => handleAddComment(post.id)} className="text-orange-500 font-bold text-sm hover:text-orange-600 px-3">Post</button>
                    </div>
                  </div>
                );
              })}
              {filteredPosts.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-16">
                <p className="text-4xl mb-2">🦗</p>
                <p className="font-medium">No posts yet.</p>
              </div>}
            </div>
          </>
        )}
        {message && <div className="fixed bottom-6 right-6 bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl font-medium z-50">{message}</div>}
      </div>
    </main>
  );
}
