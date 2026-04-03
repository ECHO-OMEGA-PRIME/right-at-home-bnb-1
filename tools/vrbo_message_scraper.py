"""
VRBO Message Scraper — CDP automation to pull guest messages from Partner Portal.
Connects to Edge with remote debugging, navigates to inbox, extracts messages,
and pushes them to the RAH database via API.

Run: python tools/vrbo_message_scraper.py
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

RESULTS_FILE = Path("tools/vrbo-messages.json")

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

def push_to_api(messages):
    """Push scraped messages to the RAH API."""
    data = json.dumps({"messages": messages}).encode()
    req = urllib.request.Request(
        f"{API_BASE}/api/admin/vrbo-messages",
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
# CONNECT
# ============================================================
print("Connecting to Edge CDP...")
try:
    resp = urllib.request.urlopen(f"http://localhost:{CDP_PORT}/json")
    tabs = json.loads(resp.read())
    ws_url = [t["webSocketDebuggerUrl"] for t in tabs if t.get("type") == "page"][0]
    ws = websocket.create_connection(ws_url, origin=f"http://localhost:{CDP_PORT}")
    cdp_send(ws, "Page.enable")
    print("Connected!")
except Exception as e:
    print(f"Failed to connect to CDP: {e}")
    print("Make sure Edge is running with: msedge --remote-debugging-port=9222")
    sys.exit(1)

# ============================================================
# CHECK LOGIN STATE
# ============================================================
cdp_nav(ws, "https://www.vrbo.com/p/inbox", wait=5)
url = cdp_url(ws)
print(f"At: {url}")

if "login" in url.lower() or "sign" in url.lower():
    print("NOT LOGGED IN - please log into VRBO in the Edge window first")
    ws.close()
    sys.exit(1)

# ============================================================
# SCRAPE INBOX
# ============================================================
print("\nScraping VRBO inbox...")

# Wait for inbox to load
time.sleep(3)

# Extract conversation threads
conversations = cdp_eval(ws, r"""
(() => {
    let threads = [];
    // Look for conversation list items
    let items = document.querySelectorAll('[data-testid*="thread"], [class*="thread"], [class*="conversation"], [class*="inbox-item"], tr, li');

    for (let item of items) {
        let text = item.textContent || '';
        if (text.length < 10 || text.length > 2000) continue;

        // Try to extract guest name, property, message preview, date
        let guestName = '';
        let propertyName = '';
        let preview = '';
        let date = '';
        let isUnread = false;

        // Look for bold/strong elements (usually guest name)
        let bold = item.querySelector('strong, b, [class*="bold"], [class*="name"], [class*="guest"]');
        if (bold) guestName = bold.textContent.trim();

        // Look for date elements
        let dateEl = item.querySelector('time, [class*="date"], [class*="time"]');
        if (dateEl) date = (dateEl.getAttribute('datetime') || dateEl.textContent || '').trim();

        // Look for unread indicators
        let unread = item.querySelector('[class*="unread"], [class*="badge"], [class*="dot"]');
        if (unread) isUnread = true;

        // Look for links to the conversation
        let link = item.querySelector('a[href*="inbox"], a[href*="thread"], a[href*="message"]');
        let threadUrl = link ? link.href : '';

        // Get preview text (usually the last message)
        let previewEl = item.querySelector('[class*="preview"], [class*="snippet"], [class*="body"], p');
        if (previewEl) preview = previewEl.textContent.trim();

        if (guestName || preview) {
            threads.push({
                guestName: guestName || 'Unknown',
                propertyName,
                preview: preview.substring(0, 200),
                date,
                isUnread,
                threadUrl,
                fullText: text.substring(0, 500),
            });
        }
    }

    // Also try to get data from React state / Apollo cache
    let apolloData = '';
    try {
        let client = window.__APOLLO_CLIENT__ || window.__NEXT_DATA__?.apolloState;
        if (client) apolloData = JSON.stringify(client).substring(0, 5000);
    } catch(e) {}

    return JSON.stringify({ threads: threads.slice(0, 50), apolloData: apolloData.substring(0, 2000) });
})()
""")

try:
    data = json.loads(conversations)
    threads = data.get('threads', [])
    print(f"Found {len(threads)} conversation threads")

    all_messages = []
    for i, thread in enumerate(threads):
        print(f"  [{i+1}] {thread.get('guestName', '?')} - {thread.get('preview', '')[:60]}...")
        if thread.get('isUnread'):
            print(f"      ** UNREAD **")

        all_messages.append({
            'guestName': thread.get('guestName', 'Unknown'),
            'preview': thread.get('preview', ''),
            'date': thread.get('date', ''),
            'isUnread': thread.get('isUnread', False),
            'threadUrl': thread.get('threadUrl', ''),
            'scrapedAt': datetime.now().isoformat(),
        })

    # Click into each unread thread to get full messages
    for thread in threads:
        if not thread.get('isUnread') or not thread.get('threadUrl'):
            continue

        print(f"\n  Opening thread: {thread['guestName']}...")
        cdp_nav(ws, thread['threadUrl'], wait=3)

        # Extract individual messages from the thread
        thread_messages = cdp_eval(ws, r"""
        (() => {
            let messages = [];
            let items = document.querySelectorAll('[class*="message"], [class*="bubble"], [class*="chat-msg"]');
            for (let item of items) {
                let text = item.textContent.trim();
                if (text.length < 2) continue;

                let sender = 'unknown';
                let classList = (item.className || '').toLowerCase();
                if (classList.includes('sent') || classList.includes('host') || classList.includes('owner')) sender = 'host';
                if (classList.includes('received') || classList.includes('guest') || classList.includes('traveler')) sender = 'guest';

                let time = '';
                let timeEl = item.querySelector('time, [class*="time"], [class*="date"]');
                if (timeEl) time = (timeEl.getAttribute('datetime') || timeEl.textContent || '').trim();

                messages.push({ text: text.substring(0, 1000), sender, time });
            }
            return JSON.stringify(messages);
        })()
        """)

        try:
            msgs = json.loads(thread_messages)
            print(f"    Found {len(msgs)} messages in thread")
            for msg in msgs[-3:]:  # Show last 3
                print(f"    [{msg['sender']}] {msg['text'][:80]}...")
        except:
            pass

    # Save results
    RESULTS_FILE.write_text(json.dumps(all_messages, indent=2), encoding='utf-8')
    print(f"\nSaved {len(all_messages)} threads to {RESULTS_FILE}")

    # Push to API
    if all_messages:
        result = push_to_api(all_messages)
        if result:
            print(f"Pushed to API: {result}")

except Exception as e:
    print(f"Parse error: {e}")
    # Save raw page text for debugging
    text = cdp_eval(ws, "document.body.innerText")
    Path("tools/vrbo-screenshots/inbox-debug.txt").write_text(
        f"URL: {cdp_url(ws)}\n\n{text}", encoding="utf-8")
    print("Saved debug info to tools/vrbo-screenshots/inbox-debug.txt")

ws.close()
print("\nDone!")
