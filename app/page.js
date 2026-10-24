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
    if (profile) {
      setEditName(profile.full_name || "");
      setEditUsername(profile.username || "");
    }
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
    } else {
      setShowSearch(false);
    }
  }

  async function handleSignUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else {
      setUser(data.user);
      setTimeout(() => {
        fetchProfile(data.user.id);
        fetchPosts();
      }, 2000);
    }
    setLoading(false);
  }

  async function handleLogin() {
    setLoading(true);
    const
