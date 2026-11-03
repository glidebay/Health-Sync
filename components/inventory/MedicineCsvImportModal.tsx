'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  ChevronRight,
  Filter,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  MedicineMaster,
  CsvParsedRow,
  CsvImportSummary,
} from '@/types/medicine';
import {
  generateSampleCsvTemplate,
  parseAndValidateCsv,
  executeCsvImport,
  generateCsvErrorReport,
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
  const [finalResult, setFinalResult] = useState<CsvImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = generateSampleCsvTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'medicine_master_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const { rows, summary: valSummary } = parseAndValidateCsv(text, existingMedicines);
      setParsedRows(rows);
      setSummary(valSummary);
      setCurrentStep('preview');
    };
    reader.readAsText(file);
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

  const handleRunImport = () => {
    setCurrentStep('importing');
    setTimeout(() => {
      const rowsToProcess = skipInvalid ? parsedRows.filter((r) => r.isValid) : parsedRows;
      const res = executeCsvImport(rowsToProcess, updateExisting, responsibleUser);
      setFinalResult(res);
      setCurrentStep('results');
      onImportComplete();
    }, 700);
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
          <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#16191E]">
                  Medicine Master CSV Import
                </h2>
                <p className="text-xs text-[#8A909D] font-medium">
                  Bulk import medicine catalog, batch inventory, and supplier master records
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

          <div className="flex items-center border-b border-slate-100 px-6 py-3 bg-[#FAFBFD] text-xs font-semibold gap-2">
            {[
              { step: 'upload', label: '1. Upload & Template' },
              { step: 'preview', label: '2. Validate & Preview' },
              { step: 'results', label: '3. Import Summary' },
            ].map((st, i) => {
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
                  {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </div>
              );
            })}
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {currentStep === 'upload' && (
              <div className="space-y-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition bg-[#FAFBFD] hover:bg-blue-50/20 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-4 group-hover:scale-110 transition">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">
                    Click to browse or drop CSV file here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Upload your medicine master sheet with batch info, pricing, and supplier tags.
                  </p>
                  <span className="mt-4 px-4 py-2 bg-white border border-slate-200 group-hover:border-blue-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs">
                    Select CSV File
                  </span>
                </div>

                <div className="bg-[#F8F9FB] rounded-2xl border border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-blue-600" />
                      Download Pre-Formatted Medicine CSV Template
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Includes 19 pre-defined columns: SKU, Brand, Generic, Manufacturer, Category, Batch#, Mfg/Exp dates, Prices, and Supplier fields.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-2xs whitespace-nowrap self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    Download Sample CSV
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Required Column Headers
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-600">
                    {[
                      'sku *',
                      'brand_name *',
                      'generic_name *',
                      'batch_number *',
                      'expiry_date *',
                      'purchase_price *',
                      'selling_price *',
                      'quantity *',
                      'manufacturer',
                      'category',
                      'dosage_form',
                      'strength',
                      'unit',
                      'barcode',
                      'mfg_date',
                      'min_stock_level',
                      'supplier_name',
                      'supplier_phone',
                      'invoice_number',
                    ].map((col) => (
                      <div
                        key={col}
                        className={`p-2 rounded-lg border text-center ${
                          col.includes('*')
                            ? 'bg-blue-50/60 border-blue-200 text-blue-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {col}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'preview' && summary && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
                  <div className="p-3 bg-[#F8F9FB] border border-slate-100 rounded-xl">
                    <p className="text-[11px] font-medium text-slate-400">Total Rows</p>
                    <p className="text-lg font-black text-slate-800">{summary.totalRows}</p>
                  </div>
                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                    <p className="text-[11px] font-medium text-emerald-700">Valid Rows</p>
                    <p className="text-lg font-black text-emerald-800">{summary.validRows}</p>
                  </div>
                  <div className="p-3 bg-red-50/60 border border-red-100 rounded-xl">
                    <p className="text-[11px] font-medium text-red-700">Invalid Rows</p>
                    <p className="text-lg font-black text-red-800">{summary.invalidRows}</p>
                  </div>
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                    <p className="text-[11px] font-medium text-blue-700">New Medicines</p>
                    <p className="text-lg font-black text-blue-800">{summary.newMedicinesCount}</p>
                  </div>
                  <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl">
                    <p className="text-[11px] font-medium text-purple-700">Existing (Restock)</p>
                    <p className="text-lg font-black text-purple-800">{summary.updatedMedicinesCount}</p>
                  </div>
                  <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                    <p className="text-[11px] font-medium text-amber-700">Duplicate SKUs</p>
                    <p className="text-lg font-black text-amber-800">{summary.duplicateRows}</p>
                  </div>
                </div>

                <div className="bg-[#F8F9FB] rounded-2xl border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                      {(['all', 'valid', 'invalid', 'duplicates'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setPreviewFilter(f)}
                          className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                            previewFilter === f
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {f} ({
                            f === 'all'
                              ? parsedRows.length
                              : f === 'valid'
                              ? summary.validRows
                              : f === 'invalid'
                              ? summary.invalidRows
                              : summary.duplicateRows
                          })
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Showing {filteredPreviewRows.length} rows
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAFBFD] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Row</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Brand & Generic</th>
                          <th className="py-2 px-3">Batch #</th>
                          <th className="py-2 px-3">Exp Date</th>
                          <th className="py-2 px-3">Qty</th>
                          <th className="py-2 px-3">Buy Price</th>
                          <th className="py-2 px-3">Sell Price</th>
                          <th className="py-2 px-3">Validation Diagnostic</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPreviewRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-6 text-center text-slate-400">
                              No rows match this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredPreviewRows.map((r) => (
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
                              <td className="py-2 px-3 font-bold text-slate-800">{r.quantity}</td>
                              <td className="py-2 px-3 text-slate-600">₹{r.purchasePrice.toFixed(2)}</td>
                              <td className="py-2 px-3 font-semibold text-emerald-700">₹{r.sellingPrice.toFixed(2)}</td>
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
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'importing' && (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                <RefreshCw className="w-10 h-10 text-[#2563EB] animate-spin" />
                <h3 className="text-base font-bold text-slate-800">
                  Processing Master Data & Batches...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Writing medicine catalog, registering batch records, and initializing stock movement ledgers.
                </p>
              </div>
            )}

            {currentStep === 'results' && finalResult && (
              <div className="space-y-6">
                <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">
                    Import Completed Successfully!
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    The medicine master catalog and batch inventory have been synchronized.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-[#F8F9FB] rounded-2xl border border-slate-100 text-center">
                    <p className="text-xs text-slate-400 font-medium">Total Processed</p>
                    <p className="text-xl font-black text-slate-800 mt-1">{finalResult.totalRows}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-xs text-emerald-700 font-medium">Successfully Imported</p>
                    <p className="text-xl font-black text-emerald-800 mt-1">{finalResult.successfullyImported}</p>
                  </div>
                  <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                    <p className="text-xs text-amber-700 font-medium">Skipped Rows</p>
                    <p className="text-xl font-black text-amber-800 mt-1">{finalResult.skippedRows}</p>
                  </div>
                  <div className="p-4 bg-red-50/70 rounded-2xl border border-red-100 text-center">
                    <p className="text-xs text-red-700 font-medium">Failed / Invalid</p>
                    <p className="text-xl font-black text-red-800 mt-1">{finalResult.failedRows}</p>
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
      </div>
    </AnimatePresence>
  );
}
