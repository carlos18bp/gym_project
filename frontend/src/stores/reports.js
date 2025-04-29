/**
 * Reports Store
 * 
 * This store handles report generation functionality, including:
 * - Generating Excel reports based on selected type and date range
 * - Managing the state of report generation
 */
import { defineStore } from 'pinia';
import axios from 'axios';

export const useReportsStore = defineStore('reports', {
  state: () => ({
    isGenerating: false,
    lastGeneratedReport: null,
    error: null
  }),

  actions: {
    /**
     * Generate an Excel report based on the provided parameters
     * @param {Object} reportData Report parameters
     * @param {string} reportData.reportType Type of report to generate
     * @param {string} reportData.startDate Start date for the report period (YYYY-MM-DD)
     * @param {string} reportData.endDate End date for the report period (YYYY-MM-DD)
     * @param {number|null} reportData.userId Optional user ID filter
     * @returns {Promise}
     */
    async generateExcelReport(reportData) {
      this.isGenerating = true;
      this.error = null;
      
      try {
        // Request the report from the backend
        const response = await axios.post('/api/reports/generate-excel/', reportData, {
          responseType: 'blob' // Important: We're expecting a binary file response
        });
        
        // Create download link for the Excel file
        const blob = new Blob([response.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        // Create a filename based on report type and date
        const reportDate = new Date().toISOString().split('T')[0];
        const filename = `${reportData.reportType}_${reportDate}.xlsx`;
        
        // Create download link and trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = window.URL.createObjectURL(blob);
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        this.lastGeneratedReport = {
          type: reportData.reportType,
          dateGenerated: new Date(),
          filename
        };
        
        return response.data;
      } catch (error) {
        this.error = error.message || 'Error al generar el reporte';
        console.error('Error generating report:', error);
        throw error;
      } finally {
        this.isGenerating = false;
      }
    }
  }
}); 