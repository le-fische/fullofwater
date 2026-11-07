#!/usr/bin/env bash
# Script to generate local SSL certificates for LAN testing using mkcert
# Used as an alternative to vite-plugin-basic-ssl for trusted root CA on iOS.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS_DIR="$DIR/certs"

mkdir -p "$CERTS_DIR"

if ! command -v mkcert &> /dev/null; then
    echo "mkcert is not installed. You can install it via Homebrew: brew install mkcert"
    echo "Note: The Vite dev server is already configured with vite-plugin-basic-ssl, so this script is optional."
    exit 0
fi

# Detect primary LAN IP
LAN_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "127.0.0.1")

echo "Generating SSL certificate for localhost, 127.0.0.1, and $LAN_IP..."
mkcert -install
mkcert -key-file "$CERTS_DIR/dev-key.pem" -cert-file "$CERTS_DIR/dev-cert.pem" localhost 127.0.0.1 "$LAN_IP" ::1

echo "Certificates created in $CERTS_DIR"
echo "To trust on iPhone: AirDrop or email $(mkcert -CAROOT)/rootCA.pem to your iPhone, install profile, and enable Full Trust in Settings -> General -> About -> Certificate Trust Settings."
