// In-memory task store for webhook results
// In production, this would use MongoDB/Redis

interface GeneratedImage {
  base64?: string;
  url?: string;
  [key: string]: unknown;
}

interface TaskResult {
  task_id: string;
  status: string;
  imageUrl?: string;
  generated?: GeneratedImage[];
  timestamp: string;
  error?: string;
}

const taskResults = new Map<string, TaskResult>();

export function storeTaskResult(task_id: string, result: Partial<TaskResult>) {
  taskResults.set(task_id, {
    task_id,
    timestamp: new Date().toISOString(),
    ...result,
  } as TaskResult);

  console.log(`📦 [task-store] Stored result for ${task_id}`);
}

export function getTaskResult(task_id: string): TaskResult | undefined {
  return taskResults.get(task_id);
}

export function hasTaskResult(task_id: string): boolean {
  return taskResults.has(task_id);
}

export function clearTaskResult(task_id: string): boolean {
  return taskResults.delete(task_id);
}

export function getAllTasks() {
  return Array.from(taskResults.entries()).map(([id, result]) => ({ id, result }));
}
