import {NativeModules} from 'react-native';

const {ProxyServerModule} = NativeModules;
if (!ProxyServerModule) throw new Error('ProxyServerModule native module not linked');

export interface ProxyInfo {
  port: number;
  address: string;
}

export interface ProxyStats {
  activeConnections: number;
  totalConnections: number;
  bytesTransferred: number;
}

export const ProxyServer = {
  startServer: (port: number): Promise<ProxyInfo> =>
    ProxyServerModule.startServer(port),
  stopServer: (): Promise<boolean> => ProxyServerModule.stopServer(),
  getStats: (): Promise<ProxyStats> => ProxyServerModule.getStats(),
};
