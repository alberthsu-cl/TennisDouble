import type { Player } from '../types';
import * as XLSX from 'xlsx';

export interface InvoiceSettings {
  year: string;
  type: string;
  expense: number;
  organization: string;
}

/**
 * Generate invoice HTML for a single player
 */
export const generateInvoiceHTML = (
  player: Player,
  settings: InvoiceSettings
): string => {
  const { year, type, expense, organization } = settings;
  
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>收據 - ${player.name}</title>
  <style>
    @page {
      size: A5 landscape;
      margin: 10mm;
    }
    
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif;
      margin: 0;
      padding: 20mm;
      background: linear-gradient(135deg, #a8c5dd 0%, #c8dae6 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .invoice-container {
      background: linear-gradient(135deg, #a8c5dd 0%, #c8dae6 100%);
      border: 2px solid #666;
      padding: 40px 60px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    }
    
    .invoice-title {
      font-size: 48px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 40px;
      letter-spacing: 8px;
    }
    
    .invoice-content {
      font-size: 24px;
      line-height: 2.5;
      margin-bottom: 40px;
      text-align: center;
    }
    
    .invoice-organization {
      font-size: 24px;
      line-height: 2;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .invoice-signature {
      font-size: 24px;
      line-height: 2;
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
    }
    
    @media print {
      body {
        background: linear-gradient(135deg, #a8c5dd 0%, #c8dae6 100%);
        padding: 0;
        display: block;
      }
      
      .invoice-container {
        box-shadow: none;
        border: 2px solid #666;
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-title">收據</div>
    <div class="invoice-content">
      茲收到 ${player.name}　${year}年${type}${expense}元
    </div>
    <div class="invoice-organization">
      ${organization}
    </div>
    <div class="invoice-signature">
      財務: _______________
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate invoices for all players and open in new window for printing
 */
export const generateAllInvoicesHTML = (
  players: Player[],
  settings: InvoiceSettings
): string => {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>收據列印 - 全部選手</title>
  <style>
    @page {
      size: A5 landscape;
      margin: 10mm;
    }
    
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    
    .invoice-container {
      background: linear-gradient(135deg, #a8c5dd 0%, #c8dae6 100%);
      border: 2px solid #666;
      padding: 40px 60px;
      margin: 20px auto;
      max-width: 600px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      page-break-after: always;
      page-break-inside: avoid;
    }
    
    .invoice-title {
      font-size: 48px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 40px;
      letter-spacing: 8px;
    }
    
    .invoice-content {
      font-size: 24px;
      line-height: 2.5;
      margin-bottom: 40px;
      text-align: center;
    }
    
    .invoice-organization {
      font-size: 24px;
      line-height: 2;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .invoice-signature {
      font-size: 24px;
      line-height: 2;
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 20px;
    }
    
    .print-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 20px;
      border: 2px solid #333;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    
    .print-controls button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      margin: 5px;
    }
    
    .print-controls button:hover {
      background: #0056b3;
    }
    
    @media print {
      .print-controls {
        display: none;
      }
      
      .invoice-container {
        box-shadow: none;
        margin: 0;
        page-break-after: always;
      }
      
      body {
        background: #fff;
      }
    }
  </style>
</head>
<body>
  <div class="print-controls">
    <div style="margin-bottom: 10px; font-weight: bold;">共 ${players.length} 張收據</div>
    <button onclick="window.print()">🖨️ 列印全部</button>
    <button onclick="window.close()">✖ 關閉</button>
  </div>
  ${players.map(player => `
  <div class="invoice-container">
    <div class="invoice-title">收據</div>
    <div class="invoice-content">
      茲收到 ${player.name}　${settings.year}年${settings.type}${settings.expense}元
    </div>
    <div class="invoice-organization">
      ${settings.organization}
    </div>
    <div class="invoice-signature">
      財務: _______________
    </div>
  </div>
  `).join('\n')}
</body>
</html>
  `.trim();
};

/**
 * Generate compact credit card-sized invoices for printing on A4
 * Fits 10 invoices per A4 page (2 columns × 5 rows)
 */
export const generateCompactInvoicesHTML = (
  players: Player[],
  settings: InvoiceSettings
): string => {
  const { year, type, expense, organization } = settings;
  
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>收據列印 - 精簡版 (${players.length}張)</title>
  <style>
    @page {
      size: A4;
      margin: 8mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: "Microsoft JhengHei", "微軟正黑體", Arial, sans-serif;
      background: #fff;
      padding: 0;
      margin: 0;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 8mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .invoice-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
      width: 100%;
    }
    
    .invoice-card {
      width: 90mm;
      height: 55mm;
      border: 2px solid #333;
      background: linear-gradient(135deg, #a8c5dd 0%, #c8dae6 100%);
      padding: 3mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      position: relative;
    }
    
    .invoice-header {
      text-align: center;
      border-bottom: 1px solid #333;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    
    .invoice-title {
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 6px;
    }
    
    .invoice-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      padding: 1mm 0;
    }
    
    .invoice-text {
      font-size: 11px;
      line-height: 1.4;
      margin-bottom: 1mm;
    }
    
    .invoice-org {
      font-size: 10px;
      margin-top: 1mm;
    }
    
    .invoice-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      border-top: 1px solid #333;
      padding-top: 2mm;
    }
    
    .print-controls {
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 20px;
      border: 2px solid #333;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000;
    }
    
    .print-controls h3 {
      margin-bottom: 10px;
      font-size: 16px;
    }
    
    .print-controls button {
      padding: 10px 20px;
      font-size: 14px;
      cursor: pointer;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      margin: 5px;
      display: block;
      width: 100%;
    }
    
    .print-controls button:hover {
      background: #0056b3;
    }
    
    .print-controls .info {
      font-size: 12px;
      color: #666;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
    }
    
    @media print {
      .print-controls {
        display: none !important;
      }
      
      .page {
        margin: 0;
        padding: 8mm;
      }
      
      body {
        margin: 0;
        padding: 0;
      }
    }
    
    @media screen {
      body {
        background: #f5f5f5;
        padding: 20px 0;
      }
      
      .page {
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        margin: 20px auto;
      }
    }
  </style>
</head>
<body>
  <div class="print-controls">
    <h3>📄 收據列印</h3>
    <div style="margin-bottom: 15px;">
      <strong>總數:</strong> ${players.length} 張<br>
      <strong>頁數:</strong> ${Math.ceil(players.length / 10)} 頁<br>
      <strong>格式:</strong> A4 (每頁10張)
    </div>
    <button onclick="window.print()">🖨️ 列印全部</button>
    <button onclick="window.close()">✖ 關閉視窗</button>
    <div class="info">
      💳 信用卡大小 (90×55mm)<br>
      每頁 2列 × 5行 = 10張
    </div>
  </div>
  
  ${generatePages(players, settings)}
</body>
</html>
  `.trim();
  
  function generatePages(players: Player[], settings: InvoiceSettings): string {
    const pages: string[] = [];
    const invoicesPerPage = 10;
    
    for (let i = 0; i < players.length; i += invoicesPerPage) {
      const pageInvoices = players.slice(i, i + invoicesPerPage);
      pages.push(generatePage(pageInvoices, settings));
    }
    
    return pages.join('\n');
  }
  
  function generatePage(players: Player[], settings: InvoiceSettings): string {
    return `
  <div class="page">
    <div class="invoice-grid">
      ${players.map(player => `
      <div class="invoice-card">
        <div class="invoice-header">
          <div class="invoice-title">收　據</div>
        </div>
        <div class="invoice-body">
          <div class="invoice-text">
            茲收到 <strong>${player.name}</strong><br>
            ${settings.year}年 ${settings.type}<br>
            金額 <strong>${settings.expense}</strong> 元
          </div>
          <div class="invoice-org">${settings.organization}</div>
        </div>
        <div class="invoice-footer">
          <span>財務經辦: _______________</span>
        </div>
      </div>
      `).join('\n')}
    </div>
  </div>`;
  }
};

/**
 * Open invoice in a new window for printing
 */
export const openInvoiceForPrint = (html: string): void => {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
};

/**
 * Export all player invoices
 */
export const exportPlayerInvoices = (
  players: Player[],
  settings: InvoiceSettings
): void => {
  const html = generateAllInvoicesHTML(players, settings);
  openInvoiceForPrint(html);
};

/**
 * Export compact credit card-sized invoices (10 per A4 page)
 */
export const exportCompactInvoices = (
  players: Player[],
  settings: InvoiceSettings
): void => {
  const html = generateCompactInvoicesHTML(players, settings);
  openInvoiceForPrint(html);
};

/**
 * Export compact invoices as PDF (automatic download)
 * Opens print dialog with print-to-PDF option
 */
export const exportCompactInvoicesPDF = async (
  players: Player[],
  settings: InvoiceSettings
): Promise<void> => {
  // Generate HTML and open in new window for printing
  const html = generateCompactInvoicesHTML(players, settings);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
};

/**
 * Export invoices as Excel file with multiple invoices per A4 page (2x3 layout)
 */
export const exportPlayerInvoicesExcel = (
  players: Player[],
  settings: InvoiceSettings
): void => {
  const wb = XLSX.utils.book_new();
  
  // Process 6 invoices per page (2 columns x 3 rows on A4)
  const invoicesPerPage = 6;
  const pages = Math.ceil(players.length / invoicesPerPage);
  
  for (let page = 0; page < pages; page++) {
    const startIdx = page * invoicesPerPage;
    const endIdx = Math.min(startIdx + invoicesPerPage, players.length);
    const pageInvoices = players.slice(startIdx, endIdx);
    
    // Create worksheet data
    const wsData: any[][] = [];
    
    // Create 3 rows, each with 2 invoices side by side
    for (let row = 0; row < 3; row++) {
      const leftIdx = row * 2;
      const rightIdx = leftIdx + 1;
      
      const leftPlayer = pageInvoices[leftIdx];
      const rightPlayer = rightIdx < pageInvoices.length ? pageInvoices[rightIdx] : null;
      
      // Add spacing row
      wsData.push(['', '', '', '', '', '', '', '', '']);
      
      // Title row
      wsData.push([
        leftPlayer ? '收據' : '', '', '', '',
        '', // Spacer
        rightPlayer ? '收據' : '', '', '', ''
      ]);
      
      // Content row
      wsData.push([
        leftPlayer ? `茲收到 ${leftPlayer.name}　${settings.year}年${settings.type}${settings.expense}元` : '', '', '', '',
        '',
        rightPlayer ? `茲收到 ${rightPlayer.name}　${settings.year}年${settings.type}${settings.expense}元` : '', '', '', ''
      ]);
      
      // Organization row
      wsData.push([
        leftPlayer ? settings.organization : '', '', '', '',
        '',
        rightPlayer ? settings.organization : '', '', '', ''
      ]);
      
      // Signature row
      wsData.push([
        leftPlayer ? '財務:' : '', '', '', '',
        '',
        rightPlayer ? '財務:' : '', '', '', ''
      ]);
      
      // Spacing between rows
      wsData.push(['', '', '', '', '', '', '', '', '']);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // IMPORTANT: Apply merges BEFORE styling
    const merges = [];
    for (let row = 0; row < 3; row++) {
      const baseRow = row * 6;
      
      const leftPlayer = pageInvoices[row * 2];
      const rightPlayer = pageInvoices[row * 2 + 1];
      
      // Left invoice merges (columns 0-3)
      if (leftPlayer) {
        merges.push(
          { s: { r: baseRow + 1, c: 0 }, e: { r: baseRow + 1, c: 3 } }, // Title
          { s: { r: baseRow + 2, c: 0 }, e: { r: baseRow + 2, c: 3 } }, // Content
          { s: { r: baseRow + 3, c: 0 }, e: { r: baseRow + 3, c: 3 } }, // Organization
          { s: { r: baseRow + 4, c: 0 }, e: { r: baseRow + 4, c: 3 } }  // Signature
        );
      }
      
      // Right invoice merges (columns 5-8)
      if (rightPlayer) {
        merges.push(
          { s: { r: baseRow + 1, c: 5 }, e: { r: baseRow + 1, c: 8 } }, // Title
          { s: { r: baseRow + 2, c: 5 }, e: { r: baseRow + 2, c: 8 } }, // Content
          { s: { r: baseRow + 3, c: 5 }, e: { r: baseRow + 3, c: 8 } }, // Organization
          { s: { r: baseRow + 4, c: 5 }, e: { r: baseRow + 4, c: 8 } }  // Signature
        );
      }
    }
    ws['!merges'] = merges;
    
    // Set column widths - 9 columns total (0-8)
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },  // Left invoice (0-3)
      { wch: 2 },                                           // Spacer (4)
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }   // Right invoice (5-8)
    ];
    
    // Set row heights
    ws['!rows'] = wsData.map((_, idx) => {
      const rowInSection = idx % 6;
      if (rowInSection === 0) return { hpt: 25 };  // Top spacing
      if (rowInSection === 5) return { hpt: 30 };  // Bottom spacing
      if (rowInSection === 1) return { hpt: 50 };  // Title
      if (rowInSection === 2) return { hpt: 40 };  // Content
      if (rowInSection === 3) return { hpt: 35 };  // Organization
      if (rowInSection === 4) return { hpt: 35 };  // Signature
      return { hpt: 30 };
    });
    
    // Apply styling to the invoice cells
    for (let row = 0; row < 3; row++) {
      const baseRow = row * 6;
      const leftPlayer = pageInvoices[row * 2];
      const rightPlayer = pageInvoices[row * 2 + 1];
      
      // Style left invoice cells
      if (leftPlayer) {
        // Title
        let cellRef = XLSX.utils.encode_cell({ r: baseRow + 1, c: 0 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 24, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              top: { style: 'medium' },
              left: { style: 'medium' },
              right: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Content
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 2, c: 0 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 14 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Organization
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 3, c: 0 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 13 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Signature
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 4, c: 0 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 13 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              bottom: { style: 'medium' },
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' }
            }
          };
        }
      }
      
      // Style right invoice cells
      if (rightPlayer) {
        // Title
        let cellRef = XLSX.utils.encode_cell({ r: baseRow + 1, c: 5 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 24, bold: true },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              top: { style: 'medium' },
              left: { style: 'medium' },
              right: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Content
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 2, c: 5 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 14 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Organization
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 3, c: 5 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 13 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' },
              bottom: { style: 'medium' }
            }
          };
        }
        
        // Signature
        cellRef = XLSX.utils.encode_cell({ r: baseRow + 4, c: 5 });
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { sz: 13 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'C8DAE6' } },
            border: {
              bottom: { style: 'medium' },
              left: { style: 'medium' },
              right: { style: 'medium' },
              top: { style: 'medium' }
            }
          };
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, `第${page + 1}頁`);
  }
  
  XLSX.writeFile(wb, `收據_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
