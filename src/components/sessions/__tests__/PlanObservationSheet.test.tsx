import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ObservationPlan } from "../../../lib/fits/types";
import { PlanObservationSheet } from "../PlanObservationSheet";

const mockCreateObservationPlan = jest.fn(async () => true);
const mockUpdateObservationPlan = jest.fn(async () => true);
const mockSetTelescope = jest.fn();
const mockSetCamera = jest.fn();
const mockSetMount = jest.fn();
const mockSetFilterInput = jest.fn();
const mockAddFilter = jest.fn();
const mockRemoveFilter = jest.fn();
const mockResetEquipment = jest.fn();
const mockSetLocationName = jest.fn();
const mockSetLatitudeInput = jest.fn();
const mockSetLongitudeInput = jest.fn();
const mockUseCurrentLocation = jest.fn();
const mockResetLocation = jest.fn();
let mockPlans: ObservationPlan[] = [];

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/common/useScreenOrientation", () => ({
  useScreenOrientation: () => ({ isLandscape: false }),
}));

jest.mock("../../../hooks/sessions/useCalendar", () => ({
  useCalendar: () => ({
    createObservationPlan: mockCreateObservationPlan,
    updateObservationPlan: mockUpdateObservationPlan,
    plans: mockPlans,
    syncing: false,
  }),
}));

jest.mock("../../../hooks/sessions/useEquipmentFields", () => ({
  useEquipmentFields: () => ({
    telescope: "",
    camera: "",
    mount: "",
    filters: [],
    filterInput: "",
    setTelescope: mockSetTelescope,
    setCamera: mockSetCamera,
    setMount: mockSetMount,
    setFilterInput: mockSetFilterInput,
    addFilter: mockAddFilter,
    removeFilter: mockRemoveFilter,
    buildEquipmentObject: () => ({}),
    resetEquipment: mockResetEquipment,
  }),
}));

jest.mock("../../../hooks/sessions/useLocationFields", () => ({
  useLocationFields: () => ({
    locationName: "",
    latitudeInput: "",
    longitudeInput: "",
    setLocationName: mockSetLocationName,
    setLatitudeInput: mockSetLatitudeInput,
    setLongitudeInput: mockSetLongitudeInput,
    useCurrentLocation: mockUseCurrentLocation,
    validateAndBuild: () => undefined,
    resetLocation: mockResetLocation,
  }),
}));

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: { defaultReminderMinutes: number }) => unknown) =>
    selector({ defaultReminderMinutes: 30 }),
}));

jest.mock("../../../stores/observation/useTargetStore", () => ({
  useTargetStore: (
    selector: (state: {
      targets: Array<{
        id: string;
        name: string;
        aliases: string[];
      }>;
    }) => unknown,
  ) =>
    selector({
      targets: [{ id: "t1", name: "M42", aliases: [] }],
    }),
}));

jest.mock("../../../lib/targets/targetRefs", () => ({
  resolveTargetId: jest.fn(() => "t1"),
  resolveTargetName: jest.fn((input: { name?: string }) => input.name ?? "M42"),
}));

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: "plan-1",
  title: "Plan A",
  targetId: "t1",
  targetName: "M42",
  startDate: "2025-03-10T21:00:00.000Z",
  endDate: "2025-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  createdAt: 1,
  status: "planned",
  ...overrides,
});

describe("PlanObservationSheet", () => {
  const onClose = jest.fn();
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlans = [];
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("shows conflict warning and blocks direct save when overlap exists", async () => {
    const base = new Date("2025-03-10T12:00:00.000Z");
    base.setHours(20, 0, 0, 0);
    const overlapEnd = new Date(base);
    overlapEnd.setHours(23, 59, 0, 0);
    mockPlans = [
      makePlan({
        startDate: base.toISOString(),
        endDate: overlapEnd.toISOString(),
      }),
    ];
    render(
      <PlanObservationSheet
        visible
        onClose={onClose}
        initialDate={new Date("2025-03-10T12:00:00.000Z")}
        initialTargetName="M42"
      />,
    );

    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "sessions.planConflictTitle",
        expect.stringContaining("sessions.planConflictSavePrompt"),
        expect.any(Array),
      );
    });
    expect(mockCreateObservationPlan).not.toHaveBeenCalled();
  });

  it("saves directly when no conflict exists", async () => {
    mockPlans = [];
    render(
      <PlanObservationSheet
        visible
        onClose={onClose}
        initialDate={new Date("2025-03-10T12:00:00.000Z")}
        initialTargetName="M42"
      />,
    );

    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(mockCreateObservationPlan).toHaveBeenCalledWith(
        expect.objectContaining({ targetName: "M42" }),
      );
    });
  });
});
