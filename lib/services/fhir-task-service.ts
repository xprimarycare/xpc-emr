import { FhirTaskBundle } from "@/lib/types/fhir";
import { AppTask } from "@/lib/types/task";
import {
  mapFhirBundleToTasks,
  mapAppTaskToFhirTask,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface TaskSearchResult {
  tasks: AppTask[];
  total: number;
  error?: string;
}

/**
 * Fetch a patient's tasks from EMR
 */
export async function searchFhirTasks(
  patientFhirId: string
): Promise<TaskSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch(
        `/api/clinical/task?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return { tasks: [], total: 0, error: data.error || "Failed to fetch tasks" };
      }
      const tasks = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { tasks, total: data.total ?? tasks.length };
    } catch (error) {
      return { tasks: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const res = await fetch(
      `/api/fhir/task?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        tasks: [],
        total: 0,
        error: `Server error (${res.status})`,
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        tasks: [],
        total: 0,
        error: data.error || "Failed to fetch tasks",
      };
    }

    const bundle = data as FhirTaskBundle;
    const tasks = mapFhirBundleToTasks(bundle);

    return {
      tasks,
      total: bundle.total ?? tasks.length,
    };
  } catch (error) {
    return {
      tasks: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface TaskCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

/**
 * Create a new task in EMR
 */
export async function createFhirTask(
  task: AppTask
): Promise<TaskCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to create task" };
      }
      return { success: true, fhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirTask = mapAppTaskToFhirTask(task);
    // Remove id for creation (let the backend assign it)
    delete (fhirTask as any).id;

    const res = await fetch("/api/fhir/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirTask),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${res.status})` };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Failed to create task",
      };
    }

    const fhirId = data.id;
    if (!fhirId) {
      return { success: false, error: "Task created but no ID returned" };
    }

    return {
      success: true,
      fhirId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface TaskUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing task in EMR
 */
export async function upsertFhirTask(
  task: AppTask
): Promise<TaskUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/task", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...task, id: task.fhirId }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || "Failed to update task" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!task.fhirId) {
    return {
      success: false,
      error: "Task has no FHIR ID — cannot update without an ID",
    };
  }

  try {
    const fhirTask = mapAppTaskToFhirTask(task);

    const res = await fetch("/api/fhir/task", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirTask),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        return { success: false, error: data.error || "Failed to update task" };
      }
      return { success: false, error: `Server error (${res.status})` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
