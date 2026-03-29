#!/usr/bin/bash

set -e
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <...command>"
    exit 1
fi

socket_path=${AXR_SOCKET:-/tmp/axr.sock}

echo $@ | nc -U $socket_path
