import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const settings = {
  bankName: "Bawjiase Community Bank PLC",
  shortBankName: "BCB",
  portalName: "SUSU Collection Portal",
  loginSubtitle: "Sign in to manage SUSU collections, customers, staff, and branch reports.",
  loginButtonText: "Secure Login",
  authorizedAccessText: "Authorized Access Only",
  branches: ["BAWJIASE", "OFAAKOR"],
  departments: ["SUSU"],
  appMode: "test",
  publicRegistrationEnabled: false,
};

const agent = {
  id: "agent-1",
  fullname: "Test Agent",
  email: "test-agent@agents.local",
  role: "GeneralStaff",
  department: "SUSU",
  branch: "BAWJIASE",
  managedBranches: [],
  permissions: {},
  isActive: true,
  isVerified: true,
};

const supervisor = {
  ...agent,
  id: "supervisor-1",
  fullname: "Test Supervisor",
  email: "supervisor@bawjiasecommunitybank.com",
  role: "Supervisor",
  managedBranches: ["BAWJIASE"],
};

const owner = {
  ...supervisor,
  id: "owner-admin-1",
  fullname: "Test Owner",
  email: "owner@bawjiasecommunitybank.com",
  role: "OwnerAdmin",
  managedBranches: ["ALL"],
};

const customer = {
  id: "customer-1",
  account_name: "TEST CUSTOMER",
  account_number: "1310000100001",
  phone: "0240000001",
  branch_name: "BAWJIASE",
  customer_status: "active",
  total_deposits: 0,
};

const now = new Date();
const currentDate = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");

const collection = {
  id: "collection-1",
  transaction_reference: "SUS-TEST-0001",
  account_name: customer.account_name,
  account_number: customer.account_number,
  amount: 25,
  agent_id: agent.id,
  agent_email: agent.email,
  agent_name: agent.fullname,
  branch_name: agent.branch,
  transaction_date: currentDate,
  transaction_time: "09:30:00",
  status: "completed",
  supervisor_review_status: "pending",
};

async function mockApi(page, user = null) {
  await page.route("**/mail-api/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/mail-api\/api/, "");
    if (path === "/portal-settings") return route.fulfill({ json: { settings } });
    if (path === "/auth/me") {
      return user
        ? route.fulfill({ json: { ok: true, user } })
        : route.fulfill({ status: 401, json: { error: "Authentication required" } });
    }
    if (path === "/auth/login") return route.fulfill({ json: { ok: true, user: supervisor } });
    if (path === "/staff/active") return route.fulfill({ json: { users: [agent, supervisor] } });
    if (path === "/customers") return route.fulfill({ json: { customers: [customer] } });
    if (path === "/customers/imports") return route.fulfill({ json: { imports: [] } });
    if (path === "/collections") return route.fulfill({ json: { collections: [collection] } });
    if (path === "/presence") return route.fulfill({ json: { presence: {} } });
    if (path.startsWith("/users/")) return route.fulfill({ json: { user } });
    return route.fulfill({ json: { ok: true, users: [], customers: [], collections: [], notifications: [], logs: [] } });
  });
}

async function seedAuthenticatedUser(page, user) {
  await page.addInitScript((storedUser) => {
    localStorage.setItem("susu_auth_user", JSON.stringify(storedUser));
  }, user);
  await mockApi(page, user);
}

async function expectDialogFitsViewport(page, testInfo) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = testInfo.project.use.viewport || { width: 1280, height: 720 };
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 8);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
  }
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
}

test("staff login reaches the protected portal", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-400"].includes(testInfo.project.name), "Covered at representative desktop and mobile widths");
  await mockApi(page);
  await page.goto("/login");
  await page.getByLabel(/official email/i).fill("supervisor@bawjiasecommunitybank.com");
  await page.getByLabel(/^password$/i).fill("StrongPassword123!");
  await expect(page.getByRole("button", { name: /secure login/i })).toBeEnabled();
  await page.getByRole("button", { name: /secure login/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main")).toBeVisible();
});

test("agent permissions and exact-account deposit search remain enforced", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-400"].includes(testInfo.project.name), "Covered at representative desktop and mobile widths");
  await seedAuthenticatedUser(page, agent);
  await page.goto("/field-collection", { waitUntil: "domcontentloaded" });
  await expect(page.getByPlaceholder("Enter exact 13-digit account number")).toBeVisible();
  await expect(page.getByText("Add Customer")).toHaveCount(0);
  await page.getByPlaceholder("Enter exact 13-digit account number").fill("TEST CUSTOMER");
  await expect(page.getByText(/use the customer account number only/i)).toBeVisible();
  await page.getByPlaceholder("Enter exact 13-digit account number").fill(customer.account_number);
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(page.getByText(customer.account_name)).toBeVisible();
});

test("supervisor sees import dialog and report export controls", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(!["desktop", "mobile-400"].includes(testInfo.project.name), "Covered at representative desktop and mobile widths");
  await seedAuthenticatedUser(page, supervisor);
  await page.goto("/agents");
  await page.getByRole("button", { name: /import customers/i }).click();
  await expect(page.getByRole("heading", { name: "Import Customers" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/reports");
  await page.getByRole("button", { name: /test agent/i }).click();
  await expect(page.getByText(/viewing records for test agent/i)).toBeVisible();
  await page.goto("/reports");
  const reportType = page.getByRole("button", { name: /daily transaction report/i });
  await expect(reportType).toBeVisible();
  await reportType.click();
  await expect(page.getByRole("heading", { name: /configure & generate report/i })).toBeVisible();
  await page.getByRole("button", { name: /generate report/i }).click();
  await expect(page.getByRole("button", { name: "Excel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();
});

test("mobile navigation keeps the six operational destinations available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-400", "Representative mobile layout assertion");
  await seedAuthenticatedUser(page, supervisor);
  await page.goto("/reports");
  const nav = page.locator("nav").last();
  await expect(nav).toBeVisible();
  await expect(nav.getByText(/home/i)).toBeVisible();
  await expect(nav.getByText(/customers/i)).toBeVisible();
  await expect(nav.getByText(/directory/i)).toBeVisible();
  await expect(nav.getByText(/reports/i)).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("desktop sidebar starts compact and expands with the chevron", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop sidebar assertion");
  await seedAuthenticatedUser(page, owner);
  await page.goto("/directory");
  const sidebar = page.locator("aside");
  await expect(sidebar).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBeLessThanOrEqual(90);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBeGreaterThanOrEqual(240);
});

test("mobile staff edit actions fit in one horizontal row", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-400", "Representative mobile dialog assertion");
  await seedAuthenticatedUser(page, owner);
  await page.goto("/directory");
  await page.getByRole("button", { name: "Edit" }).nth(1).click();
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const save = dialog.getByRole("button", { name: "Save Changes" });
  const reset = dialog.getByRole("button", { name: "Reset Login" });
  const [cancelBox, saveBox, resetBox] = await Promise.all([
    cancel.boundingBox(),
    save.boundingBox(),
    reset.boundingBox(),
  ]);
  expect(cancelBox.height).toBe(saveBox.height);
  expect(resetBox.height).toBe(saveBox.height);
  expect(Math.abs(resetBox.y - saveBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(cancelBox.y - saveBox.y)).toBeLessThanOrEqual(1);
  expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(cancelBox.x);
  expect(cancelBox.x + cancelBox.width).toBeLessThanOrEqual(saveBox.x);
  expect(resetBox.x).toBeGreaterThanOrEqual(16);
  expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(testInfo.project.use.viewport.width - 16);
});

test("operational dialogs fit and trap keyboard focus at every supported width", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await seedAuthenticatedUser(page, owner);

  await page.goto("/customers");
  await page.getByRole("button", { name: "Add Customer" }).click();
  await expectDialogFitsViewport(page, testInfo);
  const branchSelect = page.getByRole("dialog").getByRole("combobox").first();
  await branchSelect.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/agents");
  await page.getByRole("button", { name: "Add Agent", exact: true }).click();
  await expectDialogFitsViewport(page, testInfo);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /import customers/i }).click();
  await expectDialogFitsViewport(page, testInfo);
  await page.keyboard.press("Escape");

  await page.goto("/supervisor-management");
  await page.getByRole("button", { name: "Add Supervisor" }).click();
  await expectDialogFitsViewport(page, testInfo);
  await page.keyboard.press("Escape");
});

test("tables and notifications expose accessible semantics", async ({ page }, testInfo) => {
  test.skip(!["desktop", "mobile-400"].includes(testInfo.project.name), "Representative desktop and mobile accessibility check");
  await seedAuthenticatedUser(page, owner);
  await page.goto("/account-status");
  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("columnheader", { name: "User" })).toBeVisible();
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("portal-toast", { detail: { title: "Saved", description: "The test record was saved.", variant: "success" } })));
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact));
  expect(serious, serious.map((item) => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});

test("startup retries while a sleeping service becomes available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-400", "One retry-state check is sufficient");
  let settingsAttempts = 0;
  await mockApi(page);
  await page.route("**/mail-api/api/portal-settings", async (route) => {
    settingsAttempts += 1;
    if (settingsAttempts < 3) return route.fulfill({ status: 503, json: { error: "Service waking" } });
    return route.fulfill({ json: { settings } });
  });
  await page.goto("/login");
  await expect(page.getByText(/waking the secure service/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /susu collection portal/i })).toBeVisible({ timeout: 12_000 });
  expect(settingsAttempts).toBe(3);
});

test("startup failure offers a working retry action", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-400", "One retry-action check is sufficient");
  let unavailable = true;
  await mockApi(page);
  await page.route("**/mail-api/api/portal-settings", async (route) => {
    if (unavailable) return route.fulfill({ status: 503, json: { error: "Database temporarily unavailable" } });
    return route.fulfill({ json: { settings } });
  });
  await page.goto("/login");
  const retry = page.getByRole("button", { name: /retry connection/i });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  unavailable = false;
  await retry.click();
  await expect(page.getByRole("heading", { name: /susu collection portal/i })).toBeVisible({ timeout: 12_000 });
});
