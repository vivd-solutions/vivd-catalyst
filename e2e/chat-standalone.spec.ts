import { expect, test } from "@playwright/test";

test("standalone chat can run a configured tool", async ({ page }) => {
  const applicantName = `E2E Jane ${Date.now()}`;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New" }).click();
  await page
    .getByPlaceholder("Message")
    .fill(
      `/tool document.application_summary {"applicantName":"${applicantName}","grossMonthlyPay":5200,"currency":"EUR"}`
    );
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByText("Tool work completed").last()).toBeVisible();
  await expect(page.getByText(applicantName).last()).toBeVisible();
  await expect(page.getByText("No review flags were raised.").last()).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
