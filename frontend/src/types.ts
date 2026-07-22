export type UserRole = 'admin' | 'registrar' | 'team_leader' | 'department_user';
export type Channel = 'fax' | 'mail' | 'post';
export type DocumentStatus = 'pending_reception' | 'received' | 'in_progress' | 'completed';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  department_id: number | null;
  is_active: boolean;
}

export interface Department {
  id: number;
  name: string;
  emails: string[];
}

export interface Document {
  id: number;
  reception_number: string | null;
  channel: Channel;
  sender: string;
  title: string;
  doc_number: string | null;
  input_reception_date: string | null;
  original_filename: string | null;
  status: DocumentStatus;
  registered_by: { id: number; name: string };
  received_by: { id: number; name: string } | null;
  received_at: string | null;
  assigned_department: { id: number; name: string } | null;
  assigned_user: { id: number; name: string } | null;
  deadline: string | null;
  memo: string | null;
  has_receipt: boolean;
  attachment_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total: number;
  pending_reception: number;
  received: number;
  deadline_soon: number;
  overdue: number;
}

export interface DigitalStampInfo {
  configured: boolean;
  filename: string | null;
  updated_at: string | null;
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  fax: '팩스',
  mail: '메일',
  post: '우편',
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending_reception: '접수대기',
  received: '접수완료',
  in_progress: '처리중',
  completed: '처리완료',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  registrar: '접수담당',
  team_leader: '경영지원팀장',
  department_user: '담당부서',
};
