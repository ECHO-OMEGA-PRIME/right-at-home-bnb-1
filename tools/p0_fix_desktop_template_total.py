from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\templates.ts")
text = path.read_text(encoding="utf-8")
old = "- Total: ${{booking.totalPrice}}"
new = r"- Total: \${{booking.totalPrice}}"
if old not in text:
    raise SystemExit("Booking total template placeholder was not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
