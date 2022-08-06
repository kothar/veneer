# Veneer

A Lambda layer for Node.js which will intercept all incoming and outgoing network connections.

On interception, Veneer can be configured with various behaviours to introduce errors and/or request latency.

## Enabling Veneer

1. Install veneer as a new layer for your lambda function
2. Set the environment variable `NODE_OPTIONS` to `--require /opt/veneer/veneer.js`

## Configuring interception behaviours

TBC