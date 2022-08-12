import { Socket, SocketConstructorOpts } from 'net';
import { Duplex, PassThrough, Readable, Writable } from 'stream';

export class InterceptedSocket extends Socket {
    readonly _readable: Readable;
    readonly _writable: Writable;

    constructor(options?: SocketConstructorOpts) {
        super(options);
        this._readable = new PassThrough();
        this._writable = new PassThrough();

        const duplex = Duplex.from({ readable: this._readable, writable: this._writable })

        // Redirect socket to duplex
        for (const field in duplex) {
            const fieldValue = (duplex as any)[field];
            if (typeof fieldValue == 'function') {
                (this as any)[field] = fieldValue.bind(duplex);
            }
        }
    }
}