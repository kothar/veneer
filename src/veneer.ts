import { behaviours } from './behaviours';
import { Duplex, PassThrough } from 'stream'

(() => {
    const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!lambdaName) {
        throw Error('AWS_LAMBDA_FUNCTION_NAME not set');
    }
    const handler = process.env._HANDLER;
    if (!handler) {
        throw Error('_HANDLER not set');
    }

    // Pre-load behaviours
    behaviours();

    // Wrap handler (incoming requests)
    console.log(`Initialising Veneer for Lambda "${lambdaName}": handler "${handler}"`);
    const [moduleName, handlerName] = handler.split('.');
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

    // Wrap global https agent (outgoing requests)
    const https = require('https');
    const createConnection = https.globalAgent.createConnection.bind(https.globalAgent);
    https.globalAgent['createConnection'] = (options: any) => {
        const { host, port }: { host: string, port: string } = options;
        console.log(`Outgoing connection requested to ${host}:${port}`);
        const { latencyMs = 0 } = behaviours()[host] || {};

        const readable = new PassThrough();
        const writable = new PassThrough();
        const wrappedStream = Duplex.from({ readable, writable });

        const stream: Duplex = createConnection(options);
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
})();