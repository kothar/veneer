import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export type Behaviour = {
    priority?: number
    latencyMs?: number
}

let cachedBehaviours: Record<string, Behaviour> = {
    'google.com': {
        latencyMs: 100
    }
}
let nextUpdate: number;

export function behaviours(): Record<string, Behaviour> {
    let now = new Date().getTime();
    if (!nextUpdate || nextUpdate < now) {
        nextUpdate = now + 30 * 1000;

        // Refresh in background
        (async () => {
            const configTable = process.env.VENEER_CONFIG_TABLE;
            if (!configTable) {
                console.log('No config table specified');
            }

            const client = new DynamoDBClient({});
            const ddbDocClient = DynamoDBDocumentClient.from(client);
            const results = await ddbDocClient.send(new ScanCommand({
                TableName: configTable
            }))

            cachedBehaviours = {};
            results.Items?.forEach(record => {
                const { host } = record;
                cachedBehaviours[host] = record as Behaviour;
            });
            console.log(`Updated behaviours for ${results.Items?.length} hosts`);
        })();
    }
    return cachedBehaviours;
}