"""
VRBO Review Scraper — Pulls guest reviews from VRBO Partner Portal via CDP.
Navigates to each property's reviews page and extracts review data.

Run: python tools/vrbo_review_scraper.py
Requires: Edge running with --remote-debugging-port=9222 and logged into VRBO
"""
import json, os, re, sys, time, urllib.request, websocket
from pathlib import Path
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CDP_PORT = int(os.environ.get('VRBO_CDP_PORT', '9222'))
API_BASE = os.environ.get('RAH_API_BASE', 'https://rah-midland.com')
API_SECRET = os.environ.get('ADMIN_API_SECRET', 'rah-vrbo-sync-2026')
_msg_id = 0

# Load internal IDs
INTERNAL_IDS = {}
try:
    with open("tools/vrbo-internal-ids.json") as f:
        INTERNAL_IDS = json.load(f)
except:
    print("WARNING: tools/vrbo-internal-ids.json not found")

VRBO_PROPERTIES = {
    "2636389": "castleford-5001",
    "3005111": "adobe-compound-gc",
    "2634718": "garfield-2702",
    "3355618": "douglas-4501",
    "2638481": "dentcrest-4707",
    "2638524": "safari-gameroom",
    "2643822": "storey-2103",
    "2643784": "chelsea-3210",
    "4471713": "oriole-6100",
    "4437486": "lanham-1426",
    "4700881": "humble-3106",
    "4179271": "daventry-1311",
    "4581977": "lincoln-green-5055",
    "4750070": "daventry-1309",
    "3477668": "monterrey-house",
    "3724481": "clermont-house",
    "4135262": "cowboy-siesta",
    "3764453": "groovy-times",
    "3559249": "vanguard-velvet",
    "5103283": "mockingbird-ridge",
    "5103284": "blazing-saddle",
    "2641181": "uptown-place",
}

RESULTS_FILE = Path("tools/vrbo-reviews.json")

def cdp_send(ws, method, params=None):
    global _msg_id
    _msg_id += 1
    msg = {"id": _msg_id, "method": method}
    if params: msg["params"] = params
    ws.send(json.dumps(msg))
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            data = ws.recv()
            resp = json.loads(data)
            if resp.get("id") == _msg_id: return resp
        except: time.sleep(0.1)
    return {"error": "timeout"}

def cdp_eval(ws, expr):
    resp = cdp_send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    try:
        r = resp["result"]["result"]
        return r.get("value", "") if r.get("type") == "string" else json.dumps(r.get("value", ""))
    except: return ""

def cdp_nav(ws, url, wait=5):
    cdp_send(ws, "Page.navigate", {"url": url})
    time.sleep(wait)

def cdp_url(ws):
    return cdp_eval(ws, "window.location.href")

def scrape_reviews(ws, internal_id, vrbo_id, prop_name):
    """Navigate to a property's reviews page and extract reviews."""
    reviews_url = f"https://www.vrbo.com/p/px-reviews/{internal_id}"
    cdp_nav(ws, reviews_url, wait=4)

    # Dismiss modals
    cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let gotIt = btns.find(b => /got it|close|dismiss/i.test(b.textContent.trim()));
            if (gotIt) gotIt.click();
        })()
    """)
    time.sleep(1)

    # Extract review data
    reviews_data = cdp_eval(ws, r"""
    (() => {
        let reviews = [];

        // Look for review cards/containers
        let containers = document.querySelectorAll(
            '[class*="review"], [data-testid*="review"], [class*="Review"], article'
        );

        for (let c of containers) {
            let text = c.textContent || '';
            if (text.length < 20 || text.length > 5000) continue;

            let review = {
                guestName: '',
                rating: 0,
                title: '',
                content: '',
                response: '',
                date: '',
            };

            // Guest name
            let nameEl = c.querySelector('[class*="name"], [class*="author"], strong, b');
            if (nameEl) review.guestName = nameEl.textContent.trim();

            // Rating (look for stars or number)
            let ratingEl = c.querySelector('[class*="rating"], [class*="star"], [aria-label*="rating"]');
            if (ratingEl) {
                let label = ratingEl.getAttribute('aria-label') || ratingEl.textContent || '';
                let m = label.match(/(\d+(?:\.\d+)?)/);
                if (m) review.rating = parseFloat(m[1]);
            }

            // Review text
            let bodyEl = c.querySelector('[class*="body"], [class*="content"], [class*="text"], p');
            if (bodyEl) review.content = bodyEl.textContent.trim().substring(0, 1000);

            // Title
            let titleEl = c.querySelector('[class*="title"], h3, h4');
            if (titleEl) review.title = titleEl.textContent.trim();

            // Host response
            let responseEl = c.querySelector('[class*="response"], [class*="reply"]');
            if (responseEl) review.response = responseEl.textContent.trim().substring(0, 500);

            // Date
            let dateEl = c.querySelector('time, [class*="date"]');
            if (dateEl) review.date = (dateEl.getAttribute('datetime') || dateEl.textContent || '').trim();

            if (review.content || review.guestName) {
                reviews.push(review);
            }
        }

        // Also check for overall rating summary
        let summary = '';
        let summaryEl = document.querySelector('[class*="summary"], [class*="overall"], [class*="average"]');
        if (summaryEl) summary = summaryEl.textContent.trim();

        return JSON.stringify({ reviews, summary, url: window.location.href });
    })()
    """)

    try:
        data = json.loads(reviews_data)
        reviews = data.get('reviews', [])
        for r in reviews:
            r['vrboId'] = vrbo_id
            r['propertyName'] = prop_name
            r['scrapedAt'] = datetime.now().isoformat()
        return reviews
    except:
        return []


def push_reviews_to_api(reviews):
    """Push reviews to RAH API."""
    data = json.dumps({"reviews": reviews}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/api/admin/vrbo-reviews",
        data=data, method="POST",
        headers={
            "Content-Type": "application/json",
            "x-api-secret": API_SECRET,
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except Exception as e:
        print(f"  API push error: {e}")
        return None


# ============================================================
# MAIN
# ============================================================
print("VRBO Review Scraper")
print("=" * 60)

# Connect
print("Connecting to Edge CDP...")
try:
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json")
    tabs = json.loads(resp.read())
    ws_url = [t["webSocketDebuggerUrl"] for t in tabs if t.get("type") == "page"][0]
    ws = websocket.create_connection(ws_url, origin=f"http://localhost:{CDP_PORT}")
    cdp_send(ws, "Page.enable")
    print("Connected!")
except Exception as e:
    print(f"Failed to connect: {e}")
    sys.exit(1)

# Check login
cdp_nav(ws, "https://www.vrbo.com/p/properties", wait=5)
url = cdp_url(ws)
if "login" in url.lower():
    print("NOT LOGGED IN")
    ws.close()
    sys.exit(1)

print(f"Logged in. Scraping reviews for {len(VRBO_PROPERTIES)} properties...\n")

all_reviews = []
for vrbo_id, name in VRBO_PROPERTIES.items():
    internal_id = INTERNAL_IDS.get(vrbo_id)
    if not internal_id:
        print(f"  {name}: no internal ID, skipping")
        continue

    print(f"[{len(all_reviews)}/{len(VRBO_PROPERTIES)}] {name} (#{vrbo_id})")
    reviews = scrape_reviews(ws, internal_id, vrbo_id, name)
    print(f"  Found {len(reviews)} reviews")

    for r in reviews[:2]:
        stars = '⭐' * int(r.get('rating', 0))
        print(f"    {r.get('guestName', '?')} {stars}: {r.get('content', '')[:60]}...")

    all_reviews.extend(reviews)
    time.sleep(1)

ws.close()

# Save results
RESULTS_FILE.write_text(json.dumps(all_reviews, indent=2), encoding='utf-8')
print(f"\n{'=' * 60}")
print(f"Total: {len(all_reviews)} reviews from {len(VRBO_PROPERTIES)} properties")
print(f"Saved to {RESULTS_FILE}")

# Push to API
if all_reviews:
    result = push_reviews_to_api(all_reviews)
    if result:
        print(f"API: {result}")

print("Done!")
