import React, {useState, useEffect, useCallback} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {
  EyeIcon,
  EyeSlashIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon,
} from 'react-native-heroicons/outline';

import {useHotspot, PROXY_PORT} from './src/hooks/useHotspot';
import {PowerButton} from './src/components/PowerButton';
import {Preferences} from './src/native/PreferencesModule';

const C = {
  bgTop: '#000000',
  bgBottom: '#0a0a14',
  card: '#1c1c1e',
  cardBorder: '#2c2c2e',
  cardElevated: '#2c2c2e',
  accent: '#0a84ff',
  accentLight: '#64d2ff',
  green: '#30d158',
  greenDark: '#0a3d1a',
  greenSoft: 'rgba(48, 209, 88, 0.12)',
  orange: '#ff9f0a',
  orangeSoft: 'rgba(255, 159, 10, 0.12)',
  red: '#ff453a',
  redSoft: 'rgba(255, 69, 58, 0.12)',
  indigo: '#5e5ce6',
  teal: '#64d2ff',
  pink: '#ff375f',
  white: '#ffffff',
  label: '#ffffff',
  secondaryLabel: '#ebebf5',
  tertiaryLabel: 'rgba(235, 235, 245, 0.6)',
  quaternaryLabel: 'rgba(235, 235, 245, 0.3)',
  separator: 'rgba(84, 84, 88, 0.6)',
  fill: 'rgba(120, 120, 128, 0.2)',
  secondaryFill: 'rgba(120, 120, 128, 0.16)',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function App() {
  const [ssid, setSsid] = useState('Conduit');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [band, setBand] = useState<5 | 2>(5);
  const [_loaded, setLoaded] = useState(false);
  const {status, peerCount, error, stats, start, stop} = useHotspot();

  useEffect(() => {
    Promise.all([
      Preferences.getString('ssid', 'Conduit'),
      Preferences.getString('password', ''),
      Preferences.getString('band', '5'),
    ]).then(([savedSsid, savedPassword, savedBand]) => {
      setSsid(savedSsid);
      setPassword(savedPassword);
      setBand(savedBand === '2' ? 2 : 5);
      setLoaded(true);
    }).catch(e => {
      console.error('Failed to load preferences:', e);
      setLoaded(true);
    });
  }, []);

  const updateSsid = useCallback((value: string) => {
    setSsid(value);
    Preferences.setString('ssid', value).catch(console.error);
  }, []);

  const updatePassword = useCallback((value: string) => {
    setPassword(value);
    Preferences.setString('password', value).catch(console.error);
  }, []);

  const updateBand = useCallback((value: 5 | 2) => {
    setBand(value);
    Preferences.setString('band', String(value)).catch(console.error);
  }, []);

  const isActive = status === 'active';
  const isBusy = status === 'starting' || status === 'stopping';
  const canEdit = !isActive && !isBusy;

  const handleToggle = useCallback(() => {
    if (isActive) {
      stop();
    } else if (status === 'idle' || status === 'error') {
      if (password.length < 8) return;
      start(ssid, password, band);
    }
  }, [isActive, status, password, ssid, band, stop, start]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.bgTop} />
      <SafeAreaView style={s.safe}>
        <ScrollView
          style={s.container}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <Text style={s.title}>Conduit</Text>
          </View>

          {/* Setup Instructions */}
          <View style={s.infoCard}>
            <View style={s.infoHeader}>
              <InformationCircleIcon size={18} color={C.accent} />
              <Text style={s.infoTitle}>Client Setup</Text>
            </View>
            <View style={s.step}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>1</Text>
              </View>
              <Text style={s.stepText}>
                Connect to{' '}
                <Text style={s.highlight}>DIRECT-{ssid}</Text>
              </Text>
            </View>
            <View style={s.step}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>2</Text>
              </View>
              <Text style={s.stepText}>
                Wi-Fi Settings {'>'} Proxy {'>'} Manual
              </Text>
            </View>
            <View style={[s.step, s.stepLast]}>
              <View style={s.stepBadge}>
                <Text style={s.stepNum}>3</Text>
              </View>
              <Text style={s.stepText}>
                Host{' '}
                <Text style={s.highlight}>192.168.49.1</Text>
                {'  '}Port{' '}
                <Text style={s.highlight}>{PROXY_PORT}</Text>
              </Text>
            </View>
          </View>

          {/* SSID + Password */}
          <View style={s.card}>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Network Name</Text>
              <TextInput
                style={s.fieldInput}
                value={ssid}
                onChangeText={updateSsid}
                editable={canEdit}
                placeholderTextColor={C.quaternaryLabel}
                selectionColor={C.accent}
              />
            </View>
            <View style={s.fieldDivider} />
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Password</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.fieldInput, s.passwordField]}
                  value={password}
                  onChangeText={updatePassword}
                  editable={canEdit}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={C.quaternaryLabel}
                  selectionColor={C.accent}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(p => !p)}
                  hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
                  style={s.eyeBtn}>
                  {showPassword ? (
                    <EyeSlashIcon size={20} color={C.tertiaryLabel} />
                  ) : (
                    <EyeIcon size={20} color={C.tertiaryLabel} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {password.length > 0 && password.length < 8 && (
              <Text style={s.validationHint}>Minimum 8 characters required</Text>
            )}
          </View>

          {/* Band Selector */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Frequency Band</Text>
            <View style={s.segmentedControl}>
              <TouchableOpacity
                style={[s.segment, band === 5 && s.segmentActive]}
                onPress={() => canEdit && updateBand(5)}
                disabled={!canEdit}
                activeOpacity={0.7}>
                <Text
                  style={[
                    s.segmentText,
                    band === 5 && s.segmentTextActive,
                  ]}>
                  5 GHz
                </Text>
                {band === 5 && (
                  <Text style={s.segmentSub}>Faster speed</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.segment, band === 2 && s.segmentActive]}
                onPress={() => canEdit && updateBand(2)}
                disabled={!canEdit}
                activeOpacity={0.7}>
                <Text
                  style={[
                    s.segmentText,
                    band === 2 && s.segmentTextActive,
                  ]}>
                  2.4 GHz
                </Text>
                {band === 2 && (
                  <Text style={s.segmentSub}>Wider range</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Power Button */}
          <View style={s.powerArea}>
            {error && (
              <View style={s.errorPill}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <PowerButton status={status} onPress={handleToggle} />

            <Text style={[s.statusBadge, {color: isActive ? C.green : isBusy ? C.orange : C.accent}]}>
              {isBusy
                ? status === 'starting'
                  ? 'Starting...'
                  : 'Stopping...'
                : isActive
                ? 'Connected'
                : 'Start Hotspot'}
            </Text>
          </View>

          {/* Stats */}
          {isActive && (
            <View style={s.statsCard}>
              <View style={s.statCell}>
                <View style={[s.statIconBg, {backgroundColor: C.greenSoft}]}>
                  <UserGroupIcon size={18} color={C.green} />
                </View>
                <Text style={s.statValue}>{peerCount}</Text>
                <Text style={s.statLabel}>Peers</Text>
              </View>
              <View style={s.statSeparator} />
              <View style={s.statCell}>
                <View
                  style={[s.statIconBg, s.statIconBgIndigo]}>
                  <ArrowUpTrayIcon size={18} color={C.indigo} />
                </View>
                <Text style={s.statValue}>{formatBytes(stats.bytes)}</Text>
                <Text style={s.statLabel}>Transferred</Text>
              </View>
            </View>
          )}

          <View style={s.footer} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bgTop,
  },
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: C.white,
    letterSpacing: -0.5,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  fieldLabel: {
    color: C.label,
    fontSize: 16,
    fontWeight: '400',
    flex: 0.4,
  },
  fieldInput: {
    color: C.tertiaryLabel,
    fontSize: 16,
    textAlign: 'right',
    flex: 0.6,
    padding: 0,
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.separator,
    marginLeft: 0,
  },
  passwordRow: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordField: {
    flex: 1,
  },
  eyeBtn: {
    paddingLeft: 10,
  },
  validationHint: {
    color: C.red,
    fontSize: 12,
    paddingBottom: 10,
    paddingTop: 2,
  },

  sectionLabel: {
    color: C.tertiaryLabel,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingTop: 14,
    paddingBottom: 10,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: C.secondaryFill,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: C.cardElevated,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  segmentText: {
    color: C.tertiaryLabel,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: C.white,
  },
  segmentSub: {
    color: C.quaternaryLabel,
    fontSize: 10,
    marginTop: 2,
  },

  powerArea: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  errorPill: {
    backgroundColor: C.redSoft,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  errorText: {
    color: C.red,
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadge: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    letterSpacing: 0.3,
  },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 18,
    marginBottom: 14,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconBgIndigo: {
    backgroundColor: 'rgba(94, 92, 230, 0.12)',
  },
  statValue: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    color: C.quaternaryLabel,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  statSeparator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.separator,
    marginVertical: 4,
  },

  infoCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  infoTitle: {
    color: C.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepLast: {
    marginBottom: 0,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    color: C.tertiaryLabel,
    fontSize: 14,
    flex: 1,
  },
  highlight: {
    color: C.white,
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: 13,
  },

  footer: {
    height: 20,
  },
});

export default App;
