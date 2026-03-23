# Lumeo Restaurant Template

Premium restaurant website template built with Vite + React, Tailwind CSS, Firebase, and i18next.

## Features
- Multi-page marketing site + Admin dashboard
- Bilingual content (PT-PT / EN) with language switcher
- Light and dark themes with persisted preference
- Firestore as single source of truth (live updates)
- Firebase Auth for admin access
- SEO helpers per route (title, meta, OG)
- Framer Motion page transitions + reveal animations

## Getting started
1) Install dependencies:
```bash
npm install
```

2) Create a Firebase project and enable:
- Firestore
- Authentication (Email/Password)
- Analytics

3) Create a `.env` file in the project root:
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

4) Run the app:
```bash
npm run dev
```

## Admin access
- Create an admin user in Firebase Authentication (Email/Password).
- Visit `/admin/login` to sign in.
- Content updates are written to Firestore and reflected immediately on the public site.

## Firestore collections
See `src/data/firestoreSchema.js` for the complete schema. Core collections:
- `site` / `restaurant` (brand, hero, story, atmosphere, contact)
- `hours` / `default` (opening hours)
- `highlights` (home featured dishes)
- `testimonials` (guest quotes)
- `menuCategories` (menu categories with items)
- `contactRequests` (inbound contact form submissions)

## Notes
- `src/lib/firebase.js` initializes Firebase (Firestore + Analytics + Auth).
- SEO meta tags are updated per route via `src/lib/seo.js`.
- OG image placeholder lives in `public/og-placeholder.svg`.
