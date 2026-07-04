#!/usr/bin/env python3
from __future__ import annotations

import argparse
import getpass
import hashlib
import secrets


def main() -> int:
    parser = argparse.ArgumentParser(description="Hash relumeow.top project passcodes for Worker secrets.")
    parser.add_argument("--salt", help="Existing salt. Omit to generate one.")
    parser.add_argument("--passcode", help="Passcode to hash. Omit to prompt without echo.")
    args = parser.parse_args()

    salt = args.salt or secrets.token_urlsafe(32)
    passcode = args.passcode or getpass.getpass("Passcode: ")
    digest = hashlib.sha256(f"{salt}:{passcode}".encode("utf-8")).hexdigest()
    print(f"RELUMEOW_ACCESS_SALT={salt}")
    print(f"PASSCODE_HASH={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
