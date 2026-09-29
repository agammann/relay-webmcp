import { expect, test, type Page } from '@playwright/test';
import type { Workspace } from '../lib/domain';

declare global {
  interface Window {
    relayTestTools: Record<string, WebMcpTool>;
  }
}
async function installTools(page: Page) {
  await page.addInitScript(() => {
    window.relayTestTools = {};
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: async (
          tool: WebMcpTool,
          options?: { signal?: AbortSignal },
        ) => {
          window.relayTestTools[tool.name] = tool;
          options?.signal?.addEventListener('abort', () => {
            delete window.relayTestTools[tool.name];
          });
        },
      },
    });
  });
}
async function open(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeEnabled();
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
async function call(
  page: Page,
  name: string,
  input: Record<string, unknown> = {},
) {
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.relayTestTools).length))
    .toBe(6);
  return page.evaluate(
    async ({ name, input }) =>
      (await window.relayTestTools[name].execute(input)) as Record<
        string,
        unknown
      >,
    { name, input },
  );
}
async function openTask(page: Page, title: string) {
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
const output = {
  agentId: 'planning-agent',
  taskId: 'RP-101',
  summary: 'Balcony herb workshop',
  content:
    'Teach twelve beginners to plant basil in a small container. Reserve 15 minutes for questions.',
  evidence: ['Organizer brief: twelve first-time gardeners.'],
  knownLimitations: ['Material costs still need confirmation.'],
  recommendedNextAction: 'Review the proposed topic and audience.',
};

test('all six page tools complete a persisted handoff with answers, revisions, and approval', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installTools(page);
  await open(page);
  await example(page);
  const context = await call(page, 'get_workspace_context');
  expect(context.name).toBe('Plan a community workshop');
  const ready = await call(page, 'list_ready_tasks', {
    agentId: 'planning-agent',
  });
  expect(ready.count).toBe(1);
  await call(page, 'claim_task', {
    agentId: 'planning-agent',
    taskId: 'RP-101',
  });
  await openTask(page, 'Choose the workshop topic');
  await expect(
    page.getByRole('dialog').getByText('In progress', { exact: true }),
  ).toBeVisible();
  await call(page, 'update_task_progress', {
    agentId: 'planning-agent',
    taskId: 'RP-101',
    note: 'Reviewed the audience brief.',
    completionPercentage: 35,
    timeSpentMinutes: 12,
  });
  await expect(
    page
      .getByRole('dialog')
      .getByText('Reviewed the audience brief.', { exact: true }),
  ).toBeVisible();
  await call(page, 'request_human_input', {
    agentId: 'planning-agent',
    taskId: 'RP-101',
    question: 'How many guests?',
    reason: 'Sets the material quantity.',
    canContinue: false,
    recommendedChoices: ['Twelve', 'Twenty'],
  });
  await page.getByLabel('Your answer').fill('Twelve first-time gardeners.');
  await page.getByRole('button', { name: 'Save answer' }).click();
  await expect(
    page.getByRole('dialog').getByText('In progress', { exact: true }),
  ).toBeVisible();
  const afterAnswer = await call(page, 'get_workspace_context');
  expect(JSON.stringify(afterAnswer.clarifications)).toContain(
    'Twelve first-time gardeners.',
  );
  await call(page, 'submit_deliverable', output);
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
  await call(page, 'submit_deliverable', {
    ...output,
    content:
      'A balcony herb workshop for twelve first-time gardeners, with a hands-on planting activity.',
  });
  await page.getByLabel('Decision', { exact: true }).selectOption('approve');
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await expect(
    page.getByRole('dialog').getByText('Completed', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeEnabled();
  const persisted = await call(page, 'get_workspace_context');
  const tasks = persisted.tasks as Workspace['tasks'];
  expect(tasks[0].status).toBe('completed');
  expect(tasks[0].deliverables).toHaveLength(2);
  expect(tasks[1].status).toBe('ready');
  await page.screenshot({
    path: info.outputPath('relay-desktop.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('custom project, human task, profile, export and restore work through the ordinary browser UI', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('button', { name: 'Project details', exact: true })
    .click();
  await page.getByLabel('Project name').fill('Neighborhood seed exchange');
  await page
    .getByLabel('Project goal')
    .fill('Arrange a seed exchange at the community center.');
  await page.getByLabel('Target date').fill('2026-12-01');
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Neighborhood seed exchange',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByLabel('Task title').fill('Confirm the room');
  await page.getByLabel('Owner', { exact: true }).selectOption('human');
  await page
    .getByLabel('Objective', { exact: true })
    .fill('Confirm a room with space for twelve people.');
  await page.getByLabel('Expected output').fill('Written room confirmation.');
  await page
    .getByLabel('Definition of done')
    .fill('Room and date confirmed by the coordinator.');
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  await openTask(page, 'Confirm the room');
  await page
    .getByLabel('Result', { exact: true })
    .fill('Coordinator confirmed room A for December 1.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(
    page.getByRole('dialog').getByText('Completed', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Agent profiles', exact: true })
    .click();
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await page.getByLabel('Profile name').fill('Event Writer');
  await page
    .getByLabel('Profile description')
    .fill('Writes invitations and schedules.');
  await page
    .getByLabel('Capabilities', { exact: true })
    .fill('writing, planning');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(
    page.getByRole('heading', { name: 'Event Writer', exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export backup', exact: true })
    .click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Replace current project' }).click();
  await expect(
    page.getByRole('heading', { name: 'My project', exact: true }),
  ).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(path!);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Replace current project' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Neighborhood seed exchange',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Task board', exact: true }).click();
  await openTask(page, 'Confirm the room');
  await expect(
    page
      .getByRole('dialog')
      .getByText('Coordinator confirmed room A for December 1.', {
        exact: true,
      }),
  ).toBeVisible();
});

test('separate browsers get separate database rows; two tabs detect stale edits', async ({
  page,
  browser,
  context,
}) => {
  await open(page);
  await example(page);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(page.url());
  await expect(
    otherPage.getByRole('heading', { name: 'My project', exact: true }),
  ).toBeVisible();
  await other.close();
  const tab = await context.newPage();
  await tab.goto(page.url());
  await expect(
    tab.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Project details', exact: true })
    .click();
  await page.getByLabel('Project name').fill('Workshop with a saved update');
  await page.getByRole('button', { name: 'Save project' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Workshop with a saved update',
      exact: true,
    }),
  ).toBeVisible();
  await tab
    .getByRole('button', { name: 'Project details', exact: true })
    .click();
  await tab.getByLabel('Project name').fill('Stale edit should not win');
  await tab.getByRole('button', { name: 'Save project' }).click();
  await expect(
    tab
      .getByRole('dialog')
      .getByText(/changed in another tab/)
      .first(),
  ).toBeVisible();
  await tab.keyboard.press('Escape');
  await tab.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(
    tab.getByRole('heading', {
      name: 'Workshop with a saved update',
      exact: true,
    }),
  ).toBeVisible();
});

test('failed saves and malformed tool input never fabricate local success', async ({
  page,
}) => {
  await installTools(page);
  await open(page);
  await example(page);
  const invalid = await page.evaluate(async () => {
    try {
      await window.relayTestTools.claim_task.execute({
        agentId: 123,
        taskId: 'RP-101',
      });
      return 'accepted';
    } catch {
      return 'rejected';
    }
  });
  expect(invalid).toBe('rejected');
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
  const failed = await page.evaluate(async () => {
    try {
      await window.relayTestTools.claim_task.execute({
        agentId: 'planning-agent',
        taskId: 'RP-101',
      });
      return 'accepted';
    } catch {
      return 'rejected';
    }
  });
  expect(failed).toBe('rejected');
  await expect(
    page.getByRole('alert').getByText(/Storage temporarily unavailable/),
  ).toBeVisible();
  await page.unroute('**/api/workspace');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeEnabled();
  const context = await call(page, 'get_workspace_context');
  expect((context.tasks as Workspace['tasks'])[0].status).toBe('ready');
});

test('mobile tasks and dialogs fit at 390 and 320 pixels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await example(page);
  await page.screenshot({
    path: info.outputPath('relay-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await openTask(page, 'Choose the workshop topic');
  await page.screenshot({
    path: info.outputPath('relay-mobile-task.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByLabel('Task title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Add task', exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
