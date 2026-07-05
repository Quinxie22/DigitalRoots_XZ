import { useState, useEffect } from 'react';
import { Shield, Search, User as UserIcon, ShieldAlert, EyeOff, FileText, Loader, Check, Ban, UserCheck, AlertTriangle } from 'lucide-react';
import { 
  getAllUsersList, updateUserStatus, updateUserRole, 
  getFlaggedPosts, hidePost, getAuditLogs, resolveContentUrl 
} from '../contentApi';
import type { User } from '../types';

interface AdminConsoleProps {
  token: string;
  currentUser: User;
}

export default function AdminConsole({ token, currentUser }: AdminConsoleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'content' | 'logs'>('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Flagged Content State
  const [flaggedPosts, setFlaggedPosts] = useState<any[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    loadTabContent();
  }, [activeSubTab]);

  const loadTabContent = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (activeSubTab === 'users') {
        const data = await getAllUsersList(token);
        setUsers(data.users || []);
      } else if (activeSubTab === 'content') {
        const data = await getFlaggedPosts(token);
        setFlaggedPosts(data.posts || []);
      } else if (activeSubTab === 'logs') {
        const data = await getAuditLogs(token);
        setAuditLogs(data.logs || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load console data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: 'Active' | 'Suspended' | 'Banned', reason?: string) => {
    setError('');
    setSuccess('');
    try {
      await updateUserStatus(token, userId, newStatus, reason);
      setSuccess(`User status updated to ${newStatus}`);
      // Refresh user listing
      const data = await getAllUsersList(token);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'Elder' | 'Youth' | 'Admin') => {
    setError('');
    setSuccess('');
    try {
      await updateUserRole(token, userId, newRole);
      setSuccess(`User role updated to ${newRole}`);
      // Refresh user listing
      const data = await getAllUsersList(token);
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
    }
  };

  const handleHidePost = async (postId: string) => {
    setError('');
    setSuccess('');
    try {
      await hidePost(token, postId, false); // false hides the post
      setSuccess('Post successfully hidden from timeline');
      // Refresh flagged posts
      const data = await getFlaggedPosts(token);
      setFlaggedPosts(data.posts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to hide post');
    }
  };

  // Filtered users calculation
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || (u.status || 'Active') === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-surface)] overflow-y-auto p-4 md:p-8 select-none">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 text-left">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-red-500 shadow-md bg-red-500/10">
            <Shield size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif text-stone-850 dark:text-white">Admin Console</h1>
            <p className="text-xs text-stone-400">Manage user status, roles, content moderation, and inspect system audit logs.</p>
          </div>
        </div>
      </div>

      {/* Quick Alert Feedback Banner */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-left font-semibold flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs text-left font-semibold flex items-center gap-2 animate-fade-in">
          <Check size={14} />
          {success}
        </div>
      )}

      {/* Inner Navigation Tabs */}
      <div className="flex border-b mt-6" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'users' ? 'border-red-500 text-[var(--primary)] font-extrabold' : 'border-transparent text-stone-450 hover:text-stone-700'
          }`}
        >
          User Directory ({users.length})
        </button>
        <button
          onClick={() => setActiveSubTab('content')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'content' ? 'border-red-500 text-[var(--primary)] font-extrabold' : 'border-transparent text-stone-450 hover:text-stone-700'
          }`}
        >
          Flagged Content ({flaggedPosts.length})
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeSubTab === 'logs' ? 'border-red-500 text-[var(--primary)] font-extrabold' : 'border-transparent text-stone-450 hover:text-stone-700'
          }`}
        >
          System Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
            <Loader className="animate-spin text-red-500" size={24} />
            <p className="text-xs">Fetching records...</p>
          </div>
        ) : (
          <>
            {/* 1. USERS LIST VIEW */}
            {activeSubTab === 'users' && (
              <div className="space-y-4">
                {/* Search & Filter bar */}
                <div className="flex flex-col md:flex-row gap-3 items-center">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl outline-none border text-xs bg-[var(--bg-card)] dark:border-stone-850 text-stone-850 dark:text-white"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none bg-[var(--bg-card)] dark:border-stone-850 text-stone-850 dark:text-white"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <option value="All">All Roles</option>
                      <option value="Elder">Elders</option>
                      <option value="Youth">Youths</option>
                      <option value="Admin">Admins</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl border text-xs outline-none bg-[var(--bg-card)] dark:border-stone-850 text-stone-850 dark:text-white"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Banned">Banned</option>
                    </select>
                  </div>
                </div>

                {/* Users List Grid */}
                <div className="border rounded-2xl overflow-x-auto shadow-sm" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--bg-elevated)] border-b text-[10px] uppercase font-extrabold tracking-wider text-stone-500" style={{ borderColor: 'var(--border)' }}>
                        <th className="p-4">User Info</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Age</th>
                        <th className="p-4 text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-stone-400 italic">No users found matching filters.</td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const status = u.status || 'Active';
                          return (
                            <tr key={u._id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs uppercase">
                                  {u.avatar && (u.avatar.startsWith('http') || u.avatar.includes('.')) ? (
                                    <img src={u.avatar} className="w-full h-full object-cover rounded-lg" />
                                  ) : (
                                    u.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="text-left">
                                  <p className="font-bold text-stone-850 dark:text-white">{u.name}</p>
                                  <p className="text-[10px] text-stone-400">{u.email}</p>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.role === 'Admin' ? 'bg-purple-500/10 text-purple-500' :
                                  u.role === 'Elder' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' :
                                  status === 'Suspended' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="p-4 font-semibold text-stone-600 dark:text-stone-300">{u.age || '—'}</td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                {/* Role toggle options */}
                                <button
                                  onClick={() => handleUpdateRole(u._id, u.role === 'Elder' ? 'Youth' : 'Elder')}
                                  title="Toggle Elder/Youth Role"
                                  className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border hover:bg-[var(--border)] text-stone-500 hover:text-stone-850 dark:hover:text-white transition-all cursor-pointer inline-flex items-center gap-1 font-bold"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <UserIcon size={12} />
                                  <span className="text-[9px]">Toggle Role</span>
                                </button>

                                {/* Action Buttons based on status */}
                                {status === 'Active' ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateStatus(u._id, 'Suspended')}
                                      className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 hover:bg-yellow-500/20 transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[9px]"
                                    >
                                      <EyeOff size={11} /> Suspend
                                    </button>
                                    <button
                                      onClick={() => handleUpdateStatus(u._id, 'Banned')}
                                      className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[9px]"
                                    >
                                      <Ban size={11} /> Ban
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateStatus(u._id, 'Active')}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20 transition-all cursor-pointer font-bold inline-flex items-center gap-1 text-[9px]"
                                  >
                                    <UserCheck size={11} /> Unsuspend
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. FLAGGED CONTENT VIEW */}
            {activeSubTab === 'content' && (
              <div className="space-y-4 text-left">
                {flaggedPosts.length === 0 ? (
                  <div className="p-12 text-center border rounded-2xl bg-[var(--bg-card)] text-stone-400 italic" style={{ borderColor: 'var(--border)' }}>
                    No flagged or reported feed posts currently awaiting review.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flaggedPosts.map((post) => (
                      <div key={post.postId} className="p-5 border rounded-2xl bg-[var(--bg-card)] shadow-sm flex flex-col justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-bold text-red-500 px-2 py-0.5 rounded bg-red-500/10">Reported Post</span>
                            <span className="text-[10px] text-stone-400">{new Date(post.createdAt).toLocaleDateString()}</span>
                          </div>
                          
                          {post.title && <h4 className="font-serif font-black text-sm text-stone-900 dark:text-stone-100">{post.title}</h4>}
                          <h5 className="font-semibold text-xs text-stone-500">Author: {post.authorName || 'User'}</h5>
                          
                          <p className="text-xs text-stone-750 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                          {/* Flagged Media Content Display */}
                          {post.mediaUrl && (
                            <div className="mt-3 rounded-xl overflow-hidden border bg-black/10 dark:bg-black/20 flex flex-col items-center justify-center" style={{ borderColor: 'var(--border)' }}>
                              {post.type === 'image' && (
                                <img 
                                  src={resolveContentUrl(post.mediaUrl)} 
                                  alt={post.title || "Reported image content"} 
                                  className="max-h-64 w-full object-contain" 
                                />
                              )}
                              {post.type === 'video' && (
                                <video 
                                  src={resolveContentUrl(post.mediaUrl)} 
                                  controls 
                                  className="max-h-64 w-full" 
                                />
                              )}
                              {post.type === 'audio' && (
                                <div className="p-4 w-full flex items-center justify-center">
                                  <audio 
                                    src={resolveContentUrl(post.mediaUrl)} 
                                    controls 
                                    className="w-full" 
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                          <span className="text-[10px] text-stone-400">Views: {post.views || 0}</span>
                          <button
                            onClick={() => handleHidePost(post.postId)}
                            className="px-3.5 py-1.5 rounded-xl bg-red-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                          >
                            <EyeOff size={11} /> Hide from Feed
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. SYSTEM AUDIT LOGS VIEW */}
            {activeSubTab === 'logs' && (
              <div className="space-y-4 text-left">
                <div className="border rounded-2xl overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  <div className="p-4 bg-[var(--bg-elevated)] border-b text-[10px] uppercase font-extrabold tracking-wider text-stone-500" style={{ borderColor: 'var(--border)' }}>
                    Admin Activity Log Timeline
                  </div>
                  <div className="divide-y bg-[var(--bg-card)]" style={{ borderColor: 'var(--border)' }}>
                    {auditLogs.length === 0 ? (
                      <p className="p-8 text-center text-stone-405 italic">No audit log records found.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log._id} className="p-4 flex items-start gap-3 hover:bg-[var(--bg-elevated)]/30 transition-colors">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center flex-shrink-0">
                            <FileText size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <p className="text-xs font-bold text-stone-850 dark:text-white">
                                <span className="text-red-500" style={{ color: 'var(--primary)' }}>{log.adminName}</span> {log.action.replace('_', ' ')}
                              </p>
                              <span className="text-[10px] text-stone-400">
                                {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10px] text-stone-505 dark:text-stone-400 mt-1">
                              Target ID ({log.targetType}): <span className="font-mono bg-[var(--bg-elevated)] px-1 rounded">{log.targetId}</span>
                            </p>
                            {log.reason && (
                              <p className="text-[11px] italic text-stone-500 mt-1 bg-stone-500/5 p-2 rounded-lg border border-stone-500/10">Reason: "{log.reason}"</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
