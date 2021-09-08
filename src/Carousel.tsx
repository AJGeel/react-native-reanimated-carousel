import React from 'react';
import type { FlexStyle, ViewStyle } from 'react-native';
import {
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedGestureHandler,
    useAnimatedReaction,
    useDerivedValue,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { CarouselItem } from './CarouselItem';
import { fillNum } from './fillNum';
import type { TMode } from './layouts';
import { ParallaxLayout } from './layouts/index';
import { useCarouselController } from './useCarouselController';
import { useComputedAnim } from './useComputedAnim';
import { useLoop } from './useLoop';
import { useComputedIndex } from './useComputedIndex';

export const _withTiming = (
    num: number,
    callback?: (isFinished: boolean) => void
) => {
    'worklet';
    return withTiming(
        num,
        {
            duration: 250,
        },
        (isFinished) => {
            !!callback && runOnJS(callback)(isFinished);
        }
    );
};

export interface ICarouselProps<T extends unknown> {
    ref?: React.Ref<ICarouselInstance>;
    /**
     * Carousel loop playback.
     * @default true
     */
    loop?: boolean;
    /**
     * Carousel Animated transitions.
     * @default 'default'
     */
    mode?: TMode;
    /**
     * Render carousel item.
     */
    renderItem: (data: T, index: number) => React.ReactNode;
    /**
     * Specified carousel container width.
     */
    width: number;
    /**
     * Specified carousel container height.
     * @default '100%'
     */
    height?: FlexStyle['height'];
    /**
     * Carousel items data set.
     */
    data: T[];
    /**
     * Auto play
     */
    autoPlay?: boolean;
    /**
     * Auto play
     * @description reverse playback
     */
    autoPlayReverse?: boolean;
    /**
     * Auto play
     * @description playback interval
     */
    autoPlayInterval?: number;
    /**
     * Carousel container style
     */
    style?: ViewStyle;
    /**
     * When use 'default' Layout props,this prop can be control prev/next item offset.
     * @default 100
     */
    parallaxScrollingOffset?: number;
    /**
     * When use 'default' Layout props,this prop can be control prev/next item offset.
     * @default 0.8
     */
    parallaxScrollingScale?: number;
    /**
     * Callback fired when navigating to an item
     */
    onSnapToItem?: (index: number) => void;
}

export interface ICarouselInstance {
    /**
     * Play the last one
     */
    prev: () => void;
    /**
     * Play the next one
     */
    next: () => void;
    /**
     * Get current item index
     */
    getCurrentIndex: () => number;
}

function Carousel<T extends unknown = any>(
    props: ICarouselProps<T>,
    ref: React.Ref<ICarouselInstance>
) {
    const {
        height = '100%',
        data: _data = [],
        width,
        loop = true,
        mode = 'default',
        renderItem,
        autoPlay,
        autoPlayReverse,
        autoPlayInterval,
        parallaxScrollingOffset,
        parallaxScrollingScale,
        onSnapToItem,
        style,
    } = props;
    const handlerOffsetX = useSharedValue<number>(0);
    const data = React.useMemo<T[]>(() => {
        if (!loop) return _data;

        if (_data.length === 1) {
            return [_data[0], _data[0], _data[0]];
        }

        if (_data.length === 2) {
            return [_data[0], _data[1], _data[0], _data[1]];
        }

        return _data;
    }, [_data, loop]);

    const computedAnimResult = useComputedAnim(width, data.length);
    const carouselController = useCarouselController({
        width,
        handlerOffsetX,
        disable: !data.length,
    });
    useLoop({
        autoPlay,
        autoPlayInterval,
        autoPlayReverse,
        carouselController,
    });
    const { index, computedIndex } = useComputedIndex({
        length: data.length,
        handlerOffsetX,
        width,
    });

    const offsetX = useDerivedValue(() => {
        const x = handlerOffsetX.value % computedAnimResult.WL;
        return isNaN(x) ? 0 : x;
    }, [computedAnimResult]);

    useAnimatedReaction(
        () => index.value,
        (i) => {
            if (loop) {
                switch (_data.length) {
                    case 1:
                        i = 0;
                        break;
                    case 2:
                        i = i % 2;
                        break;
                }
                onSnapToItem && runOnJS(onSnapToItem)(i);
            }
        },
        [onSnapToItem, loop, _data]
    );

    const callComputedIndex = React.useCallback(
        (isFinished: boolean) => isFinished && computedIndex?.(),
        [computedIndex]
    );

    const next = React.useCallback(() => {
        return carouselController.next(callComputedIndex);
    }, [carouselController, callComputedIndex]);

    const prev = React.useCallback(() => {
        return carouselController.prev(callComputedIndex);
    }, [carouselController, callComputedIndex]);

    const getCurrentIndex = React.useCallback(() => {
        return index.value;
    }, [index]);

    const animatedListScrollHandler =
        useAnimatedGestureHandler<PanGestureHandlerGestureEvent>(
            {
                onStart: (_, ctx: any) => {
                    ctx.startContentOffsetX = handlerOffsetX.value;
                },
                onActive: (e, ctx: any) => {
                    if (loop) {
                        handlerOffsetX.value =
                            ctx.startContentOffsetX +
                            Math.round(e.translationX);
                        return;
                    }
                    handlerOffsetX.value = Math.max(
                        Math.min(
                            ctx.startContentOffsetX +
                                Math.round(e.translationX),
                            0
                        ),
                        -(data.length - 1) * width
                    );
                },
                onEnd: (e) => {
                    const intTranslationX = Math.round(e.translationX);
                    const sub = Math.abs(intTranslationX);

                    function _withTimingCallback(num: number) {
                        return _withTiming(num, callComputedIndex);
                    }

                    if (intTranslationX > 0) {
                        if (!loop && handlerOffsetX.value >= 0) {
                            return;
                        }

                        if (sub > width / 2) {
                            handlerOffsetX.value = _withTimingCallback(
                                fillNum(
                                    width,
                                    handlerOffsetX.value + (width - sub)
                                )
                            );
                        } else {
                            handlerOffsetX.value = _withTimingCallback(
                                fillNum(width, handlerOffsetX.value - sub)
                            );
                        }
                        return;
                    }

                    if (intTranslationX < 0) {
                        if (
                            !loop &&
                            handlerOffsetX.value <= -(data.length - 1) * width
                        ) {
                            return;
                        }

                        if (sub > width / 2) {
                            handlerOffsetX.value = _withTimingCallback(
                                fillNum(
                                    width,
                                    handlerOffsetX.value - (width - sub)
                                )
                            );
                        } else {
                            handlerOffsetX.value = _withTimingCallback(
                                fillNum(width, handlerOffsetX.value + sub)
                            );
                        }
                        return;
                    }
                },
            },
            [loop, data]
        );

    React.useImperativeHandle(ref, () => {
        return {
            next,
            prev,
            getCurrentIndex,
        };
    });

    const Layouts = React.useMemo<React.FC<{ index: number }>>(() => {
        switch (mode) {
            case 'parallax':
                return ({ index, children }) => (
                    <ParallaxLayout
                        parallaxScrollingOffset={parallaxScrollingOffset}
                        parallaxScrollingScale={parallaxScrollingScale}
                        computedAnimResult={computedAnimResult}
                        width={width}
                        handlerOffsetX={offsetX}
                        index={index}
                        key={index}
                        loop={loop}
                    >
                        {children}
                    </ParallaxLayout>
                );
            default:
                return ({ index, children }) => (
                    <CarouselItem
                        computedAnimResult={computedAnimResult}
                        width={width}
                        height={height}
                        handlerOffsetX={offsetX}
                        index={index}
                        key={index}
                        loop={loop}
                    >
                        {children}
                    </CarouselItem>
                );
        }
    }, [
        loop,
        mode,
        computedAnimResult,
        height,
        offsetX,
        parallaxScrollingOffset,
        parallaxScrollingScale,
        width,
    ]);

    return (
        <PanGestureHandler onHandlerStateChange={animatedListScrollHandler}>
            <Animated.View
                style={[
                    // eslint-disable-next-line react-native/no-inline-styles
                    {
                        width,
                        height,
                        flexDirection: 'row',
                        position: 'relative',
                    },
                    style,
                ]}
            >
                {data.map((item, index) => {
                    return (
                        <Layouts index={index} key={index}>
                            {renderItem(item, index)}
                        </Layouts>
                    );
                })}
            </Animated.View>
        </PanGestureHandler>
    );
}

export default React.forwardRef(Carousel) as typeof Carousel;
