"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

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

export default function ProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    checkUser();
    if (username) fetchProfileAndPosts();
  }, [username]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  }

  async function fetchProfileAndPosts() {
    setLoading(true);
    const { data: profileData } = await supabase.from("profiles").select("*").eq("username", username).single();
    
    if (profileData) {
      setProfile(profileData);
      const { data: postsData } = await supabase
        .from("posts")
        .select("*, profiles(full_name, username, is_coi, avatar_url), likes(count)")
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });
      
      if (postsData) {
        const formattedPosts = postsData.map(post => ({
          ...post,
          like_count: post.likes[0]?.count || 0
        }));
        setPosts(formattedPosts);
      }

      if (user && user.id !== profileData.id) {
        const { data: followData } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileData.id).single();
        setIsFollowing(!!followData);
      }
    }
    setLoading(false);
  }

  async function handleToggleFollow() {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    }
    setIsFollowing(!isFollowing);
  }

  const getAvatar = (profileData, sizeClass = "w-10 h-10") => {
    if (profileData?.avatar_url) {
      return <img src={profileData.avatar_url} className={`${sizeClass} rounded-full object-cover border-4 border-white dark:border-slate-950 shadow-lg`} alt="Avatar" />;
    }
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-green-600 border-4 border-white dark:border-slate-950 shadow-lg`}>
        {profileData?.full_name?.[0] || "U"}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div></div>;
  if (!profile) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-500">
      <p className="text-4xl mb-4">🔍</p>
      <p className="font-medium">User not found.</p>
      <Link href="/" className="mt-4 text-orange-500 hover:underline">Go back home</Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg className="h-5 w-5 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-slate-900 dark:text-white text-lg">{profile.full_name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{posts.length} posts</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        <div className="h-48 bg-gradient-to-r from-orange-500 via-red-500 to-green-600 relative">
          <div className="absolute -bottom-12 left-6">
            {getAvatar(profile, "w-24 h-24")}
          </div>
        </div>

        <div className="pt-16 px-6 pb-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{profile.full_name}</h2>
                {profile.is_coi && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI</span>}
                {profile.is_private && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 bg-slate-200 dark:text-slate-300 dark:bg-slate-700">🔒 Private</span>}
              </div>
              <p className="text-slate-500 dark:text-slate-400">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-slate-700 dark:text-slate-300 text-sm italic">{profile.bio}</p>}
            </div>
            {user && user.id !== profile.id && (
              <button onClick={handleToggleFollow} className={`px-6 py-2 rounded-full text-sm font-bold border transition-all ${isFollowing ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-500 hover:border-red-200' : 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white border-slate-900 dark:border-white hover:opacity-90'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {profile.is_private && !isFollowing && user?.id !== profile.id ? (
            <div className="text-center py-16">
              <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">This Account is Private</h3>
              <p className="text-slate-500 mt-2">Follow this user to see their posts.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-16">
              <p className="text-4xl mb-2">📝</p>
              <p className="font-medium">No posts yet.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-3">
                  {getAvatar(post.profiles, "w-10 h-10")}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">{post.profiles?.full_name}</p>
                      {post.profiles?.is_coi && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>@{post.profiles?.username}</span>
                      <span>•</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap text-[15px]">{post.content}</p>
                {post.image_url && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img src={post.image_url} alt="Post" className="w-full h-auto object-cover max-h-[500px]" />
                  </div>
                )}
                {post.video_url && (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black">
                    <video src={post.video_url} controls className="w-full h-auto max-h-[500px]" />
                  </div>
                )}
                <div className="flex items-center gap-6 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">❤️ {post.like_count || 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
