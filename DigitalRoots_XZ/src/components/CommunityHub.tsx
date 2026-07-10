import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  Users, Search, Plus, X, Globe, Lock, MessageSquare, 
  ThumbsUp, Calendar, Trash2, Shield, UserPlus, LogOut, Loader, Image as ImageIcon, Share2
} from 'lucide-react';
import { 
  getCommunities, getMyCommunities, createCommunity, 
  joinCommunity, leaveCommunity, getCommunityPosts, createCommunityPost,
  updateCommunity, removeCommunityMember
} from '../contentApi';
import type { User, Community, Message } from '../types';

const CustomDialog = lazy(() => import('./CustomDialog'));

function getUserInfo(userId: string) {
  const usersJson = sessionStorage.getItem('users_list') || localStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  const found = dynamicUsers.find((u) => u.id === userId || u._id === userId || u.firebaseUid === userId || u.firebase_uid === userId);
  
  if (found) {
    const initials = found.avatar || found.initials || found.name.slice(0, 2).toUpperCase();
    const gradients = [
      'from-red-700 to-red-900',
      'from-purple-700 to-purple-900',
      'from-rose-600 to-pink-900',
      'from-blue-700 to-blue-900',
      'from-emerald-700 to-teal-900',
      'from-amber-600 to-orange-800'
    ];
    const hash = userId && typeof userId === 'string' ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const colorGradient = gradients[hash % gradients.length];
    
    return {
      id: found.id || found._id,
      name: found.name,
      initials: initials.length <= 2 ? initials : found.name.slice(0, 2).toUpperCase(),
      color: colorGradient,
      role: found.role,
      avatar: found.avatar
    };
  }
  
  return {
    id: userId,
    name: 'Not Available',
    initials: 'NA',
    color: 'from-gray-650 to-gray-800',
    role: 'Youth',
    avatar: ''
  };
}

interface CommunityHubProps {
  currentUser: User;
  token: string;
}

export default function CommunityHub({ currentUser, token }: CommunityHubProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCover, setNewCover] = useState('');
  const [newInterests, setNewInterests] = useState<string[]>([]);
  const [newRules, setNewRules] = useState<string[]>(['Be respectful', 'Share helpful knowledge', 'No spam']);
  const [isPublic, setIsPublic] = useState(true);
  
  // Post Creation State
  const [postContent, setPostContent] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Tab state in detailed view
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'members' | 'rules' | 'settings'>('posts');
  const [errorMsg, setErrorMsg] = useState('');

  // Group Invite & Share State
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Community Settings Editor State
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editRules, setEditRules] = useState<string[]>([]);
  const [newRuleInput, setNewRuleInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleShareGroup = () => {
    if (!selectedCommunity) return;
    const shareUrl = `${window.location.origin}/community/${selectedCommunity.communityId}`;
    navigator.clipboard.writeText(shareUrl);
    setDialogConfig({
      isOpen: true,
      type: 'success',
      title: 'Link Copied',
      message: `Community share link copied to clipboard!\n${shareUrl}`,
      confirmLabel: 'Great',
      onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleSaveSettings = async () => {
    if (!selectedCommunity) return;
    if (!editName.trim()) {
      setSettingsError('Group name is required.');
      return;
    }
    if (!editDesc.trim()) {
      setSettingsError('About description is required.');
      return;
    }
    setSavingSettings(true);
    setSettingsSuccess('');
    setSettingsError('');
    try {
      const res = await updateCommunity(token, selectedCommunity.communityId, {
        name: editName,
        description: editDesc,
        coverImage: editCover,
        rules: editRules
      });
      if (res.success) {
        setSettingsSuccess('Group settings updated successfully!');
        setSelectedCommunity(res.community);
        fetchAllData();
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to update community settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const executeRemoveMember = async (targetUserId: string) => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
    if (!selectedCommunity) return;
    try {
      const res = await removeCommunityMember(token, selectedCommunity.communityId, targetUserId);
      if (res.success) {
        setSelectedCommunity(res.community);
        fetchAllData();
        setDialogConfig({
          isOpen: true,
          type: 'success',
          title: 'Member Removed',
          message: 'Member has been successfully removed from the group.',
          confirmLabel: 'OK',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to remove member.',
        confirmLabel: 'OK',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleRemoveMember = (memberId: string) => {
    const memberInfo = getUserInfo(memberId);
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Remove Member?',
      message: `Are you sure you want to remove ${memberInfo.name} from this community?`,
      confirmLabel: 'Remove Member',
      cancelLabel: 'Cancel',
      onConfirm: () => executeRemoveMember(memberId),
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const availableInterests = ['Cultural', 'Traditional', 'Story', 'Proverb', 'Recipe', 'History', 'Educational', 'LanguageLearning', 'Music', 'Arts', 'Tech', 'Community'];

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const allRes = await getCommunities(token, searchQuery);
      setCommunities(allRes.communities || []);
      const myRes = await getMyCommunities(token);
      setMyCommunities(myRes.communities || []);
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [searchQuery]);

  const loadCommunityPosts = async (communityId: string) => {
    setLoadingPosts(true);
    try {
      const res = await getCommunityPosts(token, communityId);
      setPosts(res.posts || []);
    } catch (err) {
      console.error('Failed to load community posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (selectedCommunity) {
      loadCommunityPosts(selectedCommunity.communityId);
      setEditName(selectedCommunity.name || '');
      setEditDesc(selectedCommunity.description || '');
      setEditCover(selectedCommunity.coverImage || '');
      setEditRules(selectedCommunity.rules || []);
      setSettingsSuccess('');
      setSettingsError('');
    }
  }, [selectedCommunity]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDesc.trim()) {
      setErrorMsg('Name and description are required.');
      return;
    }
    setErrorMsg('');
    try {
      await createCommunity(token, {
        name: newName,
        description: newDesc,
        coverImageUrl: newCover,
        interests: newInterests,
        rules: newRules,
        isPublic
      });
      setShowCreateModal(false);
      setNewName('');
      setNewDesc('');
      setNewCover('');
      setNewInterests([]);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create community.');
    }
  };

  const handleJoin = async (communityId: string) => {
    try {
      const res = await joinCommunity(token, communityId);
      if (res.success) {
        fetchAllData();
        if (selectedCommunity && selectedCommunity.communityId === communityId) {
          setSelectedCommunity(res.community);
        }
      }
    } catch (err) {
      console.error('Join error:', err);
    }
  };

  const handleLeave = async (communityId: string) => {
    if (!window.confirm('Are you sure you want to leave this community?')) return;
    try {
      const res = await leaveCommunity(token, communityId);
      if (res.success) {
        fetchAllData();
        if (selectedCommunity && selectedCommunity.communityId === communityId) {
          setSelectedCommunity(res.community);
        }
      }
    } catch (err) {
      console.error('Leave error:', err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommunity || !postContent.trim()) return;
    setSubmittingPost(true);
    try {
      const res = await createCommunityPost(token, selectedCommunity.communityId, {
        title: postTitle,
        content: postContent,
        type: 'text'
      });
      if (res.success) {
        setPostContent('');
        setPostTitle('');
        loadCommunityPosts(selectedCommunity.communityId);
        // Refresh community count
        const updatedComm = await getCommunities(token);
        const match = updatedComm.communities.find((c: any) => c.communityId === selectedCommunity.communityId);
        if (match) setSelectedCommunity(match);
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setSubmittingPost(false);
    }
  };

  const isMember = (community: Community) => {
    return community.members.includes(currentUser.id);
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[var(--bg-dark)] overflow-hidden">
      
      {/* SIDEBAR: List / Discovery */}
      <div className={`w-full md:w-80 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-card)] ${selectedCommunity ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="text-[var(--primary)]" size={20} />
              Communities
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1.5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white hover:scale-105 transition-all cursor-pointer"
              title="Create Community"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[var(--bg-elevated)] border border-transparent focus:border-[var(--primary)] outline-none text-[var(--text-primary)] transition-all"
            />
          </div>
        </div>

        {/* List of communities */}
        <div className="flex-grow overflow-y-auto p-3 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-xs text-stone-400">
              <Loader className="animate-spin text-[var(--primary)] mr-2" size={16} />
              Loading communities...
            </div>
          ) : communities.length === 0 ? (
            <div className="text-center p-8 text-xs text-stone-400">
              No communities found. Create one to get started!
            </div>
          ) : (
            communities.map((comm) => {
              const joined = isMember(comm);
              return (
                <div
                  key={comm.communityId}
                  onClick={() => setSelectedCommunity(comm)}
                  className={`p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-all ${
                    selectedCommunity?.communityId === comm.communityId ? 'bg-[var(--bg-elevated)] border-l-4 border-[var(--primary)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {comm.coverImage ? (
                      <img src={comm.coverImage} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-rose-400 flex items-center justify-center text-white text-xs font-bold uppercase">
                        {comm.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-semibold truncate text-[var(--text-primary)]">{comm.name}</h4>
                      <p className="text-[10px] text-stone-400 flex items-center gap-2">
                        <span>{comm.memberCount} member{comm.memberCount > 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{comm.postCount} post{comm.postCount > 1 ? 's' : ''}</span>
                      </p>
                    </div>
                  </div>
                  {joined && (
                    <span className="text-[9px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                      Joined
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MAIN VIEW: Community Feed / Info */}
      <div className={`flex-grow flex flex-col overflow-hidden bg-[var(--bg-dark)] ${!selectedCommunity ? 'hidden md:flex items-center justify-center text-stone-400' : 'flex'}`}>
        {!selectedCommunity ? (
          <div className="flex flex-col items-center gap-2">
            <Users size={48} className="text-stone-500 opacity-40 animate-pulse-slow" />
            <p className="text-sm">Select a community to view discussions or join group discussions</p>
          </div>
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[var(--bg-card)] border-b border-[var(--border)] relative flex-shrink-0">
              
              {/* Back Button for mobile */}
              <button 
                onClick={() => setSelectedCommunity(null)}
                className="md:hidden absolute top-4 left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Cover Banner */}
              <div className="h-32 md:h-40 bg-gradient-to-r from-red-900 to-stone-900 relative">
                {selectedCommunity.coverImage && (
                  <img src={selectedCommunity.coverImage} className="w-full h-full object-cover opacity-80" alt="" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold tracking-tight">{selectedCommunity.name}</h3>
                    <p className="text-xs text-stone-300 flex items-center gap-2 mt-1">
                      {selectedCommunity.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                      <span>{selectedCommunity.isPublic ? 'Public Group' : 'Private Group'}</span>
                      <span>•</span>
                      <span>{selectedCommunity.memberCount} member{selectedCommunity.memberCount > 1 ? 's' : ''}</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleShareGroup}
                      className="px-3.5 py-1.5 rounded-lg text-xs bg-stone-700/80 hover:bg-stone-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Share2 size={12} />
                      Share
                    </button>

                    {isMember(selectedCommunity) ? (
                      <button
                        onClick={() => handleLeave(selectedCommunity.communityId)}
                        className="px-3.5 py-1.5 rounded-lg text-xs bg-stone-700/80 hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer font-medium"
                      >
                        <LogOut size={12} />
                        Leave Group
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(selectedCommunity.communityId)}
                        className="px-4 py-1.5 rounded-lg text-xs bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white transition-all flex items-center gap-1.5 cursor-pointer font-medium hover:scale-105"
                      >
                        <UserPlus size={12} />
                        Join Group
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex px-4 pt-1 gap-4 text-xs font-semibold text-stone-500">
                <button
                  onClick={() => setActiveSubTab('posts')}
                  className={`py-3 border-b-2 px-1 cursor-pointer transition-all ${activeSubTab === 'posts' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent hover:text-[var(--text-primary)]'}`}
                >
                  Discussions
                </button>
                <button
                  onClick={() => setActiveSubTab('members')}
                  className={`py-3 border-b-2 px-1 cursor-pointer transition-all ${activeSubTab === 'members' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent hover:text-[var(--text-primary)]'}`}
                >
                  Members
                </button>
                <button
                  onClick={() => setActiveSubTab('rules')}
                  className={`py-3 border-b-2 px-1 cursor-pointer transition-all ${activeSubTab === 'rules' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent hover:text-[var(--text-primary)]'}`}
                >
                  About & Rules
                </button>
                {(selectedCommunity.creatorId === currentUser.id || selectedCommunity.admins.includes(currentUser.id)) && (
                  <button
                    onClick={() => setActiveSubTab('settings')}
                    className={`py-3 border-b-2 px-1 cursor-pointer transition-all ${activeSubTab === 'settings' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent hover:text-[var(--text-primary)]'}`}
                  >
                    Group Settings
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-grow overflow-y-auto p-4 flex justify-center">
              <div className="w-full max-w-2xl flex flex-col gap-4">
                
                {activeSubTab === 'posts' && (
                  <>
                    {/* Post creation card (only for members) */}
                    {isMember(selectedCommunity) ? (
                      <form onSubmit={handleCreatePost} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col gap-3 shadow-sm">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Share something with the group</span>
                        <input
                          type="text"
                          placeholder="Title (optional)"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-sm border border-transparent focus:border-[var(--border)] outline-none text-[var(--text-primary)]"
                        />
                        <textarea
                          placeholder={`Write something to ${selectedCommunity.name}...`}
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] text-sm border border-transparent focus:border-[var(--border)] outline-none text-[var(--text-primary)] resize-none"
                        ></textarea>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={submittingPost || !postContent.trim()}
                            className="px-4 py-2 text-xs rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] font-semibold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {submittingPost ? 'Posting...' : 'Post'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-center text-stone-400 text-xs shadow-sm">
                        Join this group to participate in discussions and share posts.
                      </div>
                    )}

                    {/* Community Posts list */}
                    {loadingPosts ? (
                      <div className="flex items-center justify-center p-8 text-xs text-stone-400">
                        <Loader className="animate-spin text-[var(--primary)] mr-2" size={16} />
                        Loading feed...
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="text-center p-12 text-xs text-stone-400">
                        No posts in this community yet. Be the first to post!
                      </div>
                    ) : (
                      posts.map((post) => (
                        <div key={post.postId} className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] flex flex-col gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs">
                              {post.authorName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                {post.authorName}
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-stone-400">{post.authorRole}</span>
                              </div>
                              <div className="text-[10px] text-stone-400">
                                {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                              </div>
                            </div>
                          </div>

                          <div>
                            {post.title && <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">{post.title}</h4>}
                            <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{post.content}</p>
                          </div>

                          {post.mediaUrl && (
                            <img src={post.mediaUrl} className="w-full max-h-80 object-cover rounded-lg mt-1" alt="" />
                          )}

                          <div className="flex items-center gap-6 border-t border-[var(--border)] pt-2.5 mt-1 text-[11px] font-semibold text-stone-400">
                            <button className="flex items-center gap-1.5 hover:text-[var(--primary)] cursor-pointer">
                              <ThumbsUp size={14} />
                              Like
                            </button>
                            <button className="flex items-center gap-1.5 hover:text-[var(--primary)] cursor-pointer">
                              <MessageSquare size={14} />
                              Comment
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeSubTab === 'members' && (
                  <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-sm font-bold">Group Members ({selectedCommunity.members.length})</h4>
                    </div>

                    {/* Add Member Directly for Creator / Admins */}
                    {(selectedCommunity.creatorId === currentUser.id || selectedCommunity.admins.includes(currentUser.id)) && (
                      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2.5 text-left">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Add Member Directly (Host Control)</span>
                        <div className="flex gap-2">
                          <select
                            value={inviteUserId}
                            onChange={(e) => setInviteUserId(e.target.value)}
                            className="flex-grow px-3 py-2 text-xs bg-[var(--bg-card)] border rounded-lg outline-none text-white focus:border-[var(--primary)]"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="">-- Select a user to add --</option>
                            {(() => {
                              const usersJson = sessionStorage.getItem('users_list') || localStorage.getItem('users_list');
                              const list: any[] = usersJson ? JSON.parse(usersJson) : [];
                              const nonMembers = list.filter(u => u.id !== currentUser.id && u.role !== 'Admin' && !selectedCommunity.members.includes(u.id));
                              return nonMembers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                              ));
                            })()}
                          </select>
                          <button
                            onClick={async () => {
                              if (!inviteUserId) return;
                              setInviting(true);
                              setInviteError('');
                              try {
                                const res = await joinCommunity(token, selectedCommunity.communityId, inviteUserId);
                                if (res.success) {
                                  fetchAllData();
                                  setSelectedCommunity(res.community);
                                  setInviteUserId('');
                                  setInviteError('');
                                }
                              } catch (err: any) {
                                setInviteError(err.message || 'Failed to add member.');
                              } finally {
                                setInviting(false);
                              }
                            }}
                            disabled={inviting || !inviteUserId}
                            className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-lg hover:bg-[var(--primary-dark)] disabled:opacity-50 cursor-pointer"
                          >
                            {inviting ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                        {inviteError && <p className="text-[10px] text-red-500 font-bold mt-1">{inviteError}</p>}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {selectedCommunity.members.map((memberId) => {
                        const isCreator = selectedCommunity.creatorId === memberId;
                        const isMod = selectedCommunity.admins.includes(memberId);
                        const memberInfo = getUserInfo(memberId);
                        
                        return (
                          <div key={memberId} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-elevated)] text-left">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br overflow-hidden ${memberInfo.color}`}>
                              {memberInfo.avatar && (memberInfo.avatar.startsWith('http') || memberInfo.avatar.includes('.')) ? (
                                <img src={memberInfo.avatar} className="w-full h-full object-cover rounded-lg" alt="" />
                              ) : (
                                memberInfo.initials
                              )}
                            </div>
                            <div className="flex-grow overflow-hidden">
                              <p className="text-xs font-semibold truncate text-[var(--text-primary)] flex items-center gap-1.5">
                                {memberInfo.name}
                                {isCreator && <span title="Group Host"><Shield size={12} className="text-amber-500" /></span>}
                                {isMod && !isCreator && <span title="Group Moderator"><Shield size={12} className="text-purple-400" /></span>}
                              </p>
                              <p className="text-[9px] text-stone-400 font-medium">
                                {isCreator ? 'Group Host' : isMod ? 'Group Moderator' : 'Member'}
                              </p>
                            </div>
                            
                            {/* Remove Member Control for Host / Moderator */}
                            {(selectedCommunity.creatorId === currentUser.id || selectedCommunity.admins.includes(currentUser.id)) && memberId !== selectedCommunity.creatorId && (
                              <button
                                onClick={() => handleRemoveMember(memberId)}
                                className="text-stone-500 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                                title="Remove Member from Group"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeSubTab === 'rules' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col gap-2">
                      <h4 className="text-sm font-bold">About {selectedCommunity.name}</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
                        {selectedCommunity.description}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col gap-2">
                      <h4 className="text-sm font-bold">Group Rules</h4>
                      <div className="flex flex-col gap-2.5 mt-2">
                        {selectedCommunity.rules && selectedCommunity.rules.length > 0 ? (
                          selectedCommunity.rules.map((rule, idx) => (
                            <div key={idx} className="flex items-start gap-3 text-xs">
                              <span className="w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                              <p className="text-[var(--text-secondary)] mt-0.5 leading-relaxed">{rule}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-stone-400">No custom rules configured for this community.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === 'settings' && (
                  <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-sm flex flex-col gap-4 text-left">
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-sm font-bold">Group Settings (Host Tools)</h4>
                    </div>

                    {settingsError && (
                      <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500 font-bold animate-slide-in">
                        {settingsError}
                      </div>
                    )}

                    {settingsSuccess && (
                      <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-400 font-bold animate-slide-in">
                        {settingsSuccess}
                      </div>
                    )}

                    {/* Group Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Group Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[var(--bg-elevated)] border rounded-xl outline-none text-white focus:border-[var(--primary)] transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>

                    {/* About Description */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">About Description</label>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 text-xs bg-[var(--bg-elevated)] border rounded-xl outline-none text-white focus:border-[var(--primary)] transition-all resize-none"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>

                    {/* Group Cover Photo URL */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Group Image URL</label>
                      <input
                        type="text"
                        value={editCover}
                        onChange={(e) => setEditCover(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-3 py-2 text-xs bg-[var(--bg-elevated)] border rounded-xl outline-none text-white focus:border-[var(--primary)] transition-all"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>

                    {/* Group Rules List */}
                    <div className="flex flex-col gap-2.5">
                      <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Group Rules</label>
                      <div className="flex flex-col gap-2 bg-[var(--bg-elevated)] p-3 rounded-xl border border-stone-800">
                        {editRules.map((rule, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-850/50 last:border-b-0">
                            <span className="text-stone-300 font-medium">{idx + 1}. {rule}</span>
                            <button
                              type="button"
                              onClick={() => setEditRules(prev => prev.filter((_, i) => i !== idx))}
                              className="text-stone-500 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {editRules.length === 0 && <span className="text-xs text-stone-500">No custom rules added yet.</span>}
                      </div>

                      {/* Add New Rule Row */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type a new rule..."
                          value={newRuleInput}
                          onChange={(e) => setNewRuleInput(e.target.value)}
                          className="flex-grow px-3 py-2 text-xs bg-[var(--bg-elevated)] border rounded-xl outline-none text-white focus:border-[var(--primary)]"
                          style={{ borderColor: 'var(--border)' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newRuleInput.trim()) return;
                            setEditRules(prev => [...prev, newRuleInput.trim()]);
                            setNewRuleInput('');
                          }}
                          className="px-3.5 py-2 bg-stone-850 hover:bg-stone-800 text-stone-200 text-xs font-bold rounded-xl border border-stone-800"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings || !editName.trim() || !editDesc.trim()}
                      className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-extrabold rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
                    >
                      {savingSettings ? (
                        <>
                          <Loader className="animate-spin" size={14} />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Group Settings</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Create Community */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-base font-bold">Create a New Community</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-[var(--bg-elevated)] cursor-pointer text-stone-400 hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
              {errorMsg && (
                <div className="p-2.5 rounded bg-red-500/10 text-red-500 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400">Community Name</label>
                <input
                  type="text"
                  placeholder="e.g. Traditional Recipes & Cooking"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] text-xs border border-transparent focus:border-[var(--primary)] outline-none text-[var(--text-primary)]"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400">Description</label>
                <textarea
                  placeholder="What is this community about? Share interests, rules or requirements."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] text-xs border border-transparent focus:border-[var(--primary)] outline-none text-[var(--text-primary)] resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400">Cover Image URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  value={newCover}
                  onChange={(e) => setNewCover(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[var(--bg-elevated)] text-xs border border-transparent focus:border-[var(--primary)] outline-none text-[var(--text-primary)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-stone-400">Interest Categories</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {availableInterests.map((interest) => {
                    const selected = newInterests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => {
                          if (selected) setNewInterests(prev => prev.filter(i => i !== interest));
                          else setNewInterests(prev => [...prev, interest]);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                          selected 
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white' 
                            : 'bg-[var(--bg-elevated)] border-stone-300 dark:border-stone-700 text-stone-400 hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 mt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Publicly Discoverable</span>
                  <span className="text-[10px] text-stone-400">Allow other members to find and join this group</span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--primary)] border-[var(--border)] focus:ring-[var(--primary)] accent-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs rounded-lg hover:bg-[var(--bg-elevated)] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] font-semibold transition-all cursor-pointer hover:scale-105"
                >
                  Create Community
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <CustomDialog
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          confirmLabel={dialogConfig.confirmLabel}
          cancelLabel={dialogConfig.cancelLabel}
          onConfirm={dialogConfig.onConfirm}
          onCancel={dialogConfig.onCancel}
        />
      </Suspense>

    </div>
  );
}
