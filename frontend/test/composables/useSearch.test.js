import { ref, nextTick } from "vue";

import { useSearch } from "@/composables/useSearch";

describe("useSearch", () => {
  test("returns all items when search term is empty and filters by fields", async () => {
    const items = [
      { name: "Alpha", email: "alpha@test.com" },
      { name: "Beta", email: "beta@test.com" },
    ];

    const { searchTerm, filteredProcess } = useSearch(items, ["name", "email"]);

    expect(filteredProcess.value).toEqual(items);

    searchTerm.value = "alp";
    await nextTick();

    expect(filteredProcess.value).toEqual([items[0]]);

    searchTerm.value = "BETA@";
    await nextTick();

    expect(filteredProcess.value).toEqual([items[1]]);
  });

  test("ignores non-string fields and treats whitespace-only as empty", async () => {
    const items = [
      { name: "Gamma", code: 123 },
      { name: "Delta", code: 456 },
    ];

    const { searchTerm, filteredProcess } = useSearch(items, ["name", "code"]);

    searchTerm.value = "gam";
    await nextTick();

    expect(filteredProcess.value).toEqual([items[0]]);

    searchTerm.value = "123";
    await nextTick();

    expect(filteredProcess.value).toEqual([]);

    searchTerm.value = "   ";
    await nextTick();

    expect(filteredProcess.value).toEqual(items);
  });

  test("works with a ref source array and reacts to changes", async () => {
    const items = ref([
      { title: "One" },
      { title: "Two" },
    ]);

    const { searchTerm, filteredProcess } = useSearch(items, ["title"]);

    searchTerm.value = "two";
    await nextTick();

    expect(filteredProcess.value).toEqual([{ title: "Two" }]);

    items.value.push({ title: "Two Plus" });
    await nextTick();

    expect(filteredProcess.value).toEqual([
      { title: "Two" },
      { title: "Two Plus" },
    ]);
  });

  test("defaults fields to empty array when not provided", async () => {
    const items = [{ name: "Alpha" }];

    const { searchTerm, filteredProcess } = useSearch(items);

    searchTerm.value = "alpha";
    await nextTick();

    expect(filteredProcess.value).toEqual([]);
  });
});
