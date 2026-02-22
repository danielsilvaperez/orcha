import type { ScaffoldTask, TaskGraph, ParallelBatch } from "./types.js";

export function buildTaskGraph(tasks: ScaffoldTask[]): TaskGraph {
  const taskMap = new Map<string, ScaffoldTask>();
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const task of tasks) {
    taskMap.set(task.id, task);
    dependencies.set(task.id, new Set(task.dependsOn));
    dependents.set(task.id, new Set());
  }

  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (dependents.has(dep)) {
        dependents.get(dep)!.add(task.id);
      }
    }
  }

  return { tasks: taskMap, dependencies, dependents };
}

export function computeParallelBatches(graph: TaskGraph): ParallelBatch[] {
  const batches: ParallelBatch[] = [];
  const completed = new Set<string>();
  const remaining = new Set(graph.tasks.keys());

  let level = 0;
  while (remaining.size > 0) {
    const ready: string[] = [];

    for (const taskId of remaining) {
      const deps = graph.dependencies.get(taskId)!;
      const allDepsCompleted = Array.from(deps).every((dep) => completed.has(dep));
      if (allDepsCompleted) {
        ready.push(taskId);
      }
    }

    if (ready.length === 0 && remaining.size > 0) {
      throw new Error(
        `Circular dependency detected in tasks: ${Array.from(remaining).join(", ")}`
      );
    }

    for (const taskId of ready) {
      remaining.delete(taskId);
      completed.add(taskId);
    }

    batches.push({ level, tasks: ready });
    level++;
  }

  return batches;
}

export function getReadyTasks(
  graph: TaskGraph,
  completedTasks: Set<string>,
  runningTasks: Set<string>
): string[] {
  const ready: string[] = [];

  for (const [taskId, task] of graph.tasks) {
    if (completedTasks.has(taskId) || runningTasks.has(taskId)) {
      continue;
    }

    const allDepsCompleted = task.dependsOn.every((dep) => completedTasks.has(dep));
    if (allDepsCompleted) {
      ready.push(taskId);
    }
  }

  return ready;
}
