"""
Send RightAtHomeBnB to Gemini for code review
"""
import google.generativeai as genai
import os

# Configure API key
api_key = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
if not api_key:
    # Try to load from .env
    env_path = r"O:\ECHO_OMEGA_PRIME\.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('GOOGLE_API_KEY=') or line.startswith('GEMINI_API_KEY='):
                    api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break

if not api_key:
    print("ERROR: No Gemini API key found")
    exit(1)

genai.configure(api_key=api_key)

# Create model  
model = genai.GenerativeModel('gemini-1.5-flash')

prompt = """You are a senior software architect. Review this vacation rental property management system:

PROJECT: RightAtHomeBnB (22 vacation rentals in Midland, TX)

Tech Stack:
- Web: Next.js 14 (Vercel)
- Mobile: React Native/Expo  
- Desktop: Electron
- Backend: FastAPI (Python)
- Database: PostgreSQL + Prisma
- AI: OpenAI GPT-4, ElevenLabs TTS
- Integrations: Airbnb/VRBO iCal, Twilio SMS, Stripe, Smart Locks

Structure: Monorepo with apps/ (web, mobile, desktop), backend/, packages/ (shared, types, ai-concierge, smart-locks, pricing, cloud-sync, security)

Key Features: GPS cleaner check-in, AI concierge, smart lock codes (auto-expire), financial dashboard, guest CRM, automated messaging, voice TTS

Provide:
1. ARCHITECTURE ASSESSMENT (is monorepo good for this?)
2. TOP 3 SECURITY CONCERNS  
3. TOP 3 IMPROVEMENTS you'd make
4. SCALABILITY - will this handle 100+ properties?
"""

print("Sending to Gemini...")
response = model.generate_content(prompt)
print("\n" + "="*60)
print("GEMINI CODE REVIEW - RightAtHomeBnB")
print("="*60 + "\n")
print(response.text)
