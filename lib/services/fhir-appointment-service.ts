import { FhirAppointmentBundle } from "@/lib/types/fhir";
import { AppAppointment } from "@/lib/types/appointment";
import {
  mapFhirBundleToAppointments,
  mapAppAppointmentToFhirAppointment,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface AppointmentSearchResult {
  appointments: AppAppointment[];
  total: number;
  error?: string;
}

/**
 * Fetch appointments by date range (for calendar view)
 */
export async function searchFhirAppointments(
  dateStart: string,
  dateEnd: string
): Promise<AppointmentSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch(
        `/api/clinical/appointment?startGte=${encodeURIComponent(dateStart)}&startLte=${encodeURIComponent(dateEnd)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return { appointments: [], total: 0, error: data.error || "Failed to fetch appointments" };
      }
      const appointments = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { appointments, total: data.total ?? appointments.length };
    } catch (error) {
      return { appointments: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const params = new URLSearchParams();
    params.append("date", `ge${dateStart}`);
    params.append("date", `le${dateEnd}`);

    const res = await fetch(`/api/fhir/appointment?${params.toString()}`);

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        appointments: [],
        total: 0,
        error: `Server error (${res.status})`,
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        appointments: [],
        total: 0,
        error: data.error || "Failed to fetch appointments",
      };
    }

    const bundle = data as FhirAppointmentBundle;
    const appointments = mapFhirBundleToAppointments(bundle);

    return {
      appointments,
      total: bundle.total ?? appointments.length,
    };
  } catch (error) {
    return {
      appointments: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Fetch appointments for a specific patient
 */
export async function searchFhirAppointmentsByPatient(
  patientFhirId: string
): Promise<AppointmentSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch(
        `/api/clinical/appointment?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        return { appointments: [], total: 0, error: data.error || "Failed to fetch appointments" };
      }
      const appointments = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { appointments, total: data.total ?? appointments.length };
    } catch (error) {
      return { appointments: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const res = await fetch(
      `/api/fhir/appointment?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        appointments: [],
        total: 0,
        error: `Server error (${res.status})`,
      };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        appointments: [],
        total: 0,
        error: data.error || "Failed to fetch appointments",
      };
    }

    const bundle = data as FhirAppointmentBundle;
    const appointments = mapFhirBundleToAppointments(bundle);

    return {
      appointments,
      total: bundle.total ?? appointments.length,
    };
  } catch (error) {
    return {
      appointments: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AppointmentCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

/**
 * Create a new appointment in EMR
 */
export async function createFhirAppointment(
  appointment: AppAppointment
): Promise<AppointmentCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointment),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to create appointment" };
      }
      return { success: true, fhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirAppointment = mapAppAppointmentToFhirAppointment(appointment);
    delete (fhirAppointment as any).id;

    const res = await fetch("/api/fhir/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirAppointment),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${res.status})` };
    }

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Failed to create appointment",
      };
    }

    const fhirId = data.id;
    if (!fhirId) {
      return { success: false, error: "Appointment created but no ID returned" };
    }

    return { success: true, fhirId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface AppointmentUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing appointment in EMR
 */
export async function upsertFhirAppointment(
  appointment: AppAppointment
): Promise<AppointmentUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const res = await fetch("/api/clinical/appointment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...appointment, id: appointment.fhirId }),
      });
      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || "Failed to update appointment" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!appointment.fhirId) {
    return {
      success: false,
      error: "Appointment has no FHIR ID — cannot update without an ID",
    };
  }

  try {
    const fhirAppointment = mapAppAppointmentToFhirAppointment(appointment);

    const res = await fetch("/api/fhir/appointment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirAppointment),
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await res.json();
        return { success: false, error: data.error || "Failed to update appointment" };
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
