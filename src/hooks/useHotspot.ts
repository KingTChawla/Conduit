import {useState, useEffect, useCallback, useRef} from 'react';
import {PermissionsAndroid, Platform, Linking} from 'react-native';
import {WifiDirect, WifiDirectEvents} from '../native/WifiDirectModule';
import {ProxyServer} from '../native/ProxyServerModule';
import {ForegroundService} from '../native/ForegroundServiceModule';

export type HotspotStatus = 'idle' | 'starting' | 'active' | 'stopping' | 'error';

export const PROXY_PORT = 8080;

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const sdkInt = Platform.Version;
  type AndroidPermission = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];
  const perms: AndroidPermission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];

  if (sdkInt >= 33) {
    perms.push('android.permission.NEARBY_WIFI_DEVICES' as AndroidPermission);
    perms.push('android.permission.POST_NOTIFICATIONS' as AndroidPermission);
  }

  const results = await PermissionsAndroid.requestMultiple(perms);

  const denied = Object.entries(results).filter(
    ([_, v]) => v !== PermissionsAndroid.RESULTS.GRANTED,
  );

  if (denied.length === 0) return true;

  const hasNeverAskAgain = denied.some(
    ([_, v]) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  );

  if (hasNeverAskAgain) {
    await Linking.openSettings();
    return false;
  }

  const retryResults = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(retryResults).every(
    r => r === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export function useHotspot() {
  const [status, setStatus] = useState<HotspotStatus>('idle');
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stats, setStats] = useState({active: 0, total: 0, bytes: 0});

  const updatePeerCount = useCallback((count: number) => {
    setPeerCount(count);
    ForegroundService.updatePeerCount(count);
  }, []);

  useEffect(() => {
    const sub1 = WifiDirectEvents.addListener('onPeerConnected', e => {
      updatePeerCount(e.count);
    });
    const sub2 = WifiDirectEvents.addListener('onPeerDisconnected', e => {
      updatePeerCount(e.count);
    });
    const sub3 = WifiDirectEvents.addListener('onGroupRemoved', () => {
      updatePeerCount(0);
    });
    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, [updatePeerCount]);

  const startPollingStats = useCallback(() => {
    statsInterval.current = setInterval(async () => {
      try {
        const s = await ProxyServer.getStats();
        setStats({
          active: s.activeConnections,
          total: s.totalConnections,
          bytes: s.bytesTransferred,
        });
      } catch (e) { console.warn('Stats polling error:', e); }
    }, 2000);
  }, []);

  const stopPollingStats = useCallback(() => {
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
  }, []);

  const start = useCallback(async (ssid: string, passphrase: string, band: number = 5) => {
    setError(null);
    setStatus('starting');

    try {
      console.log('[Conduit] Requesting permissions...');
      const granted = await requestPermissions();
      console.log('[Conduit] Permissions granted:', granted);
      if (!granted) {
        setError('Permissions required — check Settings and try again');
        setStatus('error');
        return;
      }

      console.log('[Conduit] Checking prerequisites...');
      const prereqs = await WifiDirect.checkPrerequisites();
      console.log('[Conduit] Prerequisites:', JSON.stringify(prereqs));

      if (!prereqs.wifiEnabled) {
        console.log('[Conduit] WiFi disabled, opening settings...');
        setError('Please enable WiFi, then try again');
        setStatus('error');
        await WifiDirect.enableWifi();
        return;
      }

      if (!prereqs.locationEnabled) {
        setError('Please enable Location services, then try again');
        setStatus('error');
        return;
      }

      console.log('[Conduit] Starting foreground service...');
      await ForegroundService.startService();
      console.log('[Conduit] Foreground service started');

      console.log('[Conduit] Creating WiFi Direct group... band=' + band);
      const group = await WifiDirect.createGroup(ssid, passphrase, band);
      console.log('[Conduit] Group created:', JSON.stringify(group));

      console.log('[Conduit] Starting proxy server on port', PROXY_PORT);
      const proxy = await ProxyServer.startServer(PROXY_PORT);
      console.log('[Conduit] Proxy started:', JSON.stringify(proxy));

      setProxyAddress(`${proxy.address}:${proxy.port}`);
      setStatus('active');
      startPollingStats();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start';
      const code = e instanceof Error && 'code' in e ? (e as Error & {code: unknown}).code : undefined;
      console.error('[Conduit] Error:', msg, code, e);
      setError(msg);
      setStatus('error');
      try { await ProxyServer.stopServer(); } catch {}
      try { await WifiDirect.removeGroup(); } catch {}
      try { await ForegroundService.stopService(); } catch {}
    }
  }, [startPollingStats]);

  const stop = useCallback(async () => {
    setStatus('stopping');
    stopPollingStats();
    try {
      await ProxyServer.stopServer();
      await WifiDirect.removeGroup();
      await ForegroundService.stopService();
      setStatus('idle');
      setProxyAddress(null);
      updatePeerCount(0);
      setStats({active: 0, total: 0, bytes: 0});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to stop');
      setStatus('error');
    }
  }, [stopPollingStats, updatePeerCount]);

  return {status, peerCount, error, proxyAddress, stats, start, stop};
}
