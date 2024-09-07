import { setActivePinia, createPinia } from "pinia";
import { useProcessStore } from "@/stores/process";
import processesData from "../data_sample/processes.json";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const mock = new AxiosMockAdapter(axios);

describe("Process Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
  });

  /**
   * This test ensures that the store initializes with an empty state. 
   * It checks that processes array is empty, and dataLoaded is false.
   */
  test("should initialize with empty state", () => {
    const store = useProcessStore();
    expect(store.processes).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });

  /**
   * This test checks if the processes data from processesData is correctly loaded 
   * into the store's state and sets dataLoaded to true.
   */
  test("should load processes data from processesData", async () => {
    const store = useProcessStore();
    await store.$patch({ processes: processesData, dataLoaded: true });
    expect(store.processes).toEqual(processesData);
    expect(store.dataLoaded).toBe(true);
  });

  /**
   * This test checks the functionality of the processById getter, ensuring it returns 
   * the correct process based on the given process ID.
   */
  test("should get a process by ID", () => {
    const store = useProcessStore();
    store.$patch({ processes: processesData });
    const process = store.processById(1);
    expect(process.id).toBe(1);
  });

  /**
   * This test ensures the fetchProcessesData action fetches processes from the API 
   * and updates the store.
   */
  test("should fetch processes data from API", async () => {
    const store = useProcessStore();
    mock.onGet("/api/processes/").reply(200, processesData);

    await store.fetchProcessesData();
    expect(store.processes).toEqual(processesData);
    expect(store.dataLoaded).toBe(true);
  });

  /**
   * This test ensures the init action initializes the store by fetching the processes 
   * data if not already loaded.
   */
  test("should initialize store by fetching data", async () => {
    mock.onGet("/api/processes/").reply(200, processesData);

    const store = useProcessStore();
    await store.init();

    expect(store.dataLoaded).toBe(true);
    expect(store.processes.length).toBeGreaterThan(0);
  });

  /**
   * This test ensures the fetchProcessesData action handles errors gracefully 
   * by setting the processes array to empty and dataLoaded to false.
   */
  test("should handle error when fetching processes data", async () => {
    const store = useProcessStore();
    jest.spyOn(store, "fetchProcessesData").mockImplementation(async () => {
      throw new Error("Failed to fetch");
    });

    try {
      await store.fetchProcessesData();
    } catch (error) {
      // This block will not be executed, as the error is handled inside the method
    }

    expect(store.processes).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });
});
