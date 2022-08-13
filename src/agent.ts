import http from 'http';
import https from 'https';
import { Socket } from 'net';
import { behaviour } from './behaviours';
import { FakeSocket } from './fakesocket';

export interface VeneerAgent extends https.Agent {
    createConnection: (options: any) => Socket;
    __veneer__: boolean
}

export function hookAgent(agent: http.Agent) {
    const vAgent = agent as unknown as VeneerAgent;
    if (!vAgent || vAgent.__veneer__) {
        return;
    }

    const createConnection = vAgent.createConnection;
    vAgent.createConnection = (options: any) => {
        const { host, port }: { host: string, port: string } = options;
        console.log(`Outgoing connection intercepted for ${host}:${port}`);
        const { latency = { ms: 0 }, response } = behaviour(host);

        if (response) {
            const statusCode = response?.statusCode || 200;
            console.log(`Modifying response with statusCode ${statusCode} and latency ${latency.ms}ms`)
            const [client, server] = FakeSocket.createPair();
            setTimeout(() => {
                const header =
                    `HTTP/1.1 ${statusCode} ${http.STATUS_CODES[statusCode] || 'ERROR'}\r\n` +
                    `Content-Type: ${response.contentType || 'text/plain'}\r\n\r\n`;
                server.write(header);
                server.end(response.body);
            }, latency.ms);
            return client;

        } else {
            const socket = createConnection.bind(agent)(options);

            if (latency.ms) {
                console.log(`Introducing ${latency.ms}ms latency`);
                socket.pause();
                (async () => {
                    await new Promise((resolve) => setTimeout(resolve, latency.ms));
                    socket.resume();
                })();
            }
            return socket;
        }
    }

    vAgent.__veneer__ = true;
}