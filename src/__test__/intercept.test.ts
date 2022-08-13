import { hookAgent } from '../agent';
import http, { IncomingMessage, Server, ServerResponse } from 'http';
import { cachedBehaviours } from '../behaviours';

let server: Server;
let port = 3000;
let host = 'localhost';

function requestListener(req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200);
    res.end('My first server!');
}

type Response = { responseTimeMs: number, statusCode?: number, body: string };

async function makeRequest() {
    const agent = new http.Agent();
    hookAgent(agent);

    const start = new Date().getTime();
    return new Promise<Response>((resolve, reject) => {
        http.get(`http://${host}:${port}`, { agent }, res => {
            const { statusCode } = res;
            let body = '';

            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const responseTimeMs = new Date().getTime() - start;
                resolve({ responseTimeMs, statusCode, body });
            });
        }).on('error', reject);
    });
}

beforeAll(async () => {
    await new Promise((resolve, reject) => {
        server = http.createServer(requestListener);
        server.listen(port, host, () => {
            console.log(`Server is running on http://${host}:${port}`);
            resolve('ok');
        });
    });
})

afterAll(async () => {
    await new Promise((resolve, reject) => {
        server.close(e => {
            if (e) reject(e);
            else resolve('closed');
        });
    });
    console.log('Closed server');
})

beforeEach(() => {
    cachedBehaviours.clear();
})

test('Intercept request socket', async () => {
    const response = await makeRequest();

    console.log(response);
    expect(response.responseTimeMs).toBeLessThan(200);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('My first server!');
});

test('Introduce latency to request', async () => {
    cachedBehaviours.set('localhost', { latency: [{ ms: 200 }] })
    const response = await makeRequest();

    console.log(response);
    expect(response.responseTimeMs).toBeGreaterThan(200);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('My first server!');
});

test('Modify response', async () => {
    cachedBehaviours.set('localhost', {
        response: [{
            intercept: true,
            statusCode: 404,
            body: 'Not Found'
        }]
    });
    const response = await makeRequest();

    console.log(response);
    expect(response.responseTimeMs).toBeLessThan(200);
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('Not Found');
});

test('Modify response with latency', async () => {
    cachedBehaviours.set('localhost', {
        response: [{
            intercept: true,
            statusCode: 404,
            body: 'Not Found'
        }],
        latency: [{ ms: 200 }]
    });
    const response = await makeRequest();

    console.log(response);
    expect(response.responseTimeMs).toBeGreaterThan(200);
    expect(response.statusCode).toBe(404);
    expect(response.body).toBe('Not Found');
});
