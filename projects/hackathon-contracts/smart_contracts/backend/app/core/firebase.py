from __future__ import annotations
import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


@lru_cache
def init_firebase_admin():
    """
    Initialize Firebase Admin exactly once.
    Requires:
      - FIREBASE_PROJECT_ID
      - GOOGLE_APPLICATION_CREDENTIALS pointing to service account JSON (firebase-key.json)
    """
    import firebase_admin
    from firebase_admin import credentials

    try:
        return firebase_admin.get_app()
    except ValueError:
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        if not project_id:
            raise RuntimeError("FIREBASE_PROJECT_ID is not set")
        key_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "firebase-key.json")
        if not os.path.exists(key_path):
            raise RuntimeError(f"Service account file not found at {key_path}")
        cred = credentials.Certificate(key_path)
        return firebase_admin.initialize_app(cred, {"projectId": project_id})


@lru_cache
def get_firestore_client():
    """
    Lazy Firestore client. Ensures Admin is initialized.
    """
    init_firebase_admin()
    from google.cloud import firestore

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    return firestore.Client(project=project_id)
