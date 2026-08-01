from __future__ import annotations

from pathlib import Path

TARGET = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\.github\workflows\ci.yml")

OLD = '''          firebase = data.get('firebase', {})
          assert firebase.get('expectedProjectId') == 'rightathome-prod', firebase
          assert firebase.get('configuredProjectId') == 'rightathome-prod', firebase
          assert firebase.get('configured') is True, firebase
          print('PRODUCTION_HEALTH_GREEN')
'''

NEW = '''          firebase = data.get('services', {}).get('firebase', {})
          assert firebase.get('expectedProjectId') == 'rightathome-prod', firebase
          assert firebase.get('configuredProjectId') == 'rightathome-prod', firebase
          assert firebase.get('projectMatches') is True, firebase
          assert firebase.get('clientConfigured') is True, firebase
          assert firebase.get('adminInitialized') is True, firebase
          print('PRODUCTION_HEALTH_GREEN')
'''

text = TARGET.read_text(encoding="utf-8")
if OLD not in text:
    raise SystemExit("CI health assertion block not found; no changes written")

TARGET.write_text(text.replace(OLD, NEW, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={TARGET}")
