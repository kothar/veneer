import { behaviours } from './behaviours';
import { ClientRequestArgs, IncomingMessage} from 'http';
import { Duplex, PassThrough } from 'stream';

// Extracts the options object from the arguments of a request call
function getRequestOptions(args: any[]): [ClientRequestArgs, (res: IncomingMessage) => void] {
    if (typeof args[0] == 'string') {
        const url = new URL(args[0]);
        return [
            {
                hostname: url.hostname,
                ...args[1]
            },
            args[2]
        ];
    } else if (typeof args[0] == 'object') {
        return [{ ...args[0] }, args[1]];
    }
    throw new Error('unable to parse request options');
}

(() => {
    const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown-lambda';
    const handler = process.env._HANDLER || 'unknown.handler';

    // Pre-load behaviours
    behaviours();

    // Wrap handler (incoming requests)
    console.log(`Initialising Veneer for Lambda "${lambdaName}": handler "${handler}"`);
    const [moduleName, handlerName] = handler.split('.');
    try {
        const module = require(moduleName + '.js');
        const handlerFunction = module[handlerName];
        module[handlerName] = async (event: any) => {
            console.log(`Handler invoked with event ${JSON.stringify(event)}`);
            const { latencyMs = 0 } = behaviours()[lambdaName] || {};

            if (latencyMs) {
                console.log(`Introducing ${latencyMs}ms latency`);
                await new Promise((resolve) => setTimeout(resolve, latencyMs));
            }

            return handlerFunction(event);
        };
    } catch (e) {
        let message = 'Unknown error';
        if (e instanceof Error) {
            message = e.message;
        }
        console.log(`Unable to wrap lambda handler: ${message}`)
    }

    // Wrap outgoing requests
    const https = require('https');
    const hsRequest = https.request

    // Wrap https request method (outgoing requests)
    https.request = (...args: any[]) => {
        let [requestOptions, callback] = getRequestOptions(args);
        console.log(`Outgoing request intercepted: ${requestOptions.host || requestOptions.hostname}`);

        const agent = requestOptions.agent || https.globalAgent;
        requestOptions.agent = agent;

        const createConnection = agent.createConnection;
        agent.createConnection = (options: any) => {
            const { host, port }: { host: string, port: string } = options;
            console.log(`Outgoing connection requested to ${host}:${port}`);
            const { latencyMs = 0 } = behaviours()[host] || {};

            const readable = new PassThrough();
            const writable = new PassThrough();
            const wrappedStream = Duplex.from({ readable, writable });

            const stream: Duplex = createConnection.bind(agent)(options);
            (async () => {
                if (latencyMs) {
                    console.log(`Introducing ${latencyMs}ms latency`);
                    await new Promise((resolve) => setTimeout(resolve, latencyMs));
                }

                // TODO handle failure responses

                stream.pipe(readable);
                writable.pipe(stream);
            })();

            return wrappedStream;
        }

        const clientRequest = hsRequest(requestOptions, callback);

        // Restore original createConnection method
        agent.createConnection = createConnection;

        return clientRequest;
    }
})();