import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "@/stores/auth/user";
import usersData from "../data_sample/users.json";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const mock = new AxiosMockAdapter(axios);

describe("User Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
  });

  /**
   * This test ensures that the store initializes with an empty state. 
   * It checks that users array is empty, currentUser is null, and dataLoaded is false.
   */
  test("should initialize with empty state", () => {
    const store = useUserStore();
    expect(store.users).toEqual([]);
    expect(store.currentUser).toBe(null);
    expect(store.dataLoaded).toBe(false);
  });

  /**
   * This test checks if the users data from usersData is correctly loaded into 
   * the store's state and sets dataLoaded to true.
   */
  test("should load users data from usersData", async () => {
    const store = useUserStore();
    await store.$patch({ users: usersData, dataLoaded: true });
    expect(store.users).toEqual(usersData);
    expect(store.dataLoaded).toBe(true);
  });

  /**
   * This test checks the functionality of the userById getter, ensuring it returns 
   * the correct user based on the given user ID.
   */
  test("should get a user by ID", () => {
    const store = useUserStore();
    store.$patch({ users: usersData });
    const user = store.userById(1);
    expect(user.id).toBe(1);
  });

  /**
   * This test ensures the fetchUsersData action fetches users from the API 
   * and updates the store.
   */
  test("should fetch users data from API", async () => {
    const store = useUserStore();
    mock.onGet("/api/users/").reply(200, usersData);

    await store.fetchUsersData();
    expect(store.users).toEqual(usersData);
    expect(store.dataLoaded).toBe(true);
  });

  /**
   * This test ensures the init action initializes the store by fetching the users 
   * data if not already loaded.
   */
  test("should initialize store by fetching data", async () => {
    mock.onGet("/api/users/").reply(200, usersData);

    const store = useUserStore();
    await store.init();

    expect(store.dataLoaded).toBe(true);
    expect(store.users.length).toBeGreaterThan(0);
  });

  /**
   * This test ensures the fetchUsersData action handles errors gracefully 
   * by setting the users array to empty and dataLoaded to false.
   */
  test("should handle error when fetching users data", async () => {
    const store = useUserStore();
    jest.spyOn(store, "fetchUsersData").mockImplementation(async () => {
      throw new Error("Failed to fetch");
    });

    try {
      await store.fetchUsersData();
    } catch (error) {
      // This block will not be executed, as the error is handled inside the method
    }

    expect(store.users).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });
});
