"""
VRBO Pricing Updater — Update nightly rates on VRBO via CDP automation.
Navigates to each property's pricing page and updates rates.

Run: python tools/vrbo_pricing_updater.py --vrbo-id 2636389 --rate 150
     python tools/vrbo_pricing_updater.py --all --rate 150
     python tools/vrbo_pricing_updater.py --from-db
Requires: Edge running with --remote-debugging-port=9222 and logged into VRBO
"""
import json, os, re, sys, time, urllib.request, websocket, argparse
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


def get_current_pricing(ws, internal_id):
    """Navigate to pricing page and read current rates."""
    pricing_url = f"https://www.vrbo.com/p/rates/{internal_id}"
    cdp_nav(ws, pricing_url, wait=4)

    # Dismiss modals
    cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let gotIt = btns.find(b => /got it|close|dismiss/i.test(b.textContent.trim()));
            if (gotIt) gotIt.click();
        })()
    """)
    time.sleep(1)

    pricing = cdp_eval(ws, r"""
    (() => {
        let rates = {};
        // Look for rate input fields
        document.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
            let label = '';
            let labelEl = input.closest('label') || document.querySelector('label[for="' + input.id + '"]');
            if (labelEl) label = labelEl.textContent.trim();
            let parent = input.parentElement;
            if (!label && parent) {
                let prev = parent.previousElementSibling;
                if (prev) label = prev.textContent.trim();
            }
            let val = input.value;
            if (val && parseFloat(val) > 0) {
                let key = label.toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'unknown_' + Object.keys(rates).length;
                rates[key] = { value: parseFloat(val), label, inputId: input.id || '', inputName: input.name || '' };
            }
        });

        // Also get any displayed rates in text
        let textRates = [];
        document.querySelectorAll('[class*="rate"], [class*="price"], [class*="fee"]').forEach(el => {
            let t = el.textContent.trim();
            let m = t.match(/\$\s*(\d+(?:\.\d{2})?)/);
            if (m) textRates.push({ text: t.substring(0, 100), amount: parseFloat(m[1]) });
        });

        return JSON.stringify({ rates, textRates, url: window.location.href });
    })()
    """)

    try:
        return json.loads(pricing)
    except:
        return {}


def update_nightly_rate(ws, internal_id, new_rate):
    """Update the nightly rate for a property."""
    pricing_url = f"https://www.vrbo.com/p/rates/{internal_id}"
    cdp_nav(ws, pricing_url, wait=4)

    # Dismiss modals
    cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let gotIt = btns.find(b => /got it|close|dismiss/i.test(b.textContent.trim()));
            if (gotIt) gotIt.click();
        })()
    """)
    time.sleep(1)

    # Find and update the nightly rate input
    result = cdp_eval(ws, f"""
    (() => {{
        // Find the nightly rate input
        let inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
        let rateInput = null;

        for (let input of inputs) {{
            let label = '';
            let labelEl = input.closest('label') || document.querySelector('label[for="' + input.id + '"]');
            if (labelEl) label = labelEl.textContent.toLowerCase();
            let parent = input.parentElement;
            if (!label && parent) {{
                let prev = parent.previousElementSibling;
                if (prev) label = prev.textContent.toLowerCase();
            }}
            // Look for "nightly", "base rate", "default rate"
            if (/night|base.*rate|default.*rate|per.*night/i.test(label)) {{
                rateInput = input;
                break;
            }}
        }}

        if (!rateInput) {{
            // Try first numeric input as fallback
            for (let input of inputs) {{
                if (input.value && parseFloat(input.value) > 30) {{
                    rateInput = input;
                    break;
                }}
            }}
        }}

        if (!rateInput) return 'no rate input found';

        let oldVal = rateInput.value;
        let setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(rateInput, '{new_rate}');
        rateInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
        rateInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
        return 'updated from ' + oldVal + ' to {new_rate}';
    }})()
    """)
    print(f"    Rate update: {result}")
    time.sleep(1)

    # Click Save
    save_result = cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let save = btns.find(b => /save|update|apply/i.test(b.textContent.trim()) && b.textContent.trim().length < 20);
            if (save) { save.click(); return 'saved: ' + save.textContent.trim(); }
            return 'no save button. Buttons: ' + btns.map(b => b.textContent.trim()).filter(t => t.length < 30).join(' | ');
        })()
    """)
    print(f"    Save: {save_result}")
    time.sleep(2)

    return 'updated' in result.lower() and ('save' in save_result.lower() or 'update' in save_result.lower())


# ============================================================
# MAIN
# ============================================================
parser = argparse.ArgumentParser(description='VRBO Pricing Updater')
parser.add_argument('--vrbo-id', help='Single VRBO listing ID to update')
parser.add_argument('--rate', type=float, help='New nightly rate')
parser.add_argument('--all', action='store_true', help='Update all properties')
parser.add_argument('--from-db', action='store_true', help='Read rates from RAH database')
parser.add_argument('--read-only', action='store_true', help='Just read current pricing, don\'t update')
args = parser.parse_args()

print("VRBO Pricing Updater")
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

if args.read_only:
    # Just read current pricing for all properties
    all_pricing = []
    for vrbo_id, name in VRBO_PROPERTIES.items():
        internal_id = INTERNAL_IDS.get(vrbo_id)
        if not internal_id:
            continue
        print(f"\n{name} (#{vrbo_id}):")
        pricing = get_current_pricing(ws, internal_id)
        rates = pricing.get('rates', {})
        text_rates = pricing.get('textRates', [])
        for key, val in rates.items():
            print(f"  {val.get('label', key)}: ${val['value']}")
        for tr in text_rates:
            print(f"  {tr['text']}")
        all_pricing.append({'vrboId': vrbo_id, 'name': name, **pricing})
        time.sleep(1)

    Path("tools/vrbo-pricing.json").write_text(json.dumps(all_pricing, indent=2), encoding='utf-8')
    print(f"\nSaved to tools/vrbo-pricing.json")

elif args.vrbo_id and args.rate:
    # Update single property
    internal_id = INTERNAL_IDS.get(args.vrbo_id)
    if not internal_id:
        print(f"No internal ID for {args.vrbo_id}")
        sys.exit(1)
    name = VRBO_PROPERTIES.get(args.vrbo_id, args.vrbo_id)
    print(f"\nUpdating {name} to ${args.rate}/night...")
    success = update_nightly_rate(ws, internal_id, args.rate)
    print(f"Result: {'Success' if success else 'May need manual verification'}")

elif args.all and args.rate:
    # Update all properties to same rate
    print(f"\nUpdating ALL {len(VRBO_PROPERTIES)} properties to ${args.rate}/night...")
    for vrbo_id, name in VRBO_PROPERTIES.items():
        internal_id = INTERNAL_IDS.get(vrbo_id)
        if not internal_id:
            print(f"  {name}: no internal ID, skipping")
            continue
        print(f"\n  {name}:")
        success = update_nightly_rate(ws, internal_id, args.rate)
        print(f"  Result: {'Success' if success else 'May need verification'}")
        time.sleep(1)

elif args.from_db:
    # Read rates from database and push to VRBO
    print("\nReading rates from RAH database...")
    req = urllib.request.Request(
        f"{API_BASE}/api/properties",
        headers={"x-api-secret": API_SECRET},
    )
    try:
        resp = urllib.request.urlopen(req)
        properties = json.loads(resp.read())
        if isinstance(properties, dict):
            properties = properties.get('properties', properties.get('data', []))
        for prop in properties:
            vrbo_id = prop.get('vrboId')
            if not vrbo_id or vrbo_id == 'TBD':
                continue
            internal_id = INTERNAL_IDS.get(vrbo_id)
            if not internal_id:
                continue
            rate = prop.get('nightlyRate', 0)
            if rate <= 0:
                continue
            name = prop.get('name', vrbo_id)
            print(f"\n  {name}: ${rate}/night")
            success = update_nightly_rate(ws, internal_id, rate)
            print(f"  Result: {'Success' if success else 'May need verification'}")
            time.sleep(1)
    except Exception as e:
        print(f"API error: {e}")
else:
    print("\nUsage:")
    print("  Read current pricing:  python tools/vrbo_pricing_updater.py --read-only")
    print("  Update one property:   python tools/vrbo_pricing_updater.py --vrbo-id 2636389 --rate 150")
    print("  Update all properties: python tools/vrbo_pricing_updater.py --all --rate 150")
    print("  Sync from database:    python tools/vrbo_pricing_updater.py --from-db")

ws.close()
print("\nDone!")
