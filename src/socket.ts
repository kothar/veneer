import { Socket, SocketConnectOpts } from 'net';

export class InterceptedSocket extends Socket {
    intercept(realSocket: Socket) {

    }

    override connect(...args: [any]): this {

        return super.connect(...args);
    }
}