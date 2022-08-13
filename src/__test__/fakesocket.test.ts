import { FakeSocket } from '../fakesocket';

const testData = 'The quick brown fox jumps over the lazy dog';

test('Data received on FakeSocket', async () => {
    const [from, to] = FakeSocket.createPair()

    let result = await new Promise((accept, reject) => {
        let body = '';
        to.on('data', data => body += data)
        to.on('end', () => accept(body))
        to.on('error', reject);

        from.end(testData);
    });

    expect(result).toBe(testData);
})

test('Multi-chunk data received on FakeSocket', async () => {
    const [from, to] = FakeSocket.createPair()

    let result = await new Promise((accept, reject) => {
        let body = '';
        to.on('data', data => body += data)
        to.on('end', () => accept(body))
        to.on('error', reject);

        from.write('foo');
        from.end('bar');
    });

    expect(result).toBe('foobar');
})

test('Error received on FakeSocket', async () => {
    const [from, to] = FakeSocket.createPair()

    await expect(new Promise((accept, reject) => {
        to.on('error', reject);

        from.write(testData);
        from.destroy(new Error('socket error'));
    })).rejects.toThrowError('socket error');
})