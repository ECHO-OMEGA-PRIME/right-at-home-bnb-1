from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\tools\p0_static_assertions.mjs")
text = path.read_text(encoding="utf-8")

anchor = """assert(
  'No runtime, deployment, test, or maintenance source references the forbidden Firebase project',
  forbiddenHits.length === 0,
  forbiddenHits.join(', '),
);
"""
addition = anchor + """
const obsoleteApiHost = 'api.rightathome.bnb';
const obsoleteApiHits = [];
for (const file of runtimeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(obsoleteApiHost)) obsoleteApiHits.push(relative(file));
}
assert(
  'No runtime, deployment, test, or maintenance source references the obsolete API host',
  obsoleteApiHits.length === 0,
  obsoleteApiHits.join(', '),
);
"""
if anchor not in text:
    raise SystemExit("Forbidden-project assertion anchor not found")
text = text.replace(anchor, addition, 1)

health_anchor = """assert(
  'Health endpoint reports expected and configured Firebase project IDs safely',
  health.includes('expectedProjectId') && health.includes('configuredProjectId'),
);
"""
dynamic_addition = health_anchor + """
const dynamicRoutePaths = [
  'apps/web/app/api/bookings/calendar/route.ts',
  'apps/web/app/api/integrations/paypal/callback/route.ts',
  'apps/web/app/api/integrations/paypal/transactions/route.ts',
  'apps/web/app/api/integrations/paypal/balance/route.ts',
  'apps/web/app/api/cron/guest-messages/route.ts',
  'apps/web/app/api/cron/vrbo-sync/route.ts',
];
const nonDynamicRoutes = dynamicRoutePaths.filter(
  (routePath) => !read(routePath).includes("export const dynamic = 'force-dynamic';"),
);
assert(
  'Request-dependent calendar, PayPal, and cron routes are explicitly dynamic',
  nonDynamicRoutes.length === 0,
  nonDynamicRoutes.join(', '),
);
"""
if health_anchor not in text:
    raise SystemExit("Health assertion anchor not found")
text = text.replace(health_anchor, dynamic_addition, 1)

path.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
