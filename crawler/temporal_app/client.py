"""Shared Temporal client connection — works for:
  * self-hosted (no TLS)         — local docker
  * Temporal Cloud via API Key   — TLS + api_key (simplest for Cloud)
  * Temporal Cloud via mTLS       — TLS + client cert/key

Env:
  TEMPORAL_ADDRESS    self-host: localhost:7233
                      cloud:     <namespace>.<accountId>.tmprl.cloud:7233
  TEMPORAL_NAMESPACE  self-host: "default"
                      cloud:     <namespace>.<accountId>   (e.g. car-recsys.islko)

  # Pick ONE auth for Cloud (else no-TLS for self-host):
  TEMPORAL_API_KEY    Temporal Cloud API key   → API-key auth (recommended)
  TEMPORAL_TLS_CERT + TEMPORAL_TLS_KEY  paths   → mTLS auth
"""
from __future__ import annotations

import os

from temporalio.client import Client, TLSConfig


async def connect() -> Client:
    address = os.environ.get("TEMPORAL_ADDRESS", "localhost:7233")
    namespace = os.environ.get("TEMPORAL_NAMESPACE", "default")

    api_key = os.environ.get("TEMPORAL_API_KEY")
    cert_path = os.environ.get("TEMPORAL_TLS_CERT")
    key_path = os.environ.get("TEMPORAL_TLS_KEY")

    # --- API Key (Temporal Cloud, simplest) ---
    if api_key:
        return await Client.connect(
            address,
            namespace=namespace,
            api_key=api_key,
            tls=True,                       # Cloud always TLS (server-side)
            rpc_metadata={"temporal-namespace": namespace},
        )

    # --- mTLS (Temporal Cloud, cert-based) ---
    if cert_path and key_path:
        with open(cert_path, "rb") as f:
            client_cert = f.read()
        with open(key_path, "rb") as f:
            client_key = f.read()
        return await Client.connect(
            address,
            namespace=namespace,
            tls=TLSConfig(client_cert=client_cert, client_private_key=client_key),
        )

    # --- no TLS (self-hosted local) ---
    return await Client.connect(address, namespace=namespace, tls=False)
