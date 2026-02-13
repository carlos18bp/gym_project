import {
  COLOR_PALETTE,
  getAllColors,
  getColorById,
  getColorClasses,
  getColorStyles,
  getRandomColorId,
} from "@/shared/color_palette";

describe("color_palette.js", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("getColorById returns the matching color and defaults to first entry", () => {
    expect(getColorById(3)).toEqual(COLOR_PALETTE[3]);
    expect(getColorById(999)).toEqual(COLOR_PALETTE[0]);
  });

  test("getColorStyles maps to background/border/text using light/dark", () => {
    const styles = getColorStyles(2);
    expect(styles).toEqual({
      backgroundColor: COLOR_PALETTE[2].light,
      borderColor: COLOR_PALETTE[2].dark,
      color: COLOR_PALETTE[2].dark,
    });
  });

  test("getColorClasses returns expected Tailwind-style strings", () => {
    const classes = getColorClasses(1);
    expect(classes).toEqual({
      background: `bg-[${COLOR_PALETTE[1].light}]`,
      border: `border-[${COLOR_PALETTE[1].dark}]`,
      text: `text-[${COLOR_PALETTE[1].dark}]`,
      hover: `hover:bg-[${COLOR_PALETTE[1].hex}]`,
    });
  });

  test("getRandomColorId returns a bounded random index", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomColorId()).toBe(0);

    Math.random.mockReturnValue(0.999999);
    expect(getRandomColorId()).toBe(COLOR_PALETTE.length - 1);
  });

  test("getAllColors returns the palette", () => {
    expect(getAllColors()).toBe(COLOR_PALETTE);
  });
});
