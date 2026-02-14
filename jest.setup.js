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
  const { View, Text } = require("react-native");
  const React = require("react");

  const Button = (props) =>
    React.createElement(View, { testID: "button", ...props }, props.children);
  Button.Label = (props) => React.createElement(Text, props, props.children);

  const Card = (props) => React.createElement(View, { testID: "card", ...props }, props.children);
  Card.Body = (props) => React.createElement(View, props, props.children);

  const Chip = (props) => React.createElement(View, { testID: "chip", ...props }, props.children);
  Chip.Label = (props) => React.createElement(Text, props, props.children);

  return {
    Button,
    Card,
    Chip,
    Separator: (props) => React.createElement(View, { testID: "separator", ...props }),
    HeroUINativeProvider: (props) => React.createElement(View, null, props.children),
    useThemeColor: (keys) => (Array.isArray(keys) ? keys.map(() => "#000000") : "#000000"),
  };
});

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
