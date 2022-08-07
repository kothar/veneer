import { Socket, SocketConnectOpts, SocketConstructorOpts } from 'net';

export class InterceptedSocket extends Socket {

    constructor(options: SocketConstructorOpts) {
        super(options);
    }

    intercept(realSocket: Socket) {

    }
}