import type { Locator } from "@playwright/test";

/** Select an option through the accessible custom listbox UI. */
export async function chooseCustomOption(
  control: Locator,
  optionName: string | RegExp,
): Promise<void> {
  const page = control.page();
  await control.click();
  const option = page.getByRole("option").filter({
    hasText: optionName,
  });
  await option.first().click();
}
