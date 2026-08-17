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
  onChange: (next: ElementBox) => void;
  /** Fires once per gesture (not per frame) — the right place to push an undo-history snapshot. */
  onCommit?: () => void;
  minWidthMm?: number;
  minHeightMm?: number;
  children: React.ReactNode;
}

/**
 * A freely draggable, corner-resizable element on the Label Studio canvas. Position/size are
 * always in mm (resolution-independent — the same unit the print pipeline and saved template use),
 * converted to on-screen pixels only via `pxPerMm`.
 *
 * Drag/resize now run as genuine UI-thread worklets via reanimated shared values — the wrapper's
 * on-screen transform updates every frame without ever crossing the JS bridge, which is what makes
 * this feel smooth. The previous version used `.runOnJS(true)` on every gesture callback (so each
 * pan update round-tripped: native -> JS -> React state -> re-render -> new gesture object -> back
 * to native), which is what made dragging feel laggy. JS state (the real xMm/yMm/widthMm/heightMm
 * that get saved) now only updates once, via `runOnJS`, when a gesture actually ends — during the
 * drag itself, only `translateX`/`translateY`/width/height shared values move, entirely on the UI
 * thread. `useSharedValue` mutation is unaffected by this project's React Compiler `react-hooks/refs`
 * rule — that rule targets plain `useRef`, not reanimated's shared values, which are worklet-safe by
 * design (confirmed already in use elsewhere in this app, e.g. print-animation-modal.tsx).
 */
export function DraggableElement({
  xMm,
  yMm,
  widthMm,
  heightMm,
  pxPerMm,
  selected,
  onSelect,
  onChange,
  onCommit,
  minWidthMm = 3,
  minHeightMm = 3,
  children,
}: DraggableElementProps) {
  // Live offsets applied on top of the "resting" (committed) box below, driven purely on the UI
  // thread while a gesture is active. Reset to 0 the instant a gesture ends, at the same moment the
  // real xMm/yMm/widthMm/heightMm props update to include that offset — so there's no visual jump.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const growWidth = useSharedValue(0);
  const growHeight = useSharedValue(0);
  const shiftX = useSharedValue(0); // extra left-edge shift for handles that resize from the left (tl/bl)
  const shiftY = useSharedValue(0); // extra top-edge shift for handles that resize from the top (tl/tr)

  const commitBox = (next: ElementBox) => {
    onChange(next);
    onCommit?.();
  };

  const moveGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(onSelect)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const nextBox: ElementBox = {
        xMm: Math.max(0, xMm + e.translationX / pxPerMm),
        yMm: Math.max(0, yMm + e.translationY / pxPerMm),
        widthMm,
        heightMm,
      };
      translateX.value = 0;
      translateY.value = 0;
      runOnJS(commitBox)(nextBox);
    });

  const makeResizeGesture = (corner: 'tl' | 'tr' | 'bl' | 'br') =>
    Gesture.Pan()
      .onUpdate((e) => {
        const dx = e.translationX;
        const dy = e.translationY;
        if (corner === 'br' || corner === 'tr') {
          growWidth.value = dx;
        } else {
          growWidth.value = -dx;
          shiftX.value = dx;
        }
        if (corner === 'bl' || corner === 'br') {
          growHeight.value = dy;
        } else {
          growHeight.value = -dy;
          shiftY.value = dy;
        }
      })
      .onEnd((e) => {
        const dxMm = e.translationX / pxPerMm;
        const dyMm = e.translationY / pxPerMm;
        const nextBox: ElementBox = { xMm, yMm, widthMm, heightMm };

        if (corner === 'br' || corner === 'tr') {
          nextBox.widthMm = Math.max(minWidthMm, widthMm + dxMm);
        } else {
          nextBox.widthMm = Math.max(minWidthMm, widthMm - dxMm);
          nextBox.xMm = Math.max(0, xMm + (widthMm - nextBox.widthMm));
        }
        if (corner === 'bl' || corner === 'br') {
          nextBox.heightMm = Math.max(minHeightMm, heightMm + dyMm);
        } else {
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


  const baseLeft = xMm * pxPerMm;
  const baseTop = yMm * pxPerMm;
  const baseWidth = widthMm * pxPerMm;
  const baseHeight = heightMm * pxPerMm;

  const wrapperStyle = useAnimatedStyle(() => ({
    left: baseLeft + shiftX.value,
    top: baseTop + shiftY.value,
    width: baseWidth + growWidth.value,
    height: baseHeight + growHeight.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleSize = 20;
  const handleOffset = -handleSize / 2;
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
    <GestureDetector gesture={moveGesture}>
      <Animated.View style={[styles.wrapper, wrapperStyle, { borderColor: selected ? BRAND_COLORS.blue600 : 'transparent' }]}>
        {children}

        {selected ? (
          <>
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <GestureDetector key={corner} gesture={cornerGestures[corner]}>
                <Animated.View
                  style={[
                    styles.handle,
                    { width: handleSize, height: handleSize, borderRadius: handleSize / 2 },
                    cornerPositions[corner],
                  ]}
                />
              </GestureDetector>
            ))}
          </>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  handle: {
    position: 'absolute',
    backgroundColor: BRAND_COLORS.blue600,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
