import { useFitsStore } from "../../../stores/useFitsStore";

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
