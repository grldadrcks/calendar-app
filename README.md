# Lumina Calendar

A colourful, connected Google Calendar PWA built with React + Vite. Designed to run as an always-on wall display or be installed on mobile.

**Live:** [calendar-app-drab-psi.vercel.app](https://calendar-app-drab-psi.vercel.app)

## Features

- Google OAuth sign-in (read-only calendar access)
- Month and week/agenda views
- All calendars shown with their colours, individually toggleable
- "Next up" badge highlights the next upcoming event today
- Live clock ticking in the header
- Dark/light mode (persisted to localStorage)
- Dim mode — automatically dims 10pm–6am, tap to wake for 60 seconds
- Fullscreen toggle for wall display use
- Auto-refreshes every 15 minutes
- PWA — installable on Android and iOS home screens

## Setup

### 1. Google Cloud Console

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add your domain to **Authorized JavaScript origins** (e.g. `https://your-app.vercel.app`)
4. Enable the **Google Calendar API** in your project

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in your Client ID:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Run locally

```bash
npm install
npm run dev
```

For phone testing on the same network, expose the dev server:

```bash
npm run dev -- --host
```

Then add the local IP (e.g. `http://192.168.0.x:5173`) to your OAuth authorized origins.

## Deploy

```bash
npx vercel --prod
```

## Tech

- React 19 + Vite 8
- `@react-oauth/google` for OAuth
- `vite-plugin-pwa` + Workbox for service worker and offline support
- Deployed on Vercel
