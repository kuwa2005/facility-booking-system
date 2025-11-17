import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import RoomRepository from '../models/RoomRepository';
import EquipmentRepository from '../models/EquipmentRepository';
import { Room, Equipment, ClosedDate } from '../models/types';

export interface CreateRoomDto {
  name: string;
  capacity: number | null;
  base_price_morning: number;
  base_price_afternoon: number;
  base_price_evening: number;
  extension_price_midday: number;
  extension_price_evening: number;
  ac_price_per_hour: number;
  description: string | null;
  is_active: boolean;
}

export interface CreateEquipmentDto {
  category: 'stage' | 'lighting' | 'sound' | 'other';
  name: string;
  price_type: 'per_slot' | 'flat' | 'free';
  unit_price: number;
  max_quantity: number;
  enabled: boolean;
  remark: string | null;
}

export interface CreateClosedDateDto {
  date: Date;
  reason: string;
}

/**
 * 職員用施設・設備管理サービス
 */
export class StaffFacilityManagementService {
  // ===== 部屋管理 =====

  /**
   * 部屋一覧を取得
   */
  async getRooms(includeInactive: boolean = false): Promise<Room[]> {
    if (includeInactive) {
      return RoomRepository.findAll();
    }
    return RoomRepository.findActive();
  }

  /**
   * 部屋を作成
   */
  async createRoom(staffId: number, data: CreateRoomDto): Promise<Room> {
    const room = await RoomRepository.create(data);

    await this.logActivity(
      staffId,
      'create',
      'room',
      room.id,
      `Room created: ${room.name}`
    );

    return room;
  }

  /**
   * 部屋を更新
   */
  async updateRoom(
    roomId: number,
    staffId: number,
    updates: Partial<Room>
  ): Promise<void> {
    const room = await RoomRepository.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    await RoomRepository.update(roomId, updates);

    await this.logActivity(
      staffId,
      'update',
      'room',
      roomId,
      `Room updated: ${JSON.stringify(updates)}`
    );
  }

  /**
   * 部屋を削除（論理削除）
   */
  async deleteRoom(roomId: number, staffId: number): Promise<void> {
    const room = await RoomRepository.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // 予約がある場合は削除不可
    const [usages] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM usages u
       JOIN applications a ON u.application_id = a.id
       WHERE u.room_id = ?
         AND u.date >= CURDATE()
         AND a.cancel_status = 'none'`,
      [roomId]
    );

    if (usages[0].count > 0) {
      throw new Error('Cannot delete room with upcoming reservations');
    }

    // is_active を false に設定
    await RoomRepository.update(roomId, { is_active: false });

    await this.logActivity(
      staffId,
      'delete',
      'room',
      roomId,
      `Room deactivated: ${room.name}`
    );
  }

  /**
   * 部屋の利用統計を取得
   */
  async getRoomUsageStats(roomId: number, startDate?: Date, endDate?: Date): Promise<any> {
    let query = `
      SELECT
        COUNT(u.id) as usage_count,
        SUM(CASE WHEN u.use_morning THEN 1 ELSE 0 END) as morning_count,
        SUM(CASE WHEN u.use_afternoon THEN 1 ELSE 0 END) as afternoon_count,
        SUM(CASE WHEN u.use_evening THEN 1 ELSE 0 END) as evening_count,
        SUM(CASE WHEN u.ac_requested THEN u.ac_hours ELSE 0 END) as total_ac_hours,
        COUNT(DISTINCT u.application_id) as reservation_count
      FROM usages u
      JOIN applications a ON u.application_id = a.id
      WHERE u.room_id = ?
        AND a.cancel_status = 'none'
    `;

    const params: any[] = [roomId];

    if (startDate) {
      query += ' AND u.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND u.date <= ?';
      params.push(endDate);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows[0] || {
      usage_count: 0,
      morning_count: 0,
      afternoon_count: 0,
      evening_count: 0,
      total_ac_hours: 0,
      reservation_count: 0,
    };
  }

  // ===== 設備管理 =====

  /**
   * 設備一覧を取得
   */
  async getEquipment(includeDisabled: boolean = false): Promise<Equipment[]> {
    if (includeDisabled) {
      return EquipmentRepository.findAll();
    }
    return EquipmentRepository.findEnabled();
  }

  /**
   * 設備を作成
   */
  async createEquipment(staffId: number, data: CreateEquipmentDto): Promise<Equipment> {
    const equipment = await EquipmentRepository.create(data);

    await this.logActivity(
      staffId,
      'create',
      'equipment',
      equipment.id,
      `Equipment created: ${equipment.name}`
    );

    return equipment;
  }

  /**
   * 設備を更新
   */
  async updateEquipment(
    equipmentId: number,
    staffId: number,
    updates: Partial<Equipment>
  ): Promise<void> {
    const equipment = await EquipmentRepository.findById(equipmentId);
    if (!equipment) {
      throw new Error('Equipment not found');
    }

    await EquipmentRepository.update(equipmentId, updates);

    await this.logActivity(
      staffId,
      'update',
      'equipment',
      equipmentId,
      `Equipment updated: ${JSON.stringify(updates)}`
    );
  }

  /**
   * 設備を削除（論理削除）
   */
  async deleteEquipment(equipmentId: number, staffId: number): Promise<void> {
    const equipment = await EquipmentRepository.findById(equipmentId);
    if (!equipment) {
      throw new Error('Equipment not found');
    }

    // enabled を false に設定
    await EquipmentRepository.update(equipmentId, { enabled: false });

    await this.logActivity(
      staffId,
      'delete',
      'equipment',
      equipmentId,
      `Equipment disabled: ${equipment.name}`
    );
  }

  /**
   * 設備の利用統計を取得
   */
  async getEquipmentUsageStats(equipmentId: number, startDate?: Date, endDate?: Date): Promise<any> {
    let query = `
      SELECT
        COUNT(ue.id) as usage_count,
        SUM(ue.quantity) as total_quantity,
        COUNT(DISTINCT ue.usage_id) as unique_usages
      FROM usage_equipment ue
      JOIN usages u ON ue.usage_id = u.id
      JOIN applications a ON u.application_id = a.id
      WHERE ue.equipment_id = ?
        AND a.cancel_status = 'none'
    `;

    const params: any[] = [equipmentId];

    if (startDate) {
      query += ' AND u.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND u.date <= ?';
      params.push(endDate);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows[0] || {
      usage_count: 0,
      total_quantity: 0,
      unique_usages: 0,
    };
  }

  // ===== 休館日管理 =====

  /**
   * 休館日一覧を取得
   */
  async getClosedDates(startDate?: Date, endDate?: Date): Promise<ClosedDate[]> {
    let query = 'SELECT * FROM closed_dates WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return rows as ClosedDate[];
  }

  /**
   * 休館日を追加
   */
  async addClosedDate(staffId: number, data: CreateClosedDateDto): Promise<void> {
    // 既存の予約がある場合は警告
    const [usages] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM usages u
       JOIN applications a ON u.application_id = a.id
       WHERE u.date = ?
         AND a.cancel_status = 'none'`,
      [data.date]
    );

    if (usages[0].count > 0) {
      throw new Error(`There are ${usages[0].count} existing reservations on this date`);
    }

    // 休館日を追加
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO closed_dates (date, reason) VALUES (?, ?)',
      [data.date, data.reason]
    );

    await this.logActivity(
      staffId,
      'create',
      'closed_date',
      result.insertId,
      `Closed date added: ${data.date} - ${data.reason}`
    );
  }

  /**
   * 休館日を削除
   */
  async deleteClosedDate(closedDateId: number, staffId: number): Promise<void> {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM closed_dates WHERE id = ?',
      [closedDateId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Closed date not found');
    }

    await this.logActivity(
      staffId,
      'delete',
      'closed_date',
      closedDateId,
      'Closed date removed'
    );
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

export default new StaffFacilityManagementService();
