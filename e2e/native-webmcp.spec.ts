import { test, expect, type Page } from '@playwright/test';
import { createTools } from '../lib/tools';
import type { Workspace } from '../lib/domain';

type NativeTool = {
  name: string;
  title: string;
  inputSchema: string | Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  origin: string;
};
type NativeContext = {
  getTools(): Promise<NativeTool[]>;
  executeTool(
    tool: NativeTool,
    input: string | Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};
const contracts = createTools(() => {});
const names = contracts.map((tool) => tool.name).sort();
const errors = new WeakMap<Page, string[]>();
const output = {
  agentId: 'planning-agent',
  taskId: 'RP-101',
  summary: 'Fictional balcony herb workshop',
  content:
    'A fictional practice plan for twelve first-time gardeners to plant basil in a container.',
  evidence: ['Fictional organizer brief: twelve first-time gardeners.'],
  knownLimitations: [
    'Practice only; no venue, purchases or external work were arranged.',
  ],
  recommendedNextAction: 'Review the practice plan and confirm the audience.',
};
async function call(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
) {
  return page.evaluate(
    async ({ name, input }) => {
      const native = document.modelContext as unknown as NativeContext;
      const tool = (await native.getTools()).find((tool) => tool.name === name);
      if (!tool) throw new Error(`Native discovery did not return ${name}`);
      const major = Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]);
      try {
        const result = await native.executeTool(
          tool,
          major < 155 ? JSON.stringify(input) : input,
        );
        return typeof result === 'string' ? JSON.parse(result) : result;
      } catch (error) {
        return { nativeError: (error as Error).message };
      }
    },
    { name, input },
  );
}
async function toolNames(page: Page) {
  return page.evaluate(async () =>
    (await (document.modelContext as unknown as NativeContext).getTools())
      .map((tool) => tool.name)
      .sort(),
  );
}
async function ready(page: Page) {
  await expect.poll(() => toolNames(page)).toEqual(names);
}
async function example(page: Page) {
  await page.getByRole('button', { name: 'Explore an example' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Replace current project' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Plan a community workshop',
      exact: true,
    }),
  ).toBeVisible();
}
async function openTask(page: Page) {
  await page
    .getByRole('button')
    .filter({
      has: page.getByRole('heading', {
        name: 'Choose the workshop topic',
        exact: true,
      }),
    })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function saved(page: Page): Promise<Workspace> {
  return (await (await page.request.get('/api/workspace')).json()).workspace;
}
test.beforeEach(async ({ page, browser }, testInfo) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', (error) => messages.push(error.message));
  await testInfo.attach('browser-version', {
    body: browser.version(),
    contentType: 'text/plain',
  });
  await page.goto('/');
  await ready(page);
  expect(
    await page.evaluate(() => document.modelContext?.registerTool.toString()),
  ).toContain('[native code]');
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('native discovery exposes six titled schemas and reads the saved browser workspace', async ({
  page,
}) => {
  const tools = await page.evaluate(async () =>
    (document.modelContext as unknown as NativeContext).getTools(),
  );
  for (const contract of contracts) {
    const actual = tools.find((tool) => tool.name === contract.name)!;
    expect(actual.title).toBe(contract.title);
    expect(
      typeof actual.inputSchema === 'string'
        ? JSON.parse(actual.inputSchema)
        : actual.inputSchema,
    ).toEqual(contract.inputSchema);
    expect(actual.annotations).toMatchObject(contract.annotations!);
    expect(actual.origin).toBe(new URL(page.url()).origin);
  }
  const context = await call(page, 'get_workspace_context');
  const workspace = await saved(page);
  expect(context).toMatchObject({
    success: true,
    projectId: workspace.id,
    workspaceVersion: workspace.version,
    name: workspace.name,
    tasks: workspace.tasks,
  });
  expect(
    await call(page, 'list_ready_tasks', { agentId: 'planning-agent' }),
  ).toMatchObject({ success: true, count: 0, tasks: [] });
});

test('all six native tools complete a visible durable handoff with answers, revision and approval', async ({
  page,
}) => {
  test.skip(
    !!process.env.RELAY_WEBMCP_URL,
    'Mutating fixtures run against local D1 only.',
  );
  await example(page);
  expect((await call(page, 'get_workspace_context')).name).toBe(
    'Plan a community workshop',
  );
  expect(
    (await call(page, 'list_ready_tasks', { agentId: 'planning-agent' })).count,
  ).toBe(1);
  expect(
    (
      await call(page, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).task.status,
  ).toBe('in_progress');
  await openTask(page);
  expect(
    (
      await call(page, 'update_task_progress', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
        note: 'Reviewed the fictional audience brief.',
        completionPercentage: 35,
        timeSpentMinutes: 12,
      })
    ).success,
  ).toBe(true);
  await expect(
    page
      .getByRole('dialog')
      .getByText('Reviewed the fictional audience brief.', { exact: true }),
  ).toBeVisible();
  await page.getByText('Record progress', { exact: true }).click();
  const percentage = page.getByRole('spinbutton', { name: 'Progress (0–99%)' });
  await expect(percentage).toHaveValue('35');
  await percentage.fill('45');
  expect(
    (
      await call(page, 'request_human_input', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
        question: 'How many practice guests?',
        reason: 'Sets the fictional material quantity.',
        canContinue: false,
        recommendedChoices: ['Twelve', 'Twenty'],
      })
    ).task.status,
  ).toBe('blocked');
  await expect(percentage).toHaveValue('45');
  expect(
    (await call(page, 'submit_deliverable', output)).nativeError,
  ).toBeTruthy();
  await page.getByLabel('Your answer').fill('Twelve first-time gardeners.');
  await page.getByRole('button', { name: 'Save answer' }).click();
  await expect(
    page.getByRole('dialog').getByText('In progress', { exact: true }),
  ).toBeVisible();
  expect(
    JSON.stringify((await call(page, 'get_workspace_context')).clarifications),
  ).toContain('Twelve first-time gardeners.');
  expect((await call(page, 'submit_deliverable', output)).task.status).toBe(
    'human_review',
  );
  await expect(
    page
      .getByRole('dialog')
      .getByRole('heading', { name: 'Review the deliverable' }),
  ).toBeVisible();
  await page
    .getByLabel('Review feedback')
    .fill('Include the beginner audience explicitly.');
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await expect(
    page.getByRole('dialog').getByText('In progress', { exact: true }),
  ).toBeVisible();
  expect(
    JSON.stringify((await call(page, 'get_workspace_context')).tasks),
  ).toContain('Include the beginner audience explicitly.');
  expect(
    (
      await call(page, 'submit_deliverable', {
        ...output,
        content:
          'A fictional balcony herb workshop for twelve first-time gardeners, with a hands-on planting activity.',
      })
    ).success,
  ).toBe(true);
  await page.getByLabel('Decision', { exact: true }).selectOption('approve');
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await expect(
    page.getByRole('dialog').getByText('Completed', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await ready(page);
  const persisted = await call(page, 'get_workspace_context');
  expect(persisted.tasks[0].status).toBe('completed');
  expect(persisted.tasks[0].deliverables).toHaveLength(2);
  expect(persisted.tasks[1].status).toBe('ready');
  expect((await saved(page)).tasks).toEqual(persisted.tasks);
});

test('native validation, ownership and dependencies reject writes before saved state changes', async ({
  page,
}) => {
  test.skip(
    !!process.env.RELAY_WEBMCP_URL,
    'Mutating fixtures run against local D1 only.',
  );
  await example(page);
  const before = await saved(page);
  const cases: [string, Record<string, unknown>][] = [
    ['get_workspace_context', { unknown: true }],
    ['list_ready_tasks', { capabilities: 'planning' }],
    ['claim_task', { agentId: 123, taskId: 'RP-101' }],
    ['claim_task', { agentId: 'missing-agent', taskId: 'RP-101' }],
    ['claim_task', { agentId: 'planning-agent', taskId: 'RP-102' }],
    ['claim_task', { agentId: 'research-agent', taskId: 'RP-101' }],
    [
      'claim_task',
      { agentId: 'planning-agent', taskId: 'RP-101', type: 'approve_task' },
    ],
    [
      'update_task_progress',
      {
        agentId: 'planning-agent',
        taskId: 'RP-101',
        note: 'Invalid complete',
        completionPercentage: 100,
        timeSpentMinutes: 0,
      },
    ],
    [
      'request_human_input',
      {
        agentId: 'planning-agent',
        taskId: 'RP-101',
        question: 'Question',
        reason: 'Reason',
        canContinue: 'false',
        recommendedChoices: [],
      },
    ],
    ['submit_deliverable', { ...output, evidence: 'A reference' }],
  ];
  for (const [name, input] of cases) {
    expect(
      (await call(page, name, input)).nativeError,
      `${name}: ${JSON.stringify(input)}`,
    ).toBeTruthy();
    expect(await saved(page)).toEqual(before);
  }
  expect(
    (
      await call(page, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).success,
  ).toBe(true);
  const claimed = await saved(page);
  expect(
    (
      await call(page, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).nativeError,
  ).toBeTruthy();
  expect(
    (
      await call(page, 'update_task_progress', {
        agentId: 'research-agent',
        taskId: 'RP-101',
        note: 'Wrong owner',
        completionPercentage: 10,
        timeSpentMinutes: 0,
      })
    ).nativeError,
  ).toBeTruthy();
  expect(await saved(page)).toEqual(claimed);
});

test('native writes surface server failures and stale versions without invented success', async ({
  page,
  context,
  browser,
}) => {
  test.skip(
    !!process.env.RELAY_WEBMCP_URL,
    'Failure and conflict fixtures run against local D1 only.',
  );
  await example(page);
  const before = await saved(page);
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'POST')
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Storage temporarily unavailable.',
        }),
      });
    else await route.continue();
  });
  expect(
    (
      await call(page, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).nativeError,
  ).toBeTruthy();
  await expect(
    page.getByRole('alert').getByText(/Storage temporarily unavailable/),
  ).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await page.unroute('**/api/workspace');
  const other = await context.newPage();
  await other.goto('/');
  await ready(other);
  expect(
    (
      await call(other, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).success,
  ).toBe(true);
  expect(
    (
      await call(page, 'claim_task', {
        agentId: 'planning-agent',
        taskId: 'RP-101',
      })
    ).nativeError,
  ).toBeTruthy();
  await expect(
    page.getByRole('alert').getByText(/changed in another tab/),
  ).toBeVisible();
  expect((await call(page, 'get_workspace_context')).tasks[0].status).toBe(
    'in_progress',
  );
  await other.close();
  const separate = await browser.newContext();
  const separatePage = await separate.newPage();
  await separatePage.goto(page.url());
  await ready(separatePage);
  const isolated = await call(separatePage, 'get_workspace_context');
  expect(isolated.tasks).toEqual([]);
  expect(isolated.projectId).not.toBe(before.id);
  await separate.close();
});

test('native registrations withdraw and restore through actual back-forward caching', async ({
  page,
}, testInfo) => {
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pagehide', { persisted: true }),
    ),
  );
  await expect.poll(() => toolNames(page)).toEqual([]);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    ),
  );
  await ready(page);
  expect((await call(page, 'get_workspace_context')).success).toBe(true);
  await page.evaluate(() =>
    window.addEventListener('pageshow', (event) => {
      (window as unknown as { relayRestored: boolean }).relayRestored =
        event.persisted;
    }),
  );
  await page.goto('/llms.txt');
  await page.goBack({ waitUntil: 'commit' });
  await ready(page);
  const restored = await page.evaluate(
    () =>
      (window as unknown as { relayRestored?: boolean }).relayRestored === true,
  );
  await testInfo.attach('back-forward-cache', {
    body: JSON.stringify({ restored }),
    contentType: 'application/json',
  });
  if (!process.env.RELAY_WEBMCP_URL) expect(restored).toBe(true);
  expect((await call(page, 'get_workspace_context')).success).toBe(true);
  await page.reload();
  await ready(page);
});
