import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

export interface DashboardStats {
  todayReservations: number;
  upcomingReservations: number;
  pendingPayments: number;
  totalRevenue: number;
  monthlyRevenue: number;
  activeUsers: number;
  recentApplications: any[];
  todayUsages: any[];
}

/**
 * 職員ダッシュボードサービス
 */
export class StaffDashboardService {
  /**
   * ダッシュボード統計情報を取得
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const [todayReservations, upcomingReservations, pendingPayments, revenue, activeUsers, recentApplications, todayUsages] = await Promise.all([
      this.getTodayReservationsCount(),
      this.getUpcomingReservationsCount(),
      this.getPendingPaymentsCount(),
      this.getRevenue(),
      this.getActiveUsersCount(),
      this.getRecentApplications(),
      this.getTodayUsages(),
    ]);

    return {
      todayReservations,
      upcomingReservations,
      pendingPayments,
      totalRevenue: revenue.total,
      monthlyRevenue: revenue.monthly,
      activeUsers,
      recentApplications,
      todayUsages,
    };
  }

  /**
   * 本日の予約数
   */
  private async getTodayReservationsCount(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT u.application_id) as count
       FROM usages u
       WHERE u.date = CURDATE()
         AND EXISTS (
           SELECT 1 FROM applications a
           WHERE a.id = u.application_id
           AND a.cancel_status = 'none'
         )`
    );
    return rows[0]?.count || 0;
  }

  /**
   * 今後の予約数
   */
  private async getUpcomingReservationsCount(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT u.application_id) as count
       FROM usages u
       WHERE u.date > CURDATE()
         AND EXISTS (
           SELECT 1 FROM applications a
           WHERE a.id = u.application_id
           AND a.cancel_status = 'none'
         )`
    );
    return rows[0]?.count || 0;
  }

  /**
   * 未決済件数
   */
  private async getPendingPaymentsCount(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM applications
       WHERE payment_status = 'unpaid'
         AND cancel_status = 'none'`
    );
    return Number(rows[0]?.count || 0);
  }

  /**
   * 売上情報（総売上と今月の売上）
   */
  private async getRevenue(): Promise<{ total: number; monthly: number }> {
    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount - cancellation_fee), 0) as total
       FROM applications
       WHERE payment_status = 'paid'`
    );

    const [monthlyRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total_amount - cancellation_fee), 0) as monthly
       FROM applications
       WHERE payment_status = 'paid'
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())`
    );

    return {
      total: Number(totalRows[0]?.total || 0),
      monthly: Number(monthlyRows[0]?.monthly || 0),
    };
  }

  /**
   * アクティブユーザー数
   */
  private async getActiveUsersCount(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM users
       WHERE is_active = TRUE
         AND role = 'user'
         AND deleted_at IS NULL`
    );
    return Number(rows[0]?.count || 0);
  }

  /**
   * 最近の申請一覧（直近10件）
   */
  private async getRecentApplications(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         a.id,
         a.event_name,
         a.applicant_representative,
         a.applicant_email,
         a.total_amount,
         a.payment_status,
         a.cancel_status,
         a.created_at,
         MIN(u.date) as first_usage_date,
         a.user_id,
         usr.name as user_name
       FROM applications a
       LEFT JOIN usages u ON a.id = u.application_id
       LEFT JOIN users usr ON a.user_id = usr.id
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );

    return rows.map(row => ({
      id: row.id,
      eventName: row.event_name,
      applicantName: row.applicant_representative,
      applicantEmail: row.applicant_email,
      totalAmount: row.total_amount,
      paymentStatus: row.payment_status,
      cancelStatus: row.cancel_status,
      createdAt: row.created_at,
      firstUsageDate: row.first_usage_date,
      userId: row.user_id,
      userName: row.user_name,
    }));
  }

  /**
   * 本日の利用一覧
   */
  private async getTodayUsages(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         u.id,
         u.application_id,
         u.room_id,
         r.name as room_name,
         u.date,
         u.use_morning,
         u.use_afternoon,
         u.use_evening,
         u.use_midday_extension,
         u.use_evening_extension,
         u.ac_requested,
         u.ac_hours,
         a.event_name,
         a.applicant_representative,
         a.cancel_status
       FROM usages u
       JOIN rooms r ON u.room_id = r.id
       JOIN applications a ON u.application_id = a.id
       WHERE u.date = CURDATE()
         AND a.cancel_status = 'none'
       ORDER BY
         u.use_morning DESC,
         u.use_afternoon DESC,
         u.use_evening DESC`
    );

    return rows.map(row => ({
      id: row.id,
      applicationId: row.application_id,
      roomId: row.room_id,
      roomName: row.room_name,
      date: row.date,
      useMorning: row.use_morning,
      useAfternoon: row.use_afternoon,
      useEvening: row.use_evening,
      useMiddayExtension: row.use_midday_extension,
      useEveningExtension: row.use_evening_extension,
      acRequested: row.ac_requested,
      acHours: row.ac_hours,
      eventName: row.event_name,
      applicantName: row.applicant_representative,
      cancelStatus: row.cancel_status,
    }));
  }

  /**
   * 月別売上レポート（直近12ヶ月）
   */
  async getMonthlyRevenueReport(): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') as month,
         COUNT(*) as reservation_count,
         SUM(total_amount) as total_revenue,
         SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
         SUM(CASE WHEN cancel_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
       FROM applications
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`
    );

    return rows.map(row => ({
      month: row.month,
      reservationCount: row.reservation_count,
      totalRevenue: row.total_revenue,
      paidRevenue: row.paid_revenue,
      cancelledCount: row.cancelled_count,
    }));
  }

  /**
   * 部屋別利用統計
   */
  async getRoomUsageStats(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = `
      SELECT
        r.id,
        r.name as room_name,
        COUNT(u.id) as usage_count,
        SUM(CASE WHEN u.use_morning THEN 1 ELSE 0 END) as morning_count,
        SUM(CASE WHEN u.use_afternoon THEN 1 ELSE 0 END) as afternoon_count,
        SUM(CASE WHEN u.use_evening THEN 1 ELSE 0 END) as evening_count,
        SUM(CASE WHEN u.ac_requested THEN u.ac_hours ELSE 0 END) as total_ac_hours
      FROM rooms r
      LEFT JOIN usages u ON r.id = u.room_id
      LEFT JOIN applications a ON u.application_id = a.id
      WHERE r.is_active = TRUE
    `;

    const params: any[] = [];

    if (startDate) {
      query += ' AND u.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND u.date <= ?';
      params.push(endDate);
    }

    query += `
      AND (a.cancel_status = 'none' OR a.cancel_status IS NULL)
      GROUP BY r.id, r.name
      ORDER BY usage_count DESC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows.map(row => ({
      roomId: row.id,
      roomName: row.room_name,
      usageCount: row.usage_count || 0,
      morningCount: row.morning_count || 0,
      afternoonCount: row.afternoon_count || 0,
      eveningCount: row.evening_count || 0,
      totalAcHours: row.total_ac_hours || 0,
    }));
  }
}

export default new StaffDashboardService();
