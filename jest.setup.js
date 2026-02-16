// Mock @react-native-async-storage/async-storage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Mock @gorhom/bottom-sheet
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  const BottomSheet = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      expand: jest.fn(),
      close: jest.fn(),
      collapse: jest.fn(),
      snapToIndex: jest.fn(),
      snapToPosition: jest.fn(),
      forceClose: jest.fn(),
    }));
    return React.createElement(View, props, props.children);
  });
  BottomSheet.displayName = "BottomSheet";
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: (props) => React.createElement(View, props, props.children),
    BottomSheetModal: BottomSheet,
    BottomSheetModalProvider: (props) => React.createElement(View, props, props.children),
    BottomSheetScrollView: (props) => React.createElement(View, props, props.children),
    BottomSheetFlatList: (props) => React.createElement(View, props, props.children),
    BottomSheetTextInput: (props) => React.createElement(View, props),
  };
});

// Mock expo-localization
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
  getCalendars: () => [{ calendar: "gregory", timeZone: "UTC" }],
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Stack: {
    Screen: "Stack.Screen",
  },
  Link: "Link",
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: (props) => React.createElement(Text, { testID: "icon" }, props.name),
  };
});

// Mock heroui-native
jest.mock("heroui-native", () => {
  const { View, Text, TextInput } = require("react-native");
  const React = require("react");

  const c = (testID) => (props) => React.createElement(View, { testID, ...props }, props.children);

  const Button = c("button");
  Button.Label = (props) => React.createElement(Text, props, props.children);

  const Card = c("card");
  Card.Body = c("card-body");

  const Chip = c("chip");
  Chip.Label = (props) => React.createElement(Text, props, props.children);

  const Dialog = c("dialog");
  Dialog.Portal = c("dialog-portal");
  Dialog.Overlay = c("dialog-overlay");
  Dialog.Content = c("dialog-content");
  Dialog.Close = c("dialog-close");
  Dialog.Title = (props) => React.createElement(Text, props, props.children);
  Dialog.Description = (props) => React.createElement(Text, props, props.children);

  const BottomSheet = c("bottom-sheet");
  BottomSheet.Portal = c("bottom-sheet-portal");
  BottomSheet.Overlay = c("bottom-sheet-overlay");
  BottomSheet.Content = c("bottom-sheet-content");
  BottomSheet.Title = (props) => React.createElement(Text, props, props.children);

  const TextField = c("textfield");

  return {
    BottomSheet,
    Button,
    Card,
    Chip,
    Dialog,
    TextField,
    Input: (props) => React.createElement(TextInput, { testID: "input", ...props }),
    Label: (props) => React.createElement(Text, { testID: "label", ...props }, props.children),
    Switch: c("switch"),
    PressableFeedback: c("pressable-feedback"),
    Separator: c("separator"),
    Spinner: c("spinner"),
    HeroUINativeProvider: (props) => React.createElement(View, null, props.children),
    useThemeColor: (keys) => (Array.isArray(keys) ? keys.map(() => "#000000") : "#000000"),
  };
});

// Mock react-native-safe-area-context
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: (props) => React.createElement(View, props, props.children),
    SafeAreaView: (props) => React.createElement(View, props, props.children),
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// Mock expo-screen-orientation
jest.mock("expo-screen-orientation", () => ({
  Orientation: {
    UNKNOWN: 0,
    PORTRAIT_UP: 1,
    PORTRAIT_DOWN: 2,
    LANDSCAPE_LEFT: 3,
    LANDSCAPE_RIGHT: 4,
  },
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT: 2,
    PORTRAIT_UP: 3,
    PORTRAIT_DOWN: 4,
    LANDSCAPE: 5,
    LANDSCAPE_LEFT: 6,
    LANDSCAPE_RIGHT: 7,
  },
  getOrientationAsync: jest.fn().mockResolvedValue(1), // PORTRAIT_UP
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  addOrientationChangeListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  removeOrientationChangeListener: jest.fn(),
}));

// Mock react-native-gesture-handler
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    GestureHandlerRootView: (props) => React.createElement(View, props, props.children),
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    TouchableHighlight: View,
    TouchableNativeFeedback: View,
    TouchableOpacity: View,
    TouchableWithoutFeedback: View,
    FlatList: View,
    gestureHandlerRootHOC: jest.fn(),
    NativeViewGestureHandler: View,
  };
});
