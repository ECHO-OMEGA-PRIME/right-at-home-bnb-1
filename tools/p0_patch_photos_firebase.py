from __future__ import annotations

from pathlib import Path

TARGET = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\backend\routers\photos.py")

OLD = '''class FirebaseStorageService:
    """Firebase Storage integration for photo management"""

    def __init__(self):
        self.bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "echo-prime-ai.appspot.com")
        self.initialized = False
        self._init_firebase()

    def _init_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if already initialized
            if not firebase_admin._apps:
                # Try to get credentials from environment or file
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': self.bucket_name
                    })
                else:
                    # Initialize with default credentials (for Cloud Run)
                    firebase_admin.initialize_app(options={
                        'storageBucket': self.bucket_name
                    })

            self.bucket = storage.bucket()
            self.initialized = True
            logger.info(f"Firebase Storage initialized: {self.bucket_name}")
        except Exception as e:
            logger.warning(f"Firebase Storage init failed: {e}")
            self.initialized = False
'''

NEW = '''EXPECTED_FIREBASE_PROJECT_ID = "rightathome-prod"


class FirebaseStorageService:
    """Firebase Storage integration for photo management."""

    def __init__(self):
        self.project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        self.bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET", "").strip()
        self.initialized = False
        self.bucket = None
        self._init_firebase()

    def _init_firebase(self):
        """Initialize Firebase Admin SDK with strict RAH project validation."""
        try:
            if self.project_id != EXPECTED_FIREBASE_PROJECT_ID:
                raise RuntimeError(
                    "Firebase project mismatch: expected "
                    f"{EXPECTED_FIREBASE_PROJECT_ID}, received "
                    f"{self.project_id or 'missing'}"
                )
            if not self.bucket_name:
                raise RuntimeError("FIREBASE_STORAGE_BUCKET is required")

            if firebase_admin._apps:
                app = firebase_admin.get_app()
                existing_project = getattr(app, "project_id", None)
                if not existing_project:
                    existing_project = app.options.get("projectId")
                if existing_project and existing_project != EXPECTED_FIREBASE_PROJECT_ID:
                    raise RuntimeError(
                        "Existing Firebase app project mismatch: expected "
                        f"{EXPECTED_FIREBASE_PROJECT_ID}, received {existing_project}"
                    )
            else:
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                options = {
                    "projectId": self.project_id,
                    "storageBucket": self.bucket_name,
                }
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    credential_project = getattr(cred, "project_id", None)
                    if (
                        credential_project
                        and credential_project != EXPECTED_FIREBASE_PROJECT_ID
                    ):
                        raise RuntimeError(
                            "Firebase credential project mismatch: expected "
                            f"{EXPECTED_FIREBASE_PROJECT_ID}, received "
                            f"{credential_project}"
                        )
                    firebase_admin.initialize_app(cred, options)
                else:
                    firebase_admin.initialize_app(options=options)

            self.bucket = storage.bucket(name=self.bucket_name)
            self.initialized = True
            logger.info(
                "Firebase Storage initialized for project %s and bucket %s",
                self.project_id,
                self.bucket_name,
            )
        except Exception as exc:
            logger.warning("Firebase Storage init failed: %s", exc)
            self.initialized = False
            self.bucket = None
'''

text = TARGET.read_text(encoding="utf-8")
if OLD not in text:
    raise SystemExit("Expected FirebaseStorageService block was not found; no changes written")

updated = text.replace(OLD, NEW, 1)
TARGET.write_text(updated, encoding="utf-8", newline="\n")
print(f"PATCHED={TARGET}")
