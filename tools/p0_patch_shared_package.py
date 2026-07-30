from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb")
api_file = ROOT / "packages" / "shared" / "src" / "api" / "index.ts"
package_file = ROOT / "packages" / "shared" / "package.json"

text = api_file.read_text(encoding="utf-8")
text = text.replace("  ApiResponse,\n  PaginatedResponse\n", "  ApiResponse\n", 1)
text = text.replace(
    "  return 'https://rightathome.vercel.app/api';",
    "  return 'https://api.rah-midland.com';",
    1,
)
api_file.write_text(text, encoding="utf-8", newline="\n")

package = json.loads(package_file.read_text(encoding="utf-8"), object_pairs_hook=OrderedDict)
for key, value in package.get("exports", {}).items():
    if isinstance(value, dict) and "types" in value:
        reordered = OrderedDict()
        reordered["types"] = value["types"]
        for condition, target in value.items():
            if condition != "types":
                reordered[condition] = target
        package["exports"][key] = reordered

package_file.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"PATCHED={api_file}")
print(f"PATCHED={package_file}")
