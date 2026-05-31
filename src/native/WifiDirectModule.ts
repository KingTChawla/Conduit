import {NativeModules, NativeEventEmitter} from 'react-native';

const {WifiDirectModule} = NativeModules;
if (!WifiDirectModule) throw new Error('WifiDirectModule native module not linked');

export interface GroupInfo {
  ssid: string;
  ip: string;
}

export interface GroupDetails {
  ssid: string;
  isGroupOwner: boolean;
  clientCount: number;
}

export interface Prerequisites {
  wifiEnabled: boolean;
  locationEnabled: boolean;
  p2pAvailable: boolean;
}

export const WifiDirect = {
  createGroup: (ssid: string, passphrase: string, band: number): Promise<GroupInfo> =>
    WifiDirectModule.createGroup(ssid, passphrase, band),
  removeGroup: (): Promise<void> => WifiDirectModule.removeGroup(),
  getGroupInfo: (): Promise<GroupDetails> => WifiDirectModule.getGroupInfo(),
  checkPrerequisites: (): Promise<Prerequisites> =>
    WifiDirectModule.checkPrerequisites(),
  enableWifi: (): Promise<void> => WifiDirectModule.enableWifi(),
};

export const WifiDirectEvents = new NativeEventEmitter(WifiDirectModule);
