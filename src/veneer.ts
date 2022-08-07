import { behaviour, refreshBehaviours } from './behaviours';
import { hookAgent } from './agent';
import http, { globalAgent as httpGlobalAgent, ClientRequestArgs, IncomingMessage } from 'http';
import https, { globalAgent as httpsGlobalAgent } from 'https';

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
    refreshBehaviours().catch(console.error);
    hookAgent(httpsGlobalAgent);
    hookAgent(httpGlobalAgent);

    // Wrap handler (incoming requests)
    console.log(`Initialising Veneer for Lambda "${lambdaName}": handler "${handler}"`);
    const [moduleName, handlerName] = handler.split('.');
    try {
        const module = require(moduleName + '.js');
        const handlerFunction = module[handlerName];
        module[handlerName] = async (event: any) => {
            console.log(`Handler invoked with event ${JSON.stringify(event)}`);
            const { latencyMs = 0 } = behaviour(lambdaName);

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

    // Wrap http(s) request methods (outgoing requests)
    [http, https].forEach((module: Record<string, any>) => {
        ['request', 'get'].forEach(name => {
            const method = module[name];
            module[name] = (...args: any[]) => {
                let [requestOptions, callback] = getRequestOptions(args);
                hookAgent(requestOptions.agent);
                return method(requestOptions, callback);
            }
        });
    });
})();