"""
VRBO Availability Push — Block/unblock dates on VRBO via CDP automation.
Reads blocked dates from RAH database and pushes them to the VRBO partner calendar.

Run: python tools/vrbo_availability_push.py
Requires: Edge running with --remote-debugging-port=9222 and logged into VRBO
"""
import json, os, re, sys, time, urllib.request, websocket
from pathlib import Path
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CDP_PORT = int(os.environ.get('VRBO_CDP_PORT', '9222'))
API_BASE = os.environ.get('RAH_API_BASE', 'https://rah-midland.com')
API_SECRET = os.environ.get('ADMIN_API_SECRET', 'rah-vrbo-sync-2026')
_msg_id = 0

# Load internal IDs from the mapping file
INTERNAL_IDS = {}
try:
    with open("tools/vrbo-internal-ids.json") as f:
        INTERNAL_IDS = json.load(f)
except:
    print("WARNING: tools/vrbo-internal-ids.json not found")

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

def get_blocks_from_api():
    """Get date blocks from the RAH API that need to be pushed to VRBO."""
    req = urllib.request.Request(
        f"{API_BASE}/api/admin/vrbo-availability",
        headers={"x-api-secret": API_SECRET},
    )
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except Exception as e:
        print(f"API error: {e}")
        return None

def block_dates_on_vrbo(ws, internal_id, start_date, end_date):
    """
    Block dates on VRBO calendar via CDP.
    Navigate to the calendar, click on start date, drag to end date, and set as blocked.
    """
    cal_url = f"https://www.vrbo.com/p/calendar/{internal_id}"
    cdp_nav(ws, cal_url, wait=4)

    # Dismiss any modals
    cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let gotIt = btns.find(b => /got it|close|dismiss/i.test(b.textContent.trim()));
            if (gotIt) gotIt.click();
        })()
    """)
    time.sleep(1)

    # Click on the start date cell
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    result = cdp_eval(ws, f"""
        (() => {{
            // Find date cells by data attributes or aria labels
            let startCell = document.querySelector('[data-date="{start_str}"], [aria-label*="{start_date.strftime("%B")}"][aria-label*="{start_date.day}"]');
            if (!startCell) return 'start date not found: {start_str}';
            startCell.click();
            return 'clicked start: {start_str}';
        }})()
    """)
    print(f"    Start click: {result}")
    time.sleep(1)

    # Click on end date
    result = cdp_eval(ws, f"""
        (() => {{
            let endCell = document.querySelector('[data-date="{end_str}"], [aria-label*="{end_date.strftime("%B")}"][aria-label*="{end_date.day}"]');
            if (!endCell) return 'end date not found: {end_str}';
            endCell.click();
            return 'clicked end: {end_str}';
        }})()
    """)
    print(f"    End click: {result}")
    time.sleep(1)

    # Look for a "Block" or "Save" button in the popup/modal
    result = cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let block = btns.find(b => /block|save|confirm/i.test(b.textContent.trim()) && b.textContent.trim().length < 30);
            if (block) { block.click(); return 'blocked: ' + block.textContent.trim(); }
            // Check for a dropdown/select for "Blocked"
            let selects = document.querySelectorAll('select, [role="listbox"]');
            for (let s of selects) {
                let opts = s.querySelectorAll('option, [role="option"]');
                for (let o of opts) {
                    if (/block/i.test(o.textContent)) {
                        o.selected = true;
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        return 'selected block option';
                    }
                }
            }
            return 'no block button found. Buttons: ' + btns.map(b => b.textContent.trim()).filter(t => t.length < 30).slice(0, 10).join(' | ');
        })()
    """)
    print(f"    Block: {result}")
    time.sleep(2)

    return 'blocked' in result.lower() or 'save' in result.lower()


def unblock_dates_on_vrbo(ws, internal_id, start_date, end_date):
    """Unblock dates on VRBO calendar."""
    cal_url = f"https://www.vrbo.com/p/calendar/{internal_id}"
    cdp_nav(ws, cal_url, wait=4)

    start_str = start_date.strftime('%Y-%m-%d')

    # Click on the blocked date
    result = cdp_eval(ws, f"""
        (() => {{
            let cell = document.querySelector('[data-date="{start_str}"]');
            if (!cell) return 'date not found';
            cell.click();
            return 'clicked';
        }})()
    """)
    time.sleep(1)

    # Look for unblock/remove button
    result = cdp_eval(ws, """
        (() => {
            let btns = [...document.querySelectorAll('button')];
            let unblock = btns.find(b => /unblock|remove|delete|clear/i.test(b.textContent.trim()));
            if (unblock) { unblock.click(); return 'unblocked'; }
            return 'no unblock button';
        })()
    """)
    return 'unblocked' in result.lower()


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("VRBO Availability Push")
    print("=" * 60)

    # Connect to CDP
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

    # Get blocks to push from API
    blocks = get_blocks_from_api()
    if not blocks:
        print("No blocks to push (or API unavailable)")
        print("Usage: Pass blocks via command line or set up the /api/admin/vrbo-availability endpoint")

        # Demo mode: show what we would do
        print("\nDemo mode - to block dates, call:")
        print("  python tools/vrbo_availability_push.py --vrbo-id 2636389 --start 2026-04-15 --end 2026-04-20")

        # Check for command line args
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--vrbo-id', help='VRBO listing ID')
        parser.add_argument('--start', help='Start date (YYYY-MM-DD)')
        parser.add_argument('--end', help='End date (YYYY-MM-DD)')
        parser.add_argument('--action', default='block', choices=['block', 'unblock'])
        args = parser.parse_args()

        if args.vrbo_id and args.start and args.end:
            internal_id = INTERNAL_IDS.get(args.vrbo_id)
            if not internal_id:
                print(f"No internal ID for VRBO {args.vrbo_id}")
                ws.close()
                sys.exit(1)

            start = datetime.strptime(args.start, '%Y-%m-%d')
            end = datetime.strptime(args.end, '%Y-%m-%d')

            print(f"\n{'Blocking' if args.action == 'block' else 'Unblocking'} {args.start} to {args.end} on VRBO {args.vrbo_id} ({internal_id})")

            if args.action == 'block':
                success = block_dates_on_vrbo(ws, internal_id, start, end)
            else:
                success = unblock_dates_on_vrbo(ws, internal_id, start, end)

            print(f"Result: {'Success' if success else 'Failed'}")
    else:
        print(f"Got {len(blocks.get('blocks', []))} date blocks to push")
        for block in blocks.get('blocks', []):
            vrbo_id = block['vrboId']
            internal_id = INTERNAL_IDS.get(vrbo_id)
            if not internal_id:
                print(f"  Skip {vrbo_id} - no internal ID")
                continue

            start = datetime.strptime(block['startDate'], '%Y-%m-%d')
            end = datetime.strptime(block['endDate'], '%Y-%m-%d')
            action = block.get('action', 'block')

            print(f"\n  {action.upper()} {vrbo_id}: {block['startDate']} to {block['endDate']}")
            if action == 'block':
                success = block_dates_on_vrbo(ws, internal_id, start, end)
            else:
                success = unblock_dates_on_vrbo(ws, internal_id, start, end)
            print(f"  Result: {'Success' if success else 'Failed'}")

    ws.close()
    print("\nDone!")
