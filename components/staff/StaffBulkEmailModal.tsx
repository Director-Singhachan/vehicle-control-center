import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Mail, Plus, Trash2, ClipboardPaste, Info, Loader2, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { adminStaffService, type StaffProfile } from '../../services/adminStaffService';
import {
  staffColumnIndex,
  STAFF_EMAIL_HEADER_CANDIDATES,
  STAFF_EMPLOYEE_CODE_HEADER_CANDIDATES,
} from '../../utils/staffExcelHeaders';

export interface StaffBulkEmailBatchResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  total: number;
}

interface StaffBulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStaff: StaffProfile[];
  onSuccessRefetch: () => void;
  onBatchComplete: (result: StaffBulkEmailBatchResult) => void;
}

interface Row {
  id: string;
  employee_code: string;
  new_email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500';

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

/** Excel มักอ่านรหัสเป็นตัวเลข (เช่น 1) ในของที่ DB เป็น 000001 */
function buildStaffCodeIndex(staffList: StaffProfile[]): Map<string, StaffProfile> {
  const m = new Map<string, StaffProfile>();
  for (const s of staffList) {
    const c = s.employee_code?.trim();
    if (!c) continue;
    m.set(c, s);
    if (/^\d+$/.test(c)) {
      const compact = String(parseInt(c, 10));
      if (!m.has(compact)) {
        m.set(compact, s);
      }
    }
  }
  return m;
}

function lookupStaffByCode(m: Map<string, StaffProfile>, rawCode: string): StaffProfile | undefined {
  const t = rawCode.trim();
  if (!t) return undefined;
  if (m.has(t)) return m.get(t);
  if (/^\d+$/.test(t)) {
    return m.get(String(parseInt(t, 10)));
  }
  return undefined;
}

export const StaffBulkEmailModal: React.FC<StaffBulkEmailModalProps> = ({
  isOpen,
  onClose,
  existingStaff,
  onSuccessRefetch,
  onBatchComplete,
}) => {
  const [rows, setRows] = useState<Row[]>([{ id: newId(), employee_code: '', new_email: '' }]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [excelHint, setExcelHint] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const byCode = useMemo(() => buildStaffCodeIndex(existingStaff), [existingStaff]);

  useEffect(() => {
    if (isOpen) {
      setRows([{ id: newId(), employee_code: '', new_email: '' }]);
      setPasteOpen(false);
      setPasteText('');
      setRunning(false);
      setProgress(0);
      setExcelHint(null);
      setExcelError(null);
    }
  }, [isOpen]);

  const parseExcelToRows = useCallback((buffer: ArrayBuffer): Row[] => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetIdx = workbook.SheetNames.findIndex((n) => n.includes('Simple'));
    const sheetName = sheetIdx !== -1 ? workbook.SheetNames[sheetIdx] : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawJson = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, rawJson.length); i++) {
      const row = rawJson[i];
      if (Array.isArray(row) && row.some((c) => (c || '').toString().trim() === 'รหัสพนักงาน')) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) {
      throw new Error('ไม่พบคอลัมน์ "รหัสพนักงาน" ในไฟล์');
    }

    const headers = (rawJson[headerRowIndex] as unknown[]).map((h) => (h || '').toString().trim());
    const colMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      if (h) colMap[h] = idx;
    });

    const codeCol = staffColumnIndex(colMap, STAFF_EMPLOYEE_CODE_HEADER_CANDIDATES);
    if (codeCol === undefined) {
      throw new Error('ไม่พบคอลัมน์ "รหัสพนักงาน"');
    }
    const emailCol = staffColumnIndex(colMap, STAFF_EMAIL_HEADER_CANDIDATES);
    if (emailCol === undefined) {
      throw new Error('ไม่พบคอลัมน์อีเมล (ใช้ Email / อีเมล / E-mail)');
    }

    const dataRows = rawJson.slice(headerRowIndex + 1);
    const out: Row[] = [];
    for (const row of dataRows) {
      if (!Array.isArray(row)) continue;
      const code = row[codeCol]?.toString().trim();
      const em = row[emailCol]?.toString().trim();
      if (!code) continue;
      if (!em) continue;
      out.push({ id: newId(), employee_code: code, new_email: em });
    }
    if (!out.length) {
      throw new Error('ไม่มีแถวข้อมูลที่มีรหัสพนักงานและอีเมลครบ');
    }
    return out;
  }, []);

  const handleExcelPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      setExcelError(null);
      setExcelHint(null);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buf = reader.result as ArrayBuffer;
          const parsed = parseExcelToRows(buf);
          setRows(parsed);
          setExcelHint(`โหลด ${parsed.length} แถวจาก ${f.name}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ';
          setExcelError(msg);
        }
      };
      reader.readAsArrayBuffer(f);
    },
    [parseExcelToRows],
  );

  const addRow = useCallback(() => {
    setRows((r) => [...r, { id: newId(), employee_code: '', new_email: '' }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== id)));
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<Pick<Row, 'employee_code' | 'new_email'>>) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const applyPaste = useCallback(() => {
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: Row[] = [];
    for (const line of lines) {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      if (parts.length >= 2) {
        parsed.push({ id: newId(), employee_code: parts[0], new_email: parts[1] });
      }
    }
    if (parsed.length) {
      setRows(parsed);
      setPasteOpen(false);
      setPasteText('');
    }
  }, [pasteText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => r.employee_code.trim() && r.new_email.trim());
    if (!filled.length) {
      onBatchComplete({ success: 0, failed: 0, skipped: 0, errors: [], total: 0 });
      return;
    }

    const codeSet = new Set<string>();
    for (const r of filled) {
      const c = r.employee_code.trim();
      if (codeSet.has(c)) {
        onBatchComplete({
          success: 0,
          failed: 0,
          skipped: 0,
          errors: [`รหัสพนักงาน "${c}" ซ้ำในแบบฟอร์ม — ลบแถวที่ซ้ำแล้วลองใหม่`],
          total: filled.length,
        });
        return;
      }
      codeSet.add(c);
    }

    const toRun: { staff: StaffProfile; newEmail: string }[] = [];
    let skipped = 0;
    const preErrors: string[] = [];

    for (const r of filled) {
      const code = r.employee_code.trim();
      const em = r.new_email.trim();
      if (!EMAIL_RE.test(em)) {
        preErrors.push(`รหัส ${code}: รูปแบบอีเมลไม่ถูกต้อง`);
        continue;
      }
      const staff = lookupStaffByCode(byCode, code);
      if (!staff) {
        preErrors.push(`รหัส ${code}: ไม่พบในระบบหรือยังไม่มีรหัสพนักงาน`);
        continue;
      }
      const cur = (staff.email || '').trim();
      if (normalizeEmail(em) === normalizeEmail(cur)) {
        skipped++;
        continue;
      }
      toRun.push({ staff, newEmail: em });
    }

    if (!toRun.length) {
      onBatchComplete({
        success: 0,
        failed: preErrors.length,
        skipped,
        errors: preErrors,
        total: filled.length,
      });
      if (preErrors.length === 0 && skipped > 0) {
        onClose();
      }
      return;
    }

    setRunning(true);
    setProgress(0);
    const errors = [...preErrors];
    let ok = 0;

    for (let i = 0; i < toRun.length; i++) {
      const { staff, newEmail } = toRun[i];
      try {
        await adminStaffService.updateProfile(staff.id, { email: newEmail });
        ok++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`รหัส ${staff.employee_code}: ${msg}`);
      }
      setProgress(Math.round(((i + 1) / toRun.length) * 100));
    }

    const apiFailed = toRun.length - ok;
    const failed = preErrors.length + apiFailed;
    setRunning(false);
    onBatchComplete({
      success: ok,
      failed,
      skipped,
      errors,
      total: filled.length,
    });
    if (ok > 0) {
      onSuccessRefetch();
    }
    if (ok > 0 || (failed === 0 && skipped === filled.length)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!running) onClose();
      }}
      title="เปลี่ยนอีเมล"
      size="large"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg border border-enterprise-200 dark:border-enterprise-800 bg-enterprise-50/80 dark:bg-enterprise-900/20">
          <Info className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <p>
              ระบบจะอัปเดตอีเมลใน Supabase Auth ให้ผู้ใช้<strong>คนเดิม</strong> โดยไม่ส่งลิงก์ยืนยันทางอีเมล
              (ยืนยันโดยผู้ดูแลระบบ)
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              หลังบันทึก พนักงานต้องเข้าสู่ระบบด้วย<strong>อีเมลใหม่</strong> · รหัสผ่านยังเป็นชุดเดิมจนกว่าจะเปลี่ยนแยก
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleExcelPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => excelInputRef.current?.click()}
            disabled={running}
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            อัปโหลด Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={running}>
            <Plus className="w-4 h-4 mr-1" />
            เพิ่มแถว
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPasteOpen((v) => !v)}
            disabled={running}
          >
            <ClipboardPaste className="w-4 h-4 mr-1" />
            วางจากข้อความ
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          ไฟล์ .xlsx ใช้ได้เฉพาะคอลัมน์ <span className="font-mono">รหัสพนักงาน</span> + อีเมล (Email / อีเมล / E-mail)
          — ไม่กระทบชื่อหรือตำแหน่งในระบบ
        </p>
        {excelHint && (
          <p className="text-xs text-green-600 dark:text-green-400">{excelHint}</p>
        )}
        {excelError && (
          <p className="text-xs text-red-600 dark:text-red-400">{excelError}</p>
        )}

        {pasteOpen && (
          <div className="space-y-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/40">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              วางทีละบรรทัด: <span className="font-mono">รหัสพนักงาน,อีเมลใหม่</span> หรือคั่นด้วย Tab
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              className={`${inputCls} font-mono text-xs`}
              placeholder={'00001,newmail@example.com\n00002,other@example.com'}
              disabled={running}
            />
            <Button type="button" size="sm" onClick={applyPaste} disabled={running || !pasteText.trim()}>
              แทนที่ตารางด้วยข้อความนี้
            </Button>
          </div>
        )}

        <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 dark:bg-charcoal-900 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">รหัสพนักงาน</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">อีเมลปัจจุบัน</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300">อีเมลใหม่</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const st = row.employee_code.trim()
                  ? lookupStaffByCode(byCode, row.employee_code)
                  : undefined;
                return (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 align-top">
                      <input
                        type="text"
                        value={row.employee_code}
                        onChange={(e) => updateRow(row.id, { employee_code: e.target.value })}
                        className={`${inputCls} font-mono`}
                        placeholder="เช่น 00001"
                        disabled={running}
                      />
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-500 dark:text-slate-400 break-all max-w-[180px]">
                      {st?.email || (row.employee_code.trim() ? '—' : '')}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="email"
                        value={row.new_email}
                        onChange={(e) => updateRow(row.id, { new_email: e.target.value })}
                        className={inputCls}
                        placeholder="อีเมลใหม่"
                        autoComplete="off"
                        disabled={running}
                      />
                    </td>
                    <td className="px-1 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg"
                        disabled={running || rows.length <= 1}
                        aria-label="ลบแถว"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {running && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            กำลังบันทึก… {progress}%
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="outline" onClick={onClose} disabled={running}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={running}>
            <Mail className="w-4 h-4 mr-1.5" />
            บันทึกการเปลี่ยนอีเมล
          </Button>
        </div>
      </form>
    </Modal>
  );
};
