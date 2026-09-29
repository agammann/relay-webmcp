import type { TaskDraft } from './project';
export type TaskStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'human_review'
  | 'blocked'
  | 'completed';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type OwnerType = 'human' | 'agent' | 'unassigned';

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  preferredTaskTypes: string[];
  maxActiveTasks: number;
  active: boolean;
  completedAssignments: number;
}

export interface TaskPacket {
  objective: string;
  context: string;
  inputs: string[];
  expectedOutput: string;
  definitionOfDone: string[];
  deadline: string;
  dependencies: string[];
  restrictions: string[];
  approvalRequirements: string;
}

export interface ProgressNote {
  id: string;
  agentId: string;
  note: string;
  completionPercentage: number;
  timeSpentMinutes: number;
  blocker: string | null;
  missingInformation: string | null;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  taskId: string;
  agentId: string;
  summary: string;
  content: string;
  evidence: string[];
  knownLimitations: string[];
  recommendedNextAction: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface ClarificationRequest {
  id: string;
  taskId: string;
  agentId: string;
  question: string;
  reason: string;
  canContinue: boolean;
  recommendedChoices: string[];
  status: 'pending' | 'answered';
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface Task {
  id: string;
  title: string;
  objective: string;
  projectContext: string;
  availableInputs: string[];
  expectedOutput: string;
  definitionOfDone: string[];
  ownerType: OwnerType;
  assignedAgentId: string | null;
  priority: Priority;
  status: TaskStatus;
  estimatedEffortHours: number;
  dueDate: string;
  dependencies: string[];
  labels: string[];
  locked: boolean;
  approvalRequired: boolean;
  completionPercentage: number;
  progressNotes: ProgressNote[];
  deliverables: Deliverable[];
  clarificationIds: string[];
  packet: TaskPacket;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  actorType: 'human' | 'agent' | 'system';
  actor: string;
  action: string;
  taskId: string | null;
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus | null;
  explanation: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  goal: string;
  deadline: string;
  demoData: boolean;
  version: number;
  agents: AgentProfile[];
  tasks: Task[];
  clarifications: ClarificationRequest[];
  activity: ActivityEvent[];
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceAction =
  | { type: 'claim_task'; agentId: string; taskId: string }
  | {
      type: 'update_task_progress';
      agentId: string;
      taskId: string;
      note: string;
      completionPercentage: number;
      timeSpentMinutes: number;
      blocker?: string;
      missingInformation?: string;
    }
  | {
      type: 'submit_deliverable';
      agentId: string;
      taskId: string;
      summary: string;
      content: string;
      evidence: string[];
      knownLimitations: string[];
      recommendedNextAction: string;
    }
  | {
      type: 'request_human_input';
      agentId: string;
      taskId: string;
      question: string;
      reason: string;
      canContinue: boolean;
      recommendedChoices: string[];
    }
  | { type: 'approve_deliverable'; taskId: string; feedback?: string }
  | { type: 'reject_deliverable'; taskId: string; feedback: string }
  | { type: 'answer_clarification'; clarificationId: string; answer: string }
  | { type: 'update_project'; name: string; goal: string; deadline: string }
  | { type: 'create_task'; task: TaskDraft }
  | { type: 'edit_task'; taskId: string; task: TaskDraft }
  | { type: 'delete_task'; taskId: string }
  | { type: 'complete_human_task'; taskId: string; result: string }
  | {
      type: 'add_agent';
      name: string;
      description: string;
      capabilities: string[];
      maxActiveTasks: number;
    }
  | { type: 'import_workspace'; workspace: Workspace }
  | { type: 'new_project' }
  | { type: 'reset_demo' };

export interface ActionResult {
  workspace: Workspace;
  action: WorkspaceAction['type'];
  taskId: string | null;
  agentId: string | null;
  previousStatus: TaskStatus | null;
  currentStatus: TaskStatus | null;
  changedEntityIds: string[];
  warnings: string[];
  summary: string;
}
