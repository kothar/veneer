import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler'
import https from 'https';
import { VeneerAgent } from './agent';

export interface Weighted {
    weight?: number
}

export interface Latency extends Weighted {
    ms?: number
}

export interface Response extends Weighted {
    intercept?: boolean,
    statusCode?: number,
    contentType?: string;
    body?: string
}

export type Behaviour = {
    latency?: Latency[]
    response?: Response[]
}

export type SelectedBehaviour = {
    latency?: Latency
    response?: Response
}

export const cachedBehaviours = new Map<string, Behaviour>();
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
            return;
        }

        const agent = new https.Agent() as unknown as VeneerAgent;
        agent.__veneer__ = true;
        const client = new DynamoDBClient({
            requestHandler: new NodeHttpHandler({
                httpsAgent: agent
            })
        });
        const ddbDocClient = DynamoDBDocumentClient.from(client);
        const results = await ddbDocClient.send(new ScanCommand({
            TableName: configTable
        }))

        cachedBehaviours.clear();
        results.Items?.forEach(record => {
            const { host } = record;
            cachedBehaviours.set(host, record as Behaviour);
            delete missingBehaviours[host];
        });
        console.log(`Updated behaviours for ${results.Items?.length} hosts`);

        let count = 0;
        for (let host in missingBehaviours) {
            await ddbDocClient.send(new PutCommand({
                TableName: configTable,
                ConditionExpression: 'attribute_not_exists(host)',
                Item: {
                    host,
                    latency: [{
                        weight: 100,
                        ms: 0
                    }],
                    response: [{
                        weight: 100,
                        intercept: false,
                        statusCode: 200,
                        contentType: 'text/plain',
                        body: 'replacement'
                    }]
                } as Behaviour
            }));
            count++;
        }
        console.log(`Created behaviours for ${count} hosts`);
        missingBehaviours = {};

    } catch (e) {
        let message = e;
        if (e instanceof Error) {
            message = e.message;
        }
        console.error('Unable to load new behaviours:', message);
    } finally {
        refreshInProgress = false;
    }
}

export function behaviour(host: string): SelectedBehaviour {
    refreshBehaviours().catch(console.error);
    let cachedBehaviour = cachedBehaviours.get(host);
    if (!cachedBehaviour) {
        missingBehaviours[host] = true;
    }
    cachedBehaviour = cachedBehaviour || {};

    return {
        latency: selectWeighted(cachedBehaviour.latency || []),
        response: selectWeighted(cachedBehaviour.response || [])
    };
}

export function selectWeighted<T extends Weighted>(options: T[]): T | undefined {
    if (!options.length) {
        return undefined;
    }

    const total = options
        .map(v => v.weight || 0)
        .reduce((prev, current) => prev + current);

    const selection = Math.random() * total;
    let sum = 0;
    for (const v of options) {
        sum += v.weight || 0;
        if (sum >= selection) {
            return v;
        }
    }
    return undefined;
}