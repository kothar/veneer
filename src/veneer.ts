import { behaviour, refreshBehaviours } from './behaviours';
import { hookAgent } from './agent';
import http, { globalAgent as httpGlobalAgent, ClientRequestArgs } from 'http';
import https, { globalAgent as httpsGlobalAgent } from 'https';

// Extracts the options object from the arguments of a request call
function getRequestOptions(args: any[]): ClientRequestArgs {
    if (typeof args[0] == 'string') {
        return args[1];
    } else if (typeof args[0] == 'object') {
        return args[0];
    }
    throw new Error('unable to find request options');
}

(() => {
    const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME || 'unknown-lambda';
    const handler = process.env._HANDLER || 'unknown.handler';

    // Pre-load behaviours
    const init = refreshBehaviours();
    hookAgent(httpsGlobalAgent);
    hookAgent(httpGlobalAgent);

    // Wrap handler (incoming requests)
    console.log(`Initialising Veneer for Lambda "${lambdaName}": handler "${handler}"`);
    const [moduleName, handlerName] = handler.split('.');
    try {
        const module = require(moduleName + '.js');
        const handlerFunction = module[handlerName];
        module[handlerName] = async (event: any, context: any, callback: any) => {
            await init;

            console.log(`Handler invoked with event ${JSON.stringify(event)}`);
            const { latencyMs = 0 } = behaviour(lambdaName);

            if (latencyMs) {
                console.log(`Introducing ${latencyMs}ms latency`);
                await new Promise((resolve) => setTimeout(resolve, latencyMs));
            }

            return handlerFunction(event, context, callback);
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
                const requestOptions = getRequestOptions(args);
                if (requestOptions?.agent) {
                    hookAgent(requestOptions.agent)
                }
                return method(...args);
            }
        });
    });
})();