# Right at Home BnB - Vercel Environment Variables

## ECHO OMEGA PRIME Vault Integration

This project integrates with the ECHO OMEGA PRIME credential vault for centralized key management.

### Quick Sync from Vault

```bash
# List what will be synced
python tools/sync-vercel-env.py --list

# Preview commands (doesn't actually sync)
python tools/sync-vercel-env.py --preview

# Sync all environment variables to Vercel
python tools/sync-vercel-env.py --sync
```

### Manual Configuration

If you prefer manual setup, configure these in Vercel Dashboard > Project Settings > Environment Variables

---

### Firebase (Authentication & Database)

```
NEXT_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=echo-prime-ai.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=echo-prime-ai
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=echo-prime-ai.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=249995513427
NEXT_PUBLIC_FIREBASE_APP_ID=<your-firebase-app-id>
```

**Status Check:** Go to `/api/debug` and verify `firebase.configured: true`

---

### AI / Chat (Steven AI)

```
GROQ_API_KEY=<your-groq-api-key>
```

**What happens without it:** Steven AI falls back to a default message instead of generating responses.

---

### Voice Output (ElevenLabs TTS)

```
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
ELEVENLABS_STEVEN_VOICE_ID=keDMh3sQlEXKM4EQxvvi  # Optional - defaults to ECHO Prime voice
```

**What happens without it:** Steven AI will NOT speak - only text responses will be shown.

**How to get:**
1. Go to https://elevenlabs.io
2. Sign in and go to Profile > API Keys
3. Copy your API key

---

## Quick Debug Endpoint

After deployment, visit:
```
https://your-domain.vercel.app/api/debug
```

This will show which environment variables are configured and their status.

---

## Firebase Firestore Rules

If you see "Missing or insufficient permissions" error, update your Firestore rules:

1. Go to Firebase Console > Firestore Database > Rules
2. For development/testing, use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - authenticated users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null;
    }

    // Sync events - authenticated users can read/write
    match /sync_events/{document=**} {
      allow read, write: if request.auth != null;
    }

    // Sync devices - authenticated users can read/write
    match /sync_devices/{document=**} {
      allow read, write: if request.auth != null;
    }

    // Steven AI memory - authenticated users only
    match /steven_memory/{document=**} {
      allow read, write: if request.auth != null;
    }

    // Guest memory - authenticated users only
    match /guest_memory/{document=**} {
      allow read, write: if request.auth != null;
    }

    // Sessions - authenticated users only
    match /sessions/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

---

## Google Sign-In Setup

For Google Sign-In to work:

1. Firebase Console > Authentication > Sign-in method
2. Enable Google provider
3. Add your Vercel domain to "Authorized domains":
   - `web-xxxxx.vercel.app`
   - `your-custom-domain.com`

4. Google Cloud Console > APIs & Services > Credentials
5. Update OAuth 2.0 Client ID with:
   - Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Authorized redirect URIs: `https://your-domain.vercel.app/__/auth/handler`

---

## Environment Variable Checklist

| Variable | Required | Status |
|----------|----------|--------|
| NEXT_PUBLIC_FIREBASE_API_KEY | Yes | [ ] |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Yes | [ ] |
| GROQ_API_KEY | Yes | [ ] |
| ELEVENLABS_API_KEY | Yes (for voice) | [ ] |
| ELEVENLABS_STEVEN_VOICE_ID | No | [ ] |

---

**Created by ECHO OMEGA PRIME**
**Last Updated:** 2026-01-16
