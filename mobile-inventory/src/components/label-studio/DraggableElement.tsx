import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { BRAND_COLORS } from '@/constants/theme';

export interface ElementBox {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
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
  pxPerMm,
  selected,
  onSelect,
  onDoubleTap,
  onChange,
  onCommit,
  minWidthMm = 2,
  minHeightMm = 2,
  boundsWidthMm,
  boundsHeightMm,
  children,
}: DraggableElementProps) {
  // Live offsets applied on top of the "resting" (committed) box below, driven purely on the UI
  // thread while a gesture is active. Reset to 0 the instant a gesture ends, at the same moment the
  // real xMm/yMm/widthMm/heightMm props update to include that offset — so there's no visual jump.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const growWidth = useSharedValue(0);
  const growHeight = useSharedValue(0);
  const shiftX = useSharedValue(0);
  const shiftY = useSharedValue(0);

  const commitBox = (next: ElementBox) => {
    onChange(next);
    onCommit?.();
  };

  const makeResizeGesture = (handle: 'tl' | 'tr' | 'bl' | 'br' | 'l' | 'r' | 't' | 'b') =>
    Gesture.Pan()
      .minDistance(1)
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
        const nextBox: ElementBox = { xMm, yMm, widthMm, heightMm };

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
      });

  const tlGesture = makeResizeGesture('tl');
  const trGesture = makeResizeGesture('tr');
  const blGesture = makeResizeGesture('bl');
  const brGesture = makeResizeGesture('br');

  const lGesture = makeResizeGesture('l');
  const rGesture = makeResizeGesture('r');
  const tGesture = makeResizeGesture('t');
  const bGesture = makeResizeGesture('b');

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

  const moveGesture = Gesture.Pan()
    .blocksExternalGesture(tlGesture, trGesture, blGesture, brGesture, lGesture, rGesture, tGesture, bGesture)
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      runOnJS(onSelect)();
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
      };
      translateX.value = 0;
      translateY.value = 0;
      runOnJS(commitBox)(nextBox);
    });

  // Compose tap and move gestures
  const composedBodyGesture = Gesture.Exclusive(doubleTapGesture, moveGesture, singleTapGesture);

  const baseLeft = xMm * pxPerMm;
  const baseTop = yMm * pxPerMm;
  const baseWidth = widthMm * pxPerMm;
  const baseHeight = heightMm * pxPerMm;

  const wrapperStyle = useAnimatedStyle(() => ({
    left: baseLeft + shiftX.value,
    top: baseTop + shiftY.value,
    width: Math.max(baseWidth + growWidth.value, minWidthMm * pxPerMm),
    height: Math.max(baseHeight + growHeight.value, minHeightMm * pxPerMm),
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleTouchSize = 34;
  const handleDotSize = 13;
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
    <GestureDetector gesture={composedBodyGesture}>
      <Animated.View
        style={[
          styles.wrapper,
          wrapperStyle,
          {
            borderColor: selected ? '#64748B' : 'transparent',
            borderWidth: selected ? 1.5 : 0,
            borderStyle: 'solid',
          },
        ]}
      >
        {children}

        {selected ? (
          <>
            {/* 4 Corner Round Handles matching reference design */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <GestureDetector key={corner} gesture={cornerGestures[corner]}>
                <Animated.View
                  style={[
                    styles.handleContainer,
                    { width: handleTouchSize, height: handleTouchSize },
                    cornerPositions[corner],
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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

            {/* Top / Bottom Edge Touch Drag Zones */}
            <GestureDetector gesture={tGesture}>
              <Animated.View style={[styles.edgeTouchH, { top: -14 }]} hitSlop={{ top: 8, bottom: 8 }} />
            </GestureDetector>
            <GestureDetector gesture={bGesture}>
              <Animated.View style={[styles.edgeTouchH, { bottom: -14 }]} hitSlop={{ top: 8, bottom: 8 }} />
            </GestureDetector>
            {/* Left / Right Edge Touch Drag Zones */}
            <GestureDetector gesture={lGesture}>
              <Animated.View style={[styles.edgeTouchV, { left: -14 }]} hitSlop={{ left: 8, right: 8 }} />
            </GestureDetector>
            <GestureDetector gesture={rGesture}>
              <Animated.View style={[styles.edgeTouchV, { right: -14 }]} hitSlop={{ left: 8, right: 8 }} />
            </GestureDetector>
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    borderRadius: 4,
  },
  handleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  handleDot: {
    backgroundColor: '#94A3B8',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 4,
  },
  edgeTouchH: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 28,
    zIndex: 998,
  },
  edgeTouchV: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    width: 28,
    zIndex: 998,
  },
});
