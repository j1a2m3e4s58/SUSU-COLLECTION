import { expect, test } from "@playwright/test";

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

const customer = {
  id: "customer-1",
  account_name: "TEST CUSTOMER",
  account_number: "1310000100001",
  phone: "0240000001",
  branch_name: "BAWJIASE",
  customer_status: "active",
  total_deposits: 0,
};

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
  transaction_date: "2026-07-20",
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

test("staff login reaches the protected portal", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login");
  await page.getByLabel(/official email/i).fill("supervisor@bawjiasecommunitybank.com");
  await page.getByLabel(/^password$/i).fill("StrongPassword123!");
  await expect(page.getByRole("button", { name: /secure login/i })).toBeEnabled();
  await page.getByRole("button", { name: /secure login/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("SUSU Collection Portal").first()).toBeVisible();
});

test("agent permissions and exact-account deposit search remain enforced", async ({ page }) => {
  await seedAuthenticatedUser(page, agent);
  await page.goto("/field-collection");
  await expect(page.getByPlaceholder("Enter exact 13-digit account number")).toBeVisible();
  await expect(page.getByText("Add Customer")).toHaveCount(0);
  await page.getByPlaceholder("Enter exact 13-digit account number").fill("TEST CUSTOMER");
  await expect(page.getByText(/use the customer account number only/i)).toBeVisible();
  await page.getByPlaceholder("Enter exact 13-digit account number").fill(customer.account_number);
  await page.getByRole("button", { name: /^search$/i }).click();
  await expect(page.getByText(customer.account_name)).toBeVisible();
});

test("supervisor sees import dialog and report export controls", async ({ page }) => {
  await seedAuthenticatedUser(page, supervisor);
  await page.goto("/agents");
  await page.getByRole("button", { name: /import customers/i }).click();
  await expect(page.getByRole("heading", { name: "Import Customers" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/reports");
  await page.getByRole("button", { name: /test agent/i }).click();
  await page.getByRole("navigation").getByRole("link", { name: /^reports$/i }).click();
  await page.getByRole("button", { name: /daily transaction report/i }).click();
  await page.getByRole("button", { name: /generate report/i }).click();
  await expect(page.getByRole("button", { name: "Excel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();
});

test("mobile navigation keeps the six operational destinations available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "desktop", "Mobile-only layout assertion");
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
