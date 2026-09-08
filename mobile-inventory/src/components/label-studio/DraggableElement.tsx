import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { RotateCw, Lock, Unlock, Copy, Trash2 } from 'lucide-react-native';
import { BRAND_COLORS } from '@/constants/theme';

export interface ElementBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation?: number;
  locked?: boolean;
}

interface DraggableElementProps extends ElementBox {
  /** Canvas zoom — pixels rendered per real millimeter. */
  pxPerMm: number;
  selected: boolean;
  onSelect: () => void;
  onDoubleTap?: () => void;
  onChange: (next: ElementBox) => void;
  /** Fires once per gesture (not per frame) — the right place to push an undo-history snapshot. */
  onCommit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  /** Fires when any gesture (drag, resize, pinch, rotate) starts — useful to disable canvas scroll. */
  onGestureStart?: () => void;
  /** Fires when the active gesture concludes — restores canvas scroll. */
  onGestureEnd?: () => void;
  minWidthMm?: number;
  minHeightMm?: number;
  /** The label's own size — drag/resize clamp to keep the element fully on the printable area. */
  boundsWidthMm: number;
  boundsHeightMm: number;
  children: React.ReactNode;
}

export function DraggableElement({
  xMm,
  yMm,
  widthMm,
  heightMm,
  rotation = 0,
  locked = false,
  pxPerMm,
  selected,
  onSelect,
  onDoubleTap,
  onChange,
  onCommit,
  onDuplicate,
  onDelete,
  onGestureStart,
  onGestureEnd,
  minWidthMm = 2,
  minHeightMm = 2,
  boundsWidthMm,
  boundsHeightMm,
  children,
}: DraggableElementProps) {
  // Live offsets driven purely on UI thread during active gesture
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const growWidth = useSharedValue(0);
  const growHeight = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const liveRotation = useSharedValue(rotation);
  const isRotating = useSharedValue(false);

  // Sync prop changes
  liveRotation.value = rotation;

  const commitBox = (next: ElementBox) => {
    onChange(next);
    onCommit?.();
  };

  const handleGestureStart = () => {
    onGestureStart?.();
  };

  const handleGestureEnd = () => {
    onGestureEnd?.();
  };

  const handleToggleLock = () => {
    commitBox({ xMm, yMm, widthMm, heightMm, rotation, locked: !locked });
  };

  const handleRotate90 = () => {
    if (locked) return;
    const nextRot = (Math.round((rotation + 90) / 90) * 90) % 360;
    commitBox({ xMm, yMm, widthMm, heightMm, rotation: nextRot, locked });
  };

  const makeResizeGesture = (handle: 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 't' | 'b') =>
    Gesture.Pan()
      .minDistance(1)
      .enabled(!locked)
      .onBegin(() => {
        if (onGestureStart) runOnJS(handleGestureStart)();
      })
      .onUpdate((e) => {
        const dx = e.translationX;
        const dy = e.translationY;
        if (handle === 'br' || handle === 'tr' || handle === 'r') {
          growWidth.value = dx;
        } else if (handle === 'bl' || handle === 'tl' || handle === 'l') {
          growWidth.value = -dx;
          shiftX.value = dx;
        }
        if (handle === 'bl' || handle === 'br' || handle === 'b') {
          growHeight.value = dy;
        } else if (handle === 'tl' || handle === 'tr' || handle === 't') {
          growHeight.value = -dy;
          shiftY.value = dy;
        }
      })
      .onEnd((e) => {
        const dxMm = e.translationX / pxPerMm;
        const dyMm = e.translationY / pxPerMm;
        const nextBox: ElementBox = { xMm, yMm, widthMm, heightMm, rotation, locked };

        if (handle === 'br' || handle === 'tr' || handle === 'r') {
          nextBox.widthMm = Math.max(minWidthMm, Math.min(widthMm + dxMm, boundsWidthMm - xMm));
        } else if (handle === 'bl' || handle === 'tl' || handle === 'l') {
          nextBox.widthMm = Math.max(minWidthMm, widthMm - dxMm);
          nextBox.xMm = Math.max(0, xMm + (widthMm - nextBox.widthMm));
        }
        if (handle === 'bl' || handle === 'br' || handle === 'b') {
          nextBox.heightMm = Math.max(minHeightMm, Math.min(heightMm + dyMm, boundsHeightMm - yMm));
        } else if (handle === 'tl' || handle === 'tr' || handle === 't') {
          nextBox.heightMm = Math.max(minHeightMm, heightMm - dyMm);
          nextBox.yMm = Math.max(0, yMm + (heightMm - nextBox.heightMm));
        }

        growWidth.value = 0;
        growHeight.value = 0;
        shiftX.value = 0;
        shiftY.value = 0;
        runOnJS(commitBox)(nextBox);
        if (onGestureEnd) runOnJS(handleGestureEnd)();
      })
      .onFinalize(() => {
        growWidth.value = 0;
        growHeight.value = 0;
        shiftX.value = 0;
        shiftY.value = 0;
        if (onGestureEnd) runOnJS(handleGestureEnd)();
      });

  // Konva-Style Top Rotation Gesture
  const rotateGesture = Gesture.Pan()
    .enabled(!locked)
    .onBegin(() => {
      isRotating.value = true;
      if (onGestureStart) runOnJS(handleGestureStart)();
    })
    .onUpdate((e) => {
      const currentWidth = widthMm * pxPerMm;
      const currentHeight = heightMm * pxPerMm;
      const cx = currentWidth / 2;
      const cy = currentHeight / 2;
      const touchX = cx + e.translationX;
      const touchY = -24 + e.translationY; // knob starts 24px above top center

      const rad = Math.atan2(touchY - cy, touchX - cx);
      let deg = (rad * 180) / Math.PI + 90; // offset so top = 0 deg
      if (deg < 0) deg += 360;

      // Smart snapping within 6 degrees of 0, 90, 180, 270
      const snapThreshold = 6;
      const rightAngles = [0, 90, 180, 270, 360];
      for (const ra of rightAngles) {
        if (Math.abs(deg - ra) < snapThreshold) {
          deg = ra % 360;
          break;
        }
      }

      liveRotation.value = Math.round(deg);
    })
    .onEnd(() => {
      isRotating.value = false;
      const finalRot = liveRotation.value % 360;
      runOnJS(commitBox)({ xMm, yMm, widthMm, heightMm, rotation: finalRot, locked });
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    })
    .onFinalize(() => {
      isRotating.value = false;
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    });

  const tlGesture = makeResizeGesture('tl');
  const trGesture = makeResizeGesture('tr');
  const blGesture = makeResizeGesture('bl');
  const brGesture = makeResizeGesture('br');
  const lGesture = makeResizeGesture('l');
  const rGesture = makeResizeGesture('r');
  const tGesture = makeResizeGesture('t');
  const bGesture = makeResizeGesture('b');

  // Two-Finger Pinch-to-Resize Gesture (scales element directly with fingers)
  const pinchGesture = Gesture.Pinch()
    .enabled(!locked && selected)
    .onBegin(() => {
      pinchScale.value = 1;
      if (onGestureStart) runOnJS(handleGestureStart)();
    })
    .onUpdate((e) => {
      pinchScale.value = e.scale;
    })
    .onEnd((e) => {
      const finalScale = e.scale;
      pinchScale.value = 1;
      const newWidth = Math.max(minWidthMm, Math.min(widthMm * finalScale, boundsWidthMm - xMm));
      const newHeight = Math.max(minHeightMm, Math.min(heightMm * finalScale, boundsHeightMm - yMm));
      const nextBox: ElementBox = {
        xMm,
        yMm,
        widthMm: Math.round(newWidth * 10) / 10,
        heightMm: Math.round(newHeight * 10) / 10,
        rotation,
        locked,
      };
      runOnJS(commitBox)(nextBox);
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    })
    .onFinalize(() => {
      pinchScale.value = 1;
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd(() => {
      if (onDoubleTap) {
        runOnJS(onDoubleTap)();
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onSelect)();
    });

  // Body Move Pan Gesture
  const moveGesture = Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-4, 4])
    .activeOffsetY([-4, 4])
    .onBegin(() => {
      runOnJS(onSelect)();
      if (onGestureStart) runOnJS(handleGestureStart)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const nextBox: ElementBox = {
        xMm: Math.max(0, Math.min(boundsWidthMm - widthMm, xMm + e.translationX / pxPerMm)),
        yMm: Math.max(0, Math.min(boundsHeightMm - heightMm, yMm + e.translationY / pxPerMm)),
        widthMm,
        heightMm,
        rotation,
        locked,
      };
      translateX.value = 0;
      translateY.value = 0;
      runOnJS(commitBox)(nextBox);
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    })
    .onFinalize(() => {
      translateX.value = 0;
      translateY.value = 0;
      if (onGestureEnd) runOnJS(handleGestureEnd)();
    });

  // Simultaneous pinch + tap/move on the body content area
  const bodyTapAndDrag = Gesture.Exclusive(doubleTapGesture, moveGesture, singleTapGesture);
  const composedBodyGesture = Gesture.Simultaneous(pinchGesture, bodyTapAndDrag);

  const baseLeft = xMm * pxPerMm;
  const baseTop = yMm * pxPerMm;
  const baseWidth = widthMm * pxPerMm;
  const baseHeight = heightMm * pxPerMm;

  const wrapperStyle = useAnimatedStyle(() => ({
    left: baseLeft + shiftX.value,
    top: baseTop + shiftY.value,
    width: Math.max(baseWidth + growWidth.value, minWidthMm * pxPerMm) * pinchScale.value,
    height: Math.max(baseHeight + growHeight.value, minHeightMm * pxPerMm) * pinchScale.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${liveRotation.value}deg` },
    ],
  }));

  const handleTouchSize = 36;
  const handleDotSize = 12;
  const edgeHandleW = 16;
  const edgeHandleH = 10;
  const handleOffset = -handleTouchSize / 2;

  const cornerPositions: Record<'tl' | 'tr' | 'bl' | 'br', ViewStyle> = {
    tl: { left: handleOffset, top: handleOffset },
    tr: { right: handleOffset, top: handleOffset },
    bl: { left: handleOffset, bottom: handleOffset },
    br: { right: handleOffset, bottom: handleOffset },
  };
  const cornerGestures: Record<'tl' | 'tr' | 'bl' | 'br', ReturnType<typeof makeResizeGesture>> = {
    tl: tlGesture,
    tr: trGesture,
    bl: blGesture,
    br: brGesture,
  };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        wrapperStyle,
        {
          borderColor: selected ? (locked ? '#F59E0B' : '#3B82F6') : 'transparent',
          borderWidth: selected ? 1.5 : 0,
          borderStyle: locked ? 'dashed' : 'solid',
        },
      ]}
    >
      {/* Body Area with tap, drag, double-tap, and pinch-to-resize */}
      <GestureDetector gesture={composedBodyGesture}>
        <Animated.View style={styles.bodyContent} collapsable={false}>
          {children}

          {/* Lock indicator badge when locked */}
          {locked && (
            <View style={styles.lockBadge}>
              <Lock size={10} color="#FFFFFF" />
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Handles & Control Overlay — rendered outside body gesture with pointerEvents="box-none" */}
      {selected && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Konva-Style Quick Action Floating Toolbar */}
          <View style={styles.floatingToolbar} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.toolBtn, locked && styles.toolBtnActive]}
              onPress={handleToggleLock}
              activeOpacity={0.7}
            >
              {locked ? <Lock size={12} color="#F59E0B" /> : <Unlock size={12} color="#475569" />}
            </TouchableOpacity>

            {!locked && (
              <TouchableOpacity style={styles.toolBtn} onPress={handleRotate90} activeOpacity={0.7}>
                <RotateCw size={12} color="#475569" />
              </TouchableOpacity>
            )}

            {onDuplicate && (
              <TouchableOpacity style={styles.toolBtn} onPress={onDuplicate} activeOpacity={0.7}>
                <Copy size={12} color="#475569" />
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity style={[styles.toolBtn, styles.toolBtnDanger]} onPress={onDelete} activeOpacity={0.7}>
                <Trash2 size={12} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {/* Konva Top Rotation Handle & Stem (Only shown when unlocked) */}
          {!locked && (
            <View style={styles.rotationStemContainer} pointerEvents="box-none">
              <View style={styles.rotationStem} />
              <GestureDetector gesture={rotateGesture}>
                <Animated.View style={styles.rotationKnob} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <RotateCw size={11} color="#3B82F6" />
                </Animated.View>
              </GestureDetector>
            </View>
          )}

          {/* 4 Corner Handles (Only shown when unlocked) */}
          {!locked &&
            (['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <GestureDetector key={corner} gesture={cornerGestures[corner]}>
                <Animated.View
                  style={[
                    styles.handleContainer,
                    { width: handleTouchSize, height: handleTouchSize },
                    cornerPositions[corner],
                  ]}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                >
                  <Animated.View
                    style={[
                      styles.handleDot,
                      { width: handleDotSize, height: handleDotSize, borderRadius: handleDotSize / 2 },
                    ]}
                  />
                </Animated.View>
              </GestureDetector>
            ))}

          {/* 4 Edge Middle Handles (Konva style pill anchors) */}
          {!locked && (
            <>
              {/* Top Center */}
              <GestureDetector gesture={tGesture}>
                <Animated.View
                  style={[styles.edgeAnchorH, { top: -edgeHandleH / 2 }]}
                  hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                >
                  <View style={styles.edgePillH} />
                </Animated.View>
              </GestureDetector>
              {/* Bottom Center */}
              <GestureDetector gesture={bGesture}>
                <Animated.View
                  style={[styles.edgeAnchorH, { bottom: -edgeHandleH / 2 }]}
                  hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
                >
                  <View style={styles.edgePillH} />
                </Animated.View>
              </GestureDetector>
              {/* Left Center */}
              <GestureDetector gesture={lGesture}>
                <Animated.View
                  style={[styles.edgeAnchorV, { left: -edgeHandleW / 2 }]}
                  hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
                >
                  <View style={styles.edgePillV} />
                </Animated.View>
              </GestureDetector>
              {/* Right Center */}
              <GestureDetector gesture={rGesture}>
                <Animated.View
                  style={[styles.edgeAnchorV, { right: -edgeHandleW / 2 }]}
                  hitSlop={{ top: 12, bottom: 12, left: 14, right: 14 }}
                >
                  <View style={styles.edgePillV} />
                </Animated.View>
              </GestureDetector>
            </>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    borderRadius: 3,
  },
  bodyContent: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  handleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  handleDot: {
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  /* Konva Top Rotation Knob & Connector Stem */
  rotationStemContainer: {
    position: 'absolute',
    top: -28,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 28,
    alignItems: 'center',
    zIndex: 1000,
  },
  rotationStem: {
    position: 'absolute',
    top: 14,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#3B82F6',
  },
  rotationKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 6,
  },
  /* Edge Middle Pill Handles */
  edgeAnchorH: {
    position: 'absolute',
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
  },
  edgePillH: {
    width: 14,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  edgeAnchorV: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    width: 16,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
  },
  edgePillV: {
    width: 7,
    height: 14,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
    borderWidth: 1.2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 4,
  },
  /* Floating Mini Toolbar */
  floatingToolbar: {
    position: 'absolute',
    top: -48,
    left: '50%',
    transform: [{ translateX: -54 }],
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 7,
    zIndex: 1002,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  toolBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  toolBtnActive: {
    backgroundColor: '#FEF3C7',
  },
  toolBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  lockBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 999,
  },
});
