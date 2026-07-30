from __future__ import annotations

from pathlib import Path

TARGET = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\tools\p0_verify_environment.ps1")

OLD = '''    $validation += Invoke-CapturedCommand `
        -Name 'web_prisma_validate' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'exec', 'prisma', 'validate')
    $validation += Invoke-CapturedCommand `
        -Name 'web_build' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'build')
    $validation += Invoke-CapturedCommand `
        -Name 'root_tests' `
        -Executable 'pnpm.cmd' `
        -Arguments @('test')
'''

NEW = '''    $validation += Invoke-CapturedCommand `
        -Name 'web_prisma_validate' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'exec', 'prisma', 'validate')
    $validation += Invoke-CapturedCommand `
        -Name 'mobile_typecheck' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/mobile', 'exec', 'tsc', '--noEmit')
    $validation += Invoke-CapturedCommand `
        -Name 'backend_compileall' `
        -Executable 'python.exe' `
        -Arguments @('-m', 'compileall', '-q', 'backend')
    $validation += Invoke-CapturedCommand `
        -Name 'web_build' `
        -Executable 'pnpm.cmd' `
        -Arguments @('--dir', 'apps/web', 'build')
    $validation += Invoke-CapturedCommand `
        -Name 'root_tests' `
        -Executable 'pnpm.cmd' `
        -Arguments @('test')
'''

text = TARGET.read_text(encoding="utf-8")
if OLD not in text:
    raise SystemExit("Verification validation block not found; no changes written")

TARGET.write_text(text.replace(OLD, NEW, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={TARGET}")
