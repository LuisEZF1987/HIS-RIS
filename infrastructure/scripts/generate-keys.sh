#!/bin/bash
set -e

KEYS_DIR="${1:-/c/HIS_RIS/infrastructure/keys}"
mkdir -p "$KEYS_DIR"

echo "Generating RS256 key pair in: $KEYS_DIR"

openssl genrsa -out "$KEYS_DIR/private_key.pem" 2048
openssl rsa -in "$KEYS_DIR/private_key.pem" -pubout -out "$KEYS_DIR/public_key.pem"

chmod 600 "$KEYS_DIR/private_key.pem"
chmod 644 "$KEYS_DIR/public_key.pem"

echo "Done! Keys generated:"
echo "  Private: $KEYS_DIR/private_key.pem"
echo "  Public:  $KEYS_DIR/public_key.pem"
