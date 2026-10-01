'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SyntheticEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import type {
  Task,
  TaskStatus,
  Workspace,
  WorkspaceAction,
} from '@/lib/domain';
import type { TaskDraft } from '@/lib/project';
import {
  activeAssignments,
  dependenciesComplete,
  getReadyTasks,
} from '@/lib/rules';
import {
  loadWorkspace,
  mutateWorkspace,
  serverSnapshot,
  snapshot,
  subscribe,
} from '@/lib/client';
import { WebMcpProvider } from './webmcp-provider';

const statusNames: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  human_review: 'Human review',
  blocked: 'Blocked',
  completed: 'Completed',
};
const navigation = [
  { id: 'overview', title: 'Overview', icon: LayoutDashboard },
  { id: 'board', title: 'Task board', icon: ListTodo },
  { id: 'inbox', title: 'Human inbox', icon: Inbox },
  { id: 'agents', title: 'Agent profiles', icon: Bot },
  { id: 'activity', title: 'Activity', icon: Activity },
] as const;
type View = (typeof navigation)[number]['id'];
type Modal =
  | { kind: 'task' | 'edit'; id: string }
  | { kind: 'create' | 'project' | 'agent' }
  | { kind: 'replace'; action: WorkspaceAction; title: string }
  | null;
const value = (data: FormData, key: string) => {
  const entry = data.get(key);
  return typeof entry === 'string' ? entry.trim() : '';
};
const lines = (data: FormData, key: string) =>
  value(data, key)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
const tags = (data: FormData, key: string) =>
  value(data, key)
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean);
type Save = (action: WorkspaceAction) => Promise<void>;

function Field({
  label,
  name,
  initial = '',
  multiline = false,
  required = true,
  maxLength = 1200,
  type = 'text',
  hint,
}: {
  label: string;
  name: string;
  initial?: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          name={name}
          defaultValue={initial}
          required={required}
          maxLength={maxLength}
          rows={3}
        />
      ) : (
        <input
          aria-label={label}
          name={name}
          defaultValue={initial}
          required={required}
          maxLength={maxLength}
          type={type}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function ActionForm({
  children,
  submit,
  busy,
  label = 'Save',
  className = '',
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<void>;
  busy: boolean;
  label?: string;
  className?: string;
}) {
  const [error, setError] = useState('');
  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    try {
      await submit(new FormData(form));
    } catch (error) {
      setError(
        error instanceof Error && error.name !== 'ZodError'
          ? error.message
          : 'Check required fields, dates, and field limits.',
      );
    }
  }
  return (
    <form
      className={`action-form ${className}`}
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <fieldset disabled={busy}>
        {children}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          {busy ? 'Saving…' : label}
        </button>
      </fieldset>
    </form>
  );
}

function ModalPanel({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog
      .querySelector<HTMLInputElement>(
        ':scope > .action-form input:not([type=checkbox]), :scope > .action-form textarea',
      )
      ?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('h1')?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={close}
      className="modal"
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function TaskEditor({
  workspace,
  task,
  busy,
  save,
}: {
  workspace: Workspace;
  task?: Task;
  busy: boolean;
  save: Save;
}) {
  return (
    <ActionForm
      busy={busy}
      label={task ? 'Save task' : 'Create task'}
      submit={async (data) => {
        const draft: TaskDraft = {
          title: value(data, 'title'),
          objective: value(data, 'objective'),
          context: value(data, 'context'),
          inputs: lines(data, 'inputs'),
          expectedOutput: value(data, 'output'),
          definitionOfDone: lines(data, 'done'),
          dueDate: value(data, 'due'),
          ownerType: value(data, 'owner') as 'human' | 'agent',
          priority: value(data, 'priority') as Task['priority'],
          labels: tags(data, 'labels'),
          dependencies: data.getAll('dependencies').map(String),
          restrictions: lines(data, 'restrictions'),
        };
        await save(
          task
            ? { type: 'edit_task', taskId: task.id, task: draft }
            : { type: 'create_task', task: draft },
        );
      }}
    >
      <Field
        name="title"
        label="Task title"
        initial={task?.title}
        maxLength={160}
      />
      <div className="form-pair">
        <label className="field">
          <span>Owner</span>
          <select
            aria-label="Owner"
            name="owner"
            defaultValue={task?.ownerType ?? 'agent'}
          >
            <option value="agent">Agent — submit for review</option>
            <option value="human">Human — record completion</option>
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select
            aria-label="Priority"
            name="priority"
            defaultValue={task?.priority ?? 'medium'}
          >
            {['low', 'medium', 'high', 'critical'].map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </div>
      <Field
        name="objective"
        label="Objective"
        initial={task?.objective}
        multiline
      />
      <Field
        name="context"
        label="Context"
        initial={task?.projectContext ?? workspace.goal}
        multiline
        maxLength={3000}
        hint="Give the person or agent enough background to do this task."
      />
      <Field
        name="output"
        label="Expected output"
        initial={task?.expectedOutput}
      />
      <Field
        name="done"
        label="Definition of done"
        initial={task?.definitionOfDone.join('\n')}
        multiline
        maxLength={20000}
        hint="One acceptance criterion per line; up to 20."
      />
      <div className="form-pair">
        <Field
          name="due"
          label="Due date"
          initial={task?.dueDate ?? workspace.deadline}
          type="date"
        />
        <Field
          name="labels"
          label="Capabilities"
          initial={task?.labels.join(', ')}
          required={false}
          maxLength={1000}
          hint="Comma-separated profile capabilities. Leave empty for any profile."
        />
      </div>
      <Field
        name="inputs"
        label="Inputs and references"
        initial={task?.availableInputs.join('\n')}
        multiline
        required={false}
        maxLength={20000}
        hint="One reference per line; URLs are stored as text, not fetched."
      />
      <Field
        name="restrictions"
        label="Restrictions"
        initial={task?.packet.restrictions.join('\n')}
        multiline
        required={false}
        maxLength={20000}
      />
      <fieldset className="dependencies">
        <legend>Depends on</legend>
        {workspace.tasks
          .filter((item) => item.id !== task?.id)
          .map((item) => (
            <label className="checkbox" key={item.id}>
              <input
                name="dependencies"
                type="checkbox"
                value={item.id}
                defaultChecked={task?.dependencies.includes(item.id)}
              />
              {item.id} · {item.title}
            </label>
          ))}
        {workspace.tasks.length === 0 && <p>No other tasks yet.</p>}
      </fieldset>
    </ActionForm>
  );
}

function TaskDetail({
  task,
  workspace,
  busy,
  save,
  edit,
  close,
}: {
  task: Task;
  workspace: Workspace;
  busy: boolean;
  save: Save;
  edit: () => void;
  close: () => void;
}) {
  const eligible = workspace.agents.filter((agent) =>
    getReadyTasks(workspace, agent.id).some((item) => item.id === task.id),
  );
  const agentId = task.assignedAgentId!;
  return (
    <div className="task-detail">
      <div className="row">
        <span className={`status ${task.status}`}>
          {statusNames[task.status]}
        </span>
        <span>
          {task.id} · {task.ownerType} · {task.priority} priority
        </span>
      </div>
      <dl>
        {[
          ['Objective', task.objective],
          ['Context', task.projectContext],
          ['Expected output', task.expectedOutput],
          ['Definition of done', task.definitionOfDone.join('\n')],
          ['Inputs', task.availableInputs.join('\n') || 'None supplied'],
          [
            'Restrictions',
            task.packet.restrictions.join('\n') || 'None supplied',
          ],
          ['Deadline', task.dueDate],
          [
            'Dependencies',
            task.dependencies
              .map(
                (id) =>
                  `${id}: ${workspace.tasks.find((item) => item.id === id)?.title}`,
              )
              .join('\n') || 'None',
          ],
          ['Capabilities', task.labels.join(', ') || 'Any profile'],
          ['Review', task.packet.approvalRequirements],
        ].map(([title, content]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{content}</dd>
          </div>
        ))}
      </dl>
      {['ready', 'backlog'].includes(task.status) && (
        <div className="row">
          <button onClick={edit} disabled={busy}>
            Edit task
          </button>
          <details>
            <summary>Delete unclaimed task</summary>
            <p>This removes the task. Dependent tasks must be updated first.</p>
            <button
              disabled={busy}
              onClick={() => {
                void save({ type: 'delete_task', taskId: task.id })
                  .then(close)
                  .catch(() => {});
              }}
            >
              Confirm deletion
            </button>
          </details>
        </div>
      )}
      {task.status === 'ready' && (
        <ActionForm
          busy={busy || !eligible.length}
          label="Assign task"
          submit={(data) =>
            save({
              type: 'claim_task',
              taskId: task.id,
              agentId: value(data, 'agent'),
            })
          }
        >
          <h3>Assign to a profile</h3>
          <p>
            Record the assignment here, or let a connected agent claim it. This
            does not launch an agent.
          </p>
          {eligible.length ? (
            <label className="field">
              <span>Agent profile</span>
              <select aria-label="Agent profile" name="agent">
                {eligible.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              No profile has both matching capabilities and free capacity. Add a
              suitable profile or edit the task capabilities.
            </p>
          )}
        </ActionForm>
      )}
      {task.ownerType === 'human' && task.status !== 'completed' && (
        <ActionForm
          busy={busy || !dependenciesComplete(workspace, task)}
          label="Mark complete"
          submit={(data) =>
            save({
              type: 'complete_human_task',
              taskId: task.id,
              result: value(data, 'result'),
            })
          }
        >
          <h3>Complete your task</h3>
          {task.locked && <p>Complete the dependencies first.</p>}
          <Field label="Result" name="result" multiline maxLength={1000} />
        </ActionForm>
      )}
      {agentId && ['in_progress', 'blocked'].includes(task.status) && (
        <>
          <details>
            <summary>Record progress</summary>
            <ActionForm
              busy={busy}
              label="Save progress"
              submit={(data) =>
                save({
                  type: 'update_task_progress',
                  taskId: task.id,
                  agentId,
                  note: value(data, 'note'),
                  completionPercentage: Number(value(data, 'percent')),
                  timeSpentMinutes: Number(value(data, 'minutes')),
                  ...(value(data, 'blocker')
                    ? { blocker: value(data, 'blocker') }
                    : {}),
                })
              }
            >
              <Field
                name="note"
                label="Progress note"
                multiline
                maxLength={800}
              />
              <div className="form-pair">
                <label className="field">
                  <span>Progress (0–99%)</span>
                  <input
                    key={`${task.id}:${task.completionPercentage}`}
                    name="percent"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={Math.min(99, task.completionPercentage)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Minutes spent</span>
                  <input
                    name="minutes"
                    type="number"
                    min={0}
                    max={100000}
                    defaultValue={0}
                    required
                  />
                </label>
              </div>
              <Field
                name="blocker"
                label="Current blocker"
                required={false}
                maxLength={800}
                hint="Leave blank to clear a previous progress blocker. Unanswered blocking questions still apply."
              />
            </ActionForm>
          </details>
          <details>
            <summary>Ask for human input</summary>
            <ActionForm
              busy={busy}
              label="Send to human inbox"
              submit={(data) =>
                save({
                  type: 'request_human_input',
                  taskId: task.id,
                  agentId,
                  question: value(data, 'question'),
                  reason: value(data, 'reason'),
                  canContinue: data.has('continue'),
                  recommendedChoices: lines(data, 'choices'),
                })
              }
            >
              <Field name="question" label="Question" maxLength={1000} />
              <Field
                name="reason"
                label="Why this is needed"
                maxLength={1000}
              />
              <Field
                name="choices"
                label="Suggested answers"
                multiline
                required={false}
                maxLength={4000}
              />
              <label className="checkbox">
                <input name="continue" type="checkbox" />
                Work can continue while waiting
              </label>
            </ActionForm>
          </details>
          <details>
            <summary>Submit a deliverable</summary>
            <ActionForm
              busy={busy || task.status === 'blocked'}
              label="Submit for review"
              submit={(data) =>
                save({
                  type: 'submit_deliverable',
                  taskId: task.id,
                  agentId,
                  summary: value(data, 'summary'),
                  content: value(data, 'content'),
                  evidence: lines(data, 'evidence'),
                  knownLimitations: lines(data, 'limitations'),
                  recommendedNextAction: value(data, 'next'),
                })
              }
            >
              {task.status === 'blocked' && (
                <p>
                  Resolve blocking questions and report cleared progress
                  blockers before submission.
                </p>
              )}
              <Field name="summary" label="Summary" maxLength={800} />
              <Field
                name="content"
                label="Deliverable content"
                multiline
                maxLength={8000}
              />
              <Field
                name="evidence"
                label="Evidence and references"
                multiline
                required={false}
                maxLength={20000}
              />
              <Field
                name="limitations"
                label="Known limitations"
                multiline
                required={false}
                maxLength={20000}
              />
              <Field
                name="next"
                label="Recommended next action"
                maxLength={1000}
              />
            </ActionForm>
          </details>
        </>
      )}
      {task.deliverables.length > 0 && (
        <section>
          <h3>Deliverables</h3>
          {task.deliverables.map((delivery) => (
            <article className="inset" key={delivery.id}>
              <span className="eyebrow">{delivery.status}</span>
              <h4>{delivery.summary}</h4>
              <p className="preserve">{delivery.content}</p>
              <dl>
                <div>
                  <dt>Evidence</dt>
                  <dd>{delivery.evidence.join('\n') || 'None supplied'}</dd>
                </div>
                <div>
                  <dt>Limitations</dt>
                  <dd>
                    {delivery.knownLimitations.join('\n') || 'None reported'}
                  </dd>
                </div>
                <div>
                  <dt>Next action</dt>
                  <dd>{delivery.recommendedNextAction}</dd>
                </div>
                {delivery.feedback && (
                  <div>
                    <dt>Reviewer feedback</dt>
                    <dd>{delivery.feedback}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </section>
      )}
      {task.status === 'human_review' && (
        <ActionForm
          busy={busy}
          label="Save review decision"
          submit={(data) =>
            value(data, 'decision') === 'approve'
              ? save({
                  type: 'approve_deliverable',
                  taskId: task.id,
                  ...(value(data, 'feedback')
                    ? { feedback: value(data, 'feedback') }
                    : {}),
                })
              : save({
                  type: 'reject_deliverable',
                  taskId: task.id,
                  feedback: value(data, 'feedback'),
                })
          }
        >
          <h3>Review the deliverable</h3>
          <label className="field">
            <span>Decision</span>
            <select aria-label="Decision" name="decision" defaultValue="revise">
              <option value="revise">Request revisions</option>
              <option value="approve">Approve and complete</option>
            </select>
          </label>
          <Field
            label="Review feedback"
            name="feedback"
            multiline
            required={false}
            maxLength={1000}
            hint="Required when requesting revisions."
          />
        </ActionForm>
      )}
      {workspace.clarifications
        .filter((q) => q.taskId === task.id)
        .map((q) => (
          <article className="inset" key={q.id}>
            <h4>{q.question}</h4>
            <p>{q.reason}</p>
            <p>
              {q.canContinue ? 'Work can continue' : 'Blocking question'} ·{' '}
              {q.status}
            </p>
            {q.recommendedChoices.length > 0 && (
              <p>Suggested: {q.recommendedChoices.join(' / ')}</p>
            )}
            {q.answer ? (
              <p className="preserve">
                <strong>Answer: </strong>
                {q.answer}
              </p>
            ) : (
              <ActionForm
                busy={busy}
                label="Save answer"
                submit={(data) =>
                  save({
                    type: 'answer_clarification',
                    clarificationId: q.id,
                    answer: value(data, 'answer'),
                  })
                }
              >
                <Field
                  label="Your answer"
                  name="answer"
                  multiline
                  maxLength={1500}
                />
              </ActionForm>
            )}
          </article>
        ))}
      {task.progressNotes.length > 0 && (
        <section>
          <h3>Progress history</h3>
          {[...task.progressNotes].reverse().map((note) => (
            <article className="inset" key={note.id}>
              <small>
                {new Date(note.createdAt).toLocaleString()} ·{' '}
                {note.completionPercentage}%
              </small>
              <p className="preserve">{note.note}</p>
              {(note.blocker || note.missingInformation) && (
                <p>
                  Reported blocker: {note.blocker ?? note.missingInformation}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default function RelayWorkspace() {
  const { workspace, busy, error, message } = useSyncExternalStore(
    subscribe,
    snapshot,
    serverSnapshot,
  );
  const [view, setView] = useState<View>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [fileError, setFileError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void loadWorkspace().catch(() => {});
  }, []);
  const save: Save = async (action) => {
    await mutateWorkspace(action);
  };
  const saveAndClose: Save = async (action) => {
    await save(action);
    setModal(null);
  };
  function exportBackup() {
    if (!workspace) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(workspace)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `relay-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const pending =
    workspace?.tasks.filter((task) => task.status === 'human_review').length ??
    0;
  const questions =
    workspace?.clarifications.filter((q) => q.status === 'pending') ?? [];
  const done =
    workspace?.tasks.filter((task) => task.status === 'completed').length ?? 0;
  const selectedTask =
    modal && 'id' in modal
      ? workspace?.tasks.find((task) => task.id === modal.id)
      : undefined;
  const visibleTasks =
    workspace?.tasks.filter(
      (task) =>
        (filter === 'all' || task.status === filter) &&
        `${task.title} ${task.id} ${task.objective}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) ?? [];
  function taskCard(task: Task) {
    return (
      <button
        className="task-card"
        key={task.id}
        onClick={() => setModal({ kind: 'task', id: task.id })}
      >
        <div className="row between">
          <small>{task.id}</small>
          <span className={`status ${task.status}`}>
            {statusNames[task.status]}
          </span>
        </div>
        <h3>{task.title}</h3>
        <p>{task.objective}</p>
        <div className="task-meta">
          <span>
            {task.ownerType === 'human'
              ? 'Human task'
              : (workspace?.agents.find((a) => a.id === task.assignedAgentId)
                  ?.name ?? 'Unassigned agent task')}
          </span>
          <span>
            {task.locked ? 'Waiting on dependencies' : `Due ${task.dueDate}`}
          </span>
        </div>
        <span className="open-task">
          Open task <ArrowRight size={15} />
        </span>
      </button>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span>r</span>relay<span className="brand-dot">.</span>
        </Link>
        <p className="sidebar-caption">ONE PLAN. CLEAR HANDOFFS.</p>
        <nav aria-label="Workspace">
          {navigation.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={19} />
              {title}
              {id === 'inbox' && pending + questions.length > 0 && (
                <b>{pending + questions.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Bot size={24} />
          <h3>You set the direction.</h3>
          <p>
            Give agents clear tasks. Review their work. Keep the next step
            visible.
          </p>
          <a
            href="https://github.com/agammann/relay-webmcp"
            target="_blank"
            rel="noreferrer"
          >
            Source & instructions ↗
          </a>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <span>YOUR WORKSPACE</span>
          <span className="saved">
            <span />
            {busy
              ? 'Saving…'
              : workspace
                ? 'Server-backed · this browser'
                : 'Connecting…'}
          </span>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {navigation.find((item) => item.id === view)?.title}
              </span>
              <h1 tabIndex={-1}>
                {workspace?.name ?? 'Your next project starts here.'}
              </h1>
              <p>{workspace?.goal ?? 'Opening your saved workspace…'}</p>
            </div>
            <button
              className="primary"
              disabled={!workspace || busy}
              onClick={() => setModal({ kind: 'create' })}
            >
              <Plus size={18} />
              Add task
            </button>
          </div>
          <div className="toolbar">
            <button
              disabled={!workspace || busy}
              onClick={() => setModal({ kind: 'project' })}
            >
              <Settings2 size={16} />
              Project details
            </button>
            <button disabled={!workspace || busy} onClick={exportBackup}>
              <Download size={16} />
              Export backup
            </button>
            <button
              disabled={!workspace || busy}
              onClick={() => importRef.current?.click()}
            >
              Import backup
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void loadWorkspace().catch(() => {});
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import workspace file"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setFileError('');
              try {
                if (file.size > 1000000)
                  throw new Error('Backup file is too large.');
                const data: unknown = JSON.parse(await file.text());
                const { parseBackup } = await import('@/lib/backup');
                const restored = parseBackup(data);
                setModal({
                  kind: 'replace',
                  title: `Restore “${restored.name}”`,
                  action: { type: 'import_workspace', workspace: restored },
                });
              } catch {
                setFileError(
                  'This file is not a valid Relay backup (maximum 1 MB). Your project has not changed.',
                );
              }
            }}
          />
          {(error || fileError) && (
            <div role="alert" className="error">
              {fileError || error}
            </div>
          )}
          <output className="save-status">{message}</output>
          {workspace && (
            <>
              {view === 'overview' && (
                <>
                  <div className="metrics">
                    <div>
                      <span>Completed</span>
                      <strong>
                        {done}
                        <small> / {workspace.tasks.length}</small>
                      </strong>
                    </div>
                    <div>
                      <span>Ready for an agent</span>
                      <strong>{getReadyTasks(workspace).length}</strong>
                    </div>
                    <div>
                      <span>Awaiting review</span>
                      <strong>{pending}</strong>
                    </div>
                    <div>
                      <span>Open questions</span>
                      <strong>{questions.length}</strong>
                    </div>
                  </div>
                  {!workspace.tasks.length ? (
                    <section className="empty hero-empty">
                      <span className="illustration">
                        <ListTodo size={42} />
                      </span>
                      <h2>Turn a goal into work that gets done.</h2>
                      <p>
                        Add a task with a clear outcome, give it to yourself or
                        an agent, and follow it through to completion.
                      </p>
                      <div className="row">
                        <button
                          className="primary"
                          onClick={() => setModal({ kind: 'create' })}
                        >
                          Create your first task <ArrowRight size={17} />
                        </button>
                        <button
                          onClick={() =>
                            setModal({
                              kind: 'replace',
                              title: 'Load example project',
                              action: { type: 'reset_demo' },
                            })
                          }
                        >
                          Explore an example
                        </button>
                      </div>
                    </section>
                  ) : (
                    <>
                      <div className="section-heading">
                        <h2>Work in motion</h2>
                        <button onClick={() => setView('board')}>
                          View all tasks <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="task-grid">
                        {workspace.tasks
                          .filter((task) => task.status !== 'completed')
                          .slice(0, 6)
                          .map(taskCard)}
                      </div>
                      {done === workspace.tasks.length && (
                        <div className="empty">
                          <CheckCircle2 size={32} />
                          <h2>Every task is complete.</h2>
                          <p>
                            Export a backup before starting your next project.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  <section className="guide">
                    <div>
                      <span className="step">01</span>
                      <h3>Define the work</h3>
                      <p>
                        Write an objective, expected output, acceptance
                        criteria, and dependencies.
                      </p>
                    </div>
                    <div>
                      <span className="step">02</span>
                      <h3>Make the handoff</h3>
                      <p>
                        A connected agent claims eligible work, reports
                        progress, and asks questions.
                      </p>
                    </div>
                    <div>
                      <span className="step">03</span>
                      <h3>Review the result</h3>
                      <p>
                        Read the evidence, request revisions, or approve to
                        unlock the next task.
                      </p>
                    </div>
                  </section>
                </>
              )}
              {view === 'board' && (
                <>
                  <div className="board-filters">
                    <label className="field">
                      <span>Search tasks</span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Title, objective, or ID"
                      />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {Object.entries(statusNames).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="task-grid">{visibleTasks.map(taskCard)}</div>
                  {!visibleTasks.length && (
                    <p className="empty">
                      No matching tasks. Add a task or change the filters.
                    </p>
                  )}
                </>
              )}
              {view === 'inbox' && (
                <>
                  <p className="section-intro">
                    Review deliverables and answer questions. Approval completes
                    an agent task and unlocks its dependents.
                  </p>
                  <div className="task-grid">
                    {workspace.tasks
                      .filter(
                        (task) =>
                          task.status === 'human_review' ||
                          questions.some((q) => q.taskId === task.id),
                      )
                      .map(taskCard)}
                  </div>
                  {!pending && !questions.length && (
                    <section className="empty">
                      <Inbox size={36} />
                      <h2>Nothing waiting on you.</h2>
                      <p>Agent submissions and questions will appear here.</p>
                    </section>
                  )}
                </>
              )}
              {view === 'agents' && (
                <>
                  <div className="section-heading">
                    <p>
                      Profiles describe assignments and capacity. Connect your
                      own agent in a browser with WebMCP support; Relay does not
                      run agents in the background.
                    </p>
                    <button onClick={() => setModal({ kind: 'agent' })}>
                      Add profile
                    </button>
                  </div>
                  <div className="task-grid">
                    {workspace.agents.map((agent) => (
                      <article className="profile-card" key={agent.id}>
                        <Bot size={24} />
                        <h2>{agent.name}</h2>
                        <p>{agent.description}</p>
                        <code>{agent.id}</code>
                        <div className="tags">
                          {agent.capabilities.map((capability) => (
                            <span key={capability}>{capability}</span>
                          ))}
                        </div>
                        <p>
                          {activeAssignments(workspace, agent.id)} /{' '}
                          {agent.maxActiveTasks} active assignments ·{' '}
                          {agent.completedAssignments} completed
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {view === 'activity' && (
                <section className="activity-list">
                  <h2>Recent workspace activity</h2>
                  <p>
                    The latest 100 events are kept. Task details retain
                    progress, answers, and deliverables within workspace limits.
                  </p>
                  {workspace.activity.map((event) => (
                    <article key={event.id}>
                      <span className="activity-dot" />
                      <div>
                        <small>
                          {event.actor} ·{' '}
                          {new Date(event.createdAt).toLocaleString()}
                        </small>
                        <p>{event.explanation}</p>
                      </div>
                    </article>
                  ))}
                  {!workspace.activity.length && (
                    <p className="empty">
                      Your first saved change will appear here.
                    </p>
                  )}
                </section>
              )}
              <footer>
                <p>
                  This workspace is saved on the server and tied to this
                  browser’s cookie. Export a backup before clearing cookies or
                  switching devices. No account or team link sharing.
                </p>
                <div className="row">
                  <span>
                    Version {workspace.version}
                    {workspace.demoData ? ' · Example project' : ''}
                    {workspace.deadline
                      ? ` · Target ${workspace.deadline}`
                      : ''}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      setModal({
                        kind: 'replace',
                        title: 'Start a new project',
                        action: { type: 'new_project' },
                      })
                    }
                  >
                    New project
                  </button>
                </div>
              </footer>
            </>
          )}
          <WebMcpProvider ready={!!workspace} />
        </main>
      </div>
      {modal && workspace && (
        <ModalPanel
          key={modal.kind}
          title={
            modal.kind === 'task' || modal.kind === 'edit'
              ? (selectedTask?.title ?? 'Task no longer exists')
              : modal.kind === 'create'
                ? 'Add a task'
                : modal.kind === 'project'
                  ? 'Project details'
                  : modal.kind === 'agent'
                    ? 'Add agent profile'
                    : 'title' in modal
                      ? modal.title
                      : 'Task'
          }
          close={() => setModal(null)}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {(modal.kind === 'create' || modal.kind === 'edit') && (
            <TaskEditor
              workspace={workspace}
              task={selectedTask}
              busy={busy}
              save={saveAndClose}
            />
          )}
          {modal.kind === 'task' && selectedTask && (
            <TaskDetail
              task={selectedTask}
              workspace={workspace}
              busy={busy}
              save={save}
              edit={() => setModal({ kind: 'edit', id: selectedTask.id })}
              close={() => setModal(null)}
            />
          )}
          {modal.kind === 'project' && (
            <ActionForm
              busy={busy}
              label="Save project"
              submit={(data) =>
                saveAndClose({
                  type: 'update_project',
                  name: value(data, 'name'),
                  goal: value(data, 'goal'),
                  deadline: value(data, 'deadline'),
                })
              }
            >
              <Field
                name="name"
                label="Project name"
                initial={workspace.name}
                maxLength={160}
              />
              <Field
                name="goal"
                label="Project goal"
                initial={workspace.goal}
                multiline
                maxLength={3000}
              />
              <Field
                name="deadline"
                label="Target date"
                initial={workspace.deadline}
                type="date"
                required={false}
              />
              <p>Existing task packets keep their own context and deadlines.</p>
            </ActionForm>
          )}
          {modal.kind === 'agent' && (
            <ActionForm
              busy={busy}
              label="Create profile"
              submit={(data) =>
                saveAndClose({
                  type: 'add_agent',
                  name: value(data, 'name'),
                  description: value(data, 'description'),
                  capabilities: tags(data, 'capabilities'),
                  maxActiveTasks: Number(value(data, 'capacity')),
                })
              }
            >
              <Field name="name" label="Profile name" maxLength={100} />
              <Field
                name="description"
                label="Profile description"
                maxLength={1000}
              />
              <Field
                name="capabilities"
                label="Capabilities"
                required={false}
                maxLength={1000}
                hint="Comma separated; empty means general-purpose."
              />
              <label className="field">
                <span>Maximum active tasks</span>
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={2}
                  required
                />
              </label>
            </ActionForm>
          )}
          {modal.kind === 'replace' && (
            <ActionForm
              busy={busy}
              label="Replace current project"
              submit={() => saveAndClose(modal.action)}
            >
              <p>
                This replaces the current project, tasks, and history in this
                browser workspace. Export a backup first if you want to keep
                them.
              </p>
              <button type="button" onClick={exportBackup}>
                Export current project
              </button>
              <label className="checkbox">
                <input type="checkbox" required />I understand the current
                project will be replaced.
              </label>
            </ActionForm>
          )}
        </ModalPanel>
      )}
    </div>
  );
}
