const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { getAnalyticsData } = require('../utils/analytics');
const { promisePool } = require('../config/database');

let schedulerInstance = null;

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('SMTP credentials not configured. Email reports are disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

const generateReportContent = async (period) => {
  const analytics = await getAnalyticsData(period);
  
  let content = `Library Analytics Report - ${period.charAt(0).toUpperCase() + period.slice(1)} Report\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;
  content += `Total Visits: ${analytics.totalVisits || 0}\n`;
  content += `Unique Visitors: ${analytics.uniqueUsers || 0}\n`;
  content += `Currently Inside: ${analytics.currentlyInside || 0}\n`;
  content += `Average Daily Visits: ${analytics.averageDailyVisits || 0}\n\n`;
  
  if (analytics.dailyBreakdown?.length) {
    content += 'Daily Breakdown:\n';
    analytics.dailyBreakdown.forEach(day => {
      content += `- ${day.day}: ${day.visits} visits, ${day.unique_users} unique users\n`;
    });
  }

  return { content, analytics };
};

const sendReportEmail = async (to, subject, text, attachments = []) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('Email transporter not configured. Skipping email send.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const scheduleWeeklyReport = () => {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }

  schedulerInstance = cron.schedule('0 8 * * 1', async () => {
    console.log('Running weekly analytics report...');
    try {
      const { content, analytics } = await generateReportContent('week');
      
      const [subscribers] = await promisePool.query('SELECT email FROM report_subscribers WHERE frequency = ?', ['weekly']);
      
      for (const subscriber of subscribers) {
        await sendReportEmail(subscriber.email, 'Weekly Library Analytics Report', content);
      }

      await promisePool.query(
        'INSERT INTO report_history (report_type, period, generated_at, recipient_count, status) VALUES (?, ?, NOW(), ?, ?)',
        ['weekly', 'week', subscribers.length, 'sent']
      );

      console.log(`Weekly report sent to ${subscribers.length} subscribers`);
    } catch (error) {
      console.error('Error generating weekly report:', error);
    }
  }, {
    scheduled: true,
    timezone: process.env.TZ || 'Asia/Manila'
  });

  console.log('Weekly report scheduler started');
};

const scheduleMonthlyReport = () => {
  if (!schedulerInstance) {
    schedulerInstance = cron.schedule('0 8 1 * *', async () => {
      console.log('Running monthly analytics report...');
      try {
        const { content, analytics } = await generateReportContent('month');
        
        const [subscribers] = await promisePool.query('SELECT email FROM report_subscribers WHERE frequency = ?', ['monthly']);
        
        for (const subscriber of subscribers) {
          await sendReportEmail(subscriber.email, 'Monthly Library Analytics Report', content);
        }

        await promisePool.query(
          'INSERT INTO report_history (report_type, period, generated_at, recipient_count, status) VALUES (?, ?, NOW(), ?, ?)',
          ['monthly', 'month', subscribers.length, 'sent']
        );

        console.log(`Monthly report sent to ${subscribers.length} subscribers`);
      } catch (error) {
        console.error('Error generating monthly report:', error);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'Asia/Manila'
    });
  }

  console.log('Monthly report scheduler started');
};

const initializeScheduler = () => {
  if (process.env.ENABLE_SCHEDULED_REPORTS !== 'true') {
    console.log('Scheduled reports disabled. Set ENABLE_SCHEDULED_REPORTS=true to enable.');
    return;
  }

  scheduleWeeklyReport();
  scheduleMonthlyReport();
};

const stopScheduler = () => {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
};

module.exports = {
  initializeScheduler,
  stopScheduler,
  generateReportContent,
  sendReportEmail
};
