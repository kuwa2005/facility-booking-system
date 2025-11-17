import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import ApplicationRepository from '../models/ApplicationRepository';
import { CreateApplicationDto } from '../models/types';
import { calculateTicketMultiplier } from '../utils/pricing';

export interface ProxyReservationDto extends CreateApplicationDto {
  proxy_type: 'for_member' | 'for_guest';
  notes?: string;
}

/**
 * 予約代行サービス（職員が利用者に代わって予約を作成）
 */
export class ProxyReservationService {
  /**
   * 会員のために予約を代行作成
   */
  async createForMember(
    staffId: number,
    userId: number,
    data: CreateApplicationDto,
    notes?: string
  ): Promise<any> {
    // チケット倍率を計算
    const ticketMultiplier = calculateTicketMultiplier(
      data.entrance_fee_type,
      data.entrance_fee_amount
    );

    // 予約を作成
    const application = await ApplicationRepository.create({
      ...data,
      user_id: userId,
      ticket_multiplier: ticketMultiplier,
    });

    // 代行記録を作成
    await pool.query(
      `INSERT INTO application_proxies (application_id, created_by_staff, user_id, proxy_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [application.id, staffId, userId, 'for_member', notes || null]
    );

    // アクティビティログ
    await this.logActivity(
      staffId,
      'create',
      'application',
      application.id,
      `Proxy reservation created for member ${userId}`
    );

    return application;
  }

  /**
   * ゲストのために予約を代行作成
   */
  async createForGuest(
    staffId: number,
    data: CreateApplicationDto,
    notes?: string
  ): Promise<any> {
    // チケット倍率を計算
    const ticketMultiplier = calculateTicketMultiplier(
      data.entrance_fee_type,
      data.entrance_fee_amount
    );

    // 予約を作成（user_id なし）
    const application = await ApplicationRepository.create({
      ...data,
      user_id: null,
      ticket_multiplier: ticketMultiplier,
    });

    // 代行記録を作成
    await pool.query(
      `INSERT INTO application_proxies (application_id, created_by_staff, user_id, proxy_type, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [application.id, staffId, null, 'for_guest', notes || null]
    );

    // アクティビティログ
    await this.logActivity(
      staffId,
      'create',
      'application',
      application.id,
      `Proxy reservation created for guest: ${data.applicant_representative}`
    );

    return application;
  }

  /**
   * 代行予約一覧を取得
   */
  async getProxyReservations(staffId?: number): Promise<any[]> {
    let query = `
      SELECT
        ap.*,
        a.event_name,
        a.applicant_representative,
        a.total_amount,
        a.payment_status,
        a.cancel_status,
        a.created_at as application_created_at,
        u_staff.name as staff_name,
        u_member.name as member_name,
        u_member.email as member_email
      FROM application_proxies ap
      JOIN applications a ON ap.application_id = a.id
      JOIN users u_staff ON ap.created_by_staff = u_staff.id
      LEFT JOIN users u_member ON ap.user_id = u_member.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (staffId) {
      query += ' AND ap.created_by_staff = ?';
      params.push(staffId);
    }

    query += ' ORDER BY ap.created_at DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows;
  }

  /**
   * 代行予約統計
   */
  async getProxyStats(staffId?: number): Promise<any> {
    let query = `
      SELECT
        COUNT(*) as total_proxy_reservations,
        SUM(CASE WHEN ap.proxy_type = 'for_member' THEN 1 ELSE 0 END) as member_reservations,
        SUM(CASE WHEN ap.proxy_type = 'for_guest' THEN 1 ELSE 0 END) as guest_reservations,
        SUM(CASE WHEN a.cancel_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_reservations
      FROM application_proxies ap
      JOIN applications a ON ap.application_id = a.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (staffId) {
      query += ' AND ap.created_by_staff = ?';
      params.push(staffId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0] || {
      total_proxy_reservations: 0,
      member_reservations: 0,
      guest_reservations: 0,
      cancelled_reservations: 0,
    };
  }

  /**
   * アクティビティログを記録
   */
  private async logActivity(
    staffId: number,
    actionType: string,
    targetType: string,
    targetId: number,
    description: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO staff_activity_logs (staff_id, action_type, target_type, target_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [staffId, actionType, targetType, targetId, description]
    );
  }
}

export default new ProxyReservationService();
