import { behaviour } from './behaviours';

export function hookAgent(agent: any) {
    if (!agent || agent.__veneer__) {
        return;
    }

    const createConnection = agent.createConnection;
    agent.createConnection = (options: any) => {
        const { host, port }: { host: string, port: string } = options;
        console.log(`Outgoing connection intercepted for ${host}:${port}`);
        const { latencyMs = 0 } = behaviour(host);

        // TODO handle failure responses

        const socket = createConnection.bind(agent)(options);
        if (latencyMs) {
            console.log(`Introducing ${latencyMs}ms latency`);
            socket.pause();
            (async () => {
                await new Promise((resolve) => setTimeout(resolve, latencyMs));
                socket.resume();
            })();
        }
        return socket;
    }

    agent.__veneer__ = true;
}