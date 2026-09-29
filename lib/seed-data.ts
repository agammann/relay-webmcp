import type { Workspace } from './domain';
import { createTask, createWorkspace } from './project.ts';

export function createSeedWorkspace(): Workspace {
  const workspace = createWorkspace('example');
  const deadline = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  workspace.name = 'Plan a community workshop';
  workspace.goal =
    'Prepare a useful 60-minute workshop for first-time gardeners.';
  workspace.deadline = deadline;
  workspace.demoData = true;
  const draft = {
    objective: 'Choose a suitable workshop topic and scope.',
    context: workspace.goal,
    inputs: ['Audience: beginners. Budget: $100. Duration: 60 minutes.'],
    expectedOutput: 'A short plan with clear next steps.',
    definitionOfDone: [
      'Fits the audience and budget',
      'Lists assumptions for review',
    ],
    dueDate: deadline,
    ownerType: 'agent' as const,
    priority: 'medium' as const,
    labels: ['planning'],
    dependencies: [] as string[],
    restrictions: ['Do not book venues or spend money.'],
  };
  workspace.tasks = [
    createTask('RP-101', { ...draft, title: 'Choose the workshop topic' }),
    createTask('RP-102', {
      ...draft,
      title: 'Write the workshop outline',
      objective: 'Write a timed workshop outline using the approved topic.',
      dependencies: ['RP-101'],
    }),
    createTask('RP-103', {
      ...draft,
      title: 'Confirm the venue',
      objective: 'Confirm the date and venue with the organizer.',
      ownerType: 'human',
      labels: [],
      dependencies: ['RP-102'],
      expectedOutput: 'A confirmed date and venue.',
    }),
  ];
  return workspace;
}
