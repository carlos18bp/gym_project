let mockDynamicDocumentStore;
let mockUserStore;

const mockShowNotification = jest.fn();

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDynamicDocumentStore,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

import { reactive } from "vue";
import { useDocumentPermissions } from "@/composables/document-variables/useDocumentPermissions";

const buildRoleClients = () => [
  {
    user_id: 1,
    id: 1,
    email: "client1@test.com",
    full_name: "Client One",
    role: "client",
  },
  {
    user_id: 2,
    id: 2,
    email: "corp@test.com",
    full_name: "Corp User",
    role: "corporate_client",
  },
  {
    user_id: 3,
    id: 3,
    email: "basic@test.com",
    full_name: "Basic User",
    role: "basic",
  },
];

const buildVisibilityClients = () => [
  {
    user_id: 1,
    id: 1,
    email: "c1@test.com",
    full_name: "C1",
    role: "client",
  },
  {
    user_id: 2,
    id: 2,
    email: "c2@test.com",
    full_name: "C2",
    role: "client",
  },
  {
    user_id: 3,
    id: 3,
    email: "b@test.com",
    full_name: "B",
    role: "basic",
  },
];

describe("useDocumentPermissions", () => {
  beforeEach(() => {
    mockShowNotification.mockReset();
    mockShowNotification.mockResolvedValue();

    mockDynamicDocumentStore = {
      fetchAvailableClients: jest.fn(),
      fetchAvailableRoles: jest.fn(),
      fetchDocumentPermissions: jest.fn(),
      selectedDocument: null,
    };

    mockUserStore = {
      getCurrentUser: { role: "lawyer" },
    };

    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  test("isLawyer false: loadAvailableClients does nothing", async () => {
    mockUserStore.getCurrentUser = { role: "client" };

    const permissions = useDocumentPermissions();

    await permissions.loadAvailableClients();

    expect(permissions.isLawyer.value).toBe(false);
    expect(mockDynamicDocumentStore.fetchAvailableClients).not.toHaveBeenCalled();
    expect(permissions.isLoadingClients.value).toBe(false);
  });

  test("filteredClients: handles non-array, empty query, and query filtering", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = "not-array";
    expect(permissions.filteredClients.value).toEqual([]);

    permissions.availableClients.value = [
      { user_id: 1, id: 1, full_name: "John Doe", email: "john@test.com" },
      { user_id: 2, id: 2, full_name: "Jane Smith", email: "jane@corp.com" },
      { user_id: 3, id: 3, full_name: "Other", email: "x@y.com" },
    ];

    permissions.clientSearchQuery.value = "";
    expect(permissions.filteredClients.value).toHaveLength(3);

    permissions.clientSearchQuery.value = "jane";
    expect(permissions.filteredClients.value).toEqual([
      { user_id: 2, id: 2, full_name: "Jane Smith", email: "jane@corp.com" },
    ]);

    permissions.clientSearchQuery.value = "TEST.COM";
    expect(permissions.filteredClients.value).toEqual([
      { user_id: 1, id: 1, full_name: "John Doe", email: "john@test.com" },
    ]);
  });

  test("filteredClients trims query before filtering", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { user_id: 1, id: 1, full_name: "Alpha", email: "alpha@test.com" },
      { user_id: 2, id: 2, full_name: "Beta", email: "beta@test.com" },
    ];

    permissions.clientSearchQuery.value = "  ALPHA ";

    expect(permissions.filteredClients.value).toEqual([
      { user_id: 1, id: 1, full_name: "Alpha", email: "alpha@test.com" },
    ]);
  });

  test("loadAvailableClients: sets availableClients from store and handles invalid response", async () => {
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockResolvedValueOnce([
      { user_id: 1, id: 1, full_name: "A", email: "a@test.com" },
    ]);

    const promise = permissions.loadAvailableClients();
    expect(permissions.isLoadingClients.value).toBe(true);

    await promise;

    expect(permissions.isLoadingClients.value).toBe(false);
    expect(permissions.availableClients.value).toEqual([
      { user_id: 1, id: 1, full_name: "A", email: "a@test.com" },
    ]);

    mockDynamicDocumentStore.fetchAvailableClients.mockResolvedValueOnce({});
    await permissions.loadAvailableClients();
    expect(permissions.availableClients.value).toEqual([]);
  });

  test("loadAvailableClients: notifies on error and clears clients", async () => {
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockRejectedValueOnce(
      new Error("fail")
    );

    await permissions.loadAvailableClients();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar clientes disponibles",
      "error"
    );
    expect(permissions.availableClients.value).toEqual([]);
    expect(permissions.isLoadingClients.value).toBe(false);
  });

  test("loadAvailableRoles: sets availableRoles from rolesData.roles and handles errors/invalid format", async () => {
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValueOnce({
      roles: [
        { code: "client", display_name: "Cliente" },
        { code: "basic", display_name: "Básico" },
      ],
    });

    await permissions.initializePermissions({});

    expect(permissions.availableRoles.value).toEqual([
      { code: "client", display_name: "Cliente" },
      { code: "basic", display_name: "Básico" },
    ]);
    expect(permissions.hasAvailableRoles.value).toBe(true);

    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValueOnce([
      { code: "client", display_name: "Cliente" },
    ]);

    await permissions.initializePermissions({});
    expect(permissions.availableRoles.value).toEqual([]);

    mockDynamicDocumentStore.fetchAvailableRoles.mockRejectedValueOnce(
      new Error("fail")
    );

    await permissions.initializePermissions({});

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar roles disponibles",
      "error"
    );
    expect(permissions.isLoadingRoles.value).toBe(false);
  });

  test("loadDocumentPermissions: uses fetchDocumentPermissions, initializes with selectedDocument on error", async () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      {
        user_id: 1,
        id: 1,
        email: "client1@test.com",
        full_name: "Client One",
        role: "client",
      },
    ];

    mockDynamicDocumentStore.fetchDocumentPermissions.mockResolvedValueOnce({
      is_public: true,
      visibility_permissions: [
        { user_id: 1, email: "client1@test.com", full_name: "Client One" },
      ],
    });

    await permissions.loadDocumentPermissions(10);

    expect(mockDynamicDocumentStore.fetchDocumentPermissions).toHaveBeenCalledWith(10);
    expect(permissions.isPublicDocument.value).toBe(true);
    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);

    mockDynamicDocumentStore.selectedDocument = {
      is_public: false,
      visibility_permissions: [
        { user_id: 1, email: "client1@test.com", full_name: "Client One" },
      ],
    };
    mockDynamicDocumentStore.fetchDocumentPermissions.mockRejectedValueOnce(
      new Error("fail")
    );

    await permissions.loadDocumentPermissions(99);

    expect(permissions.isPublicDocument.value).toBe(false);
    expect(permissions.selectedVisibilityUsers.value).toEqual([
      {
        id: 1,
        user_id: 1,
        email: "client1@test.com",
        full_name: "Client One",
      },
    ]);
  });

  test("loadDocumentPermissions returns early when missing documentId or user not lawyer", async () => {
    const permissions = useDocumentPermissions();

    await permissions.loadDocumentPermissions(null);
    expect(mockDynamicDocumentStore.fetchDocumentPermissions).not.toHaveBeenCalled();

    mockUserStore.getCurrentUser = { role: "client" };
    const nonLawyerPermissions = useDocumentPermissions();

    await nonLawyerPermissions.loadDocumentPermissions(10);
    expect(mockDynamicDocumentStore.fetchDocumentPermissions).not.toHaveBeenCalled();
  });

  test("initializeExistingPermissions returns early when no data or non-lawyer", () => {
    const permissions = useDocumentPermissions();

    permissions.selectedVisibilityUsers.value = [{ id: 1 }];
    permissions.initializeExistingPermissions(null);
    expect(permissions.selectedVisibilityUsers.value).toEqual([{ id: 1 }]);

    mockUserStore.getCurrentUser = { role: "client" };
    const nonLawyerPermissions = useDocumentPermissions();
    nonLawyerPermissions.selectedVisibilityUsers.value = [{ id: 2 }];
    nonLawyerPermissions.initializeExistingPermissions({ is_public: false });
    expect(nonLawyerPermissions.selectedVisibilityUsers.value).toEqual([{ id: 2 }]);
  });

  test("initializeExistingPermissions ignores non-boolean public flag and non-array visibility list", () => {
    const permissions = useDocumentPermissions();

    permissions.initializeExistingPermissions({
      is_public: "yes",
      visibility_permissions: {},
    });

    expect(permissions.isPublicDocument.value).toBe(false);
    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
  });

  test("initializeExistingPermissions keeps permissions when client lookup misses", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      {
        user_id: 1,
        id: 1,
        email: "client@test.com",
        full_name: "Client",
        role: "client",
      },
    ];

    permissions.initializeExistingPermissions({
      is_public: false,
      active_roles: { visibility_roles: ["client"] },
      visibility_permissions: [
        { user_id: 999, email: "missing@test.com", full_name: "Missing" },
      ],
    });

    expect(permissions.selectedVisibilityUsers.value).toEqual([
      { id: 999, user_id: 999, email: "missing@test.com", full_name: "Missing" },
    ]);
  });

  test("initializeExistingPermissions marks document public and clears selections", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = buildRoleClients();
    permissions.selectedVisibilityUsers.value = [{ id: 5 }];
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedUsabilityUsers.value = [{ id: 8 }];
    permissions.selectedRolesUsability.value = ["basic"];

    permissions.initializeExistingPermissions({ is_public: true });

    expect(permissions.isPublicDocument.value).toBe(true);
    expect([
      permissions.selectedVisibilityUsers.value,
      permissions.selectedUsabilityUsers.value,
      permissions.selectedRolesVisibility.value,
      permissions.selectedRolesUsability.value,
    ]).toEqual([[], [], [], []]);
  });

  test("initializeExistingPermissions sets roles and filters individual permissions", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = buildRoleClients();

    permissions.initializeExistingPermissions({
      is_public: false,
      active_roles: {
        visibility_roles: ["client"],
        usability_roles: ["basic"],
      },
      visibility_permissions: [
        {
          user_id: 1,
          email: "client1@test.com",
          full_name: "Client One",
        },
        {
          user_id: 2,
          email: "corp@test.com",
          full_name: "Corp User",
        },
        {
          user_id: 999,
          email: "missing@test.com",
        },
      ],
      usability_permissions: [
        {
          user_id: 3,
          email: "basic@test.com",
          full_name: "Basic User",
        },
        {
          user_id: 2,
          email: "corp@test.com",
          full_name: "Corp User",
        },
      ],
    });

    expect([
      permissions.isPublicDocument.value,
      permissions.selectedRolesVisibility.value,
      permissions.selectedRolesUsability.value,
    ]).toEqual([false, ["client"], ["basic"]]);
    expect({
      visibility: permissions.selectedVisibilityUsers.value,
      usability: permissions.selectedUsabilityUsers.value,
    }).toEqual({
      visibility: [{ id: 2, user_id: 2, email: "corp@test.com", full_name: "Corp User" }],
      usability: [{ id: 2, user_id: 2, email: "corp@test.com", full_name: "Corp User" }],
    });
  });

  test("initializeExistingPermissions matches clients by id when user_id differs", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      {
        user_id: 999,
        id: 5,
        email: "client@test.com",
        full_name: "Client",
        role: "client",
      },
    ];

    permissions.initializeExistingPermissions({
      is_public: false,
      active_roles: { visibility_roles: ["client"] },
      visibility_permissions: [
        { user_id: 5, email: "client@test.com", full_name: "Client" },
      ],
    });

    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
  });

  test("initializeExistingPermissions keeps individual permissions when no active roles", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [];

    permissions.initializeExistingPermissions({
      is_public: false,
      visibility_permissions: [
        { user_id: 1, email: "user@test.com", full_name: "User" },
        { user_id: 2, email: "missing@test.com" },
      ],
      usability_permissions: [
        { user_id: 3, email: "use@test.com", full_name: "Use" },
      ],
    });

    expect(permissions.selectedVisibilityUsers.value).toEqual([
      { id: 1, user_id: 1, email: "user@test.com", full_name: "User" },
    ]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([
      { id: 3, user_id: 3, email: "use@test.com", full_name: "Use" },
    ]);
  });

  test("initializeExistingPermissions keeps usability users when client role is missing", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { user_id: 1, id: 1, email: "no-role@test.com", full_name: "No Role" },
    ];

    permissions.initializeExistingPermissions({
      is_public: false,
      active_roles: { usability_roles: ["basic"] },
      usability_permissions: [
        { user_id: 1, email: "no-role@test.com", full_name: "No Role" },
      ],
    });

    expect(permissions.selectedUsabilityUsers.value).toEqual([
      { id: 1, user_id: 1, email: "no-role@test.com", full_name: "No Role" },
    ]);
  });

  test("initializeExistingPermissions includes users when availableClients is not an array", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = null;

    permissions.initializeExistingPermissions({
      is_public: false,
      active_roles: { visibility_roles: ["client"] },
      visibility_permissions: [
        { user_id: 1, email: "user@test.com", full_name: "User" },
      ],
    });

    expect(permissions.selectedVisibilityUsers.value).toEqual([
      { id: 1, user_id: 1, email: "user@test.com", full_name: "User" },
    ]);
  });

  test("toggleVisibilityPermission cascades removal from usability", () => {
    const permissions = useDocumentPermissions();

    const user = { id: 1, user_id: 1, email: "a@test.com", full_name: "A" };
    permissions.selectedVisibilityUsers.value = [user];
    permissions.selectedUsabilityUsers.value = [user];

    permissions.toggleVisibilityPermission(user);

    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);

    permissions.toggleVisibilityPermission(user);
    expect(permissions.selectedVisibilityUsers.value).toEqual([user]);
  });

  test("toggleVisibilityPermission removes visibility even when usability is missing", () => {
    const permissions = useDocumentPermissions();

    const user = { id: 2, user_id: 2, email: "b@test.com", full_name: "B" };
    permissions.selectedVisibilityUsers.value = [user];
    permissions.selectedUsabilityUsers.value = [];

    permissions.toggleVisibilityPermission(user);

    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);
  });

  test("toggleRoleVisibilityPermission adds user when user_id is null", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      {
        id: 10,
        user_id: null,
        email: "null@test.com",
        full_name: "Null User",
        role: "client",
      },
    ];

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedVisibilityUsers.value).toEqual([
      {
        id: 10,
        user_id: 10,
        email: "null@test.com",
        full_name: "Null User",
      },
    ]);
  });

  test("toggleUsabilityPermission requires visibility and toggles usability", () => {
    const permissions = useDocumentPermissions();

    const user = { id: 1, user_id: 1, email: "a@test.com", full_name: "A" };

    permissions.toggleUsabilityPermission(user);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "El usuario debe tener permisos de visualización primero",
      "warning"
    );
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);

    permissions.selectedVisibilityUsers.value.push(user);
    permissions.toggleUsabilityPermission(user);
    expect(permissions.selectedUsabilityUsers.value).toEqual([user]);

    permissions.toggleUsabilityPermission(user);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);
  });

  test("toggleRoleVisibilityPermission removes users by id fallback", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { id: 8, user_id: null, email: "id@test.com", full_name: "Id Only", role: "client" },
    ];
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = ["client"];
    permissions.selectedVisibilityUsers.value = [{ id: 8 }];
    permissions.selectedUsabilityUsers.value = [{ id: 8 }];

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);
    expect(permissions.selectedRolesUsability.value).toEqual([]);
  });

  test("toggleRoleVisibilityPermission avoids duplicates when user already selected", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { user_id: 7, id: 7, email: "dup@test.com", full_name: "Dup", role: "client" },
    ];
    permissions.selectedVisibilityUsers.value = [{ id: 7 }];

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedVisibilityUsers.value).toEqual([{ id: 7 }]);
  });

  test("toggleRoleVisibilityPermission handles non-array availableClients", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = null;

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedRolesVisibility.value).toEqual(["client"]);
    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
  });

  test("toggleRoleVisibilityPermission removal skips usability and keeps users when no clients match", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [];
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = [];
    permissions.selectedVisibilityUsers.value = [{ id: 1, user_id: 1 }];
    permissions.selectedUsabilityUsers.value = [{ id: 2, user_id: 2 }];

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedRolesVisibility.value).toEqual([]);
    expect(permissions.selectedVisibilityUsers.value).toEqual([{ id: 1, user_id: 1 }]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([{ id: 2, user_id: 2 }]);
  });

  test("hasVisibilityPermission/hasUsabilityPermission checks id and user_id", () => {
    const permissions = useDocumentPermissions();

    const user = { id: 1, user_id: 1 };

    permissions.selectedVisibilityUsers.value = [{ id: 1, user_id: 1 }];
    permissions.selectedUsabilityUsers.value = [{ id: 1, user_id: 1 }];

    expect(permissions.hasVisibilityPermission(user)).toBe(true);
    expect(permissions.hasVisibilityPermission({ id: 2, user_id: 2 })).toBe(false);

    expect(permissions.hasUsabilityPermission(user)).toBe(true);
    expect(permissions.hasUsabilityPermission({ id: 2, user_id: 2 })).toBe(false);

    expect(permissions.hasVisibilityPermission(null)).toBe(false);
    expect(permissions.hasUsabilityPermission(undefined)).toBe(false);
  });

  test("togglePublicAccess clears permissions when switching to public", () => {
    const permissions = useDocumentPermissions();

    permissions.selectedVisibilityUsers.value = [{ id: 1, user_id: 1 }];
    permissions.selectedUsabilityUsers.value = [{ id: 2, user_id: 2 }];
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = ["basic"];

    permissions.togglePublicAccess();

    expect(permissions.isPublicDocument.value).toBe(true);
    expect(permissions.selectedVisibilityUsers.value).toEqual([]);
    expect(permissions.selectedUsabilityUsers.value).toEqual([]);
    expect(permissions.selectedRolesVisibility.value).toEqual([]);
    expect(permissions.selectedRolesUsability.value).toEqual([]);

    permissions.togglePublicAccess();
    expect(permissions.isPublicDocument.value).toBe(false);
  });

  test("toggleRoleVisibilityPermission adds clients for role", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = buildVisibilityClients();
    permissions.selectedVisibilityUsers.value = [
      { id: 1, user_id: 1, email: "c1@test.com", full_name: "C1" },
    ];

    permissions.toggleRoleVisibilityPermission("client");

    expect(permissions.selectedRolesVisibility.value).toEqual(["client"]);
    expect(permissions.selectedVisibilityUsers.value).toEqual([
      { id: 1, user_id: 1, email: "c1@test.com", full_name: "C1" },
      { id: 2, user_id: 2, email: "c2@test.com", full_name: "C2" },
    ]);
  });

  test("toggleRoleVisibilityPermission removes roles and users when toggling off", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = buildVisibilityClients();
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = ["client"];
    permissions.selectedVisibilityUsers.value = [
      { id: 1, user_id: 1, email: "c1@test.com", full_name: "C1" },
      { id: 2, user_id: 2, email: "c2@test.com", full_name: "C2" },
    ];
    permissions.selectedUsabilityUsers.value = [
      { id: 2, user_id: 2, email: "c2@test.com", full_name: "C2" },
    ];

    permissions.toggleRoleVisibilityPermission("client");

    expect([
      permissions.selectedRolesVisibility.value,
      permissions.selectedRolesUsability.value,
      permissions.selectedVisibilityUsers.value,
      permissions.selectedUsabilityUsers.value,
    ]).toEqual([[], [], [], []]);
  });

  test("toggleRoleUsabilityPermission requires role visibility and toggles usability", () => {
    const permissions = useDocumentPermissions();

    permissions.toggleRoleUsabilityPermission("client");

    expect(mockShowNotification).toHaveBeenCalledWith(
      "El rol debe tener permisos de visualización primero",
      "warning"
    );

    permissions.selectedRolesVisibility.value = ["client"];

    permissions.toggleRoleUsabilityPermission("client");
    expect(permissions.selectedRolesUsability.value).toEqual(["client"]);

    permissions.toggleRoleUsabilityPermission("client");
    expect(permissions.selectedRolesUsability.value).toEqual([]);
  });

  test("getRoleDisplayName returns display_name if available", () => {
    const permissions = useDocumentPermissions();

    permissions.availableRoles.value = [
      { code: "client", display_name: "Cliente" },
    ];

    expect(permissions.getRoleDisplayName("client")).toBe("Cliente");
    expect(permissions.getRoleDisplayName("unknown")).toBe("unknown");
  });

  test("getPermissionsDataExpanded expands role permissions to user IDs and respects public documents", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { user_id: 1, role: "client" },
      { user_id: 2, role: "client" },
      { user_id: 3, role: "basic" },
    ];

    permissions.selectedVisibilityUsers.value = [
      { user_id: 99, id: 99 },
    ];

    permissions.selectedUsabilityUsers.value = [
      { user_id: 100, id: 100 },
    ];

    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = ["basic"];

    const expanded = permissions.getPermissionsDataExpanded();

    expect(expanded.is_public).toBe(false);
    expect(expanded.visibility_user_ids.sort()).toEqual([1, 2, 99].sort());
    expect(expanded.usability_user_ids.sort()).toEqual([3, 100].sort());

    permissions.isPublicDocument.value = true;
    const expandedPublic = permissions.getPermissionsDataExpanded();

    expect(expandedPublic).toEqual({
      is_public: true,
      visibility_user_ids: [],
      usability_user_ids: [],
    });
  });

  test("getPermissionsDataExpanded handles empty role lists", () => {
    const permissions = useDocumentPermissions();

    permissions.selectedVisibilityUsers.value = [{ user_id: 1 }];
    permissions.selectedUsabilityUsers.value = [{ user_id: 2 }];
    permissions.selectedRolesVisibility.value = [];
    permissions.selectedRolesUsability.value = [];

    const expanded = permissions.getPermissionsDataExpanded();

    expect(expanded.visibility_user_ids).toEqual([1]);
    expect(expanded.usability_user_ids).toEqual([2]);
  });

  test("getPermissionsData returns roles and user_ids and respects public documents", () => {
    const permissions = useDocumentPermissions();

    permissions.isPublicDocument.value = false;
    permissions.selectedRolesVisibility.value = ["client"];
    permissions.selectedRolesUsability.value = ["basic"];
    permissions.selectedVisibilityUsers.value = [{ user_id: 1 }];
    permissions.selectedUsabilityUsers.value = [{ user_id: 2 }];

    expect(permissions.getPermissionsData()).toEqual({
      is_public: false,
      visibility: { roles: ["client"], user_ids: [1] },
      usability: { roles: ["basic"], user_ids: [2] },
    });

    permissions.isPublicDocument.value = true;

    expect(permissions.getPermissionsData()).toEqual({
      is_public: true,
      visibility: { roles: [], user_ids: [] },
      usability: { roles: [], user_ids: [] },
    });
  });

  test("initializePermissions loads clients/roles and loads document permissions when document has id", async () => {
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockResolvedValueOnce([
      { user_id: 1, id: 1, role: "client" },
    ]);
    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValueOnce({
      roles: [{ code: "client", display_name: "Cliente" }],
    });
    mockDynamicDocumentStore.fetchDocumentPermissions.mockResolvedValueOnce({
      is_public: true,
    });

    await permissions.initializePermissions({ id: 55 });

    expect(mockDynamicDocumentStore.fetchAvailableClients).toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchAvailableRoles).toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchDocumentPermissions).toHaveBeenCalledWith(55);
    expect(permissions.isPublicDocument.value).toBe(true);
  });

  test("initializePermissions loads clients/roles but skips document permissions without id", async () => {
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockResolvedValueOnce([]);
    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValueOnce({ roles: [] });

    await permissions.initializePermissions({});

    expect(mockDynamicDocumentStore.fetchAvailableClients).toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchAvailableRoles).toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchDocumentPermissions).not.toHaveBeenCalled();
  });

  test("initializePermissions does nothing when user is not lawyer", async () => {
    mockUserStore.getCurrentUser = { role: "client" };
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockResolvedValueOnce([]);
    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValueOnce({ roles: [] });

    await permissions.initializePermissions({ id: 1 });

    expect(mockDynamicDocumentStore.fetchAvailableClients).not.toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchAvailableRoles).not.toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchDocumentPermissions).not.toHaveBeenCalled();
  });

  test("initializePermissions skips loading roles when user changes to non-lawyer", async () => {
    mockUserStore = reactive({ getCurrentUser: { role: "lawyer" } });
    const permissions = useDocumentPermissions();

    mockDynamicDocumentStore.fetchAvailableClients.mockImplementation(() => {
      mockUserStore.getCurrentUser.role = "client";
      return Promise.resolve([]);
    });
    mockDynamicDocumentStore.fetchAvailableRoles.mockResolvedValue({ roles: [] });

    await permissions.initializePermissions({});

    expect(mockDynamicDocumentStore.fetchAvailableClients).toHaveBeenCalled();
    expect(mockDynamicDocumentStore.fetchAvailableRoles).not.toHaveBeenCalled();
    expect(permissions.isLoadingRoles.value).toBe(false);
  });

  test("hasAvailableClients returns true when clients exist, false otherwise", () => {
    const permissions = useDocumentPermissions();

    expect(permissions.hasAvailableClients.value).toBe(false);

    permissions.availableClients.value = [];
    expect(permissions.hasAvailableClients.value).toBe(false);

    permissions.availableClients.value = [{ user_id: 1, full_name: "Client" }];
    expect(permissions.hasAvailableClients.value).toBe(true);
  });

  test("hasFilteredClients returns true when filtered clients exist, false otherwise", () => {
    const permissions = useDocumentPermissions();

    permissions.availableClients.value = [
      { user_id: 1, full_name: "Alice", email: "alice@test.com" },
      { user_id: 2, full_name: "Bob", email: "bob@test.com" },
    ];

    expect(permissions.hasFilteredClients.value).toBe(true);

    permissions.clientSearchQuery.value = "alice";
    expect(permissions.hasFilteredClients.value).toBe(true);

    permissions.clientSearchQuery.value = "nonexistent";
    expect(permissions.hasFilteredClients.value).toBe(false);
  });

  test("hasRoleVisibilityPermission checks if role is in selectedRolesVisibility", () => {
    const permissions = useDocumentPermissions();

    expect(permissions.hasRoleVisibilityPermission("client")).toBe(false);

    permissions.selectedRolesVisibility.value = ["client", "basic"];

    expect(permissions.hasRoleVisibilityPermission("client")).toBe(true);
    expect(permissions.hasRoleVisibilityPermission("basic")).toBe(true);
    expect(permissions.hasRoleVisibilityPermission("lawyer")).toBe(false);
  });

  test("hasRoleUsabilityPermission checks if role is in selectedRolesUsability", () => {
    const permissions = useDocumentPermissions();

    expect(permissions.hasRoleUsabilityPermission("client")).toBe(false);

    permissions.selectedRolesUsability.value = ["client"];

    expect(permissions.hasRoleUsabilityPermission("client")).toBe(true);
    expect(permissions.hasRoleUsabilityPermission("basic")).toBe(false);
  });

  test("getPermissionsData returns empty object when user is not lawyer", () => {
    mockUserStore.getCurrentUser = { role: "client" };
    const permissions = useDocumentPermissions();

    expect(permissions.getPermissionsData()).toEqual({});
  });

  test("getPermissionsDataExpanded returns empty object when user is not lawyer", () => {
    mockUserStore.getCurrentUser = { role: "client" };
    const permissions = useDocumentPermissions();

    expect(permissions.getPermissionsDataExpanded()).toEqual({});
  });
});
