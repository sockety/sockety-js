import * as net from 'node:net';
import * as tls from 'node:tls';
import { isTlsServer } from '../../src/utils/isTlsServer';

describe('utils', () => {
  describe('isTlsServer', () => {
    it('should accept TLS socket', () => {
      expect(isTlsServer(tls.createServer())).toBe(true);
    });

    it('should reject regular TCP socket', () => {
      expect(isTlsServer(new net.Server())).toBe(false);
    });
  });
});
