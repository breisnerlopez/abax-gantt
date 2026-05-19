export type NodeType = 'project' | 'stage' | 'group' | 'task' | 'milestone';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface ProjectType {
  id: string;
  name: string;
  color: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  budget_total: number | null;
  project_types?: ProjectType | null;
}

export interface TaskAssignee {
  id?: string;
  user_id: string;
  profiles?: Profile | null;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string;
  is_admin?: boolean;
}

export interface WbsNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  type: NodeType;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  progress: number | null;
  estimated_hours: number | null;
  estimated_cost: number | null;
  color: string | null;
  sort_order: number | null;
  responsible_id: string | null;
  is_unscheduled: boolean;
  path: string;
  task_assignees?: TaskAssignee[];
}

export interface Dependency {
  id: string;
  predecessor_id: string;
  successor_id: string;
  type: DependencyType;
}

export interface Attachment {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  download_url: string | null;
  created_at?: string;
}

export interface BudgetReport {
  project: { id: string; name: string; status: string };
  budget: { total: number; estimated_cost: number; consumed_pct: number };
  hours: { estimated: number; actual: number; variance_pct: number };
  progress: number;
  task_count: number;
  task_breakdown: Array<{
    id: string;
    name: string;
    progress: number | null;
    estimated_hours: number;
    actual_hours: number;
    hours_variance: number;
    estimated_cost: number;
    assignees: unknown[];
  }>;
  hours_by_person: Array<{ user_id: string; full_name: string; hours: number }>;
}

export interface Summary {
  active_projects: number;
  total_projects: number;
  global_progress: number;
  upcoming_milestones_count: number;
  total_budget: number;
  total_estimated_cost: number;
  budget_consumed_pct: number;
  total_tasks: number;
  unscheduled_tasks: number;
}

export interface ApiEnvelope<T> {
  data: T;
  count?: number;
}

export interface PortfolioData {
  projects: Project[];
  users: Profile[];
  nodes: WbsNode[];
  backlog: WbsNode[];
  dependencies: Dependency[];
  summary: Summary | null;
}

export interface AuthSession {
  accessToken: string | null;
  userName: string;
  userEmail: string | null;
  role: 'admin' | 'responsable' | 'ejecutor';
}
