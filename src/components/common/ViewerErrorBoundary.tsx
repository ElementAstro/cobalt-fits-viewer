import { Component, type PropsWithChildren, type ErrorInfo } from "react";
import { View } from "react-native";
import { Alert as HAlert, Button } from "heroui-native";
import { Logger, LOG_TAGS } from "../../lib/logger";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ViewerErrorBoundary extends Component<
  PropsWithChildren<{ onReset?: () => void }>,
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Logger.error(LOG_TAGS.Viewer, "ViewerErrorBoundary caught render error", {
      message: error.message,
      stack: info.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <HAlert status="danger">
            <HAlert.Indicator />
            <HAlert.Content>
              <HAlert.Title>Render Error</HAlert.Title>
              <HAlert.Description>
                {this.state.error?.message ?? "An unexpected error occurred"}
              </HAlert.Description>
            </HAlert.Content>
          </HAlert>
          <Button variant="outline" className="mt-4" onPress={this.handleReset}>
            <Button.Label>Retry</Button.Label>
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}
