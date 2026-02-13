import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useOrganizationPostsStore } from "@/stores/organization_posts";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

describe("Organization Posts Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("getters sort pinned first then by created_at desc", () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [
        { id: 1, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 2, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
        { id: 3, is_pinned: true, created_at: "2026-01-03T00:00:00Z" },
      ],
      publicPosts: [
        { id: 4, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 5, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedManagementPosts.map((p) => p.id)).toEqual([3, 2, 1]);
    expect(store.sortedPublicPosts.map((p) => p.id)).toEqual([5, 4]);

    store.$patch({
      managementPosts: [
        { id: 1, is_pinned: false, is_active: true, created_at: "2026-01-01T00:00:00Z" },
        { id: 2, is_pinned: true, is_active: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 3, is_pinned: true, is_active: true, created_at: "2026-01-01T00:00:00Z" },
      ],
    });

    expect(store.activePostsCount).toBe(2);
    expect(store.pinnedPostsCount).toBe(2);
  });

  test("getters handle pinned comparisons and public date fallback", () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [
        { id: 1, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 2, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedManagementPosts.map((post) => post.id)).toEqual([2, 1]);

    store.$patch({
      publicPosts: [
        { id: 3, is_pinned: true, created_at: "2026-01-01T00:00:00Z" },
        { id: 4, is_pinned: false, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([3, 4]);

    store.$patch({
      publicPosts: [
        { id: 5, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 6, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([6, 5]);

    store.$patch({
      publicPosts: [
        { id: 7, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 8, is_pinned: false, created_at: "2026-01-03T00:00:00Z" },
      ],
    });

    expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([8, 7]);
  });

  test("getters handle unpinned vs pinned ordering for management posts", () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [
        { id: 1, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 2, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedManagementPosts.map((post) => post.id)).toEqual([2, 1]);
  });

  test("sortedManagementPosts covers unpinned vs pinned comparator branch", () => {
    const store = useOrganizationPostsStore();
    const originalSort = Array.prototype.sort;

    try {
      Array.prototype.sort = function (compareFn) {
        compareFn(
          { id: 1, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
          { id: 2, is_pinned: false, created_at: "2026-01-01T00:00:00Z" }
        );
        compareFn(
          { id: 1, is_pinned: false, created_at: "2026-01-02T00:00:00Z" },
          { id: 2, is_pinned: true, created_at: "2026-01-01T00:00:00Z" }
        );
        return originalSort.call(this, compareFn);
      };

      store.$patch({
        managementPosts: [
          { id: 1, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
          { id: 2, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
        ],
      });

      expect(store.sortedManagementPosts.map((post) => post.id)).toEqual([2, 1]);
    } finally {
      Array.prototype.sort = originalSort;
    }
  });

  test("sortedPublicPosts sorts by date when pin status matches", () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      publicPosts: [
        { id: 10, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 11, is_pinned: false, created_at: "2026-01-04T00:00:00Z" },
      ],
    });

    expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([11, 10]);
  });

  test("sortedPublicPosts puts pinned first when unpinned comes first", () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      publicPosts: [
        { id: 20, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
        { id: 21, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([21, 20]);
  });

  test("sortedPublicPosts covers pinned comparator and date fallback branch", () => {
    const store = useOrganizationPostsStore();
    const originalSort = Array.prototype.sort;

    try {
      Array.prototype.sort = function (compareFn) {
        compareFn(
          { id: 1, is_pinned: false, created_at: "2026-01-02T00:00:00Z" },
          { id: 2, is_pinned: true, created_at: "2026-01-01T00:00:00Z" }
        );
        compareFn(
          { id: 3, is_pinned: true, created_at: "2026-01-01T00:00:00Z" },
          { id: 4, is_pinned: true, created_at: "2026-01-03T00:00:00Z" }
        );
        return originalSort.call(this, compareFn);
      };

      store.$patch({
        publicPosts: [
          { id: 20, is_pinned: false, created_at: "2026-01-01T00:00:00Z" },
          { id: 21, is_pinned: true, created_at: "2026-01-02T00:00:00Z" },
        ],
      });

      expect(store.sortedPublicPosts.map((post) => post.id)).toEqual([21, 20]);
    } finally {
      Array.prototype.sort = originalSort;
    }
  });

  test("createPost unshifts post and sets currentPost", async () => {
    const store = useOrganizationPostsStore();

    mock.onPost("/api/organizations/1/posts/create/").reply(201, { post: { id: 10, title: "A" } });

    const result = await store.createPost(1, { title: "A" });

    expect(result.post.id).toBe(10);
    expect(store.managementPosts[0].id).toBe(10);
    expect(store.currentPost.id).toBe(10);
    expect(store.isCreatingPost).toBe(false);
  });

  test("createPost throws on non-201", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/create/").reply(200, {});

    await expect(store.createPost(1, { title: "A" })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("createPost resets isCreatingPost on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/create/").networkError();

    await expect(store.createPost(1, { title: "A" })).rejects.toBeTruthy();
    expect(store.isCreatingPost).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getManagementPosts sets posts and pagination when paginated response", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/?search=x&page=2").reply(200, {
      results: [{ id: 1 }],
      count: 1,
      next: null,
      previous: null,
    });

    const result = await store.getManagementPosts(1, { search: "x", page: 2 });

    expect(result.count).toBe(1);
    expect(store.managementPosts).toEqual([{ id: 1 }]);
    expect(store.pagination.currentPage).toBe(2);
    expect(store.isLoadingPosts).toBe(false);
  });

  test("getManagementPosts supports non-paginated array response", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/").reply(200, [{ id: 1 }, { id: 2 }]);

    const result = await store.getManagementPosts(1);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.managementPosts).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("getManagementPosts skips empty params in query string", async () => {
    const store = useOrganizationPostsStore();

    mock
      .onGet(/\/api\/organizations\/1\/posts\/\?.*/)
      .reply(200, { results: [], count: 0, next: null, previous: null });

    await store.getManagementPosts(1, {
      search: "",
      is_active: null,
      is_pinned: undefined,
      page: 1,
      page_size: 10,
    });

    const calledUrl = mock.history.get[0].url;
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).toContain("page_size=10");
    expect(calledUrl).not.toContain("search=");
    expect(calledUrl).not.toContain("is_active=");
    expect(calledUrl).not.toContain("is_pinned=");
  });

  test("getManagementPosts defaults pagination when page is missing", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/?search=x").reply(200, {
      results: [{ id: 1 }],
      count: 1,
      next: null,
      previous: null,
    });

    await store.getManagementPosts(1, { search: "x" });

    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
  });

  test("getManagementPosts throws on non-200 response", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/?search=x").reply(204, {});

    await expect(store.getManagementPosts(1, { search: "x" })).rejects.toBeTruthy();
    expect(store.isLoadingPosts).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getManagementPosts resets isLoadingPosts on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/").networkError();

    await expect(store.getManagementPosts(1)).rejects.toBeTruthy();
    expect(store.isLoadingPosts).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getPublicPosts sets posts and pagination", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/public/?page=3").reply(200, {
      results: [{ id: 5 }],
      count: 1,
      next: null,
      previous: null,
    });

    await store.getPublicPosts(1, { page: 3 });

    expect(store.publicPosts).toEqual([{ id: 5 }]);
    expect(store.pagination.currentPage).toBe(3);
  });

  test("getPublicPosts defaults pagination and uses base URL when no params", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/public/").reply(200, {
      results: [{ id: 11 }],
      count: 1,
      next: null,
      previous: null,
    });

    await store.getPublicPosts(1);

    expect(store.publicPosts).toEqual([{ id: 11 }]);
    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
  });

  test("getPublicPosts supports non-paginated array response", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/public/").reply(200, [{ id: 12 }]);

    const result = await store.getPublicPosts(1);

    expect(result).toEqual([{ id: 12 }]);
    expect(store.publicPosts).toEqual([{ id: 12 }]);
  });

  test("getPublicPosts skips empty params in query string", async () => {
    const store = useOrganizationPostsStore();

    mock
      .onGet(/\/api\/organizations\/1\/posts\/public\/\?.*/)
      .reply(200, { results: [], count: 0, next: null, previous: null });

    await store.getPublicPosts(1, {
      search: "",
      page: 1,
      page_size: 10,
    });

    const calledUrl = mock.history.get[0].url;
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).toContain("page_size=10");
    expect(calledUrl).not.toContain("search=");
  });

  test("getPublicPosts throws on non-200 response", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/public/?search=x").reply(204, {});

    await expect(store.getPublicPosts(1, { search: "x" })).rejects.toBeTruthy();
    expect(store.isLoadingPosts).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getPublicPosts resets isLoadingPosts on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/public/").networkError();

    await expect(store.getPublicPosts(1)).rejects.toBeTruthy();
    expect(store.isLoadingPosts).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getPostDetail sets currentPost and updates managementPosts entry", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 9, title: "Old" }] });

    mock.onGet("/api/organizations/1/posts/9/").reply(200, { post: { id: 9, title: "New" } });

    const result = await store.getPostDetail(1, 9);

    expect(result.post.id).toBe(9);
    expect(store.currentPost.title).toBe("New");
    expect(store.managementPosts.find((p) => p.id === 9).title).toBe("New");
  });

  test("getPostDetail does not update managementPosts when post is not in list", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 8, title: "Other" }] });

    mock.onGet("/api/organizations/1/posts/9/").reply(200, { post: { id: 9, title: "New" } });

    const result = await store.getPostDetail(1, 9);

    expect(result.post.id).toBe(9);
    expect(store.currentPost.title).toBe("New");
    expect(store.managementPosts).toEqual([{ id: 8, title: "Other" }]);
  });

  test("getPostDetail uses response data when post key missing", async () => {
    const store = useOrganizationPostsStore();

    mock.onGet("/api/organizations/1/posts/10/").reply(200, { id: 10, title: "Solo" });

    const result = await store.getPostDetail(1, 10);

    expect(result.id).toBe(10);
    expect(store.currentPost.title).toBe("Solo");
  });

  test("getPostDetail throws on non-200 response", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/10/").reply(204, {});

    await expect(store.getPostDetail(1, 10)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("getPostDetail resets isLoading on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/organizations/1/posts/10/").networkError();

    await expect(store.getPostDetail(1, 10)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updatePost updates managementPosts and currentPost", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 7, title: "Old" }],
      currentPost: { id: 7, title: "Old" },
    });

    mock.onPut("/api/organizations/1/posts/7/update/").reply(200, { post: { id: 7, title: "Updated" } });

    const result = await store.updatePost(1, 7, { title: "Updated" });

    expect(result.post.title).toBe("Updated");
    expect(store.managementPosts.find((p) => p.id === 7).title).toBe("Updated");
    expect(store.currentPost.title).toBe("Updated");
    expect(store.isUpdatingPost).toBe(false);
  });

  test("updatePost uses response data when post key missing", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 7, title: "Old" }],
      currentPost: { id: 7, title: "Old" },
    });

    mock.onPut("/api/organizations/1/posts/7/update/").reply(200, { id: 7, title: "Solo" });

    const result = await store.updatePost(1, 7, { title: "Solo" });

    expect(result.id).toBe(7);
    expect(store.managementPosts.find((post) => post.id === 7).title).toBe("Solo");
    expect(store.currentPost.title).toBe("Solo");
  });

  test("updatePost leaves list/current when post is not in store", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 1, title: "Other" }],
      currentPost: { id: 2, title: "Keep" },
    });

    mock.onPut("/api/organizations/1/posts/3/update/").reply(200, { post: { id: 3, title: "Updated" } });

    const result = await store.updatePost(1, 3, { title: "Updated" });

    expect(result.post.id).toBe(3);
    expect(store.managementPosts).toEqual([{ id: 1, title: "Other" }]);
    expect(store.currentPost).toEqual({ id: 2, title: "Keep" });
  });

  test("updatePost throws on non-200 response", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/organizations/1/posts/7/update/").reply(204, {});

    await expect(store.updatePost(1, 7, { title: "Updated" })).rejects.toBeTruthy();
    expect(store.isUpdatingPost).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updatePost resets isUpdatingPost on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/organizations/1/posts/7/update/").networkError();

    await expect(store.updatePost(1, 7, { title: "Updated" })).rejects.toBeTruthy();
    expect(store.isUpdatingPost).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deletePost removes post and clears currentPost when needed", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 3 }, { id: 4 }],
      currentPost: { id: 4 },
    });

    mock.onDelete("/api/organizations/1/posts/4/delete/").reply(204);

    const result = await store.deletePost(1, 4);

    expect(result).toEqual({ message: "Post eliminado exitosamente" });
    expect(store.managementPosts.map((p) => p.id)).toEqual([3]);
    expect(store.currentPost).toBe(null);
  });

  test("deletePost returns response data on 200", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 3 }] });

    mock.onDelete("/api/organizations/1/posts/3/delete/").reply(200, { message: "ok" });

    const result = await store.deletePost(1, 3);

    expect(result).toEqual({ message: "ok" });
  });

  test("deletePost falls back to default message when response data is empty", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 5 }], currentPost: { id: 6 } });

    mock.onDelete("/api/organizations/1/posts/5/delete/").reply(200, null);

    const result = await store.deletePost(1, 5);

    expect(result).toEqual({ message: "Post eliminado exitosamente" });
    expect(store.managementPosts).toEqual([]);
  });

  test("deletePost throws on non-200/204", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/organizations/1/posts/3/delete/").reply(400, {});

    await expect(store.deletePost(1, 3)).rejects.toBeTruthy();
    expect(store.isDeletingPost).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deletePost throws when response is non-200/204 but resolved", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const spy = jest
      .spyOn(requestHttp, "delete_request")
      .mockResolvedValue({ status: 202, data: {} });

    await expect(store.deletePost(1, 3)).rejects.toThrow("Error deleting post");
    expect(store.isDeletingPost).toBe(false);

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("togglePinPost updates post in list/current", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 1, is_pinned: false }],
      currentPost: { id: 1, is_pinned: false },
    });

    mock.onPost("/api/organizations/1/posts/1/toggle-pin/").reply(200, {
      post: { id: 1, is_pinned: true },
    });

    const result = await store.togglePinPost(1, 1);

    expect(result.post.is_pinned).toBe(true);
    expect(store.managementPosts[0].is_pinned).toBe(true);
    expect(store.currentPost.is_pinned).toBe(true);
  });

  test("togglePinPost does not update list/current when post is missing", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 2, is_pinned: false }], currentPost: { id: 3, is_pinned: false } });

    mock.onPost("/api/organizations/1/posts/1/toggle-pin/").reply(200, {
      post: { id: 1, is_pinned: true },
    });

    const result = await store.togglePinPost(1, 1);

    expect(result.post.is_pinned).toBe(true);
    expect(store.managementPosts).toEqual([{ id: 2, is_pinned: false }]);
    expect(store.currentPost).toEqual({ id: 3, is_pinned: false });
  });

  test("togglePinPost throws on non-200", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/1/toggle-pin/").reply(204, {});

    await expect(store.togglePinPost(1, 1)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("togglePinPost resets isLoading on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/1/toggle-pin/").networkError();

    await expect(store.togglePinPost(1, 1)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("togglePostStatus updates post in list/current", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({
      managementPosts: [{ id: 2, is_active: false }],
      currentPost: { id: 2, is_active: false },
    });

    mock.onPost("/api/organizations/1/posts/2/toggle-status/").reply(200, {
      post: { id: 2, is_active: true },
    });

    const result = await store.togglePostStatus(1, 2);

    expect(result.post.is_active).toBe(true);
    expect(store.managementPosts[0].is_active).toBe(true);
    expect(store.currentPost.is_active).toBe(true);
  });

  test("togglePostStatus does not update list/current when post is missing", async () => {
    const store = useOrganizationPostsStore();

    store.$patch({ managementPosts: [{ id: 1, is_active: false }], currentPost: { id: 2, is_active: false } });

    mock.onPost("/api/organizations/1/posts/3/toggle-status/").reply(200, {
      post: { id: 3, is_active: true },
    });

    const result = await store.togglePostStatus(1, 3);

    expect(result.post.is_active).toBe(true);
    expect(store.managementPosts).toEqual([{ id: 1, is_active: false }]);
    expect(store.currentPost).toEqual({ id: 2, is_active: false });
  });

  test("togglePostStatus throws on non-200", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/2/toggle-status/").reply(204, {});

    await expect(store.togglePostStatus(1, 2)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("togglePostStatus resets isLoading on network error", async () => {
    const store = useOrganizationPostsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/organizations/1/posts/2/toggle-status/").networkError();

    await expect(store.togglePostStatus(1, 2)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("filters and clear methods", () => {
    const store = useOrganizationPostsStore();

    store.setFilters({ search: "x", page: 2 });
    expect(store.filters.search).toBe("x");
    expect(store.filters.page).toBe(2);

    store.clearFilters();
    expect(store.filters.search).toBe("");
    expect(store.filters.page).toBe(1);

    store.$patch({
      managementPosts: [{ id: 1 }],
      publicPosts: [{ id: 2 }],
      currentPost: { id: 1 },
      pagination: { count: 9, next: "x", previous: null, currentPage: 2, pageSize: 5 },
    });

    store.clearPosts();
    expect(store.managementPosts).toEqual([]);
    expect(store.publicPosts).toEqual([]);
    expect(store.currentPost).toBe(null);
    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);

    store.setFilters({ search: "x" });
    store.isLoading = true;
    store.isLoadingPosts = true;
    store.isCreatingPost = true;
    store.isUpdatingPost = true;
    store.isDeletingPost = true;

    store.clearAll();
    expect(store.filters.search).toBe("");
    expect(store.isLoading).toBe(false);
    expect(store.isDeletingPost).toBe(false);
  });
});
