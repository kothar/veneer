import { InterceptedSocket } from '../socket';

test('Creates intercepted socket', async () => {
    const socket = new InterceptedSocket()

    setTimeout(() => {
        socket._readable.push('The quick brown fox jumps over the lazy dog');
        socket.end();
    }, 100);

    let result = await new Promise((accept, reject) => {
        let body = '';
        socket.on('data', data => body += data)
        socket.on('end', () => accept(body))
        socket.on('error', reject);
    });

    console.log(result);
})