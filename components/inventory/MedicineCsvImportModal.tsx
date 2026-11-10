'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Check,
  Pencil,
  Download,
} from 'lucide-react';
import {
  MedicineMaster,
  CsvParsedRow,
  CsvImportSummary,
} from '@/types/medicine';
import {
  parseAndValidateCsv,
  executeCsvImport,
  generateCsvErrorReport,
  streamAndIngestCsvToSupabase,
  StreamImportProgress,
  normalizeRawCsvText,
  countTrueCsvRows,
} from '@/lib/medicineService';

interface MedicineCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMedicines: MedicineMaster[];
  onImportComplete: () => void;
  responsibleUser?: string;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'results';

export function MedicineCsvImportModal({
  isOpen,
  onClose,
  existingMedicines,
  onImportComplete,
  responsibleUser = 'Dr. Sunny',
}: MedicineCsvImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<CsvParsedRow[]>([]);
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);
  const [skipInvalid, setSkipInvalid] = useState<boolean>(true);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid' | 'duplicates'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [finalResult, setFinalResult] = useState<CsvImportSummary | null>(null);
  const [editingRow, setEditingRow] = useState<CsvParsedRow | null>(null);

  // High-Capacity Streaming State
  const [totalDetectedRows, setTotalDetectedRows] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamProgress, setStreamProgress] = useState<StreamImportProgress | null>(null);
  const rawFileTextRef = useRef<string>('');
  const rawGridRef = useRef<any[][] | null>(null);

  const PREVIEW_PAGE_SIZE = 25;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartEditRow = (row: CsvParsedRow) => {
    setEditingRow({ ...row });
  };

  const handleSaveEditedRow = (updated: CsvParsedRow) => {
    const brandValid = !!updated.brandName.trim();
    const errors = brandValid
      ? []
      : [
          {
            row: updated.rowNumber,
            field: 'brand_name',
            value: updated.brandName,
            reason: 'Brand Name is required',
          },
        ];
    const rowWithValid: CsvParsedRow = {
      ...updated,
      brandName: updated.brandName.trim(),
      genericName: updated.genericName.trim() || updated.brandName.trim(),
      errors,
      isValid: errors.length === 0,
    };

    setParsedRows((prev) => {
      const next = prev.map((r) => (r.rowNumber === rowWithValid.rowNumber ? rowWithValid : r));
      if (summary) {
        const validRows = next.filter((r) => r.isValid).length;
        const invalidRows = next.filter((r) => !r.isValid).length;
        setSummary({
          ...summary,
          validRows,
          invalidRows,
        });
      }
      return next;
    });
    setEditingRow(null);
  };

  const handleLoadedFileContent = (text: string) => {
    rawFileTextRef.current = text;

    // Fast quote-aware true row count
    const clean = normalizeRawCsvText(text);
    const lineCount = countTrueCsvRows(clean);
    setTotalDetectedRows(lineCount);

    setTimeout(() => {
      // If small file (<= 250 rows), preview all rows so edits apply; if larger file, preview 50 rows instantly
      const previewLimit = lineCount > 0 && lineCount <= 250 ? lineCount + 1 : 50;
      const { rows, summary: valSummary } = parseAndValidateCsv(text, existingMedicines, previewLimit);
      setParsedRows(rows);
      setSummary(valSummary);
      setPreviewPage(1);
      setCurrentStep('preview');
    }, 30);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const isExcel =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) return;
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
          rawGridRef.current = rawMatrix;
          rawFileTextRef.current = '';

          const { rows, summary: valSummary } = parseAndValidateCsv(rawMatrix, existingMedicines, 50);
          setTotalDetectedRows(valSummary.totalRows);
          setParsedRows(rows);
          setSummary(valSummary);
          setPreviewPage(1);
          setCurrentStep('preview');
        } catch (err) {
          console.error('Failed to parse Excel file:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        rawGridRef.current = null;
        rawFileTextRef.current = text;
        handleLoadedFileContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRunImport = async () => {
    setCurrentStep('importing');
    setImportProgress(null);
    setStreamProgress(null);

    const streamInput = rawGridRef.current || rawFileTextRef.current;

    // If large file or streaming is preferred (> 200 rows or more rows than previewed)
    if (streamInput && (totalDetectedRows > 200 || parsedRows.length < totalDetectedRows)) {
      setIsStreaming(true);
      try {
        const res = await streamAndIngestCsvToSupabase(streamInput, {
          updateExisting,
          batchSize: 500,
          responsibleUser,
          onProgress: (p) => {
            setStreamProgress({ ...p });
          },
        });

        const hasErrors = (res.failedCount || 0) > 0;
        setFinalResult({
          totalRows: res.totalProcessed,
          validRows: res.totalImported,
          invalidRows: res.failedCount || 0,
          duplicateRows: 0,
          newMedicinesCount: res.totalImported,
          updatedMedicinesCount: 0,
          successfullyImported: res.totalImported,
          skippedRows: res.totalSkipped,
          failedRows: res.failedCount || 0,
          errors: (res.errors || []).map((err, idx) => ({
            row: idx + 1,
            field: 'Database',
            value: '',
            reason: err,
          })),
        });
        setCurrentStep('results');
        if (res.totalImported > 0) {
          onImportComplete();
        }
      } catch (err: any) {
        console.error('Streaming ingest error:', err);
        setFinalResult({
          totalRows: totalDetectedRows,
          validRows: 0,
          invalidRows: totalDetectedRows,
          duplicateRows: 0,
          newMedicinesCount: 0,
          updatedMedicinesCount: 0,
          successfullyImported: 0,
          skippedRows: 0,
          failedRows: totalDetectedRows,
          errors: [{ row: 0, field: 'Import', value: '', reason: err?.message || 'Error occurred during streaming import' }],
        });
        setCurrentStep('results');
      } finally {
        setIsStreaming(false);
      }
    } else {
      // Small file direct import (preserves edits made in preview)
      try {
        const rowsToProcess = skipInvalid ? parsedRows.filter((r) => r.isValid) : parsedRows;
        const res = await executeCsvImport(
          rowsToProcess,
          updateExisting,
          responsibleUser,
          (processed, total) => {
            setImportProgress({ processed, total });
          }
        );
        setFinalResult(res);
        setCurrentStep('results');
        if (res.successfullyImported > 0) {
          onImportComplete();
        }
      } catch (err: any) {
        console.error('executeCsvImport error:', err);
        setFinalResult({
          totalRows: parsedRows.length,
          validRows: 0,
          invalidRows: parsedRows.length,
          duplicateRows: 0,
          newMedicinesCount: 0,
          updatedMedicinesCount: 0,
          successfullyImported: 0,
          skippedRows: 0,
          failedRows: parsedRows.length,
          errors: [{ row: 0, field: 'Import', value: '', reason: err?.message || 'Failed to import medicine records' }],
        });
        setCurrentStep('results');
      }
    }
  };

  const handleDownloadErrors = () => {
    if (!summary || summary.errors.length === 0) return;
    const csvContent = generateCsvErrorReport(summary.errors);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import_errors_${fileName || 'audit'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setCurrentStep('upload');
    setFileName('');
    setParsedRows([]);
    setSummary(null);
    setFinalResult(null);
    setEditingRow(null);
    setPreviewPage(1);
    setImportProgress(null);
    setTotalDetectedRows(0);
    setIsStreaming(false);
    setStreamProgress(null);
    rawFileTextRef.current = '';
    rawGridRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredPreviewRows = useMemo(() => {
    if (previewFilter === 'valid') return parsedRows.filter((r) => r.isValid);
    if (previewFilter === 'invalid') return parsedRows.filter((r) => !r.isValid);
    if (previewFilter === 'duplicates') return parsedRows.filter((r) => r.isExisting);
    return parsedRows;
  }, [parsedRows, previewFilter]);

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE) || 1;
  const paginatedPreviewRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewRows, previewPage]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#16191E]">
                  Medicine Master Import (CSV &amp; Excel)
                </h2>
                <p className="text-xs text-[#8A909D] font-medium">
                  Import medicine catalog, batch inventory, and formulation records from CSV or XLSX
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center border-b border-slate-100 px-6 py-3 bg-[#FAFBFD] text-xs font-semibold gap-2">
            {[
              { step: 'upload', label: '1. Upload File (CSV / XLSX)' },
              { step: 'preview', label: '2. Validate & Preview' },
              { step: 'results', label: '3. Import Summary' },
            ].map((st, i, arr) => {
              const active = currentStep === st.step || (currentStep === 'importing' && st.step === 'results');
              return (
                <div key={st.step} className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl transition ${
                      active ? 'bg-[#2563EB] text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {st.label}
                  </span>
                  {i < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {/* Step 1: Upload Dropzone */}
            {currentStep === 'upload' && (
              <div className="py-8 sm:py-14">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-10 sm:p-16 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#FAFBFD] hover:bg-blue-50/20 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,application/vnd.ms-excel"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-4 group-hover:scale-110 transition shadow-2xs">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Click to browse or drop CSV or Excel (XLSX) file here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-sm">
                    Upload your medicine formulary or inventory CSV or XLSX spreadsheet to synchronize catalog records.
                  </p>
                  <span className="mt-5 px-5 py-2.5 bg-white border border-slate-200 group-hover:border-blue-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs">
                    Select CSV or Excel File
                  </span>
                </div>
              </div>
            )}

            {/* Step 2: Validate & Preview */}
            {currentStep === 'preview' && summary && (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  <div className="p-3 bg-[#F8F9FB] border border-slate-100 rounded-xl">
                    <p className="text-[11px] font-medium text-slate-400">Total Rows</p>
                    <p className="text-lg font-black text-slate-800">
                      {(totalDetectedRows > 0 ? totalDetectedRows : summary.totalRows).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <p className="text-[11px] font-medium text-emerald-700">Valid Rows</p>
                    <p className="text-lg font-black text-emerald-800">{summary.validRows.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl">
                    <p className="text-[11px] font-medium text-red-700">Invalid Rows</p>
                    <p className="text-lg font-black text-red-800">{summary.invalidRows.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                    <p className="text-[11px] font-medium text-blue-700">New Medicines</p>
                    <p className="text-lg font-black text-blue-800">{summary.newMedicinesCount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl">
                    <p className="text-[11px] font-medium text-purple-700">Existing (Restock)</p>
                    <p className="text-lg font-black text-purple-800">{summary.updatedMedicinesCount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                    <p className="text-[11px] font-medium text-amber-700">Duplicate SKUs</p>
                    <p className="text-lg font-black text-amber-800">{summary.duplicateRows.toLocaleString()}</p>
                  </div>
                </div>

                {/* Import Settings */}
                <div className="bg-[#F8F9FB] rounded-2xl border border-slate-100 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Update & restock batches if SKU already exists in catalog</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={skipInvalid}
                        onChange={(e) => setSkipInvalid(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Skip invalid rows and proceed with importing valid records</span>
                    </label>
                  </div>

                  {summary.errors.length > 0 && (
                    <button
                      onClick={handleDownloadErrors}
                      className="px-3.5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold flex items-center gap-1.5 hover:bg-red-100 transition cursor-pointer self-start sm:self-auto"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Download Error CSV ({summary.errors.length})
                    </button>
                  )}
                </div>

                {/* Filters and Preview Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                      {(['all', 'valid', 'invalid', 'duplicates'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setPreviewFilter(f);
                            setPreviewPage(1);
                          }}
                          className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                            previewFilter === f
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {f} ({
                            f === 'all'
                              ? parsedRows.length.toLocaleString()
                              : f === 'valid'
                              ? summary.validRows.toLocaleString()
                              : f === 'invalid'
                              ? summary.invalidRows.toLocaleString()
                              : summary.duplicateRows.toLocaleString()
                          })
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Showing {filteredPreviewRows.length.toLocaleString()} rows
                    </span>
                  </div>

                  {/* Table with fixed max height and pagination */}
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAFBFD] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Brand & Generic</th>
                          <th className="py-2.5 px-3">Batch #</th>
                          <th className="py-2.5 px-3">Exp Date</th>
                          <th className="py-2.5 px-3">Qty</th>
                          <th className="py-2.5 px-3">Buy Price</th>
                          <th className="py-2.5 px-3">Sell Price</th>
                          <th className="py-2.5 px-3">Validation Diagnostic</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewRows.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-6 text-center text-slate-400">
                              No rows match this filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedPreviewRows.map((r) => (
                            <tr
                              key={r.rowNumber}
                              className={`hover:bg-slate-50/70 transition ${
                                !r.isValid ? 'bg-red-50/30' : ''
                              }`}
                            >
                              <td className="py-2 px-3 font-mono text-slate-500 font-bold">{r.rowNumber}</td>
                              <td className="py-2 px-3">
                                {r.isValid ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                    <Check className="w-2.5 h-2.5" /> Valid
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                                    <AlertCircle className="w-2.5 h-2.5" /> Invalid
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.sku}</td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-slate-800 block truncate max-w-xs">{r.brandName}</span>
                                <span className="text-[11px] text-slate-400 truncate max-w-xs block">{r.genericName}</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-700">{r.batchNumber}</td>
                              <td className="py-2 px-3 text-slate-600">{r.expiryDate}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">
                                {r.quantity > 0 ? r.quantity : <span className="text-slate-400 font-normal">0 (Catalog)</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {r.purchasePrice > 0 ? `₹${r.purchasePrice.toFixed(2)}` : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="py-2 px-3">
                                {r.sellingPrice > 0 ? (
                                  <span className="font-semibold text-emerald-700">₹{r.sellingPrice.toFixed(2)}</span>
                                ) : (
                                  <span className="text-slate-400 font-medium">Unpriced</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {r.errors.length > 0 ? (
                                  <div className="space-y-0.5 max-w-xs">
                                    {r.errors.map((err, ei) => (
                                      <p key={ei} className="text-[11px] text-red-600 font-medium">
                                        &bull; {err.reason}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 font-medium">
                                    Ready to import
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditRow(r)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 border border-slate-200 transition cursor-pointer"
                                  title="Edit details for this medicine"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Clean Pagination Navigation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                    <span className="text-slate-500 font-medium">
                      Showing {filteredPreviewRows.length > 0 ? (previewPage - 1) * PREVIEW_PAGE_SIZE + 1 : 0} -{' '}
                      {Math.min(previewPage * PREVIEW_PAGE_SIZE, filteredPreviewRows.length)} of{' '}
                      {filteredPreviewRows.length.toLocaleString()} records
                    </span>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 transition cursor-pointer font-bold"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-bold text-slate-800">
                        Page {previewPage} of {totalPreviewPages}
                      </span>
                      <button
                        type="button"
                        disabled={previewPage >= totalPreviewPages}
                        onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                        className="px-3 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-50 transition cursor-pointer font-bold"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Importing in progress */}
            {currentStep === 'importing' && (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                <RefreshCw className="w-10 h-10 text-[#2563EB] animate-spin" />
                <h3 className="text-base font-bold text-slate-800">
                  Processing Master Data & Batches...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Writing medicine catalog, registering batch records, and initializing stock movement ledgers.
                </p>

                <div className="w-full max-w-md space-y-2 pt-2 px-4 mx-auto">
                  <div className="flex justify-between text-xs font-semibold text-slate-600">
                    <span>Synchronizing Medicines</span>
                    <span className="tabular-nums">
                      {isStreaming && streamProgress
                        ? `${streamProgress.processed.toLocaleString()} / ${streamProgress.total.toLocaleString()} (${streamProgress.percent}%)`
                        : importProgress
                        ? `${importProgress.processed.toLocaleString()} / ${importProgress.total.toLocaleString()} (${Math.round((importProgress.processed / importProgress.total) * 100)}%)`
                        : 'Starting synchronization...'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] transition-all duration-200 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          isStreaming && streamProgress
                            ? streamProgress.percent
                            : importProgress
                            ? Math.round((importProgress.processed / importProgress.total) * 100)
                            : 8
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Import Complete Summary */}
            {currentStep === 'results' && finalResult && (
              <div className="space-y-6">
                {finalResult.successfullyImported > 0 ? (
                  <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl text-center space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">
                      Import Completed Successfully!
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {finalResult.successfullyImported.toLocaleString()} medicines and batch inventory synchronized to Supabase.
                    </p>
                  </div>
                ) : finalResult.skippedRows > 0 && finalResult.failedRows === 0 ? (
                  <div className="p-6 bg-amber-50/50 border border-amber-200 rounded-3xl text-center space-y-2">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">
                      Import Completed ({finalResult.skippedRows.toLocaleString()} Skipped)
                    </h3>
                    <p className="text-xs text-amber-700 max-w-md mx-auto">
                      {finalResult.errors[0]?.reason ||
                        'All rows were skipped because items already exist in database or were flagged as discontinued.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-6 bg-red-50/50 border border-red-200 rounded-3xl text-center space-y-2">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800">
                      Import Failed to Synchronize
                    </h3>
                    <p className="text-xs text-red-600 max-w-md mx-auto">
                      {finalResult.errors[0]?.reason || 'Records could not be saved to Supabase. Check error diagnostics below.'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-[#F8F9FB] rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-400 font-medium">Total Processed</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{finalResult.totalRows.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-700 font-medium">Successfully Imported</p>
                    <p className="text-xl font-black text-emerald-800 mt-1">{finalResult.successfullyImported.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                    <p className="text-xs text-amber-700 font-medium">Skipped Rows</p>
                    <p className="text-xl font-black text-amber-800 mt-1">{finalResult.skippedRows.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-red-50/70 rounded-2xl border border-red-100 text-center">
                    <p className="text-xs text-red-700 font-medium">Failed / Invalid</p>
                    <p className="text-xl font-black text-red-800 mt-1">{finalResult.failedRows.toLocaleString()}</p>
                  </div>
                </div>

                {finalResult.errors.length > 0 && (
                  <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-red-800">
                        {finalResult.errors.length} validation errors were encountered during import.
                      </h4>
                      <p className="text-red-600 text-[11px] mt-0.5">
                        Download the error report CSV to review and correct rejected rows.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadErrors}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Error CSV
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            {currentStep === 'upload' && (
              <>
                <div className="text-xs text-slate-400 font-medium">
                  Select a valid CSV file to begin
                </div>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}

            {currentStep === 'preview' && (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Choose Different File
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRunImport}
                    disabled={summary ? (skipInvalid ? summary.validRows === 0 : summary.invalidRows > 0) : true}
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Execute Import</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {currentStep === 'results' && (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Import Another CSV
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Quick Row Edit Dialog Modal */}
        {editingRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Edit Row #{editingRow.rowNumber} ({editingRow.sku})
                  </h3>
                  <p className="text-xs text-slate-400">Modify details or pricing before import</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={editingRow.brandName}
                    onChange={(e) => setEditingRow({ ...editingRow, brandName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-600 font-bold mb-1">Generic Name / Molecule</label>
                  <input
                    type="text"
                    value={editingRow.genericName}
                    onChange={(e) => setEditingRow({ ...editingRow, genericName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Retail Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingRow.sellingPrice > 0 ? editingRow.sellingPrice : ''}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        sellingPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00 (Unpriced)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Purchase / Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingRow.purchasePrice > 0 ? editingRow.purchasePrice : ''}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        purchasePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={editingRow.quantity}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        quantity: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={editingRow.batchNumber}
                    onChange={(e) => setEditingRow({ ...editingRow, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Expiry Date (YYYY-MM-DD)</label>
                  <input
                    type="text"
                    value={editingRow.expiryDate}
                    onChange={(e) => setEditingRow({ ...editingRow, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Dosage Form</label>
                  <select
                    value={editingRow.dosageForm}
                    onChange={(e) => setEditingRow({ ...editingRow, dosageForm: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Suspension', 'Powder', 'Other'].map(
                      (f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Strength</label>
                  <input
                    type="text"
                    value={editingRow.strength}
                    onChange={(e) => setEditingRow({ ...editingRow, strength: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Unit</label>
                  <input
                    type="text"
                    value={editingRow.unit}
                    onChange={(e) => setEditingRow({ ...editingRow, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditedRow(editingRow)}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
