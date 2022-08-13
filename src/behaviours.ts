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
    host: string
    latency?: Latency[]
    response?: Response[]
}

export type SelectedBehaviour = {
    latency?: Latency
    response?: Response
}

export const cachedBehaviours = new Map<string, Behaviour>();
let nextUpdate: number;

// Set up DB client
const configTable = process.env.VENEER_CONFIG_TABLE;
const agent = new https.Agent() as unknown as VeneerAgent;
agent.__veneer__ = true;
const client = new DynamoDBClient({
    requestHandler: new NodeHttpHandler({
        httpsAgent: agent
    })
});
const ddbDocClient = DynamoDBDocumentClient.from(client);

let refreshInProgress = false;

async function createMissingBehavior(host: string) {
    try {
        const newBehaviour: Behaviour = {
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
        }
        cachedBehaviours.set(host, newBehaviour);

        await ddbDocClient.send(new PutCommand({
            TableName: configTable,
            ConditionExpression: 'attribute_not_exists(host)',
            Item: newBehaviour
        }));

        console.log(`Created behaviour for ${host}`);
    } catch (e) {
        let message = e;
        if (e instanceof Error) {
            message = e.message;
        }
        console.log(`Failed to store behaviour for ${host}:`, message);
    }
}

export async function refreshBehaviours() {
    let now = new Date().getTime();
    if (refreshInProgress || nextUpdate && nextUpdate > now) {
        return;
    }

    try {
        refreshInProgress = true;
        nextUpdate = now + 30 * 1000;

        if (!configTable) {
            console.log('No config table specified');
            return;
        }
        const results = await ddbDocClient.send(new ScanCommand({
            TableName: configTable
        }))

        cachedBehaviours.clear();
        results.Items?.forEach(record => {
            const { host } = record;
            cachedBehaviours.set(host, record as Behaviour);
        });
        console.log(`Updated behaviours for ${results.Items?.length} hosts`);

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
        createMissingBehavior(host).catch(console.error);
    }
    cachedBehaviour = cachedBehaviour || {host};

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