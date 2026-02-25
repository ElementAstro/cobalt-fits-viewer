/**
 * Shared mock factories for backup component tests.
 * Each factory returns mock components suitable for jest.mock() return values.
 *
 * Usage inside jest.mock() factories:
 *   const { mockDialogFactory } = require("../testHelpers");
 *   jest.mock("heroui-native", () => { const h = require("../testHelpers"); return { ...h.mockDialogFactory(), ... }; });
 */

import React from "react";

const RN = require("react-native");

type MockProps = { children?: React.ReactNode } & Record<string, unknown>;

// ─── Dialog ────────────────────────────────────────────────────────────────

type MockDialogProps = MockProps & {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function mockDialogFactory() {
  const Dialog = ({ isOpen, children, onOpenChange }: MockDialogProps) =>
    isOpen ? (
      <RN.View testID="dialog" onTouchEnd={() => onOpenChange?.(false)}>
        {children}
      </RN.View>
    ) : null;
  Dialog.Portal = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Overlay = () => <RN.View />;
  Dialog.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  Dialog.Description = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  Dialog.Close = () => <RN.Pressable testID="dialog-close" />;
  return { Dialog };
}

// ─── BottomSheet ───────────────────────────────────────────────────────────

type MockBottomSheetProps = MockProps & {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function mockBottomSheetFactory() {
  const BottomSheet = ({ isOpen, children, onOpenChange }: MockBottomSheetProps) =>
    isOpen ? (
      <RN.View testID="bottom-sheet" onTouchEnd={() => onOpenChange?.(false)}>
        {children}
      </RN.View>
    ) : null;
  BottomSheet.Portal = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  BottomSheet.Overlay = () => <RN.View />;
  BottomSheet.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  BottomSheet.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  BottomSheet.Description = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  BottomSheet.Close = () => <RN.Pressable testID="bottom-sheet-close" />;
  return { BottomSheet };
}

// ─── Button ────────────────────────────────────────────────────────────────

type MockButtonProps = MockProps & {
  onPress?: () => void;
  isDisabled?: boolean;
  testID?: string;
  isIconOnly?: boolean;
};

export function mockButtonFactory(defaultTestID = "button") {
  const Button = ({ children, onPress, isDisabled, testID }: MockButtonProps) => (
    <RN.Pressable
      testID={testID ?? defaultTestID}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityState={{ disabled: !!isDisabled }}
    >
      {children}
    </RN.Pressable>
  );
  Button.Label = ({ children, ...rest }: MockProps) => <RN.Text {...rest}>{children}</RN.Text>;
  return { Button };
}

// ─── Chip ──────────────────────────────────────────────────────────────────

type MockChipProps = MockProps & {
  onPress?: () => void;
  testID?: string;
  disabled?: boolean;
  variant?: string;
  size?: string;
  color?: string;
};

export function mockChipFactory() {
  const Chip = ({ children, onPress, testID }: MockChipProps) => (
    <RN.Pressable testID={testID ?? "chip"} onPress={onPress}>
      {children}
    </RN.Pressable>
  );
  Chip.Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  return { Chip };
}

// ─── Switch ────────────────────────────────────────────────────────────────

type MockSwitchProps = {
  children?: React.ReactNode;
  onSelectedChange?: (next: boolean) => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  testID?: string;
};

export function mockSwitchFactory() {
  const Switch = ({ onSelectedChange, isSelected, testID }: MockSwitchProps) => (
    <RN.Pressable
      testID={testID ?? "switch"}
      onPress={() => onSelectedChange?.(!isSelected)}
      accessibilityState={{ checked: isSelected }}
    >
      <RN.View />
    </RN.Pressable>
  );
  Switch.Thumb = () => <RN.View />;
  return { Switch };
}

// ─── Input / TextField / FieldError ────────────────────────────────────────

export function mockInputFactory() {
  const Input = ({
    value,
    onChangeText,
    placeholder,
    testID,
    ...rest
  }: {
    value?: string;
    onChangeText?: (t: string) => void;
    placeholder?: string;
    testID?: string;
  } & Record<string, unknown>) => (
    <RN.TextInput
      testID={testID ?? `input-${placeholder}`}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      {...rest}
    />
  );
  return { Input };
}

export function mockTextFieldFactory() {
  const TextField = ({ children }: MockProps & { isRequired?: boolean; isInvalid?: boolean }) => (
    <RN.View>{children}</RN.View>
  );
  return { TextField };
}

export function mockFieldErrorFactory() {
  const FieldError = ({ children }: MockProps) => (
    <RN.Text testID="field-error">{children}</RN.Text>
  );
  return { FieldError };
}

export function mockLabelFactory() {
  const Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  return { Label };
}

// ─── Alert ─────────────────────────────────────────────────────────────────

type MockAlertProps = MockProps & { status?: string };

export function mockAlertFactory() {
  const Alert = ({ children, status }: MockAlertProps) => (
    <RN.View testID={`alert-${status}`}>{children}</RN.View>
  );
  Alert.Indicator = () => <RN.View />;
  Alert.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Alert.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  return { Alert };
}

// ─── Spinner / Surface ─────────────────────────────────────────────────────

export function mockSpinnerFactory() {
  const Spinner = () => <RN.View testID="spinner" />;
  return { Spinner };
}

export function mockSurfaceFactory() {
  const Surface = ({ children }: MockProps) => <RN.View testID="surface">{children}</RN.View>;
  return { Surface };
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function mockCardFactory() {
  const Card = ({ children, ...rest }: MockProps) => <RN.View {...rest}>{children}</RN.View>;
  Card.Header = ({ children, ...rest }: MockProps) => <RN.View {...rest}>{children}</RN.View>;
  Card.Body = ({ children, ...rest }: MockProps) => <RN.View {...rest}>{children}</RN.View>;
  Card.Footer = ({ children, ...rest }: MockProps) => <RN.View {...rest}>{children}</RN.View>;
  Card.Title = ({ children, ...rest }: MockProps) => <RN.Text {...rest}>{children}</RN.Text>;
  Card.Description = ({ children, ...rest }: MockProps) => <RN.Text {...rest}>{children}</RN.Text>;
  return { Card };
}

// ─── Separator / PressableFeedback ─────────────────────────────────────────

export function mockSeparatorFactory() {
  const Separator = () => <RN.View testID="separator" />;
  return { Separator };
}

type MockPressableProps = MockProps & { onPress?: () => void };

export function mockPressableFeedbackFactory() {
  const PressableFeedback = ({ children, onPress }: MockPressableProps) => (
    <RN.Pressable onPress={onPress}>{children}</RN.Pressable>
  );
  PressableFeedback.Highlight = () => <RN.View />;
  return { PressableFeedback };
}

// ─── useThemeColor ─────────────────────────────────────────────────────────

export function mockUseThemeColorFactory(defaultColor = "#999") {
  const useThemeColor = () => defaultColor;
  return { useThemeColor };
}

// ─── Ionicons ──────────────────────────────────────────────────────────────

export function mockIoniconsFactory() {
  return {
    Ionicons: ({ name, ...props }: Record<string, unknown>) => (
      <RN.Text testID={`icon-${name}`} {...props} />
    ),
  };
}

// ─── useI18n ───────────────────────────────────────────────────────────────

export function mockI18nFactory(translations?: Record<string, string>) {
  return {
    useI18n: () => ({
      t: (key: string) => (translations ? (translations[key] ?? key) : key),
      locale: "en",
      setLocale: jest.fn(),
    }),
  };
}

// ─── formatFileSize ────────────────────────────────────────────────────────

export function mockFormatFileSizeFactory() {
  return {
    formatFileSize: (bytes: number) => `${bytes}B`,
  };
}
