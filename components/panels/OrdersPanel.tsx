'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Zap, X, Check } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { usePatient } from '@/lib/context/PatientContext';
import { Order, OrderType } from '@/lib/types/order';
import { MedicationPreview, PreviewStatus } from './MedicationPreview';
import { LabPreview, LabPreviewStatus } from './LabPreview';
import { mapFhirMedRequestToAppMedication } from '@/lib/phenoml/fhir-mapper';
import { FhirMedicationRequest } from '@/lib/types/fhir';
import {
  parseMedicationText,
  createFhirMedication,
} from '@/lib/services/fhir-medication-service';
import {
  resolveLabCodes,
  createFhirLabOrder,
  ResolvedCode,
} from '@/lib/services/fhir-lab-service';
import {
  resolveImagingCodes,
  createFhirImagingOrder,
  ResolvedCode as ImagingResolvedCode,
  isImagingCodeStarred,
  starImagingCode,
  unstarImagingCode,
} from '@/lib/services/fhir-imaging-service';
import {
  parseReferralText,
  parseReferralCommand,
  createFhirReferral,
} from '@/lib/services/fhir-referral-service';
import { ReferralPreview } from './ReferralPreview';

const orderTypeConfigs = [
  { type: 'imaging' as OrderType, keywords: ['imaging', 'mri', 'ct', 'xray', 'x-ray', 'cxr', 'ultrasound', 'echo', 'dexa', 'mammo', 'pet', 'fluoro'] },
  { type: 'lab' as OrderType, keywords: ['order', 'lab', 'labs', 'blood', 'test', 'cbc', 'cmp'] },
  { type: 'referral' as OrderType, keywords: ['refer', 'referral', 'consult'] },
  { type: 'rx' as OrderType, keywords: ['rx', 'med', 'prescription', 'prescribe', 'metformin'] },
  { type: 'schedule' as OrderType, keywords: ['schedule', 'appointment', 'followup', 'follow-up'] }
];

const exampleCommands = [
  'order CBC, CMP, lipid panel',
  'MRI brain, CT abdomen, CXR',
  'refer to cardiology',
  'rx metformin 500mg bid'
];

function detectOrderType(text: string): OrderType {
  const lower = text.toLowerCase();
  for (const config of orderTypeConfigs) {
    if (config.keywords.some(keyword => lower.includes(keyword))) {
      return config.type;
    }
  }
  return 'lab';
}

export function OrdersPanel() {
  const { orders, addOrder, removeOrder } = useSidebar();
  const { activePatient } = usePatient();
  const [input, setInput] = useState('');

  // Rx preview state
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus | null>(null);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [parsedResource, setParsedResource] = useState<Record<string, unknown> | null>(null);
  const [previewFields, setPreviewFields] = useState({
    name: '', dose: '', route: '', frequency: '', dosageText: '',
  });

  // Lab preview state
  const [labPreviewStatus, setLabPreviewStatus] = useState<LabPreviewStatus | null>(null);
  const [labPreviewError, setLabPreviewError] = useState<string | undefined>();
  const [resolvedLabs, setResolvedLabs] = useState<ResolvedCode[]>([]);
  const [selectedLabIndices, setSelectedLabIndices] = useState<Set<number>>(new Set());

  // Imaging preview state
  const [imgPreviewStatus, setImgPreviewStatus] = useState<LabPreviewStatus | null>(null);
  const [imgPreviewError, setImgPreviewError] = useState<string | undefined>();
  const [resolvedImaging, setResolvedImaging] = useState<ImagingResolvedCode[]>([]);
  const [selectedImgIndices, setSelectedImgIndices] = useState<Set<number>>(new Set());

  // Referral preview state
  const [refPreviewStatus, setRefPreviewStatus] = useState<PreviewStatus | null>(null);
  const [refPreviewError, setRefPreviewError] = useState<string | undefined>();
  const [refParsedResource, setRefParsedResource] = useState<Record<string, unknown> | null>(null);
  const [refPreviewFields, setRefPreviewFields] = useState({
    referralType: '', referredTo: '', reason: '', priority: 'routine',
  });

  const isBusy = previewStatus === 'parsing' || previewStatus === 'confirming'
    || labPreviewStatus === 'resolving' || labPreviewStatus === 'confirming'
    || imgPreviewStatus === 'resolving' || imgPreviewStatus === 'confirming'
    || refPreviewStatus === 'parsing' || refPreviewStatus === 'confirming';
  const isFhirPatient = !!activePatient?.fhirId;

  // Save/restore preview state per patient when switching
  const prevPatientIdRef = useRef<string | null>(null);
  const previewCacheRef = useRef<Record<string, {
    input: string;
    previewStatus: PreviewStatus | null;
    previewError: string | undefined;
    parsedResource: Record<string, unknown> | null;
    previewFields: { name: string; dose: string; route: string; frequency: string; dosageText: string };
    labPreviewStatus: LabPreviewStatus | null;
    labPreviewError: string | undefined;
    resolvedLabs: ResolvedCode[];
    selectedLabIndices: Set<number>;
    imgPreviewStatus: LabPreviewStatus | null;
    imgPreviewError: string | undefined;
    resolvedImaging: ImagingResolvedCode[];
    selectedImgIndices: Set<number>;
    refPreviewStatus: PreviewStatus | null;
    refPreviewError: string | undefined;
    refParsedResource: Record<string, unknown> | null;
    refPreviewFields: { referralType: string; referredTo: string; reason: string; priority: string };
  }>>({});

  useEffect(() => {
    const prevId = prevPatientIdRef.current;
    const newId = activePatient?.id ?? null;

    // Save current state for the patient we're leaving
    if (prevId && prevId !== newId) {
      previewCacheRef.current[prevId] = {
        input, previewStatus, previewError, parsedResource, previewFields,
        labPreviewStatus, labPreviewError, resolvedLabs, selectedLabIndices,
        imgPreviewStatus, imgPreviewError, resolvedImaging, selectedImgIndices,
        refPreviewStatus, refPreviewError, refParsedResource, refPreviewFields,
      };
    }

    // Restore cached state for the patient we're switching to, or reset
    const cached = newId ? previewCacheRef.current[newId] : null;
    if (cached) {
      setInput(cached.input);
      setPreviewStatus(cached.previewStatus);
      setPreviewError(cached.previewError);
      setParsedResource(cached.parsedResource);
      setPreviewFields(cached.previewFields);
      setLabPreviewStatus(cached.labPreviewStatus);
      setLabPreviewError(cached.labPreviewError);
      setResolvedLabs(cached.resolvedLabs);
      setSelectedLabIndices(cached.selectedLabIndices);
      setImgPreviewStatus(cached.imgPreviewStatus);
      setImgPreviewError(cached.imgPreviewError);
      setResolvedImaging(cached.resolvedImaging);
      setSelectedImgIndices(cached.selectedImgIndices);
      setRefPreviewStatus(cached.refPreviewStatus);
      setRefPreviewError(cached.refPreviewError);
      setRefParsedResource(cached.refParsedResource);
      setRefPreviewFields(cached.refPreviewFields);
      delete previewCacheRef.current[newId!];
    } else {
      setInput('');
      setPreviewStatus(null);
      setPreviewError(undefined);
      setParsedResource(null);
      setPreviewFields({ name: '', dose: '', route: '', frequency: '', dosageText: '' });
      setLabPreviewStatus(null);
      setLabPreviewError(undefined);
      setResolvedLabs([]);
      setSelectedLabIndices(new Set());
      setImgPreviewStatus(null);
      setImgPreviewError(undefined);
      setResolvedImaging([]);
      setSelectedImgIndices(new Set());
      setRefPreviewStatus(null);
      setRefPreviewError(undefined);
      setRefParsedResource(null);
      setRefPreviewFields({ referralType: '', referredTo: '', reason: '', priority: 'routine' });
    }

    prevPatientIdRef.current = newId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatient?.id]);

  const handleSubmit = async () => {
    if (!input.trim() || isBusy) return;

    const orderType = detectOrderType(input);

    // For rx commands on FHIR patients, parse via PhenoML
    if (orderType === 'rx' && isFhirPatient) {
      setPreviewStatus('parsing');
      setPreviewError(undefined);
      const commandText = input.trim();
      setInput('');

      const result = await parseMedicationText(commandText);

      if (result.resource) {
        // Validate that PhenoML returned a MedicationRequest
        if (result.resource.resourceType !== 'MedicationRequest') {
          setPreviewStatus('error');
          setPreviewError(
            'Could not parse as a medication prescription. Try being more specific (e.g., "rx ibuprofen 400mg twice daily").'
          );
          setParsedResource(null);
          return;
        }

        setParsedResource(result.resource);

        // Extract display fields using existing mapper
        const appMed = mapFhirMedRequestToAppMedication(
          result.resource as unknown as FhirMedicationRequest
        );
        setPreviewFields({
          name: appMed.name,
          dose: appMed.dose,
          route: appMed.route,
          frequency: appMed.frequency,
          dosageText: appMed.dosageText || '',
        });
        setPreviewStatus('preview');
      } else {
        setPreviewStatus('error');
        setPreviewError(result.error || 'Failed to parse medication');
        setParsedResource(null);
      }
      return;
    }

    // For lab commands on FHIR patients, resolve codes via PhenoML Construe
    if (orderType === 'lab' && isFhirPatient) {
      setLabPreviewStatus('resolving');
      setLabPreviewError(undefined);
      const commandText = input.trim();
      setInput('');

      const result = await resolveLabCodes(commandText);

      if (result.codes.length > 0) {
        setResolvedLabs(result.codes);
        setSelectedLabIndices(new Set([0]));
        setLabPreviewStatus('preview');
      } else {
        setLabPreviewStatus('error');
        setLabPreviewError(
          result.error || 'No lab tests could be identified. Try being more specific (e.g., "order CBC, CMP").'
        );
        setResolvedLabs([]);
      }
      return;
    }

    // For imaging commands on FHIR patients, resolve codes via PhenoML semantic search
    if (orderType === 'imaging' && isFhirPatient) {
      setImgPreviewStatus('resolving');
      setImgPreviewError(undefined);
      const commandText = input.trim();
      setInput('');

      const result = await resolveImagingCodes(commandText);

      if (result.codes.length > 0) {
        setResolvedImaging(result.codes);
        setSelectedImgIndices(new Set([0]));
        setImgPreviewStatus('preview');
      } else {
        setImgPreviewStatus('error');
        setImgPreviewError(
          result.error || 'No imaging studies could be identified. Try being more specific (e.g., "MRI brain", "CT abdomen").'
        );
        setResolvedImaging([]);
      }
      return;
    }

    // For referral commands on FHIR patients, expand specialty locally then try PhenoML
    if (orderType === 'referral' && isFhirPatient) {
      setRefPreviewStatus('parsing');
      setRefPreviewError(undefined);
      const commandText = input.trim();
      setInput('');

      // Local specialty expansion (e.g. "cards" → "Cardiology")
      const { specialty } = parseReferralCommand(commandText);

      // Try PhenoML lang2fhir for enrichment (reason, performer, etc.)
      const result = await parseReferralText(commandText);
      const res = result.resource && (result.resource as any).resourceType === 'ServiceRequest'
        ? result.resource as any
        : null;

      setRefParsedResource(res);
      setRefPreviewFields({
        referralType: `${specialty} consultation`,
        referredTo: res?.performer?.[0]?.display || specialty,
        reason: res?.reasonCode?.[0]?.text || res?.reasonCode?.[0]?.coding?.[0]?.display || '',
        priority: res?.priority || 'routine',
      });
      setRefPreviewStatus('preview');
      return;
    }

    // Default: add as pending order (non-FHIR or non-lab/non-rx/non-imaging/non-referral)
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      type: orderType,
      text: input.trim(),
      timestamp: new Date().toISOString()
    };

    addOrder(newOrder);
    setInput('');
  };

  const handleConfirm = async () => {
    if (!parsedResource || !activePatient?.fhirId) return;

    setPreviewStatus('confirming');

    // Inject patient reference and ensure required fields
    const resourceToWrite: Record<string, unknown> = {
      ...parsedResource,
      resourceType: 'MedicationRequest',
      status: parsedResource.status || 'active',
      intent: parsedResource.intent || 'order',
      subject: { reference: `Patient/${activePatient.fhirId}` },
    };

    // Remove any server-assigned id so Medplum assigns a new one
    delete resourceToWrite.id;

    const result = await createFhirMedication(resourceToWrite);

    if (result.success) {
      // Add confirmed order to the list
      addOrder({
        id: `order-${Date.now()}`,
        type: 'rx',
        text: previewFields.name
          ? `${previewFields.name} ${[previewFields.dose, previewFields.route, previewFields.frequency].filter(Boolean).join(' ')}`
          : 'Medication prescribed',
        icon: 'confirmed',
        timestamp: new Date().toISOString(),
      });
      clearPreview();
    } else {
      setPreviewStatus('error');
      setPreviewError(result.error || 'Failed to write to Medplum');
    }
  };

  const clearPreview = () => {
    setPreviewStatus(null);
    setPreviewError(undefined);
    setParsedResource(null);
    setPreviewFields({ name: '', dose: '', route: '', frequency: '', dosageText: '' });
  };

  const handleReferralConfirm = async () => {
    if (!activePatient?.fhirId) return;

    setRefPreviewStatus('confirming');

    // Build ServiceRequest with referral category
    const resourceToWrite: Record<string, unknown> = {
      ...(refParsedResource || {}),
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '3457005',
          display: 'Patient referral',
        }],
      }],
      code: {
        text: refPreviewFields.referralType,
      },
      subject: { reference: `Patient/${activePatient.fhirId}` },
      priority: refPreviewFields.priority || 'routine',
      authoredOn: new Date().toISOString(),
      ...(refPreviewFields.referredTo ? {
        performer: [{ display: refPreviewFields.referredTo }],
      } : {}),
      ...(refPreviewFields.reason ? {
        reasonCode: [{ text: refPreviewFields.reason }],
      } : {}),
    };

    // Remove any server-assigned id so Medplum assigns a new one
    delete resourceToWrite.id;

    const result = await createFhirReferral(resourceToWrite);

    if (result.success) {
      addOrder({
        id: `order-${Date.now()}`,
        type: 'referral',
        text: refPreviewFields.referralType || 'Referral placed',
        icon: 'confirmed',
        timestamp: new Date().toISOString(),
      });
      clearReferralPreview();
    } else {
      setRefPreviewStatus('error');
      setRefPreviewError(result.error || 'Failed to write to Medplum');
    }
  };

  const clearReferralPreview = () => {
    setRefPreviewStatus(null);
    setRefPreviewError(undefined);
    setRefParsedResource(null);
    setRefPreviewFields({ referralType: '', referredTo: '', reason: '', priority: 'routine' });
  };

  const handleLabConfirm = async () => {
    const selectedLabs = resolvedLabs.filter((_, i) => selectedLabIndices.has(i));
    if (selectedLabs.length === 0 || !activePatient?.fhirId) return;

    setLabPreviewStatus('confirming');

    let allSuccess = true;
    const orderedTests: string[] = [];

    for (const lab of selectedLabs) {
      const serviceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '108252007',
            display: 'Laboratory procedure',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: lab.code,
            display: lab.description,
          }],
          text: lab.description,
        },
        subject: { reference: `Patient/${activePatient.fhirId}` },
        priority: 'routine',
        authoredOn: new Date().toISOString(),
      };

      const result = await createFhirLabOrder(serviceRequest);
      if (result.success) {
        orderedTests.push(lab.description);
      } else {
        allSuccess = false;
        setLabPreviewStatus('error');
        setLabPreviewError(result.error || 'Failed to write lab order to Medplum');
        break;
      }
    }

    if (allSuccess) {
      addOrder({
        id: `order-${Date.now()}`,
        type: 'lab',
        text: orderedTests.join(', '),
        icon: 'confirmed',
        timestamp: new Date().toISOString(),
      });
      clearLabPreview();
    }
  };

  const clearLabPreview = () => {
    setLabPreviewStatus(null);
    setLabPreviewError(undefined);
    setResolvedLabs([]);
    setSelectedLabIndices(new Set());
  };

  const handleImagingConfirm = async () => {
    const selectedStudies = resolvedImaging.filter((_, i) => selectedImgIndices.has(i));
    if (selectedStudies.length === 0 || !activePatient?.fhirId) return;

    setImgPreviewStatus('confirming');

    let allSuccess = true;
    const orderedStudies: string[] = [];

    for (const study of selectedStudies) {
      const serviceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        category: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '363679005',
            display: 'Imaging',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: study.code,
            display: study.description,
          }],
          text: study.description,
        },
        subject: { reference: `Patient/${activePatient.fhirId}` },
        priority: 'routine',
        authoredOn: new Date().toISOString(),
      };

      const result = await createFhirImagingOrder(serviceRequest);
      if (result.success) {
        orderedStudies.push(study.description);
      } else {
        allSuccess = false;
        setImgPreviewStatus('error');
        setImgPreviewError(result.error || 'Failed to write imaging order to Medplum');
        break;
      }
    }

    if (allSuccess) {
      addOrder({
        id: `order-${Date.now()}`,
        type: 'imaging',
        text: orderedStudies.join(', '),
        icon: 'confirmed',
        timestamp: new Date().toISOString(),
      });
      clearImagingPreview();
    }
  };

  const clearImagingPreview = () => {
    setImgPreviewStatus(null);
    setImgPreviewError(undefined);
    setResolvedImaging([]);
    setSelectedImgIndices(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Command Input */}
      <div className="p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command... (e.g., order labs, refer to cardiology)"
          rows={4}
          disabled={isBusy}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-blue-400 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Medication Preview Card */}
        {previewStatus && (
          <MedicationPreview
            name={previewFields.name}
            dose={previewFields.dose}
            route={previewFields.route}
            frequency={previewFields.frequency}
            dosageText={previewFields.dosageText}
            status={previewStatus}
            error={previewError}
            onConfirm={handleConfirm}
            onReject={clearPreview}
          />
        )}

        {/* Lab Preview Card */}
        {labPreviewStatus && (
          <LabPreview
            codes={resolvedLabs}
            status={labPreviewStatus}
            error={labPreviewError}
            selectedIndices={selectedLabIndices}
            onToggleIndex={(i) => {
              setSelectedLabIndices((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i); else next.add(i);
                return next;
              });
            }}
            onConfirm={handleLabConfirm}
            onReject={clearLabPreview}
          />
        )}

        {/* Imaging Preview Card */}
        {imgPreviewStatus && (
          <LabPreview
            codes={resolvedImaging}
            status={imgPreviewStatus}
            error={imgPreviewError}
            selectedIndices={selectedImgIndices}
            onToggleIndex={(i) => {
              setSelectedImgIndices((prev) => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i); else next.add(i);
                return next;
              });
            }}
            onConfirm={handleImagingConfirm}
            onReject={clearImagingPreview}
            label="imaging"
            colorScheme="teal"
            isCodeStarred={isImagingCodeStarred}
            onStarCode={starImagingCode}
            onUnstarCode={unstarImagingCode}
          />
        )}

        {/* Referral Preview Card */}
        {refPreviewStatus && (
          <ReferralPreview
            referralType={refPreviewFields.referralType}
            referredTo={refPreviewFields.referredTo}
            reason={refPreviewFields.reason}
            priority={refPreviewFields.priority}
            status={refPreviewStatus}
            error={refPreviewError}
            onConfirm={handleReferralConfirm}
            onReject={clearReferralPreview}
          />
        )}

        {/* Pending Actions */}
        <div className="px-4">
        {orders.length === 0 && !previewStatus && !labPreviewStatus && !imgPreviewStatus && !refPreviewStatus ? (
          <div className="flex flex-col items-center pt-8">
            <Zap size={32} className="text-gray-300 mb-4" />
            <p className="text-gray-400 text-sm mb-2">No pending actions</p>
            <p className="text-gray-400 text-xs mb-4">Type commands to place orders:</p>
            <ul className="space-y-2">
              {exampleCommands.map((cmd, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">•</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-mono text-xs">
                    {cmd}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">Pending actions ({orders.length})</p>
            {orders.map(order => (
              <div
                key={order.id}
                className={`flex items-start gap-2 p-3 rounded-lg group ${
                  order.icon === 'confirmed'
                    ? 'bg-green-50 border border-green-100'
                    : 'bg-blue-50 border border-blue-100'
                }`}
              >
                {order.icon === 'confirmed' ? (
                  <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Zap size={16} className="text-blue-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{order.text}</p>
                  <p className="text-xs text-gray-500 mt-1 uppercase">
                    {order.icon === 'confirmed' ? `${order.type} — saved to medplum` : order.type}
                  </p>
                </div>
                <button
                  onClick={() => removeOrder(order.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded transition-opacity"
                >
                  <X size={14} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
