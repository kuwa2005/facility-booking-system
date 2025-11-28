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
   * 月別売上レポート（当月の日別データ）
   */
  async getMonthlyRevenueReport(): Promise<any> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 当月の日別売上を取得
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE(a.created_at) as date,
         COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN a.total_amount - a.cancellation_fee ELSE 0 END), 0) as revenue
       FROM applications a
       WHERE YEAR(a.created_at) = ?
         AND MONTH(a.created_at) = ?
       GROUP BY DATE(a.created_at)
       ORDER BY date ASC`,
      [year, month]
    );

    // 月の総売上を計算
    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount - cancellation_fee ELSE 0 END), 0) as total
       FROM applications
       WHERE YEAR(created_at) = ?
         AND MONTH(created_at) = ?`,
      [year, month]
    );

    return {
      dailyRevenue: rows.map(row => ({
        date: row.date,
        revenue: Number(row.revenue || 0),
      })),
      totalRevenue: Number(totalRows[0]?.total || 0),
    };
  }

  /**
   * 日付範囲の売上レポート
   */
  async getRevenueByDateRange(startDate: Date, endDate: Date): Promise<any> {
    // 日別売上を取得
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         DATE(a.created_at) as date,
         COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN a.total_amount - a.cancellation_fee ELSE 0 END), 0) as revenue
       FROM applications a
       WHERE DATE(a.created_at) >= DATE(?)
         AND DATE(a.created_at) <= DATE(?)
       GROUP BY DATE(a.created_at)
       ORDER BY date ASC`,
      [startDate, endDate]
    );

    // 期間の総売上を計算
    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount - cancellation_fee ELSE 0 END), 0) as total
       FROM applications
       WHERE DATE(created_at) >= DATE(?)
         AND DATE(created_at) <= DATE(?)`,
      [startDate, endDate]
    );

    return {
      dailyRevenue: rows.map(row => ({
        date: row.date,
        revenue: Number(row.revenue || 0),
      })),
      totalRevenue: Number(totalRows[0]?.total || 0),
    };
  }

  /**
   * 部屋別利用統計
   */
  async getRoomUsageStats(startDate?: Date, endDate?: Date): Promise<any> {
    // デフォルトで当月のデータを取得
    if (!startDate && !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    let query = `
      SELECT
        r.id,
        r.name as room_name,
        COUNT(DISTINCT u.id) as usage_count,
        SUM(CASE WHEN u.use_morning THEN 1 ELSE 0 END) as morning_count,
        SUM(CASE WHEN u.use_afternoon THEN 1 ELSE 0 END) as afternoon_count,
        SUM(CASE WHEN u.use_evening THEN 1 ELSE 0 END) as evening_count,
        SUM(CASE WHEN u.ac_requested THEN u.ac_hours ELSE 0 END) as total_ac_hours,
        COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN a.total_amount - a.cancellation_fee ELSE 0 END) / COUNT(DISTINCT a.id), 0) as avg_revenue_per_booking
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

    // 期間内の日数を計算
    const start = startDate || new Date();
    const end = endDate || new Date();
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalPossibleSlots = daysDiff * 3; // 1日3枠（午前、午後、夜間）

    const rooms = rows.map(row => {
      const usedSlots = (row.morning_count || 0) + (row.afternoon_count || 0) + (row.evening_count || 0);
      const utilizationRate = totalPossibleSlots > 0 ? Math.round((usedSlots / totalPossibleSlots) * 100) : 0;
      const totalRevenue = Math.round((row.avg_revenue_per_booking || 0) * (row.usage_count || 0));

      return {
        roomId: row.id,
        roomName: row.room_name,
        name: row.room_name, // Frontend expects 'name' property
        usageCount: row.usage_count || 0,
        morningCount: row.morning_count || 0,
        afternoonCount: row.afternoon_count || 0,
        eveningCount: row.evening_count || 0,
        totalAcHours: row.total_ac_hours || 0,
        utilizationRate: utilizationRate,
        totalRevenue: totalRevenue,
      };
    });

    return { rooms };
  }
}

export default new StaffDashboardService();
