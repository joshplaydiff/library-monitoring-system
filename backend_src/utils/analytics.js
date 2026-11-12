// spell-checker:disable
const { promisePool } = require('../config/database');

const saveAnalyticsSnapshot = async (period, section, room_id, data) => {
  try {
    await promisePool.query(
      `INSERT INTO analytics_snapshots 
       (period, section, room_id, total_visits, entries, exits, currently_inside, unique_users, average_daily_visits, peak_hour, peak_day, data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        period,
        section || null,
        room_id || null,
        data.totalVisits || 0,
        data.entries || 0,
        data.exits || 0,
        data.currentlyInside || 0,
        data.uniqueUsers || 0,
        data.averageDailyVisits || 0,
        data.peakHour?.hour || 0,
        data.peakDay?.day || null,
        JSON.stringify(data)
      ]
    );
  } catch (error) {
    console.error('Error saving analytics snapshot:', error);
  }
};

const getAnalyticsSnapshot = async (period, section, room_id) => {
  try {
    const [snapshots] = await promisePool.query(
      `SELECT data FROM analytics_snapshots 
       WHERE period = ? 
         AND (section = ? OR (section IS NULL AND ? IS NULL))
         AND (room_id = ? OR (room_id IS NULL AND ? IS NULL))
       ORDER BY created_at DESC 
       LIMIT 1`,
      [period, section || null, section || null, room_id || null, room_id || null]
    );
    if (snapshots.length > 0) {
      return JSON.parse(snapshots[0].data);
    }
    return null;
  } catch (error) {
    console.error('Error fetching analytics snapshot:', error);
    return null;
  }
};

const getAnalyticsData = async (period = 'week', section, room_id) => {
  try {
    const cached = await getAnalyticsSnapshot(period, section, room_id);
    if (cached) return cached;

    let dateCondition = '';
    const now = new Date();

    switch (period) {
      case 'day':
        dateCondition = "DATE(timestamp) = CURDATE()";
        break;
      case 'week':
        dateCondition = "timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        break;
      case 'month':
        dateCondition = "timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        break;
      default:
        dateCondition = "timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    }

    const conditions = [dateCondition];
    const params = [];

    if (section) {
      conditions.push('section = ?');
      params.push(section);
    }

    if (room_id) {
      conditions.push('room_id = ?');
      params.push(room_id);
    }

    const whereClause = conditions.join(' AND ');

    const [totalStats] = await promisePool.query(`
      SELECT 
        COUNT(*) as total_visits,
        SUM(CASE WHEN log_type = 'entry' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN log_type = 'exit' THEN 1 ELSE 0 END) as exits,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT CASE WHEN log_type = 'entry' THEN user_id END) as unique_entries,
        COUNT(DISTINCT DATE(timestamp)) as active_days
      FROM visit_logs
      WHERE ${whereClause}
    `, params);

    const [activeUsers] = await promisePool.query(`
      SELECT COUNT(DISTINCT user_id) as active_count
      FROM visit_logs
      WHERE log_type = 'entry'
      AND user_id NOT IN (
        SELECT user_id FROM visit_logs 
        WHERE log_type = 'exit' 
        AND timestamp > (
          SELECT MAX(timestamp) FROM visit_logs 
          WHERE log_type = 'entry' AND user_id = visit_logs.user_id
        )
      )
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
      ${section ? 'AND section = ?' : ''}
      ${room_id ? 'AND room_id = ?' : ''}
    `, [...(section ? [section] : []), ...(room_id ? [room_id] : [])]);

    const [peakDay] = await promisePool.query(`
      SELECT 
        DAYNAME(timestamp) as day,
        COUNT(*) as visits
      FROM visit_logs
      WHERE ${whereClause}
      GROUP BY DAYNAME(timestamp)
      ORDER BY visits DESC
      LIMIT 1
    `, params);

    const [peakHour] = await promisePool.query(`
      SELECT 
        HOUR(timestamp) as hour,
        COUNT(*) as count
      FROM visit_logs
      WHERE ${whereClause}
      GROUP BY HOUR(timestamp)
      ORDER BY count DESC
      LIMIT 1
    `, params);

    const [dailyBreakdown] = await promisePool.query(`
      SELECT 
        DATE(timestamp) as day,
        COUNT(*) as visits,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT CASE WHEN log_type = 'entry' THEN user_id END) as entries
      FROM visit_logs
      WHERE ${whereClause}
      GROUP BY DATE(timestamp)
      ORDER BY day ASC
    `, params);

    const [hourlyDistribution] = await promisePool.query(`
      SELECT 
        HOUR(timestamp) as hour,
        COUNT(*) as count
      FROM visit_logs
      WHERE ${whereClause}
      GROUP BY HOUR(timestamp)
      ORDER BY hour ASC
    `, params);

    const [userTypeDistribution] = await promisePool.query(`
      SELECT 
        user_type,
        COUNT(*) as count
      FROM visit_logs
      WHERE ${whereClause}
      GROUP BY user_type
    `, params);

    const [purposeDistribution] = await promisePool.query(`
      SELECT 
        purpose,
        COUNT(*) as count
      FROM visit_logs
      WHERE ${whereClause}
      AND purpose IS NOT NULL
      GROUP BY purpose
      ORDER BY count DESC
    `, params);

    const [departmentDistribution] = await promisePool.query(`
      SELECT 
        u.department,
        COUNT(*) as count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.department IS NOT NULL
      GROUP BY u.department
      ORDER BY count DESC
    `, params);

    const [programDistribution] = await promisePool.query(`
      SELECT 
        u.course,
        COUNT(*) as count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.course IS NOT NULL
      GROUP BY u.course
      ORDER BY count DESC
      LIMIT 8
    `);

    const [yearLevelDistribution] = await promisePool.query(`
      SELECT 
        u.year_level,
        COUNT(*) as count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.year_level IS NOT NULL
      GROUP BY u.year_level
      ORDER BY count DESC
    `, params);

    const [engagementMetrics] = await promisePool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT CASE 
          WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
          THEN user_id 
        END) as active_users
      FROM visit_logs
      WHERE ${whereClause}
    `, params);

    const [visitFrequencyByDepartment] = await promisePool.query(`
      SELECT 
        u.department,
        COUNT(*) as visits
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.department IS NOT NULL
      GROUP BY u.department
      ORDER BY visits DESC
    `, params);

    const [avgDurationByDepartment] = await promisePool.query(`
      SELECT 
        u.department,
        AVG(CASE 
          WHEN log_type = 'exit' AND user_id IN (
            SELECT user_id FROM visit_logs WHERE log_type = 'entry'
          )
          THEN TIMESTAMPDIFF(MINUTE, 
            (SELECT MAX(timestamp) FROM visit_logs WHERE log_type = 'entry' AND user_id = vl.user_id),
            timestamp
          )
          ELSE NULL 
        END) as avg_duration
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.department IS NOT NULL
      GROUP BY u.department
      ORDER BY avg_duration DESC
    `, params);

    const [peakTimesByStudentType] = await promisePool.query(`
      SELECT 
        u.user_type,
        CASE 
          WHEN HOUR(timestamp) BETWEEN 6 AND 11 THEN 'morning'
          WHEN HOUR(timestamp) BETWEEN 12 AND 17 THEN 'afternoon'
          ELSE 'evening'
        END as time_slot,
        COUNT(*) as count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.user_type IS NOT NULL
      GROUP BY u.user_type, time_slot
      ORDER BY u.user_type, count DESC
    `, params);

    const [retentionRate] = await promisePool.query(`
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
          AND user_id IN (
            SELECT user_id FROM visit_logs 
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 60 DAY) 
            AND timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY user_id
          )
          THEN user_id 
        END) as retained_users,
        COUNT(DISTINCT user_id) as total_users
      FROM visit_logs
      WHERE ${whereClause}
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, params);

    const [visitorRatio] = await promisePool.query(`
      SELECT 
        COUNT(DISTINCT user_id) as total_count,
        COUNT(DISTINCT CASE 
          WHEN user_id NOT IN (
            SELECT DISTINCT user_id FROM visit_logs 
            WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY)
          )
          THEN user_id 
        END) as first_time_count
      FROM visit_logs
      WHERE ${whereClause}
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, params);

    const [userBehavior] = await promisePool.query(`
      SELECT 
        u.user_type,
        COUNT(*) as session_count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.user_type IS NOT NULL
      GROUP BY u.user_type
      ORDER BY session_count DESC
    `, params);

    const [peakUsageByDepartment] = await promisePool.query(`
      SELECT 
        u.department,
        HOUR(timestamp) as peak_hour,
        COUNT(*) as visits
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.department IS NOT NULL
      GROUP BY u.department, HOUR(timestamp)
      ORDER BY visits DESC
    `, params);

    const [topPurposesByUserType] = await promisePool.query(`
      SELECT 
        u.user_type,
        purpose,
        COUNT(*) as count
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.user_type IS NOT NULL
      AND purpose IS NOT NULL
      GROUP BY u.user_type, purpose
      ORDER BY u.user_type, count DESC
    `, params);

    const [incompleteLogs] = await promisePool.query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT user_id
        FROM visit_logs
        WHERE log_type = 'entry'
        AND user_id NOT IN (
          SELECT user_id FROM visit_logs 
          WHERE log_type = 'exit' 
          AND timestamp > (
            SELECT MAX(timestamp) FROM visit_logs WHERE log_type = 'entry' AND user_id = visit_logs.user_id
          )
        )
        AND timestamp >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
      ) t
    `);

    const [sectionDistribution] = await promisePool.query(`
      SELECT 
        section,
        COUNT(*) as count
      FROM visit_logs
      WHERE ${whereClause}
      AND section IS NOT NULL
      GROUP BY section
      ORDER BY count DESC
    `, params);

    const [roomDistribution] = await promisePool.query(`
      SELECT 
        r.room_name,
        r.section,
        COUNT(*) as visits
      FROM visit_logs vl
      JOIN rooms r ON vl.room_id = r.id
      WHERE ${whereClause}
      AND vl.room_id IS NOT NULL
      GROUP BY r.room_name, r.section
      ORDER BY visits DESC
    `, params);

    const [departmentGrowthTrends] = await promisePool.query(`
      SELECT 
        u.department,
        COUNT(*) as current_week_visits
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.department IS NOT NULL
      GROUP BY u.department
    `, params);

    const [previousDepartmentVisits] = await promisePool.query(`
      SELECT 
        u.department,
        COUNT(*) as previous_week_visits
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        AND timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.department IS NOT NULL
      GROUP BY u.department
    `, params);

    const departmentGrowthMap = {};
    departmentGrowthTrends.forEach(row => {
      departmentGrowthMap[row.department] = {
        currentWeek: row.current_week_visits || 0,
        previousWeek: 0,
        growthPercent: 0,
        trend: 'neutral'
      };
    });
    previousDepartmentVisits.forEach(row => {
      const current = departmentGrowthMap[row.department]?.currentWeek || 0;
      const previous = row.previous_week_visits || 0;
      const growthPercent = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0);
      departmentGrowthMap[row.department] = {
        currentWeek: current,
        previousWeek: previous,
        growthPercent,
        trend: growthPercent > 0 ? 'up' : growthPercent < 0 ? 'down' : 'neutral'
      };
    });

    const [visitsByDepartmentWithHourly] = await promisePool.query(`
      SELECT 
        u.department,
        HOUR(vl.timestamp) as hour,
        COUNT(*) as visits
      FROM visit_logs vl
      JOIN users u ON vl.user_id = u.id
      WHERE ${whereClause}
      AND u.department IS NOT NULL
      GROUP BY u.department, HOUR(vl.timestamp)
      ORDER BY u.department, hour
    `, params);

    const visitsByDepartmentMap = {};
    visitsByDepartmentWithHourly.forEach(row => {
      if (!visitsByDepartmentMap[row.department]) {
        visitsByDepartmentMap[row.department] = {
          totalVisits: 0,
          hourlyDistribution: {}
        };
      }
      visitsByDepartmentMap[row.department].totalVisits += row.visits || 0;
      visitsByDepartmentMap[row.department].hourlyDistribution[row.hour] = row.visits || 0;
    });

    const avgDurationWithSessions = avgDurationByDepartment.map(row => ({
      ...row,
      avgDuration: Math.round(row.avg_duration || 0),
      sessionCount: Math.round((visitFrequencyByDepartment.find(v => v.department === row.department)?.visits || 0))
    }));

    const result = {
      totalVisits: totalStats[0]?.total_visits || 0,
      entries: totalStats[0]?.entries || 0,
      exits: totalStats[0]?.exits || 0,
      currentlyInside: activeUsers[0]?.active_count || 0,
      uniqueUsers: totalStats[0]?.unique_users || 0,
      averageDailyVisits: Math.round((totalStats[0]?.total_visits || 0) / (totalStats[0]?.active_days || 1)),
      peakDay: peakDay[0] || {},
      peakHour: peakHour[0] || {},
      dailyBreakdown: dailyBreakdown || [],
      hourlyDistribution: formatHourlyDistribution(hourlyDistribution),
      userTypeDistribution: formatDistribution(userTypeDistribution),
      purposeDistribution: formatDistribution(purposeDistribution),
      departmentDistribution: formatDistribution(departmentDistribution),
      programDistribution: formatDistribution(programDistribution),
      yearLevelDistribution: formatDistribution(yearLevelDistribution),
      sectionDistribution: formatDistribution(sectionDistribution),
      roomDistribution: formatDistribution(roomDistribution),
      engagementMetrics: {
        totalUsers: engagementMetrics[0]?.total_users || 0,
        activeUsers: engagementMetrics[0]?.active_users || 0,
        averageVisitDuration: Math.round(engagementMetrics[0]?.average_visit_duration || 0),
        repeatVisitRate: calculateRepeatVisitRate(engagementMetrics[0]),
        returnVisitRate: calculateReturnVisitRate(engagementMetrics[0])
      },
      visitFrequencyByDepartment: formatDistribution(visitFrequencyByDepartment),
      avgDurationByDepartment: formatDistribution(avgDurationByDepartment),
      departmentAnalytics: {
        avgDurationByDepartment: avgDurationWithSessions || [],
        departmentGrowthTrends: departmentGrowthMap || {},
        visitsByDepartment: visitsByDepartmentMap || {}
      },
      peakTimesByStudentType: formatPeakTimes(peakTimesByStudentType),
      retentionRate: calculateRetentionRate(retentionRate[0]),
      visitorRatio: calculateVisitorRatio(visitorRatio[0]),
      newStudents: visitorRatio[0]?.first_time_count || 0,
      returningStudents: (visitorRatio[0]?.total_count || 0) - (visitorRatio[0]?.first_time_count || 0),
      userBehavior: formatUserBehavior(userBehavior, peakUsageByDepartment, topPurposesByUserType),
      incompleteLogs: incompleteLogs[0]?.count || 0,
      maxCapacity: 150,
      target: 10000
    };

    saveAnalyticsSnapshot(period, section, room_id, result).catch(() => {});

    return result;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
};

const formatHourlyDistribution = (data) => {
  const result = {};
  data.forEach(item => {
    result[item.hour] = item.count;
  });
  return result;
};

const formatDistribution = (data) => {
  const result = {};
  data.forEach(item => {
    const key = Object.keys(item).find(k => k !== 'count' && k !== 'visits' && k !== 'avg_duration');
    if (key) {
      result[item[key]] = item.count || item.visits || item.avg_duration || 0;
    }
  });
  return result;
};

const formatPeakTimes = (data) => {
  const result = {};
  data.forEach(item => {
    const userType = item.user_type;
    const timeSlot = item.time_slot;
    if (!result[userType]) {
      result[userType] = { morning: 0, afternoon: 0, evening: 0 };
    }
    result[userType][timeSlot] = item.count;
  });
  return result;
};

const formatUserBehavior = (behavior, peakUsage, purposes) => {
  const avgDurationByUserType = {};
  behavior.forEach(item => {
    avgDurationByUserType[item.user_type] = {
      avgDuration: 0,
      sessionCount: item.session_count || 0
    };
  });

  const peakUsageByDepartment = {};
  peakUsage.forEach(item => {
    peakUsageByDepartment[item.department] = {
      peakHour: item.peak_hour,
      visits: item.visits
    };
  });

  const topPurposesByUserType = {};
  purposes.forEach(item => {
    if (!topPurposesByUserType[item.user_type]) {
      topPurposesByUserType[item.user_type] = [];
    }
    topPurposesByUserType[item.user_type].push(item.purpose);
  });

  return {
    avgDurationByUserType,
    peakUsageByDepartment,
    topPurposesByUserType,
    retentionRate: { rate: 0, retainedUsers: 0, previousUsers: 0 },
    visitorRatio: { firstTime: { count: 0, percentage: 0 }, returning: { count: 0, percentage: 0 } }
  };
};

const calculateRepeatVisitRate = (engagementData) => {
  if (!engagementData || !engagementData.total_users) return 0;
  const repeatUsers = engagementData.total_users - engagementData.active_users;
  return Math.round((repeatUsers / engagementData.total_users) * 100) || 0;
};

const calculateReturnVisitRate = (engagementData) => {
  if (!engagementData || !engagementData.total_users) return 0;
  return Math.round((engagementData.active_users / engagementData.total_users) * 100) || 0;
};

const calculateRetentionRate = (data) => {
  if (!data || !data.total_users) return { rate: 0, retainedUsers: 0, previousUsers: 0 };
  const rate = data.total_users > 0 ? Math.round((data.retained_users / data.total_users) * 100) : 0;
  return {
    rate: rate,
    retainedUsers: data.retained_users || 0,
    previousUsers: data.total_users || 0
  };
};

const calculateVisitorRatio = (data) => {
  if (!data) return { firstTime: { count: 0, percentage: 0 }, returning: { count: 0, percentage: 0 } };
  const total = data.total_count || 0;
  const firstTime = data.first_time_count || 0;
  const returning = total - firstTime;
  return {
    firstTime: {
      count: firstTime,
      percentage: total > 0 ? Math.round((firstTime / total) * 100) : 0
    },
    returning: {
      count: returning,
      percentage: total > 0 ? Math.round((returning / total) * 100) : 0
    }
  };
};

const getHistoricalAnalytics = async (comparisonType, referenceDate) => {
  try {
    let currentPeriodCondition = '';
    let previousPeriodCondition = '';
    let weekStart = null;
    let weekEnd = null;
    let prevWeekStart = null;
    let prevWeekEnd = null;
    let monthStart = null;
    let monthEnd = null;
    let prevMonthStart = null;
    let prevMonthEnd = null;
    let yearStart = null;
    let yearEnd = null;
    let prevYearStart = null;
    let prevYearEnd = null;
    const refDate = referenceDate ? new Date(referenceDate) : new Date();

    switch (comparisonType) {
      case 'week-over-week':
        weekStart = new Date(refDate);
        weekStart.setDate(refDate.getDate() - refDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(weekStart.getDate() - 7);
        prevWeekEnd = new Date(weekStart);
        
        currentPeriodCondition = `timestamp >= '${weekStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${weekEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        previousPeriodCondition = `timestamp >= '${prevWeekStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${prevWeekEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        break;
      case 'month-over-month':
        monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
        
        prevMonthStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
        prevMonthEnd = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
        
        currentPeriodCondition = `timestamp >= '${monthStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${monthEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        previousPeriodCondition = `timestamp >= '${prevMonthStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${prevMonthEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        break;
      case 'year-over-year':
        yearStart = new Date(refDate.getFullYear(), 0, 1);
        yearEnd = new Date(refDate.getFullYear() + 1, 0, 1);
        
        prevYearStart = new Date(refDate.getFullYear() - 1, 0, 1);
        prevYearEnd = new Date(refDate.getFullYear(), 0, 1);
        
        currentPeriodCondition = `timestamp >= '${yearStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${yearEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        previousPeriodCondition = `timestamp >= '${prevYearStart.toISOString().slice(0, 19).replace('T', ' ')}' AND timestamp < '${prevYearEnd.toISOString().slice(0, 19).replace('T', ' ')}'`;
        break;
      default:
        return getAnalyticsData('week');
    }

    const [currentPeriod] = await promisePool.query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT CASE WHEN log_type = 'entry' THEN user_id END) as entries
      FROM visit_logs
      WHERE ${currentPeriodCondition}
    `);

    const [previousPeriod] = await promisePool.query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT CASE WHEN log_type = 'entry' THEN user_id END) as entries
      FROM visit_logs
      WHERE ${previousPeriodCondition}
    `);

    const current = currentPeriod[0] || {};
    const previous = previousPeriod[0] || {};

    const changePercentage = previous.total_visits > 0 
      ? Math.round(((current.total_visits - previous.total_visits) / previous.total_visits) * 100)
      : 0;

    const getTrend = (curr, prev) => {
      if (!prev || prev === 0) return 'neutral';
      const pct = ((curr - prev) / prev) * 100;
      return pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
    };

    const getChangeData = (curr, prev) => {
      const change = (curr || 0) - (prev || 0);
      const percentage = prev > 0 ? Math.round((change / prev) * 100) : 0;
      const trend = getTrend(curr, prev);
      return { change, percentage, trend };
    };

    const currentPeriodLabel = comparisonType === 'week-over-week' ? 'This Week' : comparisonType === 'month-over-month' ? 'This Month' : 'This Year';
    const previousPeriodLabel = comparisonType === 'week-over-week' ? 'Last Week' : comparisonType === 'month-over-month' ? 'Last Month' : 'Last Year';

    return {
      current: {
        period: currentPeriodLabel,
        startDate: weekStart ? weekStart.toISOString().slice(0, 10) : (monthStart ? monthStart.toISOString().slice(0, 10) : yearStart.toISOString().slice(0, 10)),
        endDate: weekEnd ? weekEnd.toISOString().slice(0, 10) : (monthEnd ? monthEnd.toISOString().slice(0, 10) : yearEnd.toISOString().slice(0, 10)),
        metrics: {
          totalVisits: current.total_visits || 0,
          uniqueUsers: current.unique_users || 0,
          averageDailyVisits: Math.round((current.total_visits || 0) / (comparisonType === 'week-over-week' ? 7 : comparisonType === 'month-over-month' ? 30 : 365)),
          repeatVisitRate: 0,
          averageVisitDuration: 0,
          peakDay: 'N/A',
          peakHour: 'N/A'
        }
      },
      previous: {
        period: previousPeriodLabel,
        startDate: prevWeekStart ? prevWeekStart.toISOString().slice(0, 10) : (prevMonthStart ? prevMonthStart.toISOString().slice(0, 10) : prevYearStart.toISOString().slice(0, 10)),
        endDate: prevWeekEnd ? prevWeekEnd.toISOString().slice(0, 10) : (prevMonthEnd ? prevMonthEnd.toISOString().slice(0, 10) : prevYearEnd.toISOString().slice(0, 10)),
        metrics: {
          totalVisits: previous.total_visits || 0,
          uniqueUsers: previous.unique_users || 0,
          averageDailyVisits: Math.round((previous.total_visits || 0) / (comparisonType === 'week-over-week' ? 7 : comparisonType === 'month-over-month' ? 30 : 365)),
          repeatVisitRate: 0,
          averageVisitDuration: 0,
          peakDay: 'N/A',
          peakHour: 'N/A'
        }
      },
      comparison: {
        totalVisits: getChangeData(current.total_visits, previous.total_visits),
        uniqueUsers: getChangeData(current.unique_users, previous.unique_users),
        averageDailyVisits: getChangeData(
          Math.round((current.total_visits || 0) / (comparisonType === 'week-over-week' ? 7 : comparisonType === 'month-over-month' ? 30 : 365)),
          Math.round((previous.total_visits || 0) / (comparisonType === 'week-over-week' ? 7 : comparisonType === 'month-over-month' ? 30 : 365))
        ),
        repeatVisitRate: { change: 0, percentage: 0, trend: 'neutral' },
        averageVisitDuration: { change: 0, percentage: 0, trend: 'neutral' }
      }
    };
  } catch (error) {
    console.error('Error fetching historical analytics:', error);
    throw error;
  }
};

const getTrendAnalytics = async (period, count, referenceDate) => {
  try {
    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const trends = [];

    for (let i = count - 1; i >= 0; i--) {
      let startDate, endDate, label;

      if (period === 'week') {
        startDate = new Date(refDate);
        startDate.setDate(refDate.getDate() - (i * 7) - refDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        label = `Week ${count - i}`;
      } else if (period === 'month') {
        startDate = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
        endDate = new Date(refDate.getFullYear(), refDate.getMonth() - i + 1, 1);
        label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        startDate = new Date(refDate.getFullYear() - i, 0, 1);
        endDate = new Date(refDate.getFullYear() - i + 1, 0, 1);
        label = startDate.getFullYear().toString();
      }

      const startStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

      const [periodData] = await promisePool.query(`
        SELECT 
          COUNT(*) as total_visits,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(CASE WHEN log_type = 'entry' THEN 1 ELSE 0 END) as entries,
          SUM(CASE WHEN log_type = 'exit' THEN 1 ELSE 0 END) as exits
        FROM visit_logs
        WHERE timestamp >= '${startStr}' AND timestamp < '${endStr}'
      `);

      const row = periodData[0] || { total_visits: 0, unique_users: 0, entries: 0, exits: 0 };
      trends.push({
        period: label,
        metrics: {
          totalVisits: row.total_visits || 0,
          uniqueUsers: row.unique_users || 0,
          entries: row.entries || 0,
          exits: row.exits || 0
        },
        startDate: startStr,
        endDate: endStr
      });
    }

    return {
      period,
      count,
      trends,
      referenceDate: refDate.toISOString()
    };
  } catch (error) {
    console.error('Error fetching trend analytics:', error);
    throw error;
  }
};

const getCapacityAnalytics = async (period = 'month') => {
  try {
    const analytics = await getAnalyticsData(period);
    
    const maxCapacity = 150;
    const currentOccupancy = analytics.currentlyInside || 0;
    const capacityPercentage = maxCapacity > 0 ? (currentOccupancy / maxCapacity) * 100 : 0;

    return {
      ...analytics,
      maxCapacity,
      currentOccupancy,
      capacityPercentage,
      capacityStatus: capacityPercentage >= 90 ? 'critical' : capacityPercentage >= 80 ? 'warning' : 'normal'
    };
  } catch (error) {
    console.error('Error fetching capacity analytics:', error);
    throw error;
  }
};

const getEngagementAnalytics = async (minVisits, daysBack) => {
  try {
    const analytics = await getAnalyticsData('month');
    
    const [engagedUsers] = await promisePool.query(`
      SELECT 
        user_id,
        COUNT(*) as visit_count
      FROM visit_logs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY user_id
      HAVING COUNT(*) >= ?
      ORDER BY visit_count DESC
    `, [daysBack, minVisits]);

    return {
      ...analytics,
      engagedUsers: engagedUsers || [],
      minVisits,
      daysBack
    };
  } catch (error) {
    console.error('Error fetching engagement analytics:', error);
    throw error;
  }
};

const getPredictiveAnalytics = async (daysToPredict = 7) => {
  try {
    const [historical] = await promisePool.query(`
      SELECT 
        DATE(timestamp) as day,
        COUNT(*) as visits,
        COUNT(DISTINCT user_id) as unique_users
      FROM visit_logs
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY day ASC
    `);

    if (historical.length === 0) {
      return {
        predictions: [],
        trend: 'neutral',
        confidence: 0,
        message: 'Insufficient data for prediction'
      };
    }

    const visitValues = historical.map(h => h.visits);
    const avgVisits = visitValues.reduce((a, b) => a + b, 0) / visitValues.length;
    const recentAvg = visitValues.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, visitValues.length);
    const trend = recentAvg > avgVisits ? 'up' : recentAvg < avgVisits ? 'down' : 'neutral';
    const confidence = Math.min(visitValues.length / 30, 1) * 100;

    const predictions = [];
    const lastDate = new Date(historical[historical.length - 1].day);
    
    for (let i = 1; i <= daysToPredict; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(lastDate.getDate() + i);
      
      const dayOfWeek = futureDate.getDay();
      const seasonalFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0;
      const predictedVisits = Math.round(recentAvg * seasonalFactor);
      
      predictions.push({
        date: futureDate.toISOString().slice(0, 10),
        day: futureDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        predictedVisits,
        confidence: Math.max(0, Math.min(100, confidence - (i * 5))),
        isPrediction: true
      });
    }

    return {
      predictions,
      trend,
      confidence: Math.round(confidence),
      historicalSummary: {
        totalDays: historical.length,
        averageVisits: Math.round(avgVisits),
        recentAverage: Math.round(recentAvg),
        peakDay: historical.reduce((max, day) => day.visits > max.visits ? day : max, historical[0])
      }
    };
  } catch (error) {
    console.error('Error generating predictive analytics:', error);
    throw error;
  }
};

module.exports = {
  getAnalyticsData,
  getHistoricalAnalytics,
  getTrendAnalytics,
  getCapacityAnalytics,
  getEngagementAnalytics,
  getPredictiveAnalytics
};
// spell-checker:enable