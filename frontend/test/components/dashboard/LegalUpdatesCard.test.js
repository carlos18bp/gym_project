import { mount } from "@vue/test-utils";

import LegalUpdatesCard from "@/components/dashboard/LegalUpdatesCard.vue";

const mockFetchActiveUpdates = jest.fn();
let mockUpdates = [];

jest.mock("swiper/vue", () => ({
  __esModule: true,
  Swiper: {
    template: "<div data-test='swiper'><slot /></div>",
  },
  SwiperSlide: {
    template: "<div data-test='slide'><slot /></div>",
  },
}));

jest.mock("swiper/modules", () => ({
  Autoplay: jest.fn(),
  Pagination: jest.fn(),
}));

jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/pagination", () => ({}));

jest.mock("@/stores/legal/legalUpdate", () => ({
  __esModule: true,
  useLegalUpdateStore: () => ({
    fetchActiveUpdates: (...args) => mockFetchActiveUpdates(...args),
    get activeUpdates() {
      return mockUpdates;
    },
  }),
}));

const flushPromises = async () => {
  await Promise.resolve();
};

describe("LegalUpdatesCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdates = [];
    mockFetchActiveUpdates.mockResolvedValue();
  });

  test("renders slides for active updates and fetches on mount", async () => {
    mockUpdates = [
      {
        id: 1,
        content: "Update one",
        link_text: "Read more",
        link_url: "https://example.com/one",
        image: "https://example.com/img.png",
      },
      {
        id: 2,
        content: "Update two",
        link_text: "Learn",
        link_url: "https://example.com/two",
        image: "",
      },
    ];

    const wrapper = mount(LegalUpdatesCard);

    await flushPromises();

    expect(mockFetchActiveUpdates).toHaveBeenCalled();
    expect(wrapper.findAll("[data-test='slide']")).toHaveLength(2);
    expect(wrapper.text()).toContain("Update one");
    expect(wrapper.text()).toContain("Read more");
    expect(wrapper.text()).toContain("Update two");
  });

  test("handleImageError swaps to placeholder image", async () => {
    mockUpdates = [
      {
        id: 1,
        content: "Update one",
        link_text: "Read more",
        link_url: "https://example.com/one",
        image: "https://example.com/img.png",
      },
    ];

    const wrapper = mount(LegalUpdatesCard);
    await flushPromises();

    const placeholderImage = wrapper.vm.$.setupState.placeholderImage;
    const target = { src: "https://example.com/broken.png" };

    wrapper.vm.$.setupState.handleImageError({ target });
    expect(target.src).toBe(placeholderImage);

    wrapper.vm.$.setupState.handleImageError({ target });
    expect(target.src).toBe(placeholderImage);
  });
});
