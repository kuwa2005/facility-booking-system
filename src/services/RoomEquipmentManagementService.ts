import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { RoomEquipment } from '../models/types';

/**
 * 部屋と設備の相互管理サービス
 */
export class RoomEquipmentManagementService {
  /**
   * 部屋で利用可能な設備一覧を取得
   */
  async getRoomEquipment(roomId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         re.*,
         e.name as equipment_name,
         e.category,
         e.price_type,
         e.unit_price,
         e.max_quantity
       FROM room_equipment re
       JOIN equipment e ON re.equipment_id = e.id
       WHERE re.room_id = ?
       ORDER BY e.category, e.name`,
      [roomId]
    );

    return rows;
  }

  /**
   * 設備が利用可能な部屋一覧を取得
   */
  async getEquipmentRooms(equipmentId: number): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         re.*,
         r.name as room_name,
         r.capacity,
         r.is_active as room_is_active
       FROM room_equipment re
       JOIN rooms r ON re.room_id = r.id
       WHERE re.equipment_id = ?
       ORDER BY r.name`,
      [equipmentId]
    );

    return rows;
  }

  /**
   * 部屋に設備を関連付け
   */
  async linkRoomEquipment(
    roomId: number,
    equipmentId: number,
    staffId: number,
    isAvailable: boolean = true,
    notes?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO room_equipment (room_id, equipment_id, is_available, notes)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_available = ?, notes = ?`,
      [roomId, equipmentId, isAvailable, notes || null, isAvailable, notes || null]
    );

    await this.logActivity(
      staffId,
      'update',
      'room_equipment',
      roomId,
      `Room ${roomId} linked to equipment ${equipmentId}`
    );
  }

  /**
   * 部屋と設備の関連を解除
   */
  async unlinkRoomEquipment(roomId: number, equipmentId: number, staffId: number): Promise<void> {
    await pool.query(
      'DELETE FROM room_equipment WHERE room_id = ? AND equipment_id = ?',
      [roomId, equipmentId]
    );

    await this.logActivity(
      staffId,
      'delete',
      'room_equipment',
      roomId,
      `Room ${roomId} unlinked from equipment ${equipmentId}`
    );
  }

  /**
   * 部屋の全設備を一括設定
   */
  async setRoomEquipmentBulk(
    roomId: number,
    equipmentIds: number[],
    staffId: number
  ): Promise<void> {
    // 既存の関連を削除
    await pool.query('DELETE FROM room_equipment WHERE room_id = ?', [roomId]);

    // 新しい関連を挿入
    if (equipmentIds.length > 0) {
      const values = equipmentIds.map(equipmentId => [roomId, equipmentId, true, null]);

      await pool.query(
        `INSERT INTO room_equipment (room_id, equipment_id, is_available, notes)
         VALUES ?`,
        [values]
      );
    }

    await this.logActivity(
      staffId,
      'update',
      'room_equipment',
      roomId,
      `Room ${roomId} equipment bulk updated: ${equipmentIds.length} items`
    );
  }

  /**
   * 設備の全部屋を一括設定
   */
  async setEquipmentRoomsBulk(
    equipmentId: number,
    roomIds: number[],
    staffId: number
  ): Promise<void> {
    // 既存の関連を削除
    await pool.query('DELETE FROM room_equipment WHERE equipment_id = ?', [equipmentId]);

    // 新しい関連を挿入
    if (roomIds.length > 0) {
      const values = roomIds.map(roomId => [roomId, equipmentId, true, null]);

      await pool.query(
        `INSERT INTO room_equipment (room_id, equipment_id, is_available, notes)
         VALUES ?`,
        [values]
      );
    }

    await this.logActivity(
      staffId,
      'update',
      'room_equipment',
      equipmentId,
      `Equipment ${equipmentId} room bulk updated: ${roomIds.length} items`
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

export default new RoomEquipmentManagementService();
