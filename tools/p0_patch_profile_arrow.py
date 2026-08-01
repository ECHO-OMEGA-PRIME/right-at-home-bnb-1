from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile\src\screens\ProfileScreen.tsx")
text = path.read_text(encoding="utf-8")
old = '<Text style={styles.settingArrow}>></Text>'
new = "<Text style={styles.settingArrow}>{'>'}</Text>"
if old not in text:
    raise SystemExit("Expected JSX arrow was not found; no changes written")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
