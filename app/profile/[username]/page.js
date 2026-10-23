"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
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
    // 1. Get the user's ID from their username
    const { data: profileData } = await supabase.from("profiles").select("*").eq("username", username).single();
    
    if (profileData) {
      setProfile(profileData);
      
      // 2. Get their posts
      const { data: postsData } = await supabase.from("posts").select("*, profiles(full_name, username, is_coi, avatar_url)").eq("user_id", profileData.id).order("created_at", { ascending: false });
      setPosts(postsData || []);

      // 3. Check if we are following them
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
      return <img src={profileData.avatar_url} className={`${sizeClass} rounded-full object-cover border-2 border-white dark:border-slate-700`} alt="Avatar" />;
    }
    return (
      <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-orange-500 to-green-600 border-2 border-white dark:border-slate-700`}>
        {profileData?.full_name?.[0] || "U"}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500">Loading profile...</div>;
  if (!profile) return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500">User not found.</div>;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-8 transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back to Feed</Link>
        
        {/* Profile Header */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
          {getAvatar(profile, "w-24 h-24")}
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{profile.full_name}</h1>
          <p className="text-slate-500 dark:text-slate-400">@{profile.username}</p>
          
          {profile.is_coi && (
            <span className="mt-2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-green-600">COI Member</span>
          )}

          {user && user.id !== profile.id && (
            <button onClick={handleToggleFollow} className={`mt-4 px-6 py-2 rounded-full text-sm font-bold border transition-colors ${isFollowing ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600' : 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'}`}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Their Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-10">This user hasn't posted yet.</div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  {getAvatar(post.profiles)}
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{post.profiles?.full_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">@{post.profiles?.username}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">• {timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                {post.image_url && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700">
                    <img src={post.image_url} alt="Post" className="w-full h-auto object-cover max-h-96" />
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>❤️ {post.like_count || 0} likes</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
