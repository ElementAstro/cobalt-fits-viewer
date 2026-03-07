import { useFitsStore } from "../../../stores/files/useFitsStore";

export function resetFitsStore() {
  useFitsStore.setState({
    files: [],
    selectedIds: [],
    isSelectionMode: false,
    sortBy: "date",
    sortOrder: "desc",
    searchQuery: "",
    filterTags: [],
  });
}
