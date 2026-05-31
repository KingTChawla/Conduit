import {NativeModules} from 'react-native';

const {ForegroundServiceModule} = NativeModules;
if (!ForegroundServiceModule) throw new Error('ForegroundServiceModule native module not linked');

export const ForegroundService = {
  startService: (): Promise<void> => ForegroundServiceModule.startService(),
  stopService: (): Promise<void> => ForegroundServiceModule.stopService(),
  updatePeerCount: (count: number): void =>
    ForegroundServiceModule.updatePeerCount(count),
};
