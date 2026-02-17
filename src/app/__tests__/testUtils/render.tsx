import React from "react";
import { render } from "@testing-library/react-native";

export function renderScreen(element: React.ReactElement) {
  return render(element);
}
