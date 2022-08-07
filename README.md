# Veneer

A Lambda layer for Node.js which will intercept all incoming and outgoing network connections.

On interception, Veneer can be configured with various behaviours to introduce errors and/or request latency.

## Enabling Veneer

1. Install veneer as a new layer for your lambda function
2. Set the environment variable `NODE_OPTIONS` to `--require /opt/veneer/veneer.js`
3. Set the environment variable `VENEER_CONFIG_TABLE` to the name of a DynamoDB table containing records with a
   partition key `host`.

## Configuring interception behaviours

When intercepting requests, Veneer will insert any missing records into the DynamoDB config table with default values.

* To change the behaviour of these requests, update the values in the fields.
* To reset the behaviour, delete the record from DynamoDB. It will be recreated the next time a request to that host is
  intercepted.