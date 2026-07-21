import axios from 'axios';
import type { DashboardStats, Department, Document, DigitalStampInfo, User } from '../types';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);
  const { data } = await api.post<{ access_token: string }>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function getDepartments() {
  const { data } = await api.get<Department[]>('/departments');
  return data;
}

export async function createDepartment(payload: { name: string; emails?: string[] }) {
  const { data } = await api.post<Department>('/departments', payload);
  return data;
}

export async function updateDepartment(
  id: number,
  payload: { name?: string; emails?: string[] },
) {
  const { data } = await api.patch<Department>(`/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: number) {
  await api.delete(`/departments/${id}`);
}

export async function getUsers(departmentId?: number) {
  const { data } = await api.get<User[]>('/users', {
    params: departmentId ? { department_id: departmentId } : {},
  });
  return data;
}

export async function getAdminUsers() {
  const { data } = await api.get<User[]>('/admin/users');
  return data;
}

export async function createUser(payload: {
  username: string;
  password: string;
  name: string;
  role: string;
  department_id?: number | null;
}) {
  const { data } = await api.post<User>('/admin/users', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: {
    name?: string;
    role?: string;
    department_id?: number | null;
    password?: string;
    is_active?: boolean;
  },
) {
  const { data } = await api.patch<User>(`/admin/users/${id}`, payload);
  return data;
}

export async function getStats() {
  const { data } = await api.get<DashboardStats>('/documents/stats');
  return data;
}

export async function getDocuments(params: Record<string, string | boolean | undefined>) {
  const { data } = await api.get<Document[]>('/documents', { params });
  return data;
}

export async function registerDocument(formData: FormData) {
  const { data } = await api.post<Document>('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function receiveDocument(
  docId: number,
  payload: {
    assigned_department_id: number;
    assigned_user_id?: number;
    deadline?: string;
    memo?: string;
  },
) {
  const { data } = await api.post<Document>(`/documents/${docId}/receive`, payload);
  return data;
}

export function getAttachmentUrl(docId: number) {
  return `/api/documents/${docId}/attachment`;
}

export async function getDigitalStampInfo() {
  const { data } = await api.get<DigitalStampInfo>('/admin/digital-stamp');
  return data;
}

export async function uploadDigitalStamp(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<DigitalStampInfo>('/admin/digital-stamp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteDigitalStamp() {
  await api.delete('/admin/digital-stamp');
}

export function getDigitalStampImageUrl() {
  return '/api/admin/digital-stamp/image';
}

export default api;
