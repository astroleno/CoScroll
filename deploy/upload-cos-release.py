#!/usr/bin/env python3
"""Create-only CoScroll COS upload. Secrets stay inside this wrapper's process."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import subprocess
import sys
from pathlib import Path

BUCKET = "tongye-1327162705"
REGION = "ap-shanghai"
SERVICE = "fv-slide-cos-upload"
CACHE = "public, max-age=31536000, immutable"
PREFIX = "releases/aitoshuu-me/"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def keychain(account: str) -> str:
    result = subprocess.run(
        ["security", "find-generic-password", "-s", SERVICE, "-a", account, "-w"],
        capture_output=True, check=False,
    )
    if result.returncode or not result.stdout.strip():
        raise RuntimeError(f"Keychain account {account} is unavailable")
    return result.stdout.decode("utf-8").strip()


def checked_path(root: Path, name: str) -> Path:
    if not isinstance(name, str) or name.startswith(("/", "\\")) or "\\" in name or ".." in Path(name).parts:
        raise RuntimeError("unsafe package path")
    target = root / name
    if target.is_symlink() or not target.resolve().is_relative_to(root) or not target.is_file():
        raise RuntimeError("package entry is not a regular file")
    return target


def load_plan(root: Path) -> tuple[str, list[dict]]:
    verification = subprocess.run(["node", str(Path(__file__).with_name("verify-package.mjs")), str(root), "--production"], capture_output=True, check=False)
    if verification.returncode:
        raise RuntimeError("package integrity or production profile validation failed")
    manifest_file = checked_path(root, "manifests/release-manifest.json")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    release_id = manifest.get("releaseId")
    if (manifest.get("schemaVersion") != 1 or manifest.get("site") != "CoScroll"
            or not isinstance(release_id, str) or not re.fullmatch(r"coscroll-[0-9a-f]{16}", release_id)):
        raise RuntimeError("invalid CoScroll release manifest")
    object_prefix = f"{PREFIX}{release_id}/"
    if (manifest.get("objectPrefix") != object_prefix
            or manifest.get("assetsBase") != f"https://assets.aitoshuu.me/{object_prefix}"
            or manifest.get("mediaBase") != f"https://media.aitoshuu.me/{object_prefix}"):
        raise RuntimeError("manifest CDN origin is outside the approved scope")
    plan = []
    seen = set()
    for entry in manifest.get("entries", []):
        if entry.get("channel") not in {"assets", "media"}:
            continue
        package_path = entry.get("packagePath")
        channel = entry["channel"]
        if not isinstance(package_path, str) or not package_path.startswith(channel + "/"):
            raise RuntimeError("invalid package channel path")
        relative_path = package_path[len(channel) + 1:]
        key = object_prefix + relative_path
        if (not relative_path or ".." in Path(relative_path).parts or key != entry.get("objectKey")
                or key in seen or not key.startswith(object_prefix)):
            raise RuntimeError("COS object key is outside the immutable release")
        seen.add(key)
        local_path = checked_path(root, package_path)
        if local_path.stat().st_size != entry.get("bytes") or sha256(local_path) != entry.get("sha256"):
            raise RuntimeError("release package hash mismatch")
        if not entry["bytes"] or entry.get("cacheControl") != CACHE or not entry.get("mime"):
            raise RuntimeError("invalid immutable object metadata")
        plan.append({**entry, "localPath": local_path})
    if not plan:
        raise RuntimeError("release has no CDN objects")
    plan.append({"channel": "manifest", "packagePath": "manifests/release-manifest.json",
                 "objectKey": object_prefix + "manifests/release-manifest.json",
                 "localPath": manifest_file, "bytes": manifest_file.stat().st_size,
                 "sha256": sha256(manifest_file), "mime": "application/json; charset=utf-8",
                 "cacheControl": "no-store"})
    return release_id, sorted(plan, key=lambda item: item["objectKey"])


def header(data: dict, name: str) -> str | None:
    return next((str(value) for key, value in data.items() if key.lower() == name.lower()), None)


def matches(entry: dict, data: dict | None, release_id: str) -> bool:
    return data is not None and all([
        header(data, "Content-Length") == str(entry["bytes"]),
        header(data, "Content-Type") == entry["mime"],
        header(data, "Cache-Control") == entry["cacheControl"],
        header(data, "x-cos-meta-sha256") == entry["sha256"],
        header(data, "x-cos-meta-release-id") == release_id,
    ])


def upload(root: Path, release_id: str, plan: list[dict]) -> dict:
    try:
        from qcloud_cos import CosConfig, CosS3Client
        from qcloud_cos.cos_exception import CosServiceError
    except ImportError as error:
        raise RuntimeError("Tencent COS SDK is unavailable") from error
    logging.getLogger("qcloud_cos").setLevel(logging.CRITICAL)
    client = CosS3Client(CosConfig(Region=REGION, SecretId=keychain("secret-id"), SecretKey=keychain("secret-key")))

    def head(key: str) -> dict | None:
        try:
            return client.head_object(Bucket=BUCKET, Key=key)
        except CosServiceError as error:
            if error.get_status_code() == 404:
                return None
            raise RuntimeError(f"COS HEAD failed: HTTP {error.get_status_code()}") from None

    result = {"uploaded": 0, "skipped": 0}
    for entry in plan:
        key = entry["objectKey"]
        existing = head(key)
        if existing is not None:
            if not matches(entry, existing, release_id):
                raise RuntimeError(f"immutable object conflict: {key}")
            result["skipped"] += 1
            continue
        try:
            with entry["localPath"].open("rb") as stream:
                client.put_object(
                    Bucket=BUCKET, Key=key, Body=stream,
                    ContentType=entry["mime"], CacheControl=entry["cacheControl"],
                    Metadata={"x-cos-forbid-overwrite": "true",
                              "x-cos-meta-sha256": entry["sha256"],
                              "x-cos-meta-release-id": release_id},
                )
        except CosServiceError as error:
            concurrent = head(key)
            if concurrent is None or not matches(entry, concurrent, release_id):
                raise RuntimeError(f"COS create failed: HTTP {error.get_status_code()} for {key}") from None
        if not matches(entry, head(key), release_id):
            raise RuntimeError(f"COS post-upload verification failed: {key}")
        result["uploaded"] += 1
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package_dir", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--bucket", default=BUCKET)
    parser.add_argument("--region", default=REGION)
    args = parser.parse_args()
    if args.bucket != BUCKET or args.region != REGION:
        raise RuntimeError("bucket or region is outside the approved scope")
    root = args.package_dir.resolve()
    release_id, plan = load_plan(root)
    if args.apply:
        print(json.dumps({"releaseId": release_id, **upload(root, release_id, plan)}))
    else:
        print(json.dumps({"mode": "offline-plan", "releaseId": release_id,
                          "objects": len(plan), "bytes": sum(item["bytes"] for item in plan),
                          "objectPrefix": f"{PREFIX}{release_id}/"}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Third-party exceptions may contain request internals; never echo them.
        print("COS upload blocked; package, scope, or Keychain preflight failed", file=sys.stderr)
        raise SystemExit(1)
