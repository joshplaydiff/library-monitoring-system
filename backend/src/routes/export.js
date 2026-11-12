const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const json2csv = require('json2csv');
const PDFDocument = require('pdfkit');
const { promisePool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const exportToExcel = async (req, res) => {
  try {
    const { analytics, options } = req.body;

    if (!analytics) {
      return res.status(400).json({
        success: false,
        error: 'Analytics data is required'
      });
    }

    const fields = [
      { label: 'Metric', value: 'metric' },
      { label: 'Value', value: 'value' }
    ];

    const data = [
      { metric: 'Total Visits', value: analytics.totalVisits || 0 },
      { metric: 'Entries', value: analytics.entries || 0 },
      { metric: 'Exits', value: analytics.exits || 0 },
      { metric: 'Currently Inside', value: analytics.currentlyInside || 0 },
      { metric: 'Unique Visitors', value: analytics.uniqueUsers || 0 },
      { metric: 'Average Daily Visits', value: analytics.averageDailyVisits || 0 },
      { metric: 'Report Type', value: options?.reportType || 'General' },
      { metric: 'Date Range', value: options?.dateRange || 'Week' },
      { metric: 'Generated At', value: new Date().toISOString() }
    ];

    if (analytics.dailyBreakdown && analytics.dailyBreakdown.length > 0) {
      data.push({ metric: '', value: '' });
      data.push({ metric: 'Daily Breakdown', value: '' });
      analytics.dailyBreakdown.forEach(day => {
        data.push({
          metric: day.day || 'Unknown',
          value: `${day.visits || 0} visits, ${day.unique_users || 0} unique users`
        });
      });
    }

    if (analytics.userTypeDistribution && Object.keys(analytics.userTypeDistribution).length > 0) {
      data.push({ metric: '', value: '' });
      data.push({ metric: 'User Type Distribution', value: '' });
      Object.entries(analytics.userTypeDistribution).forEach(([type, count]) => {
        data.push({ metric: type, value: count });
      });
    }

    if (analytics.purposeDistribution && Object.keys(analytics.purposeDistribution).length > 0) {
      data.push({ metric: '', value: '' });
      data.push({ metric: 'Purpose Distribution', value: '' });
      Object.entries(analytics.purposeDistribution).forEach(([purpose, count]) => {
        data.push({ metric: purpose, value: count });
      });
    }

    if (analytics.departmentDistribution && Object.keys(analytics.departmentDistribution).length > 0) {
      data.push({ metric: '', value: '' });
      data.push({ metric: 'Department Distribution', value: '' });
      Object.entries(analytics.departmentDistribution).forEach(([dept, count]) => {
        data.push({ metric: dept, value: count });
      });
    }

    const csv = json2csv.parse(data, { fields });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=library-analytics-${options?.dateRange || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to Excel',
      message: error.message
    });
  }
};

const exportToPDF = async (req, res) => {
  try {
    const { analytics, options } = req.body;

    if (!analytics) {
      return res.status(400).json({
        success: false,
        error: 'Analytics data is required'
      });
    }

    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: 'Library Monitoring System Analytics Report',
        Author: 'UST Legazpi Library System',
        Subject: options?.reportType || 'General Analytics',
        Keywords: 'library, analytics, report, UST Legazpi'
      }
    });
    
    const filename = `library-analytics-${options?.dateRange || 'export'}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    const colors = {
      primary: '#8B0000',
      secondary: '#D4AF37',
      text: '#2c3e50',
      light: '#f8f9fa',
      border: '#e0e0e0'
    };

    const addCoverPage = () => {
      const centerX = doc.page.width / 2;
      
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.light);
      
      doc.rect(0, 0, doc.page.width, 15).fill(colors.primary);
      doc.rect(0, doc.page.height - 15, doc.page.width, 15).fill(colors.primary);
      
      doc.rect(centerX - 80, 80, 160, 3).fill(colors.secondary);
      
      doc.fontSize(28).fillColor(colors.primary).text('University of Santo Tomas', centerX - 180, 120, { width: 360, align: 'center' });
      doc.fontSize(24).fillColor(colors.primary).text('Legazpi', centerX - 180, 155, { width: 360, align: 'center' });
      
      doc.rect(centerX - 100, 200, 200, 2).fill(colors.secondary);
      
      doc.fontSize(22).fillColor(colors.primary).text('Library Monitoring System', centerX - 180, 220, { width: 360, align: 'center' });
      doc.fontSize(16).fillColor(colors.text).text('Analytics Report', centerX - 180, 255, { width: 360, align: 'center' });
      
      doc.rect(centerX - 120, 310, 240, 1).fill(colors.border);
      
      const reportInfo = [
        { label: 'Report Type', value: options?.reportType || 'General Analytics' },
        { label: 'Date Range', value: options?.dateRange || 'Week' },
        { label: 'Generated On', value: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
        { label: 'Generated By', value: 'Library Monitoring System' }
      ];
      
      reportInfo.forEach((info, index) => {
        const y = 340 + (index * 30);
        doc.fontSize(11).fillColor(colors.text).text(info.label, centerX - 160, y, { width: 100 });
        doc.fontSize(11).fillColor(colors.primary).text(info.value, centerX - 40, y, { width: 200 });
      });
      
      doc.rect(centerX - 120, 480, 240, 1).fill(colors.border);
      doc.fontSize(9).fillColor('#666666').text('CONFIDENTIAL - For Internal Use Only', centerX - 180, 500, { width: 360, align: 'center' });
    };

    const addHeader = () => {
      if (doc.y > 100) {
        doc.rect(doc.page.margins.left, doc.y, pageWidth, 25).fill(colors.primary);
        doc.fontSize(11).fillColor('#ffffff').text('Library Monitoring System', doc.page.margins.left + 10, doc.y + 6);
        doc.text('Analytics Report', doc.page.margins.left + 150, doc.y + 6);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, doc.page.margins.left + pageWidth - 120, doc.y + 6);
        doc.moveDown(1.5);
      }
    };

    const addFooter = () => {
      const footerY = doc.page.height - 30;
      doc.rect(doc.page.margins.left, footerY, pageWidth, 1).fill(colors.border);
      doc.fontSize(8).fillColor('#666666').text(
        'University of Santo Tomas - Legazpi | Library Monitoring System',
        doc.page.margins.left,
        footerY + 5,
        { width: pageWidth, align: 'center' }
      );
    };

    const addSectionHeader = (title) => {
      doc.moveDown(1);
      doc.rect(doc.page.margins.left, doc.y, pageWidth, 30).fill(colors.primary);
      doc.fontSize(14).fillColor('#ffffff').text(title, doc.page.margins.left + 10, doc.y + 8, { bold: true });
      doc.moveDown(1.5);
    };

    const addKpiBoxes = (kpis) => {
      const boxWidth = pageWidth / 4 - 10;
      const boxHeight = 50;
      const startY = doc.y;
      
      kpis.forEach((kpi, index) => {
        const x = doc.page.margins.left + (index * (boxWidth + 10));
        const y = startY;
        
        doc.rect(x, y, boxWidth, boxHeight).fillAndStroke(colors.light, colors.border);
        doc.rect(x, y, 3, boxHeight).fill(colors.primary);
        
        doc.fontSize(9).fillColor('#666666').text(kpi.label, x + 10, y + 8, { width: boxWidth - 20 });
        doc.fontSize(18).fillColor(colors.primary).text(String(kpi.value), x + 10, y + 22, { width: boxWidth - 20, bold: true });
        
        if (kpi.subtext) {
          doc.fontSize(8).fillColor('#999999').text(kpi.subtext, x + 10, y + 40, { width: boxWidth - 20 });
        }
      });
      
      doc.y = startY + boxHeight + 15;
    };

    const addDataTable = (title, headers, rows) => {
      if (!rows || rows.length === 0) return;
      
      doc.fontSize(12).fillColor(colors.primary).text(title, doc.page.margins.left, doc.y, { bold: true });
      doc.moveDown(0.3);
      
      const colWidth = pageWidth / headers.length;
      const rowHeight = 20;
      
      doc.rect(doc.page.margins.left, doc.y, pageWidth, rowHeight).fill(colors.primary);
      headers.forEach((header, i) => {
        doc.fontSize(10).fillColor('#ffffff').text(header, doc.page.margins.left + (i * colWidth) + 5, doc.y + 5, { width: colWidth - 10 });
      });
      doc.moveDown(1);
      
      rows.forEach((row, rowIndex) => {
        const y = doc.y;
        if (rowIndex % 2 === 0) {
          doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill(colors.light);
        }
        
        row.forEach((cell, i) => {
          doc.fontSize(10).fillColor(colors.text).text(String(cell), doc.page.margins.left + (i * colWidth) + 5, y + 5, { width: colWidth - 10 });
        });
        doc.moveDown(1);
      });
      
      doc.moveDown(0.5);
    };

    addCoverPage();
    doc.addPage();
    addHeader();
    
    addSectionHeader('Executive Summary');
    addKpiBoxes([
      { label: 'Total Visits', value: analytics.totalVisits || 0, subtext: 'This period' },
      { label: 'Unique Visitors', value: analytics.uniqueUsers || 0, subtext: 'Distinct users' },
      { label: 'Currently Inside', value: analytics.currentlyInside || 0, subtext: 'Active now' },
      { label: 'Avg Daily Visits', value: analytics.averageDailyVisits || 0, subtext: 'Per day average' }
    ]);

    addSectionHeader('Visit Analytics');
    
    if (analytics.dailyBreakdown && analytics.dailyBreakdown.length > 0) {
      const tableRows = analytics.dailyBreakdown.map(day => [
        day.day ? day.day.substring(0, 3) : 'N/A',
        day.day || 'Unknown',
        String(day.visits || 0),
        String(day.unique_users || 0),
        `${day.average_duration || 30} min`
      ]);
      addDataTable('Daily Visit Summary', ['Day', 'Date', 'Visits', 'Unique Users', 'Avg Duration'], tableRows);
    }

    if (analytics.hourlyDistribution && Object.keys(analytics.hourlyDistribution).length > 0) {
      doc.fontSize(12).fillColor(colors.primary).text('Hourly Distribution', doc.page.margins.left, doc.y, { bold: true });
      doc.moveDown(0.3);
      
      const hourlyRows = Object.entries(analytics.hourlyDistribution)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, count]) => {
          const hourNum = parseInt(hour);
          const timeStr = hourNum === 0 ? '12:00 AM' : hourNum < 12 ? `${hourNum}:00 AM` : hourNum === 12 ? '12:00 PM' : `${hourNum - 12}:00 PM`;
          return [timeStr, String(count)];
        });
      addDataTable('', ['Time', 'Visits'], hourlyRows);
    }

    addSectionHeader('User Demographics');
    
    if (analytics.userTypeDistribution && Object.keys(analytics.userTypeDistribution).length > 0) {
      const userTypeRows = Object.entries(analytics.userTypeDistribution).map(([type, count]) => [
        type.charAt(0).toUpperCase() + type.slice(1),
        String(count),
        `${((count / (analytics.totalVisits || 1)) * 100).toFixed(1)}%`
      ]);
      addDataTable('User Type Distribution', ['User Type', 'Count', 'Percentage'], userTypeRows);
    }

    if (analytics.departmentDistribution && Object.keys(analytics.departmentDistribution).length > 0) {
      const deptRows = Object.entries(analytics.departmentDistribution)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([dept, count]) => [
          dept,
          String(count),
          `${(((count || 0) / (analytics.totalVisits || 1)) * 100).toFixed(1)}%`
        ]);
      addDataTable('Department Distribution', ['Department', 'Count', 'Percentage'], deptRows);
    }

    if (analytics.purposeDistribution && Object.keys(analytics.purposeDistribution).length > 0) {
      const purposeRows = Object.entries(analytics.purposeDistribution)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([purpose, count]) => [
          purpose,
          String(count),
          `${(((count || 0) / (analytics.totalVisits || 1)) * 100).toFixed(1)}%`
        ]);
      addDataTable('Purpose of Visit', ['Purpose', 'Count', 'Percentage'], purposeRows);
    }

    if (analytics.engagementMetrics && Object.keys(analytics.engagementMetrics).length > 0) {
      addSectionHeader('Engagement Metrics');
      addKpiBoxes([
        { label: 'Total Users Engaged', value: analytics.engagementMetrics.totalUsers || 0 },
        { label: 'Active Users (7 Days)', value: analytics.engagementMetrics.activeUsers || 0 },
        { label: 'Avg Visit Duration', value: `${analytics.engagementMetrics.averageVisitDuration || 0} min` },
        { label: 'Repeat Visit Rate', value: `${analytics.engagementMetrics.repeatVisitRate || 0}%` }
      ]);
    }

    if (options?.includeRecommendations) {
      addSectionHeader('Recommendations');
      
      const recommendations = [];
      if (analytics.currentlyInside > 100) {
        recommendations.push('• Consider opening additional study areas during peak hours to accommodate high occupancy.');
      }
      if (analytics.peakHour && analytics.peakHour.hour !== undefined) {
        recommendations.push(`• Peak usage occurs around ${analytics.peakHour.hour}:00. Consider adjusting staffing and resource allocation during these hours.`);
      }
      if (analytics.averageDailyVisits < 50) {
        recommendations.push('• Consider implementing promotional activities and outreach programs to increase library engagement.');
      }
      if (analytics.engagementMetrics?.repeatVisitRate < 30) {
        recommendations.push('• Focus on improving user experience to encourage repeat visits and increase retention rates.');
      }
      recommendations.push('• Monitor capacity utilization regularly and adjust resources based on peak demand patterns.');
      recommendations.push('• Consider extending operating hours during examination periods to accommodate increased demand.');
      
      recommendations.forEach(rec => {
        doc.fontSize(10).fillColor(colors.text).text(rec, doc.page.margins.left, doc.y, { width: pageWidth });
        doc.moveDown(0.3);
      });
    }

    addFooter();
    doc.end();
    
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to PDF',
      message: error.message
    });
  }
};

router.post('/excel', authenticateToken, exportToExcel);
router.post('/pdf', authenticateToken, exportToPDF);

module.exports = router;