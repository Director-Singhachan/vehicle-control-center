// Excel Export Utility
import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
  width?: number;
  format?: (value: any) => string | number;
}

export const excelExport = {
  // Export data to Excel file
  exportToExcel: <T extends Record<string, any>>(
    data: T[],
    columns: ExportColumn[],
    filename: string = 'export.xlsx',
    sheetName: string = 'Sheet1'
  ): void => {
    // Prepare data with formatted values
    const formattedData = data.map(row => {
      const formattedRow: Record<string, any> = {};
      columns.forEach(col => {
        const value = row[col.key];
        formattedRow[col.label] = col.format ? col.format(value) : value;
      });
      return formattedRow;
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Set column widths
    const colWidths = columns.map(col => ({
      wch: col.width || 15,
    }));
    worksheet['!cols'] = colWidths;

    // Ensure filename has .xlsx extension
    const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

    // Generate Excel file and download
    XLSX.writeFile(workbook, safeFilename);
  },

  /** Export หลายชีตในไฟล์เดียว (แต่ละชีตอาจมีคอลัมน์/แถวคนละรูปแบบได้) */
  exportToExcelMultiSheet: (
    sheets: {
      sheetName: string;
      data: Record<string, any>[];
      columns: ExportColumn[];
    }[],
    filename: string = 'export.xlsx'
  ): void => {
    const workbook = XLSX.utils.book_new();
    sheets.forEach(({ sheetName, data, columns }) => {
      const formattedData = data.map(row => {
        const formattedRow: Record<string, any> = {};
        columns.forEach(col => {
          const value = row[col.key];
          formattedRow[col.label] = col.format ? col.format(value) : value;
        });
        return formattedRow;
      });
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const colWidths = columns.map(col => ({ wch: col.width || 15 }));
      worksheet['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    });
    const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, safeFilename);
  },

  // Format currency (Thai Baht)
  formatCurrency: (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '0.00';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(value);
  },

  // Format number with 2 decimals
  formatNumber: (value: number | null | undefined, decimals: number = 2): number => {
    if (value === null || value === undefined) return 0;
    return Number(value.toFixed(decimals));
  },

  // Format date (Thai format)
  formatDate: (value: string | Date | null | undefined): string => {
    if (!value) return '-';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  },

  // Format datetime (Thai format)
  formatDateTime: (value: string | Date | null | undefined): string => {
    if (!value) return '-';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
};

