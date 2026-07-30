# RAH Tools

## Egress Watchdog

**Purpose.** RAH smart-lock control routes exclusively through FORGE's `echo-rah-api`,
and the Tuya Cloud project is IP-allowlisted to FORGE's public egress IP
(currently `107.219.15.225`) so a leaked Tuya secret is useless from anywhere else.
The home/ISP IP is dynamic — if it changes, Tuya calls (guest lock-code provisioning)
silently fail. The watchdog checks the live egress IP every 10 minutes against the
expected IP, using a majority consensus of three independent services
(`api.ipify.org`, `ifconfig.me/ip`, `checkip.amazonaws.com`; >= 2 must agree).
On drift it logs a structured event, writes
`/home/forge/rah-monitor/egress_state.json` (`acknowledged: false`), and Telegram-alerts
the Commander (via `/home/forge/cc_tg.py`, falling back to the Bot API if
`TG_BOT_TOKEN` is set). Re-alerts for the same drifted IP are throttled to every 6h.

**Files** (in this directory):

| File | Deploys to |
|---|---|
| `egress_watchdog.py` | `/home/forge/rah-monitor/egress_watchdog.py` |
| `echo-rah-egress-watchdog.service` | `/etc/systemd/system/` |
| `echo-rah-egress-watchdog.timer` | `/etc/systemd/system/` |

**Deploy** (from this `tools/` directory; `forge` = the FORGE ssh alias):

```bash
scp egress_watchdog.py forge:/home/forge/rah-monitor/egress_watchdog.py
scp echo-rah-egress-watchdog.service echo-rah-egress-watchdog.timer forge:/tmp/
ssh forge "mkdir -p /home/forge/rah-monitor && chmod 755 /home/forge/rah-monitor/egress_watchdog.py \
  && sudo mv /tmp/echo-rah-egress-watchdog.service /tmp/echo-rah-egress-watchdog.timer /etc/systemd/system/ \
  && sudo systemctl daemon-reload \
  && sudo systemctl enable --now echo-rah-egress-watchdog.timer"
```

**Verify:**

```bash
ssh forge "sudo systemctl start echo-rah-egress-watchdog.service \
  && journalctl -u echo-rah-egress-watchdog.service -n 20 --no-pager \
  && cat /home/forge/rah-monitor/egress_state.json"
```

Expect a `consensus` log line and `"ok": true` in the state file.

**After an IP change (acknowledge/update):**

1. Log into the Tuya IoT console and update the project's IP allowlist to the
   new egress IP (the alert message contains it).
2. Edit `/etc/systemd/system/echo-rah-egress-watchdog.service` and set
   `Environment=RAH_EXPECTED_EGRESS_IP=<new ip>`.
3. `sudo systemctl daemon-reload && sudo systemctl start echo-rah-egress-watchdog.service`
   — the next run writes `"ok": true` and the alerting stops.
4. Keep this doc's "currently" IP note honest, and mirror the new IP anywhere
   else it is pinned (e.g. `echo-rah-api` docs).

**Notes / knobs (env on the service):**

- `RAH_EXPECTED_EGRESS_IP` (default `107.219.15.225`) — the allowlisted IP.
- `RAH_EGRESS_STATE` (default `/home/forge/rah-monitor/egress_state.json`).
- `RAH_EGRESS_HTTP_TIMEOUT` (default `5` seconds per source).
- `RAH_REALERT_HOURS` (default `6`) — same-drift re-alert throttle.
- `TG_BOT_TOKEN` / `TG_CHAT_ID` (default chat `8890692789`) — Bot-API fallback
  when `cc_tg.py` is unavailable. With neither path, it still logs loudly and
  writes the state file; it never crashes.
- systemd landmine honored: the service is `Type=oneshot` with **no `Restart=`**
  (a oneshot+Restart+timer combo creates an invisible hot loop). The timer
  (`OnBootSec=2min`, `OnUnitActiveSec=10min`, `Persistent=true`) is the only
  re-trigger. Exit codes: `0` = OK or drift handled; `1` = no confident
  consensus reading (transient — the timer simply retries).
