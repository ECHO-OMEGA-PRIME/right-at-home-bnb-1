#!/usr/bin/env python3
"""
Right at Home BnB - Vercel Environment Sync Tool
Pulls credentials from ECHO OMEGA PRIME vault and syncs to Vercel

Usage:
    python tools/sync-vercel-env.py --list     # List vars to sync
    python tools/sync-vercel-env.py --sync     # Sync to Vercel
    python tools/sync-vercel-env.py --preview  # Preview only (don't sync)
"""

import subprocess
import sys
import json
import argparse
from pathlib import Path

# Add ECHO vault to path
sys.path.insert(0, "O:/ECHO_OMEGA_PRIME/core")

# Environment variables to sync from vault to Vercel
VERCEL_ENV_CONFIG = {
    # Format: "VERCEL_VAR_NAME": ("vault_service", "vault_username") or "static_value"

    # Firebase (public keys)
    "NEXT_PUBLIC_FIREBASE_API_KEY": ("firebase_echo_prime", "echo-prime-ai"),
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": "echo-prime-ai.firebaseapp.com",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID": "echo-prime-ai",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": "echo-prime-ai.appspot.com",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "249995513427",
    "NEXT_PUBLIC_FIREBASE_APP_ID": "1:249995513427:web:310bf6cf8b171cddb140a6",

    # AI / Chat
    "GROQ_API_KEY": ("API_KEYS", "GROQ_API_KEY"),

    # Voice TTS
    "ELEVENLABS_API_KEY": ("API_KEYS", "ELEVENLABS_API_KEY"),
    "ELEVENLABS_STEVEN_VOICE_ID": "keDMh3sQlEXKM4EQxvvi",  # ECHO Prime voice
}


def get_vault():
    """Get ECHO credential vault instance."""
    try:
        from credential_vault import CloudCredentialVault
        return CloudCredentialVault()
    except ImportError:
        print("ERROR: Could not import ECHO vault. Make sure O:/ECHO_OMEGA_PRIME/core is accessible.")
        sys.exit(1)


def get_env_values():
    """Resolve all environment values from vault or static."""
    vault = get_vault()
    result = {}

    for var_name, source in VERCEL_ENV_CONFIG.items():
        if isinstance(source, str):
            # Static value
            result[var_name] = source
        else:
            # Vault lookup: (service, username)
            service, username = source
            cred = vault.get_credential(service, username)
            if cred:
                result[var_name] = cred.get("password", "")
            else:
                # Try searching by just username
                for c in vault.credentials.values():
                    if c.get("username") == username:
                        result[var_name] = c.get("password", "")
                        break
                else:
                    print(f"WARNING: Could not find {var_name} in vault ({service}/{username})")
                    result[var_name] = ""

    return result


def list_vars():
    """List all environment variables and their values (masked)."""
    values = get_env_values()
    print("\n=== Environment Variables to Sync ===\n")
    for name, value in sorted(values.items()):
        if value:
            masked = value[:8] + "..." if len(value) > 12 else value
            print(f"  {name}: {masked}")
        else:
            print(f"  {name}: [NOT SET]")
    print()


def preview_sync():
    """Preview the Vercel commands that would be run."""
    values = get_env_values()
    print("\n=== Vercel Sync Preview ===\n")
    print("Commands that would be run:\n")
    for name, value in sorted(values.items()):
        if value:
            print(f'vercel env add {name} production < (echo "{value[:8]}...")')
    print()


def sync_to_vercel():
    """Actually sync environment variables to Vercel."""
    values = get_env_values()

    print("\n=== Syncing to Vercel ===\n")

    for name, value in sorted(values.items()):
        if not value:
            print(f"  SKIP {name}: No value")
            continue

        try:
            # Use vercel env add with stdin
            # First remove if exists (ignore error)
            subprocess.run(
                ["vercel", "env", "rm", name, "production", "--yes"],
                capture_output=True,
                cwd=Path(__file__).parent.parent
            )

            # Add the new value
            result = subprocess.run(
                ["vercel", "env", "add", name, "production"],
                input=value.encode(),
                capture_output=True,
                cwd=Path(__file__).parent.parent
            )

            if result.returncode == 0:
                print(f"  OK {name}")
            else:
                error = result.stderr.decode() if result.stderr else "Unknown error"
                print(f"  ERROR {name}: {error}")

        except FileNotFoundError:
            print("ERROR: Vercel CLI not found. Install with: npm i -g vercel")
            sys.exit(1)
        except Exception as e:
            print(f"  ERROR {name}: {e}")

    print("\n=== Sync Complete ===")
    print("\nNOTE: You may need to redeploy for changes to take effect:")
    print("  vercel --prod")
    print()


def main():
    parser = argparse.ArgumentParser(description="Sync ECHO vault to Vercel")
    parser.add_argument("--list", action="store_true", help="List vars to sync")
    parser.add_argument("--preview", action="store_true", help="Preview commands")
    parser.add_argument("--sync", action="store_true", help="Actually sync to Vercel")

    args = parser.parse_args()

    if args.list:
        list_vars()
    elif args.preview:
        preview_sync()
    elif args.sync:
        sync_to_vercel()
    else:
        # Default: show help
        parser.print_help()
        print("\n\nQuick start:")
        print("  python tools/sync-vercel-env.py --list   # See what will be synced")
        print("  python tools/sync-vercel-env.py --sync   # Sync to Vercel")


if __name__ == "__main__":
    main()
