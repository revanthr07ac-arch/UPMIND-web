# UPMIND — Learn. Create. Connect.
## Full-Stack Peer-Learning & Social Network (Web Application)

> **Tagline:** Learn. Create. Connect.  
> **Aesthetic:** Instagram-inspired dark mode (`#0B0C0F` background, `#15161B` elevated surfaces, `#E5484D` red accent).  
> **Core Differentiator:** 100% Free Peer Learning Workflow: **Discover Creator → Watch Tutorial → Request Free Materials → Receive Authorized Resources → Direct Message → Apply Skill.**

---

## 1. Features Implemented

### 🎨 Theme & Visual Design
- **Exact Dark Theme Palette**:
  - Background: `#0B0C0F`, elevated `#101116`.
  - Surfaces: `#15161B` (cards), `#1B1D24` (secondary), `#23252D` (tertiary), `#282A32` (hover).
  - Text: `#F5F5F7` (primary), `#B0B3BD` (secondary), `#858995` (muted).
  - Accent: `#E5484D` (primary red), `#D7373F` (hover), `#BE3038` (active), `#32191D` (soft), `#693039` (border).
  - Borders: `#292B34`, `#393C47`.
- **Responsive Layout**:
  - Desktop: Left navigation sidebar with Upmind branding & red active indicators, central content feed, and right contextual sidebar (suggested creators & trending skills).
  - Tablet: Collapsible navigation with centered responsive feed.
  - Mobile (320px–639px): Sticky header with unread message/notification badges, compact feed, and fixed 5-tab bottom navigation (`Home`, `Explore`, `Create`, `Reels`, `Profile`).

### 📰 Home Feed & Social Features
- **Story Bar**: Horizontal carousel with Instagram-style gradient ring (`#E5484D` gradient), "Your Story" upload shortcut, and immersive fullscreen story viewer with auto-advancing progress bars and tap navigation.
- **For You & Following Tabs**: Toggle between personalized discovery feed and posts from followed creators.
- **Interactive Post Cards**:
  - Author avatar, username, relative timestamp (`2h ago`), and follow shortcut.
  - Media showcase (images, tutorial lessons with collapsible breakdowns).
  - Realtime Likes counter with animated red heart.
  - Threaded Comments modal with instant submission and author notifications.
  - Bookmark / Save functionality.
  - Share modal with link copy and Web Share API support.
  - **"Request Materials" CTA**: Prominent, tasteful button on skill-sharing posts.

### 🤝 Core Differentiator: Free Peer-Learning Hub (`/learn`)
- **Requests Received Tab**: For creators to view incoming material requests from learners, accept or decline with one click, and attach learning resources.
- **Requests Sent Tab**: For learners to track pending, accepted, and fulfilled requests.
- **Resource Attachment & Fulfillment**: Creators attach practice notes, GitHub links, Figma templates, Google Drive folders, or files directly to the request.
- **Access & Message**: Once fulfilled, learners can directly access the material and start a 1-on-1 direct message with the mentor.
- **Zero Paywalls**: All resources remain strictly free.

### 🔍 Explore & Skill Discovery (`/explore`)
- Instant search filtering by creator username, skill name, or caption keywords.
- Skill category pills (`UI/UX Design`, `Mobile Development`, `Programming`, `Graphic Design`, `Video Editing`, `AI & Prompting`, `Data Science`).
- Top Mentors recommendation row with instant follow buttons.
- Responsive image/video discovery grid with hover engagement counters.

### 🎬 Immersive Reels (`/reels`)
- Full vertical viewport short-video experience with play/pause and sound mute toggle.
- Right-hand overlay action bar (Like with live counter, Comments modal, Request Learning Materials CTA, Save, Share).
- Desktop keyboard/arrow navigation and touch swipe support.

### 💬 Direct Messaging (`/messages`)
- Responsive split-pane layout on desktop and dedicated conversation view on mobile.
- 1-on-1 conversations fetched from `public.conversations` and `public.conversation_members`.
- Supabase Realtime subscription on `messages` table for instant live message delivery.
- Unread badge counters.

### 🔔 Activity Notifications (`/notifications`)
- Alerts for new followers, likes, comments, learning requests received, and material fulfillments.
- Mark all as read action and unread counter badges.

### 👥 Creator Profiles (`/u/:username` & `/profile`)
- Header with avatar, display name, username, bio, college/organization affiliation, location, and portfolio link.
- Experience level badge (`beginner`, `intermediate`, `advanced` mentor).
- Dynamic Skill Badges: **"Can Teach & Mentor"** vs. **"Currently Learning"**.
- Tabbed content: Posts grid, Reels, and private Saved bookmarks.
- Edit Profile modal with avatar upload, bio, education, and links.

### 🛡️ Safety, Settings & Privacy (`/settings`)
- Privacy controls: Toggle direct messages and mentor badges.
- Upmind Peer Learning Pledge guidelines.
- Sign out and cascading account deletion with explicit confirmation dialog.

---

## 2. Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Framework** | React 19 + TypeScript | Strict typing, Vite 8 bundler |
| **Styling** | Vanilla CSS Tokens + Tailwind CSS v4 | `@tailwindcss/vite`, CSS variables |
| **Routing** | React Router v7 | Protected routes, public routes, deep-link support |
| **Icons** | Lucide React | Modern, minimalist icon set |
| **Backend & DB** | Supabase & PostgreSQL 15 | Active cloud instance with RLS |
| **Realtime** | Supabase Realtime Channels | Live chat messages & notifications |
| **Testing** | Vitest + React Testing Library | Unit tests, component tests, jsdom |

---

## 3. Database Schema & Migrations

The database consists of 16 interconnected PostgreSQL tables with Row Level Security (RLS) enabled:
- `profiles`: Creator and learner profiles, stats, bio, institution, experience level.
- `skills`: Catalog of categorized skills (UI/UX, Flutter, Python, Graphic Design, etc.).
- `user_skills`: Intent-based mapping (`teaching` vs `learning`) with proficiency levels.
- `posts`: Media showcases, short reels, and tutorial posts with step-by-step breakdown.
- `likes`: Post likes with counter synchronization.
- `comments`: Threaded post comments with notifications.
- `follows`: Social following graph.
- `saved_posts`: Private bookmark collection.
- `stories`: 24-hour ephemeral stories with image/video support.
- `learning_requests`: Structured material requests, statuses (`pending`, `accepted`, `declined`, `completed`), and fulfillment resources.
- `conversations` & `conversation_members`: 1-on-1 messaging threads with last-read tracking.
- `messages`: Chat message history with Realtime replication.
- `shared_resources`: Attached files, external links, and practice notes.
- `notifications`: Activity alerts for likes, follows, comments, and learning requests.
- `communities` & `community_members`: Skill groups and discussion forums.
- `blocks` & `reports`: Moderation and harassment prevention.

### Migration Files:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_row_level_security.sql`
- `supabase/migrations/003_storage_and_triggers.sql`
- `supabase/migrations/004_seed_skills.sql`
- `supabase/migrations/005_profiles_institution_course.sql`
- `supabase/migrations/006_backend_foundation_step2.sql`
- `supabase/migrations/007_schema_repair_and_sync.sql`
- `supabase/migrations/008_messaging_and_resources_step5.sql`
- `supabase/migrations/009_profile_highlights.sql`
- `supabase/migrations/010_fix_storage_avatar_upload.sql`
- `supabase/migrations/011_auth_email_and_autoconfirm_repair.sql`
- `supabase/migrations/012_web_features_reels_stories_communities.sql`

---

## 4. Environment Configuration

Create a `.env` file in the root directory (copied from `.env.example`):

```env
VITE_SUPABASE_URL=https://nfjrhdrmsdincireoada.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_TvYgdpQKKrS-4IpGFxGXSg_MQo00pzp
```

---

## 5. Getting Started & Running Locally

### Prerequisites:
- Node.js v18+ (tested on Node v24.20.0)
- npm v10+

### Installation:
```bash
# Install dependencies
npm install
```

### Run Local Development Server:
```bash
npm run dev
```
Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

---

## 6. Testing & Production Build

### Run Unit and Component Tests (Vitest):
```bash
npm test
```
*Result: 9 tests passing across 2 test suites.*

### Run Linter (Oxlint):
```bash
npm run lint
```
*Result: 0 errors.*

### Run Production Build:
```bash
npm run build
```
*Result: Clean TypeScript compilation and Vite production bundle generated in `dist/` in < 1 second.*

### Preview Production Build:
```bash
npm run preview
```

---

## 7. Demo Accounts & Testing Tips

- **Quick Demo Login**: On the `/login` screen, click the **"Use Demo Creator Account"** button to instantly populate credentials (`revanth@upmind.dev` / `Upmind123!@#`) and sign in.
- **Requesting Materials**: Navigate to the feed or explore page, find a tutorial post authored by another creator, and click **"Request Materials"**. Switch to the `/learn` tab to inspect the request workflow.
- **Realtime Chat**: Open two browser tabs with different accounts and navigate to `/messages` to experience live real-time message exchange.

---

## 8. Deployment Instructions

1. **Vercel / Netlify / Cloudflare Pages**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     - `VITE_SUPABASE_URL`: Your Supabase Project URL
     - `VITE_SUPABASE_ANON_KEY`: Your Supabase Publishable Key
   - SPA Rewrite: Ensure all routes rewrite to `/index.html` for client-side routing.
