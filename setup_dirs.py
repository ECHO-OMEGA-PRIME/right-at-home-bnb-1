import os
base = r'P:\SOVEREIGN_APPS\RightAtHomeBnB'
dirs = [
    'apps/web/src/components', 'apps/web/src/pages', 'apps/web/src/styles',
    'apps/web/src/hooks', 'apps/web/src/lib', 'apps/web/public/images',
    'apps/mobile/src/screens', 'apps/mobile/src/components', 'apps/mobile/src/navigation',
    'apps/mobile/src/services', 'apps/mobile/assets',
    'apps/desktop/src/main', 'apps/desktop/src/renderer', 'apps/desktop/src/preload',
    'packages/shared/components', 'packages/shared/hooks', 'packages/shared/utils',
    'packages/api-client/src', 'packages/types/src',
    'backend/api/routes', 'backend/api/middleware', 'backend/services', 'backend/models',
    'backend/ai/concierge', 'backend/ai/vision', 'backend/ai/sentiment',
    'database/migrations', 'database/seeds', 'config', 'docs',
    'deploy/docker', 'deploy/cloudrun', 'deploy/vercel',
    'assets/brand', 'assets/icons', 'tests/unit', 'tests/integration'
]
for d in dirs:
    path = os.path.join(base, d)
    os.makedirs(path, exist_ok=True)
    print(f'Created: {d}')
print('DONE!')
