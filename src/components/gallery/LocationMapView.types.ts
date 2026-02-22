import type { Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { FitsMetadata } from "../../lib/fits/types";
import type { MapPreset } from "../../lib/map/styles";
import type { MapClusterAction, MapClusterNode } from "../../lib/map/types";

export interface LocationMapViewRef {
  flyTo(latitude: number, longitude: number, zoom?: number): void;
}

export interface LocationMapViewProps {
  ref?: Ref<LocationMapViewRef>;
  files: FitsMetadata[];
  style?: StyleProp<ViewStyle>;
  preset?: MapPreset;
  showOverlays?: boolean;
  contentPaddingTop?: number;
  platformMode?: "native" | "web";
  onClusterAction?: (action: MapClusterAction) => void;
  onClusterPress?: (cluster: MapClusterNode) => void;
}
