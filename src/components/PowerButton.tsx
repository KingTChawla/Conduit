import React, {useEffect, useMemo, useRef} from 'react';
import {StyleSheet, TouchableOpacity, Animated, useWindowDimensions} from 'react-native';
import {PowerIcon, WifiIcon} from 'react-native-heroicons/outline';
import {HotspotStatus} from '../hooks/useHotspot';

interface Props {
  status: HotspotStatus;
  onPress: () => void;
}

const COLORS: Record<HotspotStatus, string> = {
  idle: '#0a84ff',
  starting: '#ff9f0a',
  active: '#30d158',
  stopping: '#ff9f0a',
  error: '#ff453a',
};

const GLOW_COLORS: Record<HotspotStatus, string> = {
  idle: 'rgba(10, 132, 255, 0.08)',
  starting: 'rgba(255, 159, 10, 0.15)',
  active: 'rgba(48, 209, 88, 0.15)',
  stopping: 'rgba(255, 159, 10, 0.15)',
  error: 'rgba(255, 69, 58, 0.08)',
};

export function PowerButton({status, onPress}: Props) {
  const {width: SCREEN_W} = useWindowDimensions();
  const SIZE = Math.min(SCREEN_W * 0.52, 220);
  const ICON_SIZE = SIZE * 0.32;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const isBusy = status === 'starting' || status === 'stopping';
  const accent = COLORS[status];
  const glow = GLOW_COLORS[status];

  const glowStyle = useMemo(() => ({
    width: SIZE + 30,
    height: SIZE + 30,
    borderRadius: (SIZE + 30) / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: glow,
    transform: [{scale: pulseAnim}],
  }), [SIZE, glow, pulseAnim]);

  const ringStyle = useMemo(() => ({
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#0a0a14',
    shadowOffset: {width: 0, height: 0},
    elevation: 8,
    borderColor: accent,
    shadowColor: accent,
    shadowOpacity: status === 'active' ? 0.5 : 0.25,
    shadowRadius: status === 'active' ? 24 : 14,
    transform: [{scale: pulseAnim}],
  }), [SIZE, accent, status, pulseAnim]);

  useEffect(() => {
    if (isBusy) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.97,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      const fade = Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      fade.start();
      pulseRef.current = pulse;
      return () => {
        pulse.stop();
        fade.stop();
      };
    } else {
      pulseRef.current?.stop();
      Animated.parallel([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isBusy, pulseAnim, fadeAnim]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isBusy}
      activeOpacity={0.85}
      style={styles.touchable}>
      <Animated.View style={glowStyle}>
        <Animated.View style={ringStyle}>
          <Animated.View style={{opacity: fadeAnim}}>
            {isBusy || status === 'active' ? (
              <WifiIcon size={ICON_SIZE} color={accent} strokeWidth={1.4} />
            ) : (
              <PowerIcon size={ICON_SIZE} color={accent} strokeWidth={1.4} />
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
