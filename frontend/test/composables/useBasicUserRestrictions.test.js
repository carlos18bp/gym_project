let mockUserStore;

const mockShowNotification = jest.fn();

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

import { useBasicUserRestrictions } from "@/composables/useBasicUserRestrictions";

describe("useBasicUserRestrictions", () => {
  beforeEach(() => {
    mockShowNotification.mockReset();
    mockUserStore = { currentUser: { role: "basic" } };
  });

  test("isBasicUser reflects role", () => {
    const { isBasicUser } = useBasicUserRestrictions();
    expect(isBasicUser.value).toBe(true);

    mockUserStore = { currentUser: { role: "client" } };
    const nonBasic = useBasicUserRestrictions();
    expect(nonBasic.isBasicUser.value).toBe(false);
  });

  test("showRestrictionNotification calls notification helper", () => {
    const { showRestrictionNotification } = useBasicUserRestrictions();

    showRestrictionNotification("Editar");

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Esta funcionalidad está restringida para usuarios básicos. Por favor, contacta a tu abogado para obtener acceso completo.",
      "warning"
    );
  });

  test("handleFeatureAccess blocks basic users", () => {
    const { handleFeatureAccess } = useBasicUserRestrictions();
    const callback = jest.fn();

    const result = handleFeatureAccess("Editar", callback);

    expect(result).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalled();
  });

  test("handleFeatureAccess allows non-basic users and runs callback", () => {
    mockUserStore = { currentUser: { role: "client" } };
    const { handleFeatureAccess } = useBasicUserRestrictions();
    const callback = jest.fn();

    const result = handleFeatureAccess("Editar", callback);

    expect(result).toBe(true);
    expect(callback).toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("handleFeatureAccess allows non-basic users when callback is missing", () => {
    mockUserStore = { currentUser: { role: "client" } };
    const { handleFeatureAccess } = useBasicUserRestrictions();

    const result = handleFeatureAccess("Editar");

    expect(result).toBe(true);
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("getRestrictedButtonClasses returns classes when disabled", () => {
    const { getRestrictedButtonClasses } = useBasicUserRestrictions();

    expect(getRestrictedButtonClasses(false)).toBe("");
    expect(getRestrictedButtonClasses(true)).toBe("opacity-60 cursor-not-allowed");
  });
});
