from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\packages\shared\src\sync\index.ts")
text = path.read_text(encoding="utf-8")
text = text.replace("  orderBy,\n  Timestamp,", "  orderBy,\n  getDocs,\n  Timestamp,", 1)
text = text.replace(
    """    const snapshot = await devicesQuery.get();
    return snapshot.docs.map(doc => ({
      platform: doc.data().platform,
      deviceId: doc.id,
      lastSeen: doc.data().lastSeen.toDate()
    }));""",
    """    const snapshot = await getDocs(devicesQuery);
    return snapshot.docs.map((deviceDoc) => ({
      platform: deviceDoc.data().platform,
      deviceId: deviceDoc.id,
      lastSeen: deviceDoc.data().lastSeen.toDate()
    }));""",
    1,
)
path.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
