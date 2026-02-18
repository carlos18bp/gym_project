import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useOrganizationsStore } from "@/stores/organizations";

const mock = new AxiosMockAdapter(axios);

describe("Organizations Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  const collectLoadingResets = async (store, actions) => {
    const results = [];
    for (const action of actions) {
      try {
        await action();
        results.push("resolved");
      } catch {
        results.push(store.isLoading);
      }
    }
    return results;
  };

  const collectInvitationResets = async (store, actions) => {
    const results = [];
    for (const action of actions) {
      try {
        await action();
        results.push("resolved");
      } catch {
        results.push(store.isLoadingInvitations);
      }
    }
    return results;
  };

  test("initializes with empty state", () => {
    const store = useOrganizationsStore();

    expect(store.organizations).toEqual([]);
    expect(store.currentOrganization).toBe(null);
    expect(store.myMemberships).toEqual([]);
    expect(store.invitations).toEqual([]);
    expect(store.myInvitations).toEqual([]);
    expect(store.organizationMembers).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });

  test("getters: organizationById, activeOrganizations, pendingInvitations, canRespondToInvitation", () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [
        { id: 1, is_active: true },
        { id: 2, is_active: false },
      ],
      myInvitations: [
        { id: 10, status: "PENDING", can_be_responded: true, is_expired: false },
        { id: 11, status: "ACCEPTED", can_be_responded: true, is_expired: false },
        { id: 12, status: "PENDING", can_be_responded: false, is_expired: false },
        { id: 13, status: "PENDING", can_be_responded: true, is_expired: true },
      ],
    });

    expect(store.organizationById(1)).toEqual({ id: 1, is_active: true });
    expect(store.activeOrganizations.map((o) => o.id)).toEqual([1]);

    expect(store.pendingInvitations.map((i) => i.id)).toEqual([10, 12, 13]);

    expect(store.canRespondToInvitation(10)).toBe(true);
    expect(store.canRespondToInvitation(12)).toBe(false);
    expect(store.canRespondToInvitation(13)).toBe(false);
    expect(store.canRespondToInvitation(999)).toBeUndefined();
  });

  test("createOrganization (JSON) creates and unshifts organization", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/create/").reply(201, {
      organization: { id: 1, name: "Org" },
    });

    const result = await store.createOrganization({ name: "Org" });

    expect(result.organization.id).toBe(1);
    expect(store.organizations[0]).toEqual({ id: 1, name: "Org" });
    expect(store.currentOrganization).toEqual({ id: 1, name: "Org" });
    expect(store.isLoading).toBe(false);
  });

  test("createOrganization (JSON) throws when response status is not 201", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/create/").reply(200, {
      organization: { id: 1, name: "Org" },
    });

    await expect(store.createOrganization({ name: "Org" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("createOrganization (FormData via profile_image) creates and unshifts organization", async () => {
    const store = useOrganizationsStore();

    const img = new File(["x"], "p.png", { type: "image/png" });

    mock.onPost("/api/organizations/create/").reply(201, {
      organization: { id: 2, name: "Org2" },
    });

    const result = await store.createOrganization({ name: "Org2", profile_image: img, cover_image: null });

    expect(result.organization.id).toBe(2);
    expect(store.organizations[0]).toEqual({ id: 2, name: "Org2" });
    expect(store.currentOrganization).toEqual({ id: 2, name: "Org2" });
  });

  test("createOrganization (FormData via cover_image) creates and unshifts organization", async () => {
    const store = useOrganizationsStore();

    const cover = new File(["x"], "c.png", { type: "image/png" });

    mock.onPost("/api/organizations/create/").reply(201, {
      organization: { id: 3, name: "Org3" },
    });

    const result = await store.createOrganization({ name: "Org3", profile_image: null, cover_image: cover });

    expect(result.organization.id).toBe(3);
    expect(store.organizations[0]).toEqual({ id: 3, name: "Org3" });
    expect(store.currentOrganization).toEqual({ id: 3, name: "Org3" });
  });

  test("createOrganization (FormData) throws when response status is not 201", async () => {
    const store = useOrganizationsStore();

    const img = new File(["x"], "p.png", { type: "image/png" });

    mock.onPost("/api/organizations/create/").reply(200, {
      organization: { id: 2, name: "Org2" },
    });

    await expect(
      store.createOrganization({ name: "Org2", profile_image: img, cover_image: null })
    ).rejects.toBeTruthy();

    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyOrganizations sets organizations, pagination, and cache flags", async () => {
    const store = useOrganizationsStore();

    mock
      .onGet("/api/organizations/my-organizations/?search=test&page=2")
      .reply(200, {
        results: [{ id: 1, is_active: true }],
        count: 1,
        next: null,
        previous: null,
      });

    const result = await store.getMyOrganizations({ search: "test", page: 2, is_active: "" });

    expect(result.count).toBe(1);
    expect(store.organizations).toEqual([{ id: 1, is_active: true }]);
    expect(store.pagination.currentPage).toBe(2);
    expect(store.pagination.pageSize).toBe(10);
    expect(store.dataLoaded).toBe(true);
    expect(store.lastFetchTime).toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("getMyOrganizations defaults pagination when params are missing", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/my-organizations/").reply(200, {
      results: [],
      count: 0,
      next: null,
      previous: null,
    });

    await store.getMyOrganizations();

    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
    expect(store.isLoading).toBe(false);
  });

  test("getMyOrganizations throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/my-organizations/").reply(204, { results: [] });

    await expect(store.getMyOrganizations()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getOrganizationDetail sets currentOrganization and updates in list", async () => {
    const store = useOrganizationsStore();

    store.$patch({ organizations: [{ id: 5, name: "Old" }] });

    mock.onGet("/api/organizations/5/").reply(200, { id: 5, name: "New" });

    const result = await store.getOrganizationDetail(5);

    expect(result).toEqual({ id: 5, name: "New" });
    expect(store.currentOrganization).toEqual({ id: 5, name: "New" });
    expect(store.organizations.find((o) => o.id === 5)).toEqual({ id: 5, name: "New" });
  });

  test("getOrganizationDetail does not update list when org is missing", async () => {
    const store = useOrganizationsStore();

    store.$patch({ organizations: [{ id: 5, name: "Old" }] });

    mock.onGet("/api/organizations/6/").reply(200, { id: 6, name: "New" });

    const result = await store.getOrganizationDetail(6);

    expect(result).toEqual({ id: 6, name: "New" });
    expect(store.currentOrganization).toEqual({ id: 6, name: "New" });
    expect(store.organizations).toEqual([{ id: 5, name: "Old" }]);
  });

  test("getOrganizationDetail throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/5/").reply(204, {});

    await expect(store.getOrganizationDetail(5)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("updateOrganization (JSON) updates list/current/memberships via helper", async () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 7, name: "Old" }],
      currentOrganization: { id: 7, name: "Old" },
      myMemberships: [{ id: 7, name: "Old" }],
    });

    mock.onPut("/api/organizations/7/update/").reply(200, {
      organization: { id: 7, name: "Updated" },
    });

    const result = await store.updateOrganization(7, { name: "Updated" });

    expect(result.organization.name).toBe("Updated");
    expect(store.organizations.find((o) => o.id === 7).name).toBe("Updated");
    expect(store.currentOrganization.name).toBe("Updated");
    expect(store.myMemberships.find((o) => o.id === 7).name).toBe("Updated");
  });

  test("updateOrganization (FormData) throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    const cover = new File(["x"], "c.png", { type: "image/png" });

    mock.onPost("/api/organizations/7/update/").reply(204, {
      organization: { id: 7, name: "Updated" },
    });

    await expect(
      store.updateOrganization(7, { name: "Updated", cover_image: cover })
    ).rejects.toBeTruthy();

    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("updateOrganization (FormData via cover_image) updates state via helper", async () => {
    const store = useOrganizationsStore();

    const cover = new File(["x"], "c.png", { type: "image/png" });

    store.$patch({
      organizations: [{ id: 7, name: "Old" }],
      currentOrganization: { id: 7, name: "Old" },
      myMemberships: [{ id: 7, name: "Old" }],
    });

    mock.onPost("/api/organizations/7/update/").reply(200, {
      organization: { id: 7, name: "Updated" },
    });

    const result = await store.updateOrganization(7, { name: "Updated", cover_image: cover });

    expect(result.organization.name).toBe("Updated");
    expect(store.organizations.find((o) => o.id === 7).name).toBe("Updated");
    expect(store.currentOrganization.name).toBe("Updated");
    expect(store.myMemberships.find((o) => o.id === 7).name).toBe("Updated");
  });

  test("updateOrganization (FormData via profile_image) updates state via helper", async () => {
    const store = useOrganizationsStore();

    const img = new File(["x"], "p.png", { type: "image/png" });

    store.$patch({
      organizations: [{ id: 7, name: "Old" }],
      currentOrganization: { id: 7, name: "Old" },
      myMemberships: [{ id: 7, name: "Old" }],
    });

    mock.onPost("/api/organizations/7/update/").reply(200, {
      organization: { id: 7, name: "Updated" },
    });

    const result = await store.updateOrganization(7, { name: "Updated", profile_image: img });

    expect(result.organization.name).toBe("Updated");
    expect(store.organizations.find((o) => o.id === 7).name).toBe("Updated");
    expect(store.currentOrganization.name).toBe("Updated");
    expect(store.myMemberships.find((o) => o.id === 7).name).toBe("Updated");
  });

  test("updateOrganization throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onPut("/api/organizations/7/update/").reply(204, {
      organization: { id: 7, name: "Updated" },
    });

    await expect(store.updateOrganization(7, { name: "Updated" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("deleteOrganization removes organization and clears currentOrganization", async () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 9, name: "X" }],
      currentOrganization: { id: 9, name: "X" },
    });

    mock.onDelete("/api/organizations/9/delete/").reply(200, { ok: true });

    const result = await store.deleteOrganization(9);

    expect(result).toEqual({ ok: true });
    expect(store.organizations).toEqual([]);
    expect(store.currentOrganization).toBe(null);
  });

  test("deleteOrganization keeps currentOrganization when different", async () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 9, name: "X" }],
      currentOrganization: { id: 10, name: "Y" },
    });

    mock.onDelete("/api/organizations/9/delete/").reply(200, { ok: true });

    await store.deleteOrganization(9);

    expect(store.organizations).toEqual([]);
    expect(store.currentOrganization).toEqual({ id: 10, name: "Y" });
  });

  test("deleteOrganization throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onDelete("/api/organizations/9/delete/").reply(204, { ok: true });

    await expect(store.deleteOrganization(9)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("sendInvitation unshifts invitation", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/1/invitations/send/").reply(201, {
      invitation: { id: 1, status: "PENDING" },
    });

    const result = await store.sendInvitation(1, { invited_user_email: "x@test.com" });

    expect(result.invitation.id).toBe(1);
    expect(store.invitations[0].id).toBe(1);
    expect(store.isLoadingInvitations).toBe(false);
  });

  test("sendInvitation throws when response status is not 201", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/1/invitations/send/").reply(200, {
      invitation: { id: 1, status: "PENDING" },
    });

    await expect(store.sendInvitation(1, { invited_user_email: "x@test.com" })).rejects.toBeTruthy();
    expect(store.isLoadingInvitations).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getOrganizationInvitations sets invitations and supports query params", async () => {
    const store = useOrganizationsStore();

    mock
      .onGet("/api/organizations/1/invitations/?status=PENDING")
      .reply(200, [{ id: 1 }, { id: 2 }]);

    const result = await store.getOrganizationInvitations(1, { status: "PENDING" });

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.invitations).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.isLoadingInvitations).toBe(false);
  });

  test("getOrganizationInvitations ignores empty params", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/invitations/").reply(200, [{ id: 3 }]);

    await store.getOrganizationInvitations(1, { status: "" });

    expect(store.invitations).toEqual([{ id: 3 }]);
    expect(mock.history.get[0].url).toBe("/api/organizations/1/invitations/");
  });

  test("getOrganizationInvitations throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/invitations/").reply(204, []);

    await expect(store.getOrganizationInvitations(1)).rejects.toBeTruthy();
    expect(store.isLoadingInvitations).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("cancelInvitation removes invitation from state", async () => {
    const store = useOrganizationsStore();

    store.$patch({ invitations: [{ id: 1 }, { id: 2 }] });

    mock.onDelete("/api/organizations/1/invitations/2/cancel/").reply(200, { ok: true });

    const result = await store.cancelInvitation(1, 2);

    expect(result.ok).toBe(true);
    expect(store.invitations).toEqual([{ id: 1 }]);
    expect(store.isLoadingInvitations).toBe(false);
  });

  test("cancelInvitation throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onDelete("/api/organizations/1/invitations/2/cancel/").reply(204, { ok: true });

    await expect(store.cancelInvitation(1, 2)).rejects.toBeTruthy();
    expect(store.isLoadingInvitations).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyInvitations sets myInvitations and pagination", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/invitations/my-invitations/?page=3").reply(200, {
      results: [{ id: 10, status: "PENDING" }],
      count: 1,
      next: null,
      previous: null,
    });

    const result = await store.getMyInvitations({ page: 3 });

    expect(result.count).toBe(1);
    expect(store.myInvitations).toEqual([{ id: 10, status: "PENDING" }]);
    expect(store.pagination.currentPage).toBe(3);
  });

  test("getMyInvitations ignores empty params", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/invitations/my-invitations/").reply(200, {
      results: [{ id: 11, status: "PENDING" }],
      count: 1,
      next: null,
      previous: null,
    });

    await store.getMyInvitations({ status: "" });

    expect(store.myInvitations).toEqual([{ id: 11, status: "PENDING" }]);
    expect(mock.history.get[0].url).toBe("/api/invitations/my-invitations/");
  });

  test("getMyInvitations defaults pagination when params are missing", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/invitations/my-invitations/").reply(200, {
      results: [],
      count: 0,
      next: null,
      previous: null,
    });

    await store.getMyInvitations();

    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
    expect(store.isLoadingInvitations).toBe(false);
  });

  test("getMyInvitations throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/invitations/my-invitations/").reply(204, { results: [] });

    await expect(store.getMyInvitations()).rejects.toBeTruthy();
    expect(store.isLoadingInvitations).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("respondToInvitation updates invitation and refreshes memberships on accept", async () => {
    const store = useOrganizationsStore();

    store.$patch({ myInvitations: [{ id: 20, status: "PENDING" }], myMemberships: [] });

    mock.onPost("/api/invitations/20/respond/").reply(200, {
      invitation: { id: 20, status: "ACCEPTED" },
    });

    const membershipsSpy = jest.spyOn(store, "getMyMemberships").mockResolvedValue({ organizations: [{ id: 1 }] });

    const result = await store.respondToInvitation(20, "accept");

    expect(result.invitation.status).toBe("ACCEPTED");
    expect(store.myInvitations.find((i) => i.id === 20).status).toBe("ACCEPTED");
    expect(membershipsSpy).toHaveBeenCalled();
  });

  test("respondToInvitation keeps invitations when not found", async () => {
    const store = useOrganizationsStore();

    store.$patch({ myInvitations: [] });

    mock.onPost("/api/invitations/21/respond/").reply(200, {
      invitation: { id: 21, status: "ACCEPTED" },
    });

    const membershipsSpy = jest.spyOn(store, "getMyMemberships").mockResolvedValue({
      organizations: [{ id: 1 }],
    });

    await store.respondToInvitation(21, "accept");

    expect(store.myInvitations).toEqual([]);
    expect(membershipsSpy).toHaveBeenCalled();
  });

  test("respondToInvitation does not refresh memberships on reject", async () => {
    const store = useOrganizationsStore();

    store.$patch({ myInvitations: [{ id: 20, status: "PENDING" }], myMemberships: [{ id: 1 }] });

    mock.onPost("/api/invitations/20/respond/").reply(200, {
      invitation: { id: 20, status: "REJECTED" },
    });

    const membershipsSpy = jest.spyOn(store, "getMyMemberships").mockResolvedValue({
      organizations: [{ id: 1 }],
    });

    const result = await store.respondToInvitation(20, "reject");

    expect(result.invitation.status).toBe("REJECTED");
    expect(membershipsSpy).not.toHaveBeenCalled();
  });

  test("respondToInvitation throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/invitations/20/respond/").reply(204, {
      invitation: { id: 20, status: "ACCEPTED" },
    });

    await expect(store.respondToInvitation(20, "accept")).rejects.toBeTruthy();
    expect(store.isLoadingInvitations).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyMemberships sets myMemberships", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/my-memberships/").reply(200, {
      organizations: [{ id: 1 }, { id: 2 }],
    });

    const result = await store.getMyMemberships();

    expect(result.organizations).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.myMemberships).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.isLoading).toBe(false);
  });

  test("getMyMemberships throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/my-memberships/").reply(204, { organizations: [] });

    await expect(store.getMyMemberships()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("leaveOrganization removes membership", async () => {
    const store = useOrganizationsStore();

    store.$patch({ myMemberships: [{ id: 30 }, { id: 31 }] });

    mock.onPost("/api/organizations/30/leave/").reply(200, { ok: true });

    const result = await store.leaveOrganization(30);

    expect(result.ok).toBe(true);
    expect(store.myMemberships.map((o) => o.id)).toEqual([31]);
  });

  test("leaveOrganization throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/30/leave/").reply(204, { ok: true });

    await expect(store.leaveOrganization(30)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getOrganizationMembers sets organizationMembers", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/members/").reply(200, { members: [{ id: 1 }, { id: 2 }] });

    const result = await store.getOrganizationMembers(1);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.organizationMembers).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("getOrganizationMembers supports query params and defaults members to []", async () => {
    const store = useOrganizationsStore();

    mock
      .onGet("/api/organizations/1/members/?is_active=true&role=client")
      .reply(200, {});

    const result = await store.getOrganizationMembers(1, { is_active: true, role: "client" });

    expect(result).toEqual([]);
    expect(store.organizationMembers).toEqual([]);
    expect(store.isLoadingMembers).toBe(false);
  });

  test("getOrganizationMembers ignores empty params", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/members/").reply(200, { members: [{ id: 1 }] });

    const result = await store.getOrganizationMembers(1, { is_active: "", role: null });

    expect(result).toEqual([{ id: 1 }]);
    expect(store.organizationMembers).toEqual([{ id: 1 }]);
    expect(mock.history.get[0].url).toBe("/api/organizations/1/members/");
  });

  test("getOrganizationMembers throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/members/").reply(204, {});

    await expect(store.getOrganizationMembers(1)).rejects.toBeTruthy();
    expect(store.isLoadingMembers).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("removeMember removes member from state", async () => {
    const store = useOrganizationsStore();

    store.$patch({ organizationMembers: [{ id: 1 }, { id: 2 }] });

    mock.onDelete("/api/organizations/1/members/2/remove/").reply(200, { ok: true });

    const result = await store.removeMember(1, 2);

    expect(result.ok).toBe(true);
    expect(store.organizationMembers).toEqual([{ id: 1 }]);
  });

  test("removeMember throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onDelete("/api/organizations/1/members/2/remove/").reply(204, { ok: true });

    await expect(store.removeMember(1, 2)).rejects.toBeTruthy();
    expect(store.isLoadingMembers).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getOrganizationStats sets organizationStats", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/stats/").reply(200, { total_organizations: 1 });

    const result = await store.getOrganizationStats();

    expect(result.total_organizations).toBe(1);
    expect(store.organizationStats.total_organizations).toBe(1);
  });

  test("getOrganizationStats throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/stats/").reply(204, {});

    await expect(store.getOrganizationStats()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getOrganizationPublicInfo returns response data", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/99/public/").reply(200, { id: 99, name: "Public" });

    const result = await store.getOrganizationPublicInfo(99);

    expect(result).toEqual({ id: 99, name: "Public" });
  });

  test("getOrganizationPublicInfo throws when response status is not 200", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/99/public/").reply(204, {});

    await expect(store.getOrganizationPublicInfo(99)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("resets isLoading for organization create/detail actions", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/create/").networkError();
    mock.onGet("/api/organizations/my-organizations/").networkError();
    mock.onGet("/api/organizations/5/").networkError();

    const results = await collectLoadingResets(store, [
      () => store.createOrganization({ name: "Org" }),
      () => store.getMyOrganizations(),
      () => store.getOrganizationDetail(5),
    ]);

    expect(results).toEqual([false, false, false]);
  });

  test("resets isLoading for organization update/delete actions", async () => {
    const store = useOrganizationsStore();

    mock.onPut("/api/organizations/7/update/").networkError();
    mock.onDelete("/api/organizations/9/delete/").networkError();
    mock.onPost("/api/organizations/30/leave/").networkError();

    const results = await collectLoadingResets(store, [
      () => store.updateOrganization(7, { name: "Updated" }),
      () => store.deleteOrganization(9),
      () => store.leaveOrganization(30),
    ]);

    expect(results).toEqual([false, false, false]);
  });

  test("resets isLoading for membership/stats/public info actions", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/my-memberships/").networkError();
    mock.onGet("/api/organizations/stats/").networkError();
    mock.onGet("/api/organizations/99/public/").networkError();

    const results = await collectLoadingResets(store, [
      () => store.getMyMemberships(),
      () => store.getOrganizationStats(),
      () => store.getOrganizationPublicInfo(99),
    ]);

    expect(results).toEqual([false, false, false]);
  });

  test("resets isLoadingInvitations on invitation action network errors", async () => {
    const store = useOrganizationsStore();

    mock.onPost("/api/organizations/1/invitations/send/").networkError();
    mock.onGet("/api/organizations/1/invitations/").networkError();
    mock.onDelete("/api/organizations/1/invitations/2/cancel/").networkError();
    mock.onGet("/api/invitations/my-invitations/").networkError();
    mock.onPost("/api/invitations/20/respond/").networkError();

    const results = await collectInvitationResets(store, [
      () => store.sendInvitation(1, { invited_user_email: "x@test.com" }),
      () => store.getOrganizationInvitations(1),
      () => store.cancelInvitation(1, 2),
      () => store.getMyInvitations(),
      () => store.respondToInvitation(20, "accept"),
    ]);

    expect(results).toEqual([false, false, false, false, false]);
  });

  test("resets isLoadingMembers on member action network errors", async () => {
    const store = useOrganizationsStore();

    mock.onGet("/api/organizations/1/members/").networkError();
    mock.onDelete("/api/organizations/1/members/2/remove/").networkError();

    await expect(store.getOrganizationMembers(1)).rejects.toBeTruthy();
    expect(store.isLoadingMembers).toBe(false);

    await expect(store.removeMember(1, 2)).rejects.toBeTruthy();
    expect(store.isLoadingMembers).toBe(false);
  });

  test("_updateOrganizationInState updates list, currentOrganization, and memberships", () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 1, name: "Old" }],
      currentOrganization: { id: 1, name: "Old" },
      myMemberships: [{ id: 1, name: "Old" }],
    });

    store._updateOrganizationInState(1, { id: 1, name: "New" });

    expect(store.organizations[0].name).toBe("New");
    expect(store.currentOrganization.name).toBe("New");
    expect(store.myMemberships[0].name).toBe("New");
  });

  test("_updateOrganizationInState leaves state when organization missing", () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 1, name: "Old" }],
      currentOrganization: null,
      myMemberships: [{ id: 3, name: "Keep" }],
    });

    store._updateOrganizationInState(2, { id: 2, name: "New" });

    expect(store.organizations).toEqual([{ id: 1, name: "Old" }]);
    expect(store.currentOrganization).toBe(null);
    expect(store.myMemberships).toEqual([{ id: 3, name: "Keep" }]);
  });

  test("clearAll resets store", () => {
    const store = useOrganizationsStore();

    store.$patch({
      organizations: [{ id: 1 }],
      currentOrganization: { id: 1 },
      myMemberships: [{ id: 1 }],
      invitations: [{ id: 1 }],
      myInvitations: [{ id: 1 }],
      organizationMembers: [{ id: 1 }],
      dataLoaded: true,
      lastFetchTime: "x",
      organizationStats: { total_organizations: 9 },
    });

    store.clearAll();

    expect([
      store.organizations,
      store.currentOrganization,
      store.myMemberships,
      store.invitations,
      store.myInvitations,
      store.organizationMembers,
      store.dataLoaded,
      store.lastFetchTime,
      store.organizationStats.total_organizations,
    ]).toEqual([[], null, [], [], [], [], false, null, 0]);
  });
});
