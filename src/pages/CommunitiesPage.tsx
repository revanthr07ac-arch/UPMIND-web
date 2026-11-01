import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Plus,
  Check,
  Search,
  X,
  Lock,
  Globe,
  RotateCcw,
  AlertCircle,
  Clock,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { Dialog } from '../components/common/Dialog';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import {
  fetchCommunities,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  type CommunityErrorType,
} from '../lib/communities';
import type { Community } from '../types/database';

export const CommunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<CommunityErrorType | undefined>();
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'discover'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSort, setSelectedSort] = useState<'members' | 'recent' | 'name'>('members');

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('UI/UX & Design');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [coverUrl, setCoverUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'All',
    'UI/UX & Design',
    'Mobile Development',
    'Programming & Systems',
    'Video & Audio',
    'AI & Data Science',
    'Game Development',
    'General',
  ];

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManual) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  // Load communities from real backend
  const loadCommunities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const res = await fetchCommunities({
      search,
      category: selectedCategory,
      tab: activeTab,
      sort: selectedSort,
      userId: user?.id,
    });

    if (res.error) {
      setError(res.error);
      setErrorType(res.errorType);
      setCommunities([]);
    } else {
      setError(null);
      setErrorType(undefined);
      setCommunities(res.communities);
    }
    setIsLoading(false);
  }, [search, selectedCategory, activeTab, selectedSort, user?.id]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  // Debounced search trigger
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearch(val);
    });
  };

  // Join or Leave community
  const handleToggleJoin = async (e: React.MouseEvent, comm: Community) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setActionLoadingId(comm.id);

    if (comm.is_member) {
      // Leave
      const isOwner = comm.owner_id === user.id || comm.created_by === user.id;
      const res = await leaveCommunity(comm.id, user.id, isOwner);
      if (!res.success) {
        alert(res.error || 'Could not leave community.');
      } else {
        await loadCommunities();
      }
    } else {
      // Join
      const isPrivate = comm.visibility === 'private' || Boolean(comm.is_private);
      const res = await joinCommunity(comm.id, user.id, isPrivate);
      if (!res.success) {
        alert(res.error || 'Could not join community.');
      } else {
        await loadCommunities();
      }
    }

    setActionLoadingId(null);
  };

  // Create Community submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    const res = await createCommunity(
      {
        name,
        slug,
        description,
        category,
        visibility,
        coverUrl: coverUrl.trim() || undefined,
      },
      user.id
    );

    if (res.error || !res.community) {
      setFormError(res.error || 'Failed to create community.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setIsCreateOpen(false);
    setName('');
    setSlug('');
    setIsSlugManual(false);
    setDescription('');
    setCoverUrl('');
    setVisibility('public');

    // Navigate to the newly created community detail page
    navigate(`/communities/${res.community.id}`);
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-theme">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-surface border border-theme flex items-center justify-center text-[#FF304F] shadow-sm shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primary">
              Communities
            </h1>
            <p className="text-xs sm:text-sm text-secondary leading-relaxed">
              Join communities to learn together, ask questions, share resources, and collaborate on projects.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            if (!user) {
              navigate('/login', { state: { from: location } });
              return;
            }
            setIsCreateOpen(true);
          }}
          className="shrink-0"
        >
          Create Community
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Search input & Sort dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search communities by name, skill, or topic..."
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[12px] border border-theme pl-9.5 pr-8 py-2.5 focus:border-[#FF304F] focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as any)}
              className="w-full sm:w-auto bg-surface text-primary text-xs rounded-[12px] border border-theme px-3 py-2.5 focus:border-[#FF304F] focus:outline-none cursor-pointer"
            >
              <option value="members">Sort: Most Members</option>
              <option value="recent">Sort: Recently Created</option>
              <option value="name">Sort: Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Tab Filters (All, My Communities, Discover) & Categories */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-secondary rounded-[10px] border border-theme shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#FF304F] text-white shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              All Communities
            </button>
            <button
              onClick={() => {
                if (!user) {
                  navigate('/login', { state: { from: location } });
                  return;
                }
                setActiveTab('my');
              }}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors ${
                activeTab === 'my'
                  ? 'bg-[#FF304F] text-white shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              My Communities
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-colors ${
                activeTab === 'discover'
                  ? 'bg-[#FF304F] text-white shadow-xs'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              Discover
            </button>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-surface text-secondary hover:text-primary text-xs rounded-[8px] border border-theme px-2.5 py-1.5 focus:border-[#FF304F] focus:outline-none cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {(isLoading || isPending) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="bg-surface border border-theme rounded-[16px] p-5 flex flex-col justify-between gap-4 animate-pulse"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-[12px] bg-surface-secondary shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-3/4 h-3.5 bg-surface-secondary rounded" />
                  <div className="w-1/2 h-2.5 bg-surface-tertiary rounded" />
                  <div className="w-full h-8 bg-surface-tertiary rounded mt-2" />
                </div>
              </div>
              <div className="pt-3 border-t border-theme flex justify-between items-center">
                <div className="w-20 h-2 bg-surface-secondary rounded" />
                <div className="w-24 h-7 bg-surface-secondary rounded-[8px]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="w-full max-w-md mx-auto py-12 text-center flex flex-col items-center bg-surface border border-theme rounded-[20px] p-8 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-[#FF304F]/10 border border-[#FF304F]/30 flex items-center justify-center text-[#FF304F] mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-primary mb-2">
            {errorType === 'schema_missing'
              ? 'Database Migration Required'
              : errorType === 'permission_denied'
              ? 'Access Restricted'
              : 'Unable to load communities'}
          </h2>
          <p className="text-xs text-secondary mb-6 max-w-sm leading-relaxed">{error}</p>
          <button
            onClick={() => loadCommunities()}
            className="inline-flex items-center gap-2 bg-[#FF304F] hover:bg-[#E5203F] text-white text-xs font-semibold px-5 py-2.5 rounded-[12px] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty States */}
      {!isLoading && !error && communities.length === 0 && (
        <div className="w-full max-w-md mx-auto py-12 sm:py-16 text-center flex flex-col items-center bg-surface border border-dashed border-theme rounded-[24px] p-8 shadow-xl animate-fade-in">
          {search ? (
            <>
              <div className="w-16 h-16 rounded-full bg-surface-secondary border border-theme flex items-center justify-center text-muted mb-4">
                <Search className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">No communities found</h2>
              <p className="text-xs text-secondary mb-6 max-w-sm leading-relaxed">
                No groups matched &ldquo;{search}&rdquo;. Try another search keyword or clear your filter.
              </p>
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear Search
              </Button>
            </>
          ) : activeTab === 'my' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-surface-secondary border border-theme flex items-center justify-center text-[#FF304F] mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                You haven&apos;t joined any communities yet
              </h2>
              <p className="text-xs text-secondary mb-6 max-w-sm leading-relaxed">
                Start learning together by exploring active skill groups or creating your own.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => setActiveTab('all')}>
                  Browse Communities
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                  Create Community
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-surface-secondary border border-theme flex items-center justify-center text-[#FF304F] mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-primary mb-2 tracking-tight">
                No communities yet.
              </h2>
              <p className="text-xs sm:text-sm text-secondary mb-6 max-w-sm leading-relaxed">
                Start a community around a skill you love, or discover a group to learn with.
              </p>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    if (!user) {
                      navigate('/login', { state: { from: location } });
                      return;
                    }
                    setIsCreateOpen(true);
                  }}
                >
                  Create Community
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Compass className="w-4 h-4" />}
                  onClick={() => navigate('/explore')}
                >
                  Explore Skills
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Community Cards Grid */}
      {!isLoading && !error && communities.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {communities.map((comm) => {
            const isPrivate = comm.visibility === 'private' || comm.is_private;
            const isOwner = user && (comm.owner_id === user.id || comm.created_by === user.id);
            const isMember = comm.is_member;
            const isPendingRequest = comm.membership_status === 'pending';
            const isActionLoading = actionLoadingId === comm.id;

            return (
              <div
                key={comm.id}
                onClick={() => navigate(`/communities/${comm.id}`)}
                className="bg-surface border border-theme rounded-[16px] overflow-hidden flex flex-col justify-between hover:border-theme-strong transition-all shadow-card cursor-pointer group"
              >
                {/* Optional Cover Banner */}
                {comm.cover_url && (
                  <div className="w-full h-24 overflow-hidden bg-black/50 border-b border-theme">
                    <img
                      src={comm.cover_url}
                      alt={comm.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-5 flex flex-col gap-3">
                  {/* Avatar & Title Row */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-[12px] bg-surface-secondary border border-theme overflow-hidden shrink-0 flex items-center justify-center text-[#FF304F] font-bold text-base shadow-sm">
                      {comm.avatar_url ? (
                        <img
                          src={comm.avatar_url}
                          alt={comm.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        comm.name.substring(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-primary group-hover:text-primary truncate">
                          {comm.name}
                        </h3>
                        {isPrivate ? (
                          <span title="Private Community" className="inline-flex items-center">
                            <Lock className="w-3 h-3 text-muted shrink-0" aria-label="Private Community" />
                          </span>
                        ) : (
                          <span title="Public Community" className="inline-flex items-center">
                            <Globe className="w-3 h-3 text-muted shrink-0" aria-label="Public Community" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-semibold text-[#FF304F]">
                          {comm.category}
                        </span>
                        <span className="text-muted text-[10px]">•</span>
                        <span className="text-[11px] text-muted font-medium">
                          {comm.members_count} {comm.members_count === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {comm.description && (
                    <p className="text-xs text-secondary leading-relaxed line-clamp-2">
                      {comm.description}
                    </p>
                  )}
                </div>

                {/* Card Action Footer */}
                <div
                  className="px-5 py-3 border-t border-theme bg-surface-secondary/40 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    {isOwner ? (
                      <span className="text-[#FF304F] font-semibold">You own this</span>
                    ) : isMember ? (
                      <span className="text-[#35B883] font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Member
                      </span>
                    ) : isPendingRequest ? (
                      <span className="text-[#FF7479] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending approval
                      </span>
                    ) : (
                      <span>Free peer group</span>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Primary Button */}
                    {isOwner ? (
                      <button
                        onClick={() => navigate(`/communities/${comm.id}`)}
                        className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold bg-surface text-primary border border-theme hover:bg-surface-secondary transition-colors cursor-pointer"
                      >
                        Manage
                      </button>
                    ) : isMember ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/communities/${comm.id}`)}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-semibold bg-surface text-primary border border-theme hover:bg-surface-secondary transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          disabled={isActionLoading}
                          onClick={(e) => handleToggleJoin(e, comm)}
                          className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium text-muted hover:text-[#FF6269] hover:bg-[#FF304F]/10 transition-colors cursor-pointer"
                        >
                          Leave
                        </button>
                      </div>
                    ) : isPendingRequest ? (
                      <button
                        disabled
                        className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold bg-surface-secondary text-muted border border-theme opacity-80 cursor-not-allowed"
                      >
                        Requested
                      </button>
                    ) : (
                      <button
                        disabled={isActionLoading}
                        onClick={(e) => handleToggleJoin(e, comm)}
                        className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold bg-[#FF304F] hover:bg-[#E5203F] text-white shadow-xs transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                      >
                        {isActionLoading ? (
                          <span>Updating...</span>
                        ) : isPrivate ? (
                          <span>Request to Join</span>
                        ) : (
                          <span>Join Community</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Community Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Community"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 rounded-[10px] bg-[#FF304F]/10 border border-[#FF304F]/40 text-xs text-[#FF6269] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">
              Community Name <span className="text-[#FF304F]">*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={80}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Next.js & Fullstack Builders"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-secondary">
                URL Slug <span className="text-[#FF304F]">*</span>
              </label>
              <span className="text-[10px] text-muted">/communities/{slug || 'your-slug'}</span>
            </div>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setIsSlugManual(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));
              }}
              placeholder="e.g., nextjs-fullstack-builders"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs font-mono rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">
              Category <span className="text-[#FF304F]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface text-primary text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none cursor-pointer"
            >
              {categories
                .filter((c) => c !== 'All')
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
          </div>

          {/* Visibility */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center gap-2 p-2.5 rounded-[10px] border text-left transition-colors cursor-pointer ${
                  visibility === 'public'
                    ? 'bg-surface-secondary border-[#FF304F] text-primary'
                    : 'bg-surface border-theme text-secondary'
                }`}
              >
                <Globe className="w-4 h-4 text-[#FF304F] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Public</span>
                  <span className="text-[10px] text-muted">Anyone can view and join</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex items-center gap-2 p-2.5 rounded-[10px] border text-left transition-colors cursor-pointer ${
                  visibility === 'private'
                    ? 'bg-surface-secondary border-[#FF304F] text-primary'
                    : 'bg-surface border-theme text-secondary'
                }`}
              >
                <Lock className="w-4 h-4 text-[#FF304F] shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Private</span>
                  <span className="text-[10px] text-muted">Approval required to join</span>
                </div>
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">
              Description <span className="text-[#FF304F]">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What skills will members share, build, and practice in this community?"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>

          {/* Cover Image URL */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">
              Cover Image URL <span className="text-[10px] text-muted">(Optional)</span>
            </label>
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
            >
              Create Community
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
