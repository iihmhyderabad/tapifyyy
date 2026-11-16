# NFC & QR Code Manager — Google Review & Social Cards

A full-stack TanStack Start application for managing dynamic QR codes and NFC cards. Features permanent QR URLs, instant destination updates, print-ready card generation (PDF/SVG/PSD/PNG), and Supabase authentication with Row-Level Security.

## Features

- **Dynamic QR Routing**: Permanent QR links (`/r/:id`) that redirect dynamically to current destination targets.
- **Direct Card Activation**: Scan-to-claim blank card workflow allowing immediate activation on first tap.
- **Card Design Studio**: Google Review, Instagram, and custom card designs with real-time preview and export.
- **High-Resolution Exports**: Vector PDF, SVG primitives, 600-PPI layered PSD, and 8K PNG outputs.
- **Supabase Integration**: Authentication, user profiles, and Postgres database with Row-Level Security.
- **Vercel Ready**: Optimized for deployment on Vercel using TanStack Start and Nitro.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) + [React 19](https://react.dev)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com)
- **Backend / DB**: [Supabase](https://supabase.com) (PostgreSQL, Auth, RLS)
- **Build Tool**: [Vite](https://vitejs.dev) & [Nitro](https://nitro.unjs.io)
- **Deployment**: [Vercel](https://vercel.com)

## Getting Started

### 1. Prerequisites
- Node.js 20+ (Node 24 supported)
- npm or bun

### 2. Installation
```sh
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-or-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-or-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Database Connection (Optional for Drizzle migrations)
DATABASE_URL="postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"

# Public Domain (Used to encode printed QR links)
VITE_PUBLIC_SITE_URL="https://your-app.vercel.app"
```

### 4. Running Locally
```sh
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### 5. Running Tests
```sh
npm test
```

## Deployment to Vercel

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the project into [Vercel](https://vercel.com/new).
3. Set the Framework Preset to **Other** (or let Vercel detect the build output).
4. Build Command: `npm run build`
5. Output Directory: `.vercel/output` (automatically detected by Nitro).
6. Configure the Environment Variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_PUBLIC_SITE_URL` (your production URL)
