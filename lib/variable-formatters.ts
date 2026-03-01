import { Variable } from './types/variable';
import { Patient } from './types/patient';
import { AppMedication } from './types/medication';
import { AppAllergy } from './types/allergy';
import { AppCondition } from './types/condition';
import { AppLabOrder } from './types/lab';
import { AppImagingOrder } from './types/imaging';
import { AppGoal } from './types/goal';
import { AppCareTeamMember } from './types/care-team';
import { AppSocialHistoryObservation } from './types/social-history';
import { AppFamilyMemberHistory } from './types/family-history';
import { AppProcedure } from './types/procedure';
import { AppReferral } from './types/referral';
import { AppVital } from './types/vital';
import { AppTask } from './types/task';
import { AppEncounter } from './types/encounter';
import { AppAppointment } from './types/appointment';
import { searchFhirMedications } from './services/fhir-medication-service';
import { searchFhirAllergies } from './services/fhir-allergy-service';
import { searchFhirConditions } from './services/fhir-condition-service';
import { searchFhirLabOrders } from './services/fhir-lab-service';
import { searchFhirImagingOrders } from './services/fhir-imaging-service';
import { searchFhirGoals } from './services/fhir-goal-service';
import { searchFhirCareTeamMembers } from './services/fhir-care-team-service';
import { searchFhirSocialHistories } from './services/fhir-social-history-service';
import { searchFhirFamilyHistories } from './services/fhir-family-history-service';
import { searchFhirProcedures } from './services/fhir-procedure-service';
import { searchFhirReferrals } from './services/fhir-referral-service';
import { searchFhirVitals } from './services/fhir-vital-service';
import { searchFhirTasks } from './services/fhir-task-service';
import { searchFhirEncounters } from './services/fhir-encounter-service';
import { searchFhirAppointmentsByPatient } from './services/fhir-appointment-service';

// --- HTML Formatters (one per resource type) ---

function formatDemographicsHtml(patient: Patient): string {
  const lines = [
    `<p><strong>Patient Info</strong></p>`,
    patient.name ? `<p>• Name: ${patient.name}</p>` : null,
    patient.dob ? `<p>• DOB: ${patient.dob}</p>` : null,
    patient.sex ? `<p>• Sex: ${patient.sex}</p>` : null,
    patient.mrn ? `<p>• MRN: ${patient.mrn}</p>` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

function formatMedicationsHtml(meds: AppMedication[]): string {
  if (meds.length === 0) return '<p><strong>Medications</strong></p>\n<p>No medications on file.</p>';
  const lines = [`<p><strong>Medications (${meds.length})</strong></p>`];
  for (const med of meds) {
    const parts = [med.name, med.dose, med.route, med.frequency].filter(Boolean);
    let line = `<p>• ${parts.join(' ')}`;
    if (med.status) line += ` — ${med.status}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatAllergiesHtml(allergies: AppAllergy[]): string {
  if (allergies.length === 0) return '<p><strong>Allergies</strong></p>\n<p>No allergies on file.</p>';
  const lines = [`<p><strong>Allergies (${allergies.length})</strong></p>`];
  for (const a of allergies) {
    let line = `<p>• ${a.substance}`;
    if (a.category) line += ` (${a.category})`;
    line += ` — ${a.clinicalStatus}`;
    if (a.reaction) line += `, ${a.reaction}`;
    if (a.severity) line += ` (${a.severity})`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatConditionsHtml(conditions: AppCondition[]): string {
  if (conditions.length === 0) return '<p><strong>Conditions</strong></p>\n<p>No conditions on file.</p>';
  const lines = [`<p><strong>Conditions (${conditions.length})</strong></p>`];
  for (const c of conditions) {
    let line = `<p>• ${c.name} — ${c.clinicalStatus}`;
    if (c.coding?.code) line += ` (ICD-10: ${c.coding.code})`;
    if (c.onsetDate) line += `, onset: ${c.onsetDate}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatLabsHtml(labs: AppLabOrder[]): string {
  if (labs.length === 0) return '<p><strong>Labs</strong></p>\n<p>No lab orders on file.</p>';
  const lines = [`<p><strong>Labs (${labs.length})</strong></p>`];
  for (const lab of labs) {
    let line = `<p>• ${lab.testName} — ${lab.status}`;
    if (lab.priority !== 'routine') line += `, priority: ${lab.priority}`;
    if (lab.authoredOn) line += `, ordered: ${lab.authoredOn}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatImagingHtml(orders: AppImagingOrder[]): string {
  if (orders.length === 0) return '<p><strong>Imaging</strong></p>\n<p>No imaging orders on file.</p>';
  const lines = [`<p><strong>Imaging (${orders.length})</strong></p>`];
  for (const img of orders) {
    let line = `<p>• ${img.studyName} — ${img.status}`;
    if (img.priority !== 'routine') line += `, priority: ${img.priority}`;
    if (img.authoredOn) line += `, ordered: ${img.authoredOn}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatGoalsHtml(goals: AppGoal[]): string {
  if (goals.length === 0) return '<p><strong>Goals of Care</strong></p>\n<p>No goals on file.</p>';
  const lines = [`<p><strong>Goals of Care (${goals.length})</strong></p>`];
  for (const g of goals) {
    let line = `<p>• ${g.name} — ${g.lifecycleStatus}`;
    if (g.startDate) line += `, started: ${g.startDate}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatCareTeamHtml(members: AppCareTeamMember[]): string {
  if (members.length === 0) return '<p><strong>Care Team</strong></p>\n<p>No care team members on file.</p>';
  const lines = [`<p><strong>Care Team (${members.length})</strong></p>`];
  for (const m of members) {
    let line = `<p>• ${m.name}`;
    if (m.role) line += ` — ${m.role}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatSocialHistoryHtml(obs: AppSocialHistoryObservation[]): string {
  if (obs.length === 0) return '<p><strong>Social History</strong></p>\n<p>No social history on file.</p>';
  const lines = [`<p><strong>Social History (${obs.length})</strong></p>`];
  for (const sh of obs) {
    let line = `<p>• ${sh.name}: ${sh.value || 'not specified'}`;
    if (sh.effectiveDate) line += ` (as of ${sh.effectiveDate})`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatFamilyHistoryHtml(members: AppFamilyMemberHistory[]): string {
  if (members.length === 0) return '<p><strong>Family History</strong></p>\n<p>No family history on file.</p>';
  const lines = [`<p><strong>Family History (${members.length} members)</strong></p>`];
  for (const fh of members) {
    let line = `<p>• ${fh.relationshipDisplay || fh.name}`;
    if (fh.deceased) line += ' — deceased';
    if (fh.deceasedAge) line += ` at age ${fh.deceasedAge}`;
    if (fh.conditions.length > 0) {
      const conds = fh.conditions.map(c => {
        let s = c.name;
        if (c.onsetAge) s += ` (onset age ${c.onsetAge})`;
        return s;
      });
      line += `: ${conds.join(', ')}`;
    }
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatSurgicalHistoryHtml(procedures: AppProcedure[]): string {
  if (procedures.length === 0) return '<p><strong>Surgical History</strong></p>\n<p>No procedures on file.</p>';
  const lines = [`<p><strong>Surgical History (${procedures.length})</strong></p>`];
  for (const p of procedures) {
    let line = `<p>• ${p.name} — ${p.status}`;
    if (p.performedDate) line += `, ${p.performedDate}`;
    if (p.outcome) line += `, outcome: ${p.outcome}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatReferralsHtml(referrals: AppReferral[]): string {
  if (referrals.length === 0) return '<p><strong>Referrals</strong></p>\n<p>No referrals on file.</p>';
  const lines = [`<p><strong>Referrals (${referrals.length})</strong></p>`];
  for (const r of referrals) {
    let line = `<p>• ${r.referralType} — ${r.status}`;
    if (r.referredTo) line += `, to: ${r.referredTo}`;
    if (r.reason) line += `, reason: ${r.reason}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatVitalsHtml(vitals: AppVital[]): string {
  if (vitals.length === 0) return '<p><strong>Vitals</strong></p>\n<p>No vitals on file.</p>';
  const lines = [`<p><strong>Vitals (${vitals.length} readings)</strong></p>`];
  for (const v of vitals) {
    if (v.systolic !== undefined && v.diastolic !== undefined) {
      lines.push(`<p>• ${v.name}: ${v.systolic}/${v.diastolic} mmHg — ${v.effectiveDateTime}</p>`);
    } else if (v.value !== undefined) {
      lines.push(`<p>• ${v.name}: ${v.value} ${v.unit || ''} — ${v.effectiveDateTime}</p>`);
    }
  }
  return lines.join('\n');
}

function formatTasksHtml(tasks: AppTask[]): string {
  if (tasks.length === 0) return '<p><strong>Tasks</strong></p>\n<p>No tasks on file.</p>';
  const lines = [`<p><strong>Tasks (${tasks.length})</strong></p>`];
  for (const t of tasks) {
    let line = `<p>• ${t.description} — ${t.status}`;
    if (t.priority !== 'routine') line += `, priority: ${t.priority}`;
    if (t.dueDate) line += `, due: ${t.dueDate}`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatEncountersHtml(encounters: AppEncounter[]): string {
  if (encounters.length === 0) return '<p><strong>Encounters</strong></p>\n<p>No encounters on file.</p>';
  const lines = [`<p><strong>Encounters (${encounters.length})</strong></p>`];
  for (const e of encounters) {
    let line = `<p>• ${e.date} — ${e.classDisplay} (${e.status})`;
    if (e.noteText) {
      const truncated = e.noteText.length > 200 ? e.noteText.slice(0, 200) + '...' : e.noteText;
      line += `</p>\n<p>  Note: ${truncated}`;
    }
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

function formatAppointmentsHtml(appointments: AppAppointment[]): string {
  if (appointments.length === 0) return '<p><strong>Appointments</strong></p>\n<p>No appointments on file.</p>';
  const lines = [`<p><strong>Appointments (${appointments.length})</strong></p>`];
  for (const a of appointments) {
    let line = `<p>• ${a.description || 'Appointment'} — ${a.status}`;
    if (a.start) line += `, ${a.start}`;
    if (a.end) line += ` to ${a.end}`;
    if (a.appointmentType) line += ` (${a.appointmentType})`;
    line += '</p>';
    lines.push(line);
  }
  return lines.join('\n');
}

// --- Variable definition config ---

interface VariableConfig {
  key: string;
  icon: string;
  isPinned: boolean;
}

const VARIABLE_CONFIGS: VariableConfig[] = [
  { key: 'patient_info', icon: '👤', isPinned: true },
  { key: 'medications', icon: '💊', isPinned: true },
  { key: 'allergies', icon: '⚠️', isPinned: true },
  { key: 'conditions', icon: '📋', isPinned: true },
  { key: 'vitals', icon: '📊', isPinned: true },
  { key: 'care_team', icon: '👥', isPinned: false },
  { key: 'goals_of_care', icon: '🎯', isPinned: false },
  { key: 'labs', icon: '🔬', isPinned: false },
  { key: 'imaging', icon: '📷', isPinned: false },
  { key: 'surgical_history', icon: '🏥', isPinned: false },
  { key: 'family_history', icon: '👨‍👩‍👧', isPinned: false },
  { key: 'social_history', icon: '🏠', isPinned: false },
  { key: 'referrals', icon: '📤', isPinned: false },
  { key: 'tasks', icon: '✅', isPinned: false },
  { key: 'encounters', icon: '📅', isPinned: false },
  { key: 'appointments', icon: '📆', isPinned: false },
];

// --- Master function: fetch all FHIR data and build variables ---

export async function buildPatientVariables(
  fhirId: string,
  patient?: Patient | null
): Promise<Record<string, Variable>> {
  const now = Date.now();

  // Fetch all FHIR data in parallel
  const [
    medsResult,
    allergiesResult,
    conditionsResult,
    labsResult,
    imagingResult,
    goalsResult,
    careTeamResult,
    socialHistoryResult,
    familyHistoryResult,
    proceduresResult,
    referralsResult,
    vitalsResult,
    tasksResult,
    encountersResult,
    appointmentsResult,
  ] = await Promise.all([
    searchFhirMedications(fhirId).catch(() => ({ medications: [] as AppMedication[] })),
    searchFhirAllergies(fhirId).catch(() => ({ allergies: [] as AppAllergy[] })),
    searchFhirConditions(fhirId).catch(() => ({ conditions: [] as AppCondition[] })),
    searchFhirLabOrders(fhirId).catch(() => ({ labOrders: [] as AppLabOrder[] })),
    searchFhirImagingOrders(fhirId).catch(() => ({ imagingOrders: [] as AppImagingOrder[] })),
    searchFhirGoals(fhirId).catch(() => ({ goals: [] as AppGoal[] })),
    searchFhirCareTeamMembers(fhirId).catch(() => ({ members: [] as AppCareTeamMember[] })),
    searchFhirSocialHistories(fhirId).catch(() => ({ observations: [] as AppSocialHistoryObservation[] })),
    searchFhirFamilyHistories(fhirId).catch(() => ({ members: [] as AppFamilyMemberHistory[] })),
    searchFhirProcedures(fhirId).catch(() => ({ procedures: [] as AppProcedure[] })),
    searchFhirReferrals(fhirId).catch(() => ({ referrals: [] as AppReferral[] })),
    searchFhirVitals(fhirId).catch(() => ({ vitals: [] as AppVital[] })),
    searchFhirTasks(fhirId).catch(() => ({ tasks: [] as AppTask[] })),
    searchFhirEncounters(fhirId).catch(() => ({ encounters: [] as AppEncounter[] })),
    searchFhirAppointmentsByPatient(fhirId).catch(() => ({ appointments: [] as AppAppointment[] })),
  ]);

  // Build formatted HTML content for each variable
  const contentMap: Record<string, string> = {
    patient_info: patient ? formatDemographicsHtml(patient) : '<p><strong>Patient Info</strong></p>\n<p>No patient data available.</p>',
    medications: formatMedicationsHtml(medsResult.medications),
    allergies: formatAllergiesHtml(allergiesResult.allergies),
    conditions: formatConditionsHtml(conditionsResult.conditions),
    labs: formatLabsHtml(labsResult.labOrders),
    imaging: formatImagingHtml(imagingResult.imagingOrders),
    goals_of_care: formatGoalsHtml(goalsResult.goals),
    care_team: formatCareTeamHtml(careTeamResult.members),
    social_history: formatSocialHistoryHtml(socialHistoryResult.observations),
    family_history: formatFamilyHistoryHtml(familyHistoryResult.members),
    surgical_history: formatSurgicalHistoryHtml(proceduresResult.procedures),
    referrals: formatReferralsHtml(referralsResult.referrals),
    vitals: formatVitalsHtml(vitalsResult.vitals),
    tasks: formatTasksHtml(tasksResult.tasks),
    encounters: formatEncountersHtml(encountersResult.encounters),
    appointments: formatAppointmentsHtml(appointmentsResult.appointments),
  };

  // Assemble Variable objects
  const variables: Record<string, Variable> = {};
  for (const config of VARIABLE_CONFIGS) {
    variables[config.key] = {
      name: config.key,
      content: contentMap[config.key],
      icon: config.icon,
      isPinned: config.isPinned,
      isAutoGenerated: true,
      lastRefreshedAt: now,
    };
  }

  return variables;
}
