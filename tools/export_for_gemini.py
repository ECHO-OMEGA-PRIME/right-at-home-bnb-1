"""
Export RightAtHomeBnB codebase for Gemini review
Excludes: node_modules, .git, __pycache__, build artifacts
Creates a single markdown file with all code for easy paste into AI Studio
"""

from pathlib import Path
import os

# Directories to skip
SKIP_DIRS = {
    'node_modules', '.git', '__pycache__', '.next', 'dist', 'build', 
    '.turbo', '.cache', 'coverage', '.pnpm', '.prisma', 'vrbo_images'
}

# File extensions to include
INCLUDE_EXT = {
    '.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml',
    '.prisma', '.sql', '.sh', '.ps1', '.env.example', '.css', '.scss'
}

# Files to skip
SKIP_FILES = {
    'package-lock.json', 'pnpm-lock.yaml', '.env', 'dev.db'
}

# Max file size (skip huge files)
MAX_FILE_SIZE = 100_000  # 100KB

def should_include(path: Path) -> bool:
    """Check if file should be included"""
    if path.name in SKIP_FILES:
        return False
    if path.suffix not in INCLUDE_EXT and path.name not in {'.prettierrc', '.eslintrc.json'}:
        return False
    if path.stat().st_size > MAX_FILE_SIZE:
        return False
    return True

def export_codebase():
    root = Path(r"P:\SOVEREIGN_APPS\RightAtHomeBnB")
    output = root / "GEMINI_REVIEW_EXPORT.md"
    
    lines = [
        "# RightAtHomeBnB Codebase Export",
        "",
        "## Project Overview",
        "Vacation rental management platform for Right at Home - Midland (22 properties)",
        "",
        "## Tech Stack",
        "- Frontend: Next.js (web), React Native (mobile), Electron (desktop)",
        "- Backend: FastAPI (Python)",
        "- Database: Prisma + SQLite (dev) / PostgreSQL (prod)",
        "- AI: Claude API integration for concierge",
        "",
        "---",
        ""
    ]
    
    file_count = 0
    
    for dirpath, dirnames, filenames in os.walk(root):
        # Remove directories we want to skip
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        
        rel_dir = Path(dirpath).relative_to(root)
        
        for filename in sorted(filenames):
            filepath = Path(dirpath) / filename
            
            if not should_include(filepath):
                continue
            
            rel_path = filepath.relative_to(root)
            
            try:
                content = filepath.read_text(encoding='utf-8', errors='ignore')
                
                # Determine language for syntax highlighting
                ext_map = {
                    '.py': 'python', '.ts': 'typescript', '.tsx': 'tsx',
                    '.js': 'javascript', '.jsx': 'jsx', '.json': 'json',
                    '.md': 'markdown', '.yaml': 'yaml', '.yml': 'yaml',
                    '.prisma': 'prisma', '.sql': 'sql', '.sh': 'bash',
                    '.ps1': 'powershell', '.css': 'css', '.scss': 'scss'
                }
                lang = ext_map.get(filepath.suffix, '')
                
                lines.append(f"## `{rel_path}`")
                lines.append("")
                lines.append(f"```{lang}")
                lines.append(content)
                lines.append("```")
                lines.append("")
                
                file_count += 1
                print(f"Added: {rel_path}")
                
            except Exception as e:
                print(f"Skipped {rel_path}: {e}")
    
    # Write output
    output.write_text("\n".join(lines), encoding='utf-8')
    print(f"\n✅ Exported {file_count} files to: {output}")
    print(f"📋 File size: {output.stat().st_size / 1024:.1f} KB")
    print(f"\n📤 Upload this file to aistudio.google.com or paste contents")

if __name__ == "__main__":
    export_codebase()
