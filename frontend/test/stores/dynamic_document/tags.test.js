import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const mock = new AxiosMockAdapter(axios);

describe("Dynamic Document Store - Tags", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
  });

  test("fetchTags loads tags and sets tagsLoaded", async () => {
    const store = useDynamicDocumentStore();

    const tags = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];

    mock.onGet("/api/dynamic-documents/tags/").reply(200, tags);

    const result = await store.fetchTags();

    expect(result).toEqual(tags);
    expect(store.tags).toEqual(tags);
    expect(store.tagsLoaded).toBe(true);
    expect(store.isLoadingTags).toBe(false);
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchTags handles empty response data", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet("/api/dynamic-documents/tags/").reply(200);

    const result = await store.fetchTags(true);

    expect(result).toEqual([]);
    expect(store.tags).toEqual([]);
    expect(store.tagsLoaded).toBe(true);
    expect(store.isLoadingTags).toBe(false);
  });

  test("fetchTags returns cached tags when tagsLoaded is true and forceRefresh is false", async () => {
    const store = useDynamicDocumentStore();

    const tags = [{ id: 1, name: "Cached" }];
    store.$patch({ tags, tagsLoaded: true });

    const result = await store.fetchTags();

    expect(result).toEqual(tags);
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchTags forces refresh when forceRefresh is true", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tagsLoaded: true, tags: [{ id: 1, name: "Cached" }] });

    mock.onGet("/api/dynamic-documents/tags/").reply(200, [{ id: 2, name: "Fresh" }]);

    const result = await store.fetchTags(true);

    expect(result).toEqual([{ id: 2, name: "Fresh" }]);
    expect(store.tags).toEqual([{ id: 2, name: "Fresh" }]);
  });

  test("fetchTags returns current tags when isLoadingTags is true", async () => {
    const store = useDynamicDocumentStore();

    const tags = [{ id: 1, name: "Loading" }];
    store.$patch({ tags, isLoadingTags: true, tagsLoaded: false });

    const result = await store.fetchTags();

    expect(result).toEqual(tags);
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchTags throws and resets tags on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/tags/").reply(500, { detail: "error" });

    await expect(store.fetchTags(true)).rejects.toBeTruthy();

    expect(store.tags).toEqual([]);
    expect(store.isLoadingTags).toBe(false);

    consoleSpy.mockRestore();
  });

  test("initTags calls fetchTags when tags are not loaded", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet("/api/dynamic-documents/tags/").reply(200, []);

    await store.initTags();

    expect(mock.history.get).toHaveLength(1);
  });

  test("initTags does not call fetchTags when tagsLoaded is true and forceRefresh is false", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tagsLoaded: true, tags: [{ id: 1, name: "A" }] });

    await store.initTags(false);

    expect(mock.history.get).toHaveLength(0);
  });

  test("createTag posts tag, adds it to store, and registers activity", async () => {
    const store = useDynamicDocumentStore();

    const tagData = { name: "New", color_id: 1 };
    const createdTag = { id: 10, name: "New", color_id: 1 };

    mock.onPost("/api/dynamic-documents/tags/create/").reply(201, createdTag);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.createTag(tagData);

    expect(result).toEqual(createdTag);
    expect(store.tags).toContainEqual(createdTag);

    expect(mock.history.post).toHaveLength(2);
    expect(mock.history.post[0].url).toBe("/api/dynamic-documents/tags/create/");
    expect(mock.history.post[1].url).toBe("/api/create-activity/");
  });

  test("createTag throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/dynamic-documents/tags/create/").reply(500, { detail: "error" });

    await expect(store.createTag({ name: "Fail", color_id: 1 })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("updateTag updates local tag and registers activity", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      tags: [
        { id: 1, name: "Old" },
        { id: 2, name: "Keep" },
      ],
    });

    const updated = { id: 1, name: "Updated" };

    mock.onPut("/api/dynamic-documents/tags/1/update/").reply(200, updated);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateTag(1, { name: "Updated" });

    expect(result).toEqual(updated);
    expect(store.tags.find((t) => t.id === 1)).toEqual(updated);

    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("updateTag uses default label when tag name is missing", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tags: [{ id: 1, name: "Old" }] });

    mock.onPut("/api/dynamic-documents/tags/1/update/").reply(200, { id: 1, name: "Old" });
    mock.onPost("/api/create-activity/").reply(200, {
      id: 1,
      action_type: "update",
      description: "Actualizaste la etiqueta \"sin nombre\"",
      created_at: new Date().toISOString(),
    });

    await store.updateTag(1, { color_id: 1 });

    const activityPayload = JSON.parse(mock.history.post[0].data);
    expect(activityPayload.description).toContain("sin nombre");
  });

  test("updateTag leaves list unchanged when tag is missing", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tags: [{ id: 1, name: "Old" }] });

    mock.onPut("/api/dynamic-documents/tags/99/update/").reply(200, { id: 99, name: "New" });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateTag(99, { name: "New" });

    expect(result).toEqual({ id: 99, name: "New" });
    expect(store.tags).toEqual([{ id: 1, name: "Old" }]);
  });

  test("updateTag throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/dynamic-documents/tags/1/update/").reply(500, { detail: "error" });

    await expect(store.updateTag(1, { name: "Updated" })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteTag removes tag on 204 and registers activity", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      tags: [
        { id: 1, name: "DeleteMe" },
        { id: 2, name: "Keep" },
      ],
    });

    mock.onDelete("/api/dynamic-documents/tags/1/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteTag(1);

    expect(result).toBe(true);
    expect(store.tags.map((t) => t.id)).toEqual([2]);

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("deleteTag returns false when response is not 204", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tags: [{ id: 1, name: "X" }] });

    mock.onDelete("/api/dynamic-documents/tags/1/delete/").reply(200);

    const result = await store.deleteTag(1);

    expect(result).toBe(false);
    expect(store.tags).toHaveLength(1);
  });

  test("deleteTag returns false on request error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    store.$patch({ tags: [{ id: 1, name: "X" }] });

    mock.onDelete("/api/dynamic-documents/tags/1/delete/").networkError();

    const result = await store.deleteTag(1);

    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deleteTag uses default label when tag is missing", async () => {
    const store = useDynamicDocumentStore();

    mock.onDelete("/api/dynamic-documents/tags/5/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteTag(5);

    expect(result).toBe(true);
  });
});
