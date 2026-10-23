"use client";

import { useState, useEffect } from "react";
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
  const [commentInputs, setCommentInputs] = useState({}); 
  const [feedFilter, setFeedFilter] = useState("all"); 
  const [isLoginMode, setIsLoginMode] = useState(false); 

  // NEW: Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => { checkUser(); }, []);
  
  // NEW: Apply Dark Mode class to HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    const { data } = await supabase.from("posts").select("*, profiles(full_name, username, is_coi)").order("created_at", { ascending: false });
    if (data) setPosts(data);
  }

  async function fetchUserLikes(userId) {
    const { data } = await supabase.from("likes").select("post_id").eq("user_id", userId);
    if (data) setUserLikes(data.map(like => like.post_id));
  }

  async function fetchComments() {
    const { data } = await supabase.from("comments").select("*, profiles(full_name, username)").order("created_at", { ascending: true });
    if (data) setComments(data);
  }

  async function fetchFollowing(userId) {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (data) setFollowingIds(data.map(f => f.following_id));
  }

  async function handleSignUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage("Error: " + error.message);
    else {
      setUser(data.user);
      setTimeout(() => { fetchProfile(data.user.id); fetchPosts(); fetchUserLikes(data.user.id); fetchComments(); fetchFollowing(data.user.id); }, 2000); 
    }
    setLoading(false);
  }

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("Error: " + error.message);
    else {
      setUser(data.user);
      fetchProfile(data.user.id);
      fetchPosts();
      fetchUserLikes(data.user.id);
      fetchComments();
      fetchFollowing(data.user.id);
    }
    setLoading(false);
  }

  async function handleClaimCOI() {
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ is_coi: true, coi_claimed_at: new Date() }).eq("id", profile.id);
    if (!error) { setMessage(" Successfully claimed the COI Badge!"); fetchProfile(profile.id); }
    setLoading(false);
  }

  async function handleUpdateProfile() {
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: editName, username: editUsername }).eq("id", profile.id);
    if (!error) { setMessage(" Profile updated!"); fetchProfile(profile.id); fetchPosts(); setIsEditing(false); }
    else { setMessage("Error: " + error.message); }
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
      const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, selectedImage);
      if (uploadError) { setMessage("Error uploading image: " + uploadError.message); setLoading(false); return; }
      const { data } = supabase.storage.from('post-images').getPublicUrl(filePath);
      imageUrl = data.publicUrl;
    }

    const { error } = await supabase.from("posts").insert([{ user_id: user.id, content: newPostContent, image_url: imageUrl }]);
    if (!error) { 
      setNewPostContent(""); setSelectedImage(null); setImagePreview(null); 
      document.getElementById('image-upload').value = ""; 
      fetchPosts(); 
    } else { setMessage("Error posting: " + error.message); }
    setLoading(false);
  }

  async function handleDeletePost(postId) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    if (!error) fetchPosts();
    else setMessage("Error deleting post.");
  }

  async function handleToggleLike(postId, currentCount) {
    const isLiked = userLikes.includes(postId);
    let newCount = isLiked ? currentCount - 1 : currentCount + 1;
    if (isLiked) await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
    else await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    await supabase.from("posts").update({ like_count: newCount }).eq("id", postId);
    fetchPosts();
    fetchUserLikes(user.id);
  }

  async function handleToggleFollow(targetUserId) {
    const isFollowing = followingIds.includes(targetUserId);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
    }
    fetchFollowing(user.id);
  }

  async function handleAddComment(postId) {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;
    const { error } = await supabase.from("comments").insert([{ post_id: postId, user_id: user.id, content: text }]);
    if (!error) {
      setCommentInputs({ ...commentInputs, [postId]: "" });
      fetchComments();
    } else { setMessage("Error adding comment."); }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setPosts([]); setUserLikes([]); setComments([]); setFollowingIds([]); setMessage("");
  }

  const filteredPosts = feedFilter === 'all' ? posts : posts.filter(post => followingIds.includes(post.user_id));

  return (
    // NEW: Added dark mode background colors
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-8 transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-green-600 bg-clip-text text-transparent">Deshly</h1>
          <div className="flex items-center gap-4">
            {/* NEW: Dark Mode Toggle Button */}
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xl">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            {user && <button onClick={handleSignOut} className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600">Sign Out</button>}
          </div>
        </div>

        {!user ? (
          // NEW: Added dark mode card and input colors
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isLoginMode ? "Welcome Back!" : "Join the Community"}</h2>
            
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
              <button onClick={() => setIsLoginMode(false)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isLoginMode ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Sign Up</button>
              <button onClick={() => setIsLoginMode(true)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isLoginMode ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Log In</button>
            </div>

            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400" />
            
            <button onClick={isLoginMode ? handleLogin : handleSignUp} disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">
              {loading ? "Processing..." : (isLoginMode ? "Log In" : "Sign Up")}
            </button>
          </div>
        ) : (
          <>
            {/* PROFILE SECTION */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Logged in as</p>
                  {/* NEW: Darker text (slate-900) */}
                  <p className="font-bold text-slate-900 dark:text-white text-lg">{profile?.full_name || "New User"}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">@{profile?.username || "user"}</p>
                </div>
                {profile?.is_coi ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI Member</span>
                ) : (
                  <button onClick={handleClaimCOI} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">Claim COI Tag</button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <input type="text" placeholder="Your Name" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <input type="text" placeholder="Username" value={editUsername} onChange={(e) => setEditUsername(e.target.value.replace(/\s/g, ''))} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                  <div className="flex gap-2">
                    <button onClick={handleUpdateProfile} disabled={loading} className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium">{loading ? "Saving..." : "Save"}</button>
                    <button onClick={() => setIsEditing(false)} className="text-slate-500 dark:text-slate-400 px-4 py-2 rounded-lg text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium mt-2">✏️ Edit Profile</button>
              )}
            </div>

            {/* POST CREATOR */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder={`What's on your mind, ${profile?.full_name || 'friend'}?`} className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400"></textarea>
              {imagePreview && (
                <div className="mt-3 relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                  <button onClick={() => { setImagePreview(null); setSelectedImage(null); document.getElementById('image-upload').value = ""; }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center mt-3">
                <label className="cursor-pointer flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-orange-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm font-medium">Add Photo</span>
                  <input id="image-upload" type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                <button onClick={handleCreatePost} disabled={loading || (!newPostContent.trim() && !selectedImage)} className="bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">{loading ? "Posting..." : "Post"}</button>
              </div>
            </div>

            {/* FEED FILTER */}
            <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-fit mx-auto">
              <button onClick={() => setFeedFilter('all')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${feedFilter === 'all' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>All Posts</button>
              <button onClick={() => setFeedFilter('following')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${feedFilter === 'following' ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Following</button>
            </div>

            {/* THE FEED */}
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isLiked = userLikes.includes(post.id);
                const postComments = comments.filter(c => c.post_id === post.id);
                const isAuthor = post.user_id === user.id;
                const isFollowing = followingIds.includes(post.user_id);

                return (
                  <div key={post.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${post.profiles?.is_coi ? 'bg-gradient-to-br from-orange-500 to-green-600' : 'bg-slate-400'}`}>
                          {post.profiles?.full_name?.[0] || "U"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            {/* NEW: Darker text for names */}
                            <span className="font-bold text-slate-900 dark:text-white">{post.profiles?.full_name || "Anonymous"}</span>
                            {post.profiles?.is_coi && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI</span>}
                            {!isAuthor && (
                              <button onClick={() => handleToggleFollow(post.user_id)} className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${isFollowing ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-red-50 hover:text-red-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100'}`}>
                                {isFollowing ? 'Following' : 'Follow'}
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">@{post.profiles?.username || "user"}</span>
                        </div>
                      </div>
                      {isAuthor && (
                        <button onClick={() => handleDeletePost(post.id)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                    {/* NEW: Darker text for post content */}
                    <p className="text-slate-800 dark:text-slate-100 leading-relaxed mb-3 whitespace-pre-wrap font-medium">{post.content}</p>
                    {post.image_url && (
                      <div className="mb-3 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                        <img src={post.image_url} alt="Post" className="w-full h-auto object-cover max-h-96" />
                      </div>
                    )}
                    <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => handleToggleLike(post.id, post.like_count || 0)} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isLiked ? 'text-red-500' : 'text-slate-500 dark:text-slate-400 hover:text-red-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        {post.like_count || 0}
                      </button>
                      <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        {postComments.length}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {postComments.map((comment) => (
                        <div key={comment.id} className="flex gap-2 text-sm">
                          <span className="font-bold text-slate-900 dark:text-white">{comment.profiles?.full_name || "User"}:</span>
                          <span className="text-slate-700 dark:text-slate-200">{comment.content}</span>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-700">
                        <input type="text" placeholder="Write a comment..." value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)} className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-900 dark:text-white placeholder-slate-400" />
                        <button onClick={() => handleAddComment(post.id)} className="text-orange-600 dark:text-orange-400 font-bold text-sm hover:text-orange-700">Post</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredPosts.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-10">{feedFilter === 'following' ? "You aren't following anyone yet. Follow some people to see their posts here!" : "No posts yet. Be the first to say something!"}</div>}
            </div>
          </>
        )}
        {message && <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">{message}</div>}
      </div>
    </main>
  );
}
