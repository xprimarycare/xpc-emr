"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { usePatient } from "@/lib/context/PatientContext";
import { searchFhirPatients, PatientSearchResult } from "@/lib/services/fhir-patient-service";
import { PatientData } from "@/lib/types/patient";

export function PatientSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PatientSearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { addPatient, patients } = usePatient();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults(null);
      setIsOpen(false);
      return;
    }
    setIsSearching(true);
    setIsOpen(true);
    const searchResults = await searchFhirPatients(query);
    setResults(searchResults);
    setIsSearching(false);
  }, []);

  const handleChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    performSearch(searchQuery);
  };

  const handleImport = (patient: PatientData) => {
    if (patients.some((p) => p.id === patient.id)) {
      alert("Patient already imported");
      return;
    }
    addPatient(patient);
    setIsOpen(false);
    setResults(null);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        onFocus={() => results && setIsOpen(true)}
        placeholder="Search Medplum patients..."
        className="pl-9 pr-4 py-1.5 bg-gray-50 border-0 rounded-md text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-200"
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-80 overflow-y-auto">
          {isSearching && (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          )}

          {!isSearching && results?.error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm">
              {results.error}
            </div>
          )}

          {!isSearching && results && !results.error && (
            <>
              {results.patients.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No patients found
                </div>
              ) : (
                <ul className="divide-y">
                  {results.patients.map((patient) => (
                    <li
                      key={patient.id}
                      onClick={() => handleImport(patient)}
                      className="p-3 hover:bg-blue-50 flex justify-between items-center cursor-pointer"
                    >
                      <div>
                        <p className="font-medium text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-500">
                          MRN: {patient.mrn} | DOB: {patient.dob}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
                        Import
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-3 py-2 bg-gray-50 text-xs text-gray-400 border-t">
                {results.total} result(s) from Medplum
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
