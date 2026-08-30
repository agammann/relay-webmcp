'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The overlay intentionally uses a non-modal section to preserve the board context. */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, Bot, CalendarDays, CheckCircle2, CircleDot, Clock3,
  Command, Download, Inbox, LayoutDashboard, LockKeyhole, MessageSquareText,
  RefreshCcw, Sparkles, UsersRound, UserRound, XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import type { Task, TaskStatus, Workspace, WorkspaceAction } from '@/lib/domain';
import { activeAssignments, applyWorkspaceAction, packetCompleteness } from '@/lib/rules';
import { createSeedWorkspace } from '@/lib/seed-data';
import { WebMcpProvider } from './webmcp-provider';

type View = 'command' | 'board' | 'inbox' | 'agents' | 'activity';

const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'command', label: 'Command center', icon: LayoutDashboard },
  { id: 'board', label: 'Task board', icon: CircleDot },
  { id: 'inbox', label: 'Human inbox', icon: Inbox },
  { id: 'agents', label: 'Agent roster', icon: UsersRound },
  { id: 'activity', label: 'Activity', icon: Activity },
];

const statusLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog', ready: 'Ready', in_progress: 'In progress',
  human_review: 'Human review', blocked: 'Blocked', completed: 'Completed',
};

const statusClasses: Record<TaskStatus, string> = {
  backlog: 'border-[#d8dee8] bg-[#f3f5f8] text-[#637189]',
  ready: 'border-[#bcd2ff] bg-[#edf4ff] text-[#1955c7]',
  in_progress: 'border-[#c7d3e6] bg-[#eef3f9] text-[#172d52]',
  human_review: 'border-[#ecd69c] bg-[#fff8df] text-[#8a6414]',
  blocked: 'border-[#f0b9aa] bg-[#fff0eb] text-[#a5402f]',
  completed: 'border-[#a8dbc7] bg-[#ebfaf3] text-[#267254]',
};

const priorityClasses = {
  low: 'bg-[#edf1f6] text-[#66758d]', medium: 'bg-[#e9f1ff] text-[#2860bd]',
  high: 'bg-[#fff1d5] text-[#8a6414]', critical: 'bg-[#ffebe6] text-[#aa3f2d]',
};

const json = async (path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'RelayPlan request failed.');
  return data;
};

function TaskCard({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const completeness = packetCompleteness(task);
  return (
    <button type="button" onClick={() => onSelect(task)} className="group w-full rounded-2xl border border-[var(--rp-line)] bg-white p-4 text-left shadow-[0_10px_30px_rgba(22,45,82,0.05)] transition hover:-translate-y-0.5 hover:border-[#9fb9e9] hover:shadow-[0_14px_34px_rgba(22,45,82,0.09)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-[#71809a]">{task.id}</span>
        <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${priorityClasses[task.priority]}`}>{task.priority}</span>
      </div>
      <h3 className="text-[15px] font-semibold leading-snug text-[#152947]">{task.title}</h3>
      <div className="mt-4 flex items-center gap-2 text-xs text-[#53627a]">
        {task.ownerType === 'human' ? <UserRound className="size-3.5 text-[#9a721b]" /> : task.assignedAgentId ? <Bot className="size-3.5 text-[#2869df]" /> : <CircleDot className="size-3.5" />}
        <span>{task.ownerType === 'human' ? 'Human-owned' : task.assignedAgentId ? task.assignedAgentId.replaceAll('-', ' ') : 'Available to agents'}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-[#71809a]"><span>{completeness.percentage}% packet</span><span>{task.completionPercentage}% complete</span></div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#edf1f6]"><span className="block h-full rounded-full bg-[#2d73f5]" style={{ width: `${task.completionPercentage}%` }} /></div>
    </button>
  );
}

function TaskBoard({ tasks, onSelect, compact = false }: { tasks: Task[]; onSelect: (task: Task) => void; compact?: boolean }) {
  const statuses: TaskStatus[] = compact ? ['ready', 'in_progress', 'human_review', 'blocked'] : ['backlog', 'ready', 'in_progress', 'human_review', 'blocked', 'completed'];
  return (
    <div className={`grid gap-4 overflow-x-auto pb-4 ${compact ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3 2xl:grid-cols-6'}`}>
      {statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section key={status} className="min-w-[250px] rounded-[22px] border border-[var(--rp-line)] bg-[#f4f7fb] p-3.5">
            <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[#4c5d76]">{statusLabels[status]}</h3><span className="grid size-6 place-items-center rounded-full bg-white text-[11px] font-bold text-[#53627a] shadow-sm">{columnTasks.length}</span></div>
            <div className="space-y-3">{columnTasks.map((task) => <TaskCard key={task.id} task={task} onSelect={onSelect} />)}{!columnTasks.length ? <div className="rounded-xl border border-dashed border-[#d2dae6] px-3 py-8 text-center text-xs text-[#8793a6]">No tasks here</div> : null}</div>
          </section>
        );
      })}
    </div>
  );
}

export function RelayPlanApp() {
  const [workspace, setWorkspace] = useState<Workspace>(() => createSeedWorkspace());
  const [view, setView] = useState<View>('command');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('Loading the shared workspace…');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadWorkspace = async () => {
    try {
      const data = await json('/api/workspace'); setWorkspace(data.workspace as Workspace); setConnected(true); setMessage('Shared workspace connected');
    } catch { setConnected(false); setMessage('Local preview state · production uses durable shared storage'); }
  };

  useEffect(() => {
    queueMicrotask(() => void loadWorkspace());
    const onMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ workspace?: Workspace; summary?: string }>).detail;
      if (detail?.workspace) setWorkspace(detail.workspace); else void loadWorkspace();
      if (detail?.summary) setMessage(detail.summary);
    };
    window.addEventListener('relayplan:mutated', onMutation);
    return () => window.removeEventListener('relayplan:mutated', onMutation);
  }, []);

  const mutate = async (action: WorkspaceAction) => {
    setBusy(true);
    try {
      if (connected) {
        const data = await json('/api/workspace', { method: 'POST', body: JSON.stringify(action) });
        setWorkspace(data.workspace as Workspace); setMessage(String(data.summary));
      } else {
        const result = applyWorkspaceAction(workspace, action); setWorkspace(result.workspace); setMessage(`${result.summary} Preview only.`);
      }
      setSelectedTask(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  };

  const metrics = useMemo(() => [
    { label: 'Ready for agents', value: workspace.tasks.filter((task) => task.status === 'ready').length, tone: 'ready' as TaskStatus },
    { label: 'In progress', value: workspace.tasks.filter((task) => task.status === 'in_progress').length, tone: 'in_progress' as TaskStatus },
    { label: 'Needs your approval', value: workspace.tasks.filter((task) => task.status === 'human_review').length, tone: 'human_review' as TaskStatus },
    { label: 'Blocked', value: workspace.tasks.filter((task) => task.status === 'blocked').length, tone: 'blocked' as TaskStatus },
  ], [workspace]);
  const complete = workspace.tasks.filter((task) => task.status === 'completed').length;
  const progress = Math.round((complete / workspace.tasks.length) * 100);
  const pendingDeliverables = workspace.tasks.flatMap((task) => task.deliverables.filter((deliverable) => deliverable.status === 'pending').map((deliverable) => ({ task, deliverable })));
  const pendingClarifications = workspace.clarifications.filter((item) => item.status === 'pending');

  const exportWorkspace = () => {
    const href = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = href; link.download = `relayplan-workspace-v${workspace.version}.json`; link.click(); URL.revokeObjectURL(href);
  };

  return (
    <main className="min-h-screen bg-[var(--rp-canvas)] pb-24 text-[#172d52]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#10233f]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1560px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => setView('command')}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2d73f5] shadow-[0_8px_24px_rgba(45,115,245,0.35)]"><Command className="size-5" strokeWidth={2.3} /></span><span className="min-w-0"><span className="block truncate text-[15px] font-bold tracking-tight">RelayPlan</span><span className="hidden text-[10px] font-medium uppercase tracking-[0.15em] text-[#aabbd2] sm:block">One plan for you and your agents</span></span></button>
          <nav aria-label="Workspace navigation" className="hidden items-center gap-1 xl:flex">{navigation.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${view === item.id ? 'bg-white/12 text-white' : 'text-[#afbed2] hover:bg-white/7 hover:text-white'}`}><Icon className="size-3.5" /> {item.label}</button>; })}</nav>
          <div className="flex items-center gap-2"><Badge className={`hidden border sm:inline-flex ${connected ? 'border-[#2e8b65]/50 bg-[#143d38] text-[#87dfbb]' : 'border-[#536983] bg-[#1b3458] text-[#c0cce0]'}`}><span className={`size-1.5 rounded-full ${connected ? 'bg-[#6fe0ad]' : 'bg-[#8fa2ba]'}`} /> {connected ? 'Shared live state' : 'Preview state'}</Badge><Button className="h-8 bg-[#2d73f5] px-3 text-white hover:bg-[#2465dc]" onClick={() => setView('activity')}><Sparkles data-icon="inline-start" /> Agent tools</Button></div>
        </div>
        <nav aria-label="Mobile workspace navigation" className="flex overflow-x-auto border-t border-white/8 px-3 py-1.5 xl:hidden">{navigation.map((item) => <button key={item.id} type="button" onClick={() => setView(item.id)} className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold ${view === item.id ? 'bg-white/12 text-white' : 'text-[#afbed2]'}`}>{item.label}</button>)}</nav>
      </header>

      <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {view === 'command' ? <>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-[24px] border border-[var(--rp-line)] bg-white p-5 shadow-[0_18px_60px_rgba(22,45,82,0.06)] sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-[#bad0f6] bg-[#f0f6ff] text-[#1955c7]">Demonstration data</Badge><span className="inline-flex items-center gap-1 text-xs text-[#71809a]"><CalendarDays className="size-3.5" /> Due September 3</span></div><h1 className="max-w-3xl text-2xl font-bold tracking-[-0.035em] text-[#122642] sm:text-[32px]">{workspace.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#5a6980]">{workspace.goal}</p></div><div className="flex gap-2"><Button variant="outline" className="h-9 border-[#cbd6e6] bg-white px-3 text-[#213a60]" onClick={exportWorkspace}><Download data-icon="inline-start" /> Export</Button><Button variant="outline" className="h-9 border-[#cbd6e6] bg-white px-3 text-[#213a60]" disabled={busy} onClick={() => mutate({ type: 'reset_demo' })}><RefreshCcw data-icon="inline-start" /> Reset demo</Button></div></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Overall progress</span><span className="text-[#2869df]">{progress}%</span></div><Progress value={progress} className="[&_[data-slot=progress-indicator]]:bg-[#2d73f5] [&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-[#e8eef7]" /></div><p className="text-xs text-[#71809a]">{complete} of {workspace.tasks.length} tasks complete</p></div>
            </div>
            <aside className="rounded-[24px] border border-[#ecd69c] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(138,100,20,0.06)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9b741e]">Human inbox</p><h2 className="mt-1 text-lg font-bold tracking-tight text-[#4a3812]">{pendingDeliverables.length + pendingClarifications.length} decisions need you</h2></div><span className="grid size-9 place-items-center rounded-xl bg-[#f4d987] text-[#76560e]"><MessageSquareText className="size-4" /></span></div><p className="mt-3 text-sm leading-6 text-[#735f32]">Review agent deliverables, answer clarifications, and keep final authority with the human owner.</p><Button className="mt-5 h-9 bg-[#9a721b] px-3 text-white hover:bg-[#7f5e13]" onClick={() => setView('inbox')}>Open human inbox <ArrowRight data-icon="inline-end" /></Button></aside>
          </section>
          <section aria-label="Workspace metrics" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map((metric) => <button type="button" onClick={() => setView(metric.tone === 'human_review' || metric.tone === 'blocked' ? 'inbox' : 'board')} key={metric.label} className={`rounded-2xl border p-4 text-left ${statusClasses[metric.tone]}`}><p className="text-2xl font-extrabold tracking-[-0.04em]">{metric.value}</p><p className="mt-1 text-xs font-semibold">{metric.label}</p></button>)}</section>
          <section className="mt-7"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#2d73f5]">Shared task board</p><h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#122642]">Work moving through the relay</h2></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-[#637189]"><span className="inline-flex items-center gap-1.5"><Bot className="size-3.5 text-[#2869df]" /> Agent-owned</span><span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5 text-[#9a721b]" /> Human approval</span><span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Dependency locked</span></div></div><TaskBoard tasks={workspace.tasks} onSelect={setSelectedTask} compact /></section>
        </> : null}

        {view === 'board' ? <section><div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#2d73f5]">Every handoff visible</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#122642]">Task board</h1><p className="mt-2 text-sm text-[#637189]">Dependencies, ownership, approval gates, and agent-ready work stay explicit.</p></div><TaskBoard tasks={workspace.tasks} onSelect={setSelectedTask} /></section> : null}

        {view === 'inbox' ? <section><div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#9a721b]">Human-only control</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#122642]">Human inbox</h1><p className="mt-2 text-sm text-[#637189]">Agents can submit work and ask questions. Only you can approve, reject, or answer.</p></div><div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4"><h2 className="text-sm font-bold text-[#324761]">Deliverables awaiting approval</h2>{pendingDeliverables.map(({ task, deliverable }) => <article key={deliverable.id} className="rounded-2xl border border-[#ecd69c] bg-white p-5 shadow-[0_12px_36px_rgba(138,100,20,0.06)]"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[11px] font-bold text-[#8a6414]">{task.id}</span><h3 className="mt-1 text-lg font-bold text-[#162a47]">{task.title}</h3></div><Badge className="bg-[#fff1c5] text-[#8a6414]">Human review</Badge></div><p className="mt-4 text-sm font-semibold text-[#344761]">{deliverable.summary}</p><p className="mt-2 text-sm leading-6 text-[#637189]">{deliverable.content}</p><div className="mt-4 rounded-xl bg-[#f7f9fc] p-3 text-xs leading-5 text-[#5d6b80]"><strong>Evidence:</strong> {deliverable.evidence.join(' · ')}<br /><strong>Known limitation:</strong> {deliverable.knownLimitations.join(' · ') || 'None reported'}</div><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} className="bg-[#277457] text-white hover:bg-[#1f6248]" onClick={() => mutate({ type: 'approve_deliverable', taskId: task.id })}><CheckCircle2 data-icon="inline-start" /> Approve</Button><Button disabled={busy} variant="destructive" onClick={() => mutate({ type: 'reject_deliverable', taskId: task.id, feedback: 'Please revise the deliverable with clearer evidence and limitations.' })}><XCircle data-icon="inline-start" /> Request revisions</Button></div></article>)}{!pendingDeliverables.length ? <div className="rounded-2xl border border-dashed border-[#ccd6e4] bg-white/70 p-8 text-center text-sm text-[#71809a]">No deliverables are waiting for review.</div> : null}</div>
          <div className="space-y-4"><h2 className="text-sm font-bold text-[#324761]">Clarification requests</h2>{pendingClarifications.map((clarification) => { const task = workspace.tasks.find((item) => item.id === clarification.taskId); return <article key={clarification.id} className="rounded-2xl border border-[#f0b9aa] bg-white p-5 shadow-[0_12px_36px_rgba(165,64,47,0.06)]"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[11px] font-bold text-[#a5402f]">{clarification.taskId}</span><h3 className="mt-1 text-lg font-bold text-[#162a47]">{task?.title}</h3></div>{!clarification.canContinue ? <Badge variant="destructive">Work blocked</Badge> : null}</div><p className="mt-4 text-sm font-semibold text-[#344761]">{clarification.question}</p><p className="mt-2 text-sm leading-6 text-[#637189]">{clarification.reason}</p>{clarification.recommendedChoices.length ? <ul className="mt-3 space-y-1 text-xs text-[#637189]">{clarification.recommendedChoices.map((choice) => <li key={choice}>• {choice}</li>)}</ul> : null}<label className="mt-4 block text-xs font-bold text-[#45566d]" htmlFor={`answer-${clarification.id}`}>Your answer</label><Input id={`answer-${clarification.id}`} value={answers[clarification.id] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [clarification.id]: event.target.value }))} className="mt-2 h-10 bg-[#fbfcfe]" placeholder="Give the agent a concrete answer" /><Button disabled={busy || (answers[clarification.id]?.trim().length ?? 0) < 2} className="mt-3 bg-[#a5402f] text-white hover:bg-[#8c3426]" onClick={() => mutate({ type: 'answer_clarification', clarificationId: clarification.id, answer: answers[clarification.id] })}>Send answer <ArrowRight data-icon="inline-end" /></Button></article>; })}{!pendingClarifications.length ? <div className="rounded-2xl border border-dashed border-[#ccd6e4] bg-white/70 p-8 text-center text-sm text-[#71809a]">No clarification requests are pending.</div> : null}</div>
        </div></section> : null}

        {view === 'agents' ? <section><div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#2d73f5]">Coordination labels, not verified identities</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#122642]">Agent roster</h1><p className="mt-2 text-sm text-[#637189]">Capacity limits prevent agents from silently over-claiming work.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{workspace.agents.map((agent) => { const active = activeAssignments(workspace, agent.id); return <article key={agent.id} className="rounded-[22px] border border-[var(--rp-line)] bg-white p-5 shadow-[0_14px_40px_rgba(22,45,82,0.05)]"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#e9f1ff] text-[#2869df]"><Bot className="size-5" /></span><Badge variant="outline" className={agent.active ? 'border-[#a8dbc7] bg-[#ebfaf3] text-[#267254]' : ''}>{agent.active ? 'Active' : 'Paused'}</Badge></div><h2 className="mt-4 text-lg font-bold text-[#172d52]">{agent.name}</h2><p className="mt-2 min-h-16 text-sm leading-5 text-[#637189]">{agent.description}</p><div className="mt-4 flex flex-wrap gap-1.5">{agent.capabilities.map((capability) => <span key={capability} className="rounded-full bg-[#f0f4f9] px-2 py-1 text-[10px] font-semibold text-[#52627a]">{capability}</span>)}</div><div className="mt-5 border-t border-[#e5eaf1] pt-4"><div className="flex justify-between text-xs font-semibold"><span>Active capacity</span><span>{active}/{agent.maxActiveTasks}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1f6]"><span className="block h-full bg-[#2d73f5]" style={{ width: `${Math.min(100, (active / agent.maxActiveTasks) * 100)}%` }} /></div><p className="mt-3 text-xs text-[#71809a]">{agent.completedAssignments} completed assignments</p></div></article>; })}</div></section> : null}

        {view === 'activity' ? <section><div className="mb-5"><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#2d73f5]">Auditable by design</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#122642]">Activity history</h1><p className="mt-2 text-sm text-[#637189]">Every human, agent, and system state transition includes its before and after status.</p></div><div className="overflow-hidden rounded-[22px] border border-[var(--rp-line)] bg-white shadow-[0_14px_40px_rgba(22,45,82,0.05)]">{workspace.activity.map((event) => <article key={event.id} className="grid gap-3 border-b border-[#edf0f4] p-4 last:border-b-0 sm:grid-cols-[150px_1fr_auto]"><div><p className="text-xs font-bold text-[#263d5e]">{event.actor}</p><p className="mt-1 text-[10px] uppercase tracking-[0.09em] text-[#7a879a]">{event.actorType}</p></div><div><p className="text-sm font-semibold text-[#30445f]">{event.explanation}</p><p className="mt-1 font-mono text-[10px] text-[#7c899b]">{event.action}{event.taskId ? ` · ${event.taskId}` : ''}</p></div><div className="flex items-center gap-2 sm:justify-end">{event.previousStatus ? <Badge variant="outline" className={statusClasses[event.previousStatus]}>{statusLabels[event.previousStatus]}</Badge> : null}{event.newStatus ? <><ArrowRight className="size-3 text-[#8995a6]" /><Badge variant="outline" className={statusClasses[event.newStatus]}>{statusLabels[event.newStatus]}</Badge></> : null}</div></article>)}</div></section> : null}

        <footer className="mt-8 flex flex-col gap-3 border-t border-[var(--rp-line)] py-5 text-xs text-[#71809a] sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><Activity className="size-3.5 text-[#2d73f5]" /> {workspace.activity.length} human, agent, and system actions recorded</span><span className="inline-flex items-center gap-2"><Clock3 className="size-3.5" /> Workspace version {workspace.version} · {message}</span><span className="inline-flex items-center gap-2 text-[#277457]"><CheckCircle2 className="size-3.5" /> Approval rules enforced</span></footer>
      </div>

      {selectedTask ? <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#081426]/55 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTask(null); }}><section role="dialog" aria-modal="true" aria-labelledby="task-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-[#2d73f5]">{selectedTask.id}</span><Badge variant="outline" className={statusClasses[selectedTask.status]}>{statusLabels[selectedTask.status]}</Badge>{selectedTask.locked ? <Badge variant="outline"><LockKeyhole className="size-3" /> Locked</Badge> : null}</div><h2 id="task-title" className="mt-2 text-2xl font-bold tracking-tight text-[#142945]">{selectedTask.title}</h2></div><Button variant="ghost" size="icon" aria-label="Close task packet" onClick={() => setSelectedTask(null)}><XCircle /></Button></div><p className="mt-4 text-sm leading-6 text-[#5f6e84]">{selectedTask.packet.objective}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-[#f5f8fc] p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#64758d]">Relevant context</p><p className="mt-2 text-sm leading-6 text-[#43546c]">{selectedTask.packet.context}</p></div><div className="rounded-xl bg-[#f5f8fc] p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#64758d]">Expected output</p><p className="mt-2 text-sm leading-6 text-[#43546c]">{selectedTask.packet.expectedOutput}</p></div></div><div className="mt-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#64758d]">Definition of done</p><ul className="mt-2 space-y-2 text-sm text-[#43546c]">{selectedTask.packet.definitionOfDone.map((item) => <li key={item} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2b8a67]" /> {item}</li>)}</ul></div><div className="mt-5 flex flex-wrap gap-2 text-xs"><Badge variant="outline">Due {selectedTask.packet.deadline}</Badge><Badge variant="outline">{packetCompleteness(selectedTask).percentage}% packet complete</Badge><Badge variant="outline">{selectedTask.approvalRequired ? 'Human approval required' : 'No approval gate'}</Badge></div>{selectedTask.dependencies.length ? <div className="mt-5 rounded-xl border border-[#dce4ef] p-4"><p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#64758d]">Dependencies</p><div className="mt-2 flex flex-wrap gap-2">{selectedTask.dependencies.map((dependency) => { const item = workspace.tasks.find((task) => task.id === dependency); return <Badge key={dependency} variant="outline" className={item ? statusClasses[item.status] : ''}>{dependency} · {item ? statusLabels[item.status] : 'Unknown'}</Badge>; })}</div></div> : null}</section></div> : null}
      <WebMcpProvider />
    </main>
  );
}
