import * as net from 'node:net';
import * as tls from 'node:tls';
import { isTlsSocket } from '../../src/utils/isTlsSocket';

describe('utils', () => {
  describe('isTlsSocket', () => {
    it('should accept TLS socket', () => {
      expect(isTlsSocket(new tls.TLSSocket(new net.Socket()))).toBe(true);
    });

    it('should reject regular TCP socket', () => {
      expect(isTlsSocket(new net.Socket())).toBe(false);
    });
  });
});
