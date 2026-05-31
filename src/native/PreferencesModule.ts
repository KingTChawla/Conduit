import {NativeModules} from 'react-native';

const {PreferencesModule} = NativeModules;
if (!PreferencesModule) throw new Error('PreferencesModule native module not linked');

export const Preferences = {
  getString: (key: string, fallback: string): Promise<string> =>
    PreferencesModule.getString(key, fallback),
  setString: (key: string, value: string): Promise<void> =>
    PreferencesModule.setString(key, value),
};
