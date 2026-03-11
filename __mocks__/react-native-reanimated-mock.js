/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const React = require("react");
const ReactNative = require("react-native");

const identity = (value) => value;
const noOp = () => {};

function interpolate(value, inputRange, outputRange) {
  if (!Array.isArray(inputRange) || !Array.isArray(outputRange)) return value;
  if (inputRange.length < 2 || outputRange.length < 2) return value;

  const inMin = inputRange[0];
  const inMax = inputRange[inputRange.length - 1];
  const outMin = outputRange[0];
  const outMax = outputRange[outputRange.length - 1];

  if (inMax === inMin) return outMin;
  const ratio = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * ratio;
}

const AnimatedDefault = {
  View: ReactNative.View,
  Text: ReactNative.Text,
  Image: ReactNative.Image,
  ScrollView: ReactNative.ScrollView,
  FlatList: ReactNative.FlatList,
  createAnimatedComponent: (Component) => Component,
};

const reanimatedMock = {
  __esModule: true,
  default: AnimatedDefault,
  View: ReactNative.View,
  Text: ReactNative.Text,
  Image: ReactNative.Image,
  ScrollView: ReactNative.ScrollView,
  FlatList: ReactNative.FlatList,
  createAnimatedComponent: (Component) => Component,
  useSharedValue: (value) => ({ value }),
  useDerivedValue: (factory) => ({ value: typeof factory === "function" ? factory() : factory }),
  useAnimatedStyle: (factory) => (typeof factory === "function" ? factory() : {}),
  useAnimatedProps: (factory) => (typeof factory === "function" ? factory() : {}),
  useAnimatedGestureHandler: () => noOp,
  useAnimatedScrollHandler: () => noOp,
  useAnimatedReaction: noOp,
  useFrameCallback: noOp,
  useAnimatedRef: () => React.createRef(),
  measure: () => null,
  scrollTo: noOp,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  cancelAnimation: noOp,
  makeMutable: (value) => ({ value }),
  withTiming: identity,
  withSpring: identity,
  withDecay: identity,
  withRepeat: (animation) => animation,
  withSequence: (...animations) => animations[animations.length - 1],
  withDelay: (_ms, animation) => animation,
  interpolate,
  interpolateColor: () => "#000000",
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  Extrapolation: {
    CLAMP: "clamp",
    EXTEND: "extend",
    IDENTITY: "identity",
  },
  ReduceMotion: {
    System: "system",
    Always: "always",
    Never: "never",
  },
  Easing: {
    linear: identity,
    ease: identity,
    quad: identity,
    cubic: identity,
    poly: () => identity,
    sin: identity,
    circle: identity,
    exp: identity,
    elastic: () => identity,
    back: () => identity,
    bounce: identity,
    bezier: () => identity,
    in: identity,
    out: identity,
    inOut: identity,
  },
  Keyframe: function Keyframe() {},
  Layout: {
    springify: () => ({}),
    duration: () => ({}),
    delay: () => ({}),
  },
  FadeIn: { duration: () => ({}) },
  FadeInDown: { duration: () => ({}) },
  FadeInUp: { duration: () => ({}) },
  FadeOut: { duration: () => ({}) },
  FadeOutDown: { duration: () => ({}) },
  FadeOutUp: { duration: () => ({}) },
  SlideInRight: { duration: () => ({}) },
  SlideOutRight: { duration: () => ({}) },
  SlideInLeft: { duration: () => ({}) },
  SlideOutLeft: { duration: () => ({}) },
  ZoomIn: { duration: () => ({}) },
  ZoomOut: { duration: () => ({}) },
};

module.exports = reanimatedMock;
