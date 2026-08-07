#!/usr/bin/env bash
set -euo pipefail

# ==============================================
# MELOTONES - LOCAL DEPLOYMENT AGENT (WSL2)
# ==============================================

echo "🎵 Melotones Local Setup Agent"
echo "==============================="

# ---- 1. Ensure Node.js & npm ----
if ! command -v node &> /dev/null; then
  echo "⚡ Node.js not found. Installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
else
  echo "✅ Node.js $(node -v) already installed"
fi

# ---- 2. Create project folder if not exists ----
PROJECT_DIR=~/melotones
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# ---- 3. Write all source files (the complete SaaS) ----
echo "📁 Generating project files..."

# package.json
cat > package.json << 'PKGJSON'
{
  "name": "melotones",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "generate-sample-mp3": "node scripts/generate-sample-mp3.js"
  },
  "dependencies": {
    "@supabase/ssr": "^0.1.0",
    "@supabase/supabase-js": "^2.39.3",
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "stripe": "^14.14.0",
    "tailwind-merge": "^2.2.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
PKGJSON

# next.config.js
cat > next.config.js << 'NEXTCONF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['avatars.githubusercontent.com'] },
};
module.exports = nextConfig;
NEXTCONF

# tailwind.config.ts
cat > tailwind.config.ts << 'TAILWIND'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
export default config;
TAILWIND

# postcss.config.js
cat > postcss.config.js << 'POSTCSS'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
POSTCSS

# tsconfig.json
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSCONFIG

# .env.local template
cat > .env.local.example << 'ENVEX'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_MOCK_AI=true
NEXT_PUBLIC_MOCK_PAYMENTS=true
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ENVEX

# lib directory
mkdir -p lib/supabase
mkdir -p scripts
mkdir -p public/audio
mkdir -p components

# lib/supabase/client.ts
cat > lib/supabase/client.ts << 'SBCLIENT'
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
SBCLIENT

# lib/supabase/server.ts
cat > lib/supabase/server.ts << 'SBSERVER'
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerClientWithCookies() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
SBSERVER

# lib/supabase/middleware.ts
cat > lib/supabase/middleware.ts << 'SBMID'
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
SBMID

# middleware.ts (root)
cat > middleware.ts << 'ROOTMID'
import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
ROOTMID

# lib/utils.ts
cat > lib/utils.ts << 'UTILS'
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
UTILS

# lib/stripe.ts
cat > lib/stripe.ts << 'STRIPE'
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
STRIPE

# lib/ai-generate.ts
cat > lib/ai-generate.ts << 'AI'
// Mock AI generation – clearly labelled
export async function mockGenerateMusic(
  occasion: string,
  style: string,
  message: string
): Promise<{ audioUrl: string; duration: number }> {
  // Simulate processing time (2-5 seconds)
  await new Promise((r) => setTimeout(r, 2500));
  return {
    audioUrl: '/audio/sample.mp3',
    duration: 10,
  };
}
AI

# types/index.ts
cat > types/index.ts << 'TYPES'
export type Generation = {
  id: string;
  user_id: string;
  occasion: string;
  style: string;
  custom_message: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  audio_url: string | null;
  is_public: boolean;
  created_at: string;
};

export type ExampleSong = {
  id: string;
  title: string;
  occasion: string;
  style: string;
  audio_url: string;
  description: string | null;
  plays: number;
};
TYPES

# scripts/generate-sample-mp3.js
cat > scripts/generate-sample-mp3.js << 'SAMPLEMP3'
const fs = require('fs');
const path = require('path');

const sampleMp3Base64 = '//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADwADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsL///////////////////////////////////////////8AAAA5TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAA8D5f0BAAAAAAADwAAAA8EAAA8D5f0AgAAAAAADwAAAA8IAAA8D5f0AwAAAAAADwAAAA8MAAA8D5f0BAAAAAAADwAAAA8QAAA8D5f0CAAAAAAADwAAAA8UAAA8D5f0DwAAAAAADwAAAA8YAAA8D5f0EAAAAAAADwAAAA8cAAA8D5f0FAAAAAAADwAAAA8gAAA8D5f0GAAAAAAADwAAAA8kAAA8D5f0HAAAAAAADwAAAA8oAAA8D5f0IAAAAAAADwAAAA8sAAA8D5f0JAAAAAAADwAAAA80AAA8D5f0KAAAAAAADwAAAA84AAA8D5f0LAAAAAAADwAAAA9A';
const buffer = Buffer.from(sampleMp3Base64, 'base64');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'audio', 'sample.mp3'), buffer);
console.log('Sample MP3 created.');
SAMPLEMP3

# components/AuthForm.tsx
cat > components/AuthForm.tsx << 'AUTHFORM'
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else {
        alert('Check your email to confirm your account!');
        router.push('/login');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">{isSignUp ? 'Create Account' : 'Sign In'}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border p-2 rounded"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border p-2 rounded"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button className="text-purple-600 underline" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
}
AUTHFORM

# components/Navbar.tsx
cat > components/Navbar.tsx << 'NAVBAR'
'use client';
import Link from 'next/link';
import { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar({ session: initialSession }: { session: Session | null }) {
  const [session, setSession] = useState(initialSession);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow p-4 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold text-purple-600">Melotones</Link>
      <div className="flex gap-4 items-center">
        <Link href="/" className="hover:text-purple-600">Home</Link>
        {session ? (
          <>
            <Link href="/create" className="hover:text-purple-600">Create</Link>
            <Link href="/history" className="hover:text-purple-600">My Songs</Link>
            <Link href="/dashboard" className="hover:text-purple-600">Dashboard</Link>
            <button onClick={handleLogout} className="text-red-500 hover:underline">Logout</button>
          </>
        ) : (
          <>
            <Link href="/login" className="hover:text-purple-600">Login</Link>
            <Link href="/signup" className="hover:text-purple-600">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
NAVBAR

# components/SearchFilters.tsx
cat > components/SearchFilters.tsx << 'SEARCHFILT'
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

const occasions = ['birthday', 'wedding', 'baptism', 'graduation', 'tribute', 'dowry', 'proposal', 'encouragement', 'apology', 'fun'];
const styles = ['Afrobeat', 'Amapiano', 'Zouk', 'Coupé-Décalé', 'Rap', 'RnB', 'Acoustic', 'Gospel', 'Mbalax', 'Highlife'];

export default function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [occasion, setOccasion] = useState(searchParams.get('occasion') || '');
  const [style, setStyle] = useState(searchParams.get('style') || '');
  const [q, setQ] = useState(searchParams.get('q') || '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (occasion) params.set('occasion', occasion);
    if (style) params.set('style', style);
    if (q) params.set('q', q);
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-8 p-4 bg-white rounded shadow">
      <input
        type="text"
        placeholder="Search by title..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="border p-2 rounded"
      />
      <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="border p-2 rounded">
        <option value="">All Occasions</option>
        {occasions.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <select value={style} onChange={(e) => setStyle(e.target.value)} className="border p-2 rounded">
        <option value="">All Styles</option>
        {styles.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button onClick={applyFilters} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Filter</button>
    </div>
  );
}
SEARCHFILT

# components/ExampleGrid.tsx
cat > components/ExampleGrid.tsx << 'EXAMPLEGRID'
import { ExampleSong } from '@/types';
import Link from 'next/link';

export default function ExampleGrid({ songs }: { songs: ExampleSong[] }) {
  if (!songs.length) return <p className="text-gray-500">No example songs found.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {songs.map((song) => (
        <div key={song.id} className="bg-white rounded shadow p-4">
          <h3 className="font-semibold text-lg">{song.title}</h3>
          <p className="text-sm text-gray-600 capitalize">{song.occasion} · {song.style}</p>
          <audio controls src={song.audio_url} className="w-full mt-2" />
          {song.description && <p className="text-sm mt-2">{song.description}</p>}
        </div>
      ))}
    </div>
  );
}
EXAMPLEGRID

# components/CreateForm.tsx
cat > components/CreateForm.tsx << 'CREATEFORM'
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const occasions = ['birthday', 'wedding', 'baptism', 'graduation', 'tribute', 'dowry', 'proposal', 'encouragement', 'apology', 'fun'];
const styles = ['Afrobeat', 'Amapiano', 'Zouk', 'Coupé-Décalé', 'Rap', 'RnB', 'Acoustic', 'Gospel', 'Mbalax', 'Highlife'];

export default function CreateForm() {
  const [occasion, setOccasion] = useState(occasions[0]);
  const [style, setStyle] = useState(styles[0]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('generating');
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, style, custom_message: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGenerationId(data.id);
      setStatus('completed');
      router.push(`/songs/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Create Your Personalized Song</h1>
      {process.env.NEXT_PUBLIC_MOCK_AI === 'true' && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
          ⚠️ <strong>Demo Mode:</strong> AI generation is simulated. Real music generation will be available soon.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          Occasion
          <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full border p-2 rounded mt-1">
            {occasions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="block">
          Music Style
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full border p-2 rounded mt-1">
            {styles.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          Names, anecdotes, personal message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border p-2 rounded mt-1"
            rows={4}
            placeholder="e.g. Happy birthday to my best friend Kemi..."
            required
          />
        </label>
        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={status === 'generating'}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center"
        >
          {status === 'generating' ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Generating...
            </>
          ) : (
            'Generate Song (1 credit)'
          )}
        </button>
      </form>
    </div>
  );
}
CREATEFORM

# components/SongDetail.tsx
cat > components/SongDetail.tsx << 'SONGDETAIL'
'use client';
import { Generation } from '@/types';

export default function SongDetail({ song }: { song: Generation }) {
  const shareText = `Listen to my AI-generated ${song.occasion} song in ${song.style} style on Melotones!`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Melotones Song', text: shareText, url: shareUrl });
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };

  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
  const instagramShare = `https://www.instagram.com/`;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Your Generated Song</h1>
      <div className="mb-4">
        <p className="capitalize"><strong>Occasion:</strong> {song.occasion}</p>
        <p><strong>Style:</strong> {song.style}</p>
        <p className="text-sm text-gray-600 mt-2">{song.custom_message}</p>
      </div>
      {song.status === 'completed' && song.audio_url ? (
        <>
          <audio controls src={song.audio_url} className="w-full mb-4" />
          <div className="flex flex-wrap gap-3 mb-6">
            <a
              href={song.audio_url}
              download
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Download MP3
            </a>
            <button onClick={handleShare} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              Share
            </button>
            <a href={whatsappShare} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
              WhatsApp
            </a>
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied'); }} className="bg-gray-500 text-white px-4 py-2 rounded">
              Copy Link
            </button>
          </div>
        </>
      ) : (
        <p className="text-yellow-600">Song is still processing or failed.</p>
      )}
    </div>
  );
}
SONGDETAIL

# components/CreditsManager.tsx
cat > components/CreditsManager.tsx << 'CREDITSMGR'
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CreditsManager() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const addCredits = async () => {
    setLoading(true);
    if (process.env.NEXT_PUBLIC_MOCK_PAYMENTS === 'true') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/credits/add-mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, amount: 10 }),
      });
      alert('10 credits added (mock)');
      window.location.reload();
    } else {
      const res = await fetch('/api/credits/purchase', { method: 'POST' });
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
    setLoading(false);
  };

  return (
    <button
      onClick={addCredits}
      disabled={loading}
      className="mt-3 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Buy 10 Credits (Test Mode)'}
    </button>
  );
}
CREDITSMGR

# App layout, pages, API routes...
mkdir -p app/auth/callback
mkdir -p app/login
mkdir -p app/signup
mkdir -p app/create
mkdir -p app/songs/[id]
mkdir -p app/history
mkdir -p app/dashboard
mkdir -p app/api/generations
mkdir -p app/api/credits/add-mock
mkdir -p app/api/credits/purchase
mkdir -p app/api/credits/webhook

# app/layout.tsx
cat > app/layout.tsx << 'LAYOUT'
import './globals.css';
import Navbar from '@/components/Navbar';
import { createServerClientWithCookies } from '@/lib/supabase/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Navbar session={session} />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
LAYOUT

# app/globals.css
cat > app/globals.css << 'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS

# app/page.tsx (Home)
cat > app/page.tsx << 'HOMEPAGE'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import ExampleGrid from '@/components/ExampleGrid';
import SearchFilters from '@/components/SearchFilters';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { occasion?: string; style?: string; q?: string } }) {
  const supabase = createServerClientWithCookies();
  let query = supabase.from('example_songs').select('*').order('created_at', { ascending: false });

  if (searchParams.occasion) query = query.eq('occasion', searchParams.occasion);
  if (searchParams.style) query = query.eq('style', searchParams.style);
  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`);

  const { data: songs, error } = await query;
  if (error) console.error(error);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Discover AI‑Generated Songs</h1>
      <SearchFilters />
      <ExampleGrid songs={songs || []} />
    </div>
  );
}
HOMEPAGE

# app/auth/callback/route.ts
cat > app/auth/callback/route.ts << 'CALLBACK'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerClientWithCookies();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
CALLBACK

# app/login/page.tsx
cat > app/login/page.tsx << 'LOGINPAGE'
import AuthForm from '@/components/AuthForm';
export default function Login() { return <AuthForm />; }
LOGINPAGE

# app/signup/page.tsx
cat > app/signup/page.tsx << 'SIGNUPPAGE'
import AuthForm from '@/components/AuthForm';
export default function Signup() { return <AuthForm />; }
SIGNUPPAGE

# app/create/page.tsx
cat > app/create/page.tsx << 'CREATEPAGE'
import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import CreateForm from '@/components/CreateForm';

export default async function CreatePage() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  return <CreateForm />;
}
CREATEPAGE

# app/songs/[id]/page.tsx
cat > 'app/songs/[id]/page.tsx' << 'SONGPAGE'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SongDetail from '@/components/SongDetail';

export default async function SongPage({ params }: { params: { id: string } }) {
  const supabase = createServerClientWithCookies();
  const { data: song, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !song) notFound();
  return <SongDetail song={song} />;
}
SONGPAGE

# app/history/page.tsx
cat > app/history/page.tsx << 'HISTORYPAGE'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HistoryPage() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: songs } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Song Library</h1>
      {!songs || songs.length === 0 ? (
        <p>No songs yet. <Link href="/create" className="text-purple-600 underline">Create one</Link></p>
      ) : (
        <div className="space-y-4">
          {songs.map((song) => (
            <div key={song.id} className="bg-white rounded shadow p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold capitalize">{song.occasion} · {song.style}</p>
                <p className="text-sm text-gray-600">{new Date(song.created_at).toLocaleDateString()}</p>
                <p className={`text-sm ${song.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>{song.status}</p>
              </div>
              <Link href={`/songs/${song.id}`} className="text-purple-600 hover:underline">Open</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
HISTORYPAGE

# app/dashboard/page.tsx
cat > app/dashboard/page.tsx << 'DASHPAGE'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CreditsManager from '@/components/CreditsManager';

export default async function DashboardPage() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', session.user.id)
    .single();

  const { count: totalGenerations } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold">Credits</h2>
          <p className="text-3xl font-bold my-2">{credits?.balance ?? 0}</p>
          <CreditsManager />
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-semibold">Statistics</h2>
          <p>Total Generations: <strong>{totalGenerations ?? 0}</strong></p>
        </div>
      </div>
    </div>
  );
}
DASHPAGE

# API routes
cat > app/api/generations/route.ts << 'GENAPI'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { mockGenerateMusic } from '@/lib/ai-generate';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: creditRow, error: creditError } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', session.user.id)
    .single();
  if (creditError || !creditRow || creditRow.balance < 1) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ balance: creditRow.balance - 1 })
    .eq('user_id', session.user.id);
  if (deductError) return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });

  const { data: generation, error: insertError } = await supabase
    .from('generations')
    .insert({
      user_id: session.user.id,
      occasion,
      style,
      custom_message,
      status: 'processing',
    })
    .select()
    .single();

  if (insertError || !generation) {
    await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', session.user.id);
    return NextResponse.json({ error: 'Failed to create generation' }, { status: 500 });
  }

  try {
    const { audioUrl } = await mockGenerateMusic(occasion, style, custom_message);
    const { error: updateError } = await supabase
      .from('generations')
      .update({ status: 'completed', audio_url: audioUrl })
      .eq('id', generation.id);

    if (updateError) {
      await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
      return NextResponse.json({ error: 'Generation update failed' }, { status: 500 });
    }

    return NextResponse.json({ id: generation.id, status: 'completed' });
  } catch (err) {
    await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
GENAPI

cat > app/api/credits/add-mock/route.ts << 'ADDMOCK'
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_MOCK_PAYMENTS !== 'true') {
    return NextResponse.json({ error: 'Mock mode disabled' }, { status: 400 });
  }
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount } = await request.json();
  const { data: creditRow } = await supabase.from('user_credits').select('balance').eq('user_id', session.user.id).single();
  if (!creditRow) return NextResponse.json({ error: 'Credits not found' }, { status: 500 });

  const { error } = await supabase
    .from('user_credits')
    .update({ balance: creditRow.balance + amount })
    .eq('user_id', session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, newBalance: creditRow.balance + amount });
}
ADDMOCK

cat > app/api/credits/purchase/route.ts << 'PURCHASE'
import { stripe } from '@/lib/stripe';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: '10 Melotones Credits' },
          unit_amount: 500,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?canceled=true`,
    metadata: { userId: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
PURCHASE

cat > app/api/credits/webhook/route.ts << 'WEBHOOK'
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Stripe } from 'stripe';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      const { data: creditRow } = await supabaseAdmin
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();
      if (creditRow) {
        await supabaseAdmin
          .from('user_credits')
          .update({ balance: creditRow.balance + 10 })
          .eq('user_id', userId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
WEBHOOK

echo "✅ All source files created."

# ---- 4. Install dependencies ----
echo "📦 Installing npm dependencies..."
npm install

# ---- 5. Generate sample MP3 ----
echo "🎧 Generating silent sample MP3..."
node scripts/generate-sample-mp3.js

# ---- 6. Environment configuration ----
echo ""
echo "🔑 Now we need your Supabase credentials."
echo "   (If you haven't created a project yet, go to https://supabase.com, create one,"
echo "    then copy the URL and anon key from Settings > API.)"

read -p "👉 Supabase URL (e.g. https://xxxxx.supabase.co): " SUPABASE_URL
read -p "👉 Supabase anon key: " SUPABASE_ANON_KEY
read -p "👉 Supabase SERVICE ROLE key (for webhooks): " SUPABASE_SERVICE_KEY

cat > .env.local << ENVEOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}
NEXT_PUBLIC_MOCK_AI=true
NEXT_PUBLIC_MOCK_PAYMENTS=true
STRIPE_SECRET_KEY=sk_test_dummy
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENVEOF

echo "⚙️  .env.local written."

# ---- 7. Database setup instructions ----
echo ""
echo "🗄️  DATABASE SETUP"
echo "---------------------------------------"
echo "1. Go to your Supabase SQL Editor."
echo "2. Run the following SQL script to create tables, trigger, and seed data:"
echo ""
echo "------ COPY FROM BELOW ------"
cat << 'DBSCRIPT'
-- profiles
create table public.profiles (
  id uuid references auth.users primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- credits
create table public.user_credits (
  user_id uuid references auth.users primary key,
  balance int default 0
);

-- generations
create table public.generations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  occasion text not null,
  style text not null,
  custom_message text,
  status text default 'queued' check (status in ('queued','processing','completed','failed')),
  audio_url text,
  is_public boolean default false,
  created_at timestamptz default now()
);

-- example songs
create table public.example_songs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  occasion text not null,
  style text not null,
  audio_url text not null,
  description text,
  plays int default 0,
  created_at timestamptz default now()
);

-- trigger for new users
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  insert into public.user_credits (user_id, balance) values (new.id, 3);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- seed example songs
INSERT INTO public.example_songs (title, occasion, style, audio_url, description) VALUES
('Birthday Bash', 'birthday', 'Afrobeat', '/audio/sample.mp3', 'A joyful Afrobeat birthday anthem'),
('Amapiano Wedding', 'wedding', 'Amapiano', '/audio/sample.mp3', 'Smooth Amapiano love song for the big day'),
('Graduation Glory', 'graduation', 'Rap', '/audio/sample.mp3', 'Energetic rap celebrating success'),
('Apology in Zouk', 'apology', 'Zouk', '/audio/sample.mp3', 'Heartfelt Zouk ballad to say sorry'),
('Baptism Blessing', 'baptism', 'Gospel', '/audio/sample.mp3', 'Uplifting gospel tune for a christening');
DBSCRIPT
echo "------ END OF SQL ------"
echo ""
read -p "Press Enter after you have executed the SQL script..."

# ---- 8. Start dev server ----
echo "🚀 Starting Melotones on http://localhost:3000 ..."
npm run dev
