import { useState, useCallback } from "react";
import { useChipInput } from "../common/useChipInput";

interface EquipmentValues {
  telescope?: string;
  camera?: string;
  mount?: string;
  filters?: string[];
}

interface UseEquipmentFieldsReturn {
  telescope: string;
  camera: string;
  mount: string;
  filters: string[];
  filterInput: string;
  setTelescope: (value: string) => void;
  setCamera: (value: string) => void;
  setMount: (value: string) => void;
  setFilterInput: (value: string) => void;
  addFilter: () => void;
  removeFilter: (item: string) => void;
  resetEquipment: (initial?: EquipmentValues) => void;
  buildEquipmentObject: () => EquipmentValues;
}

export function useEquipmentFields(initial?: EquipmentValues): UseEquipmentFieldsReturn {
  const [telescope, setTelescope] = useState(initial?.telescope ?? "");
  const [camera, setCamera] = useState(initial?.camera ?? "");
  const [mount, setMount] = useState(initial?.mount ?? "");
  const [filters, setFilters] = useState<string[]>(initial?.filters ?? []);
  const [filterInput, setFilterInput] = useState("");

  const { addItem, removeItem } = useChipInput();

  const addFilter = useCallback(() => {
    addItem(filterInput, filters, setFilters, setFilterInput);
  }, [filterInput, filters, addItem]);

  const removeFilter = useCallback(
    (item: string) => {
      removeItem(item, filters, setFilters);
    },
    [filters, removeItem],
  );

  const resetEquipment = useCallback((next?: EquipmentValues) => {
    setTelescope(next?.telescope ?? "");
    setCamera(next?.camera ?? "");
    setMount(next?.mount ?? "");
    setFilters(next?.filters ?? []);
    setFilterInput("");
  }, []);

  const buildEquipmentObject = useCallback((): EquipmentValues => {
    const obj: EquipmentValues = {};
    if (telescope.trim()) obj.telescope = telescope.trim();
    if (camera.trim()) obj.camera = camera.trim();
    if (mount.trim()) obj.mount = mount.trim();
    if (filters.length > 0) obj.filters = filters;
    return obj;
  }, [telescope, camera, mount, filters]);

  return {
    telescope,
    camera,
    mount,
    filters,
    filterInput,
    setTelescope,
    setCamera,
    setMount,
    setFilterInput,
    addFilter,
    removeFilter,
    resetEquipment,
    buildEquipmentObject,
  };
}
