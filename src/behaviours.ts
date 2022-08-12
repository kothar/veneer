import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import https from 'https';

export type Behaviour = {
    priority?: number
    latencyMs?: number
}

let cachedBehaviours: Record<string, Behaviour> = {};
let missingBehaviours: Record<string, boolean> = {};
let nextUpdate: number;

let refreshInProgress = false;

export async function refreshBehaviours() {
    let now = new Date().getTime();
    if (refreshInProgress || nextUpdate && nextUpdate > now) {
        return;
    }

    try {
        refreshInProgress = true;
        nextUpdate = now + 30 * 1000;

        const configTable = process.env.VENEER_CONFIG_TABLE;
        if (!configTable) {
            console.log('No config table specified');
        }

        const agent = new https.Agent();
        (agent as any)['__veneer__'] = true;
        const client = new DynamoDBClient({
            requestHandler: new NodeHttpHandler({
                httpsAgent: agent
            })
        });
        const ddbDocClient = DynamoDBDocumentClient.from(client);
        const results = await ddbDocClient.send(new ScanCommand({
            TableName: configTable
        }))

        cachedBehaviours = {};
        results.Items?.forEach(record => {
            const { host } = record;
            cachedBehaviours[host] = record as Behaviour;
            delete missingBehaviours[host];
        });
        console.log(`Updated behaviours for ${results.Items?.length} hosts`);

        let count = 0;
        for (let host in missingBehaviours) {
            await ddbDocClient.send(new PutCommand({
                TableName: configTable,
                ConditionExpression: 'attribute_not_exists(host)',
                Item: { host, latencyMs: 0 }
            }));
            count++;
        }
        console.log(`Created behaviours for ${count} hosts`);
        missingBehaviours = {};
    } finally {
        refreshInProgress = false;
    }
}

export function behaviour(host: string): Behaviour {
    refreshBehaviours().catch(console.error);
    const cachedBehaviour = cachedBehaviours[host];
    if (!cachedBehaviour) {
        missingBehaviours[host] = true;
    }
    return cachedBehaviour || {};
}