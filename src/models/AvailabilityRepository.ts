import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { DayAvailability } from './types';
import RoomRepository from './RoomRepository';

export class AvailabilityRepository {
  /**
   * Get closed dates for a specific month
   */
  async getClosedDates(year: number, month: number): Promise<string[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DATE_FORMAT(date, "%Y-%m-%d") as date FROM closed_dates WHERE date BETWEEN ? AND ?',
      [startDate, endDateStr]
    );

    return rows.map((row) => row.date);
  }

  /**
   * Get reservations for a room in a specific month
   */
  async getReservations(roomId: number, year: number, month: number): Promise<any[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        u.date,
        u.use_morning,
        u.use_afternoon,
        u.use_evening,
        a.cancel_status
      FROM usages u
      INNER JOIN applications a ON u.application_id = a.id
      WHERE u.room_id = ?
        AND u.date BETWEEN ? AND ?
        AND a.cancel_status = 'none'
      ORDER BY u.date ASC`,
      [roomId, startDate, endDateStr]
    );

    return rows;
  }

  /**
   * Get availability for a room for a specific month
   * 在庫管理対応：予約数をカウントして残数を計算
   */
  async getMonthAvailability(roomId: number, year: number, month: number): Promise<DayAvailability[]> {
    const closedDates = await this.getClosedDates(year, month);
    const reservations = await this.getReservations(roomId, year, month);

    // Get room's max reservation count
    const room = await RoomRepository.findById(roomId);
    const maxCount = room?.maxReservationCount || 1;

    // Create a map of reservation counts by date
    const reservationCountMap = new Map<string, { morning: number; afternoon: number; evening: number }>();
    reservations.forEach((res) => {
      const dateStr = new Date(res.date).toISOString().split('T')[0];
      if (!reservationCountMap.has(dateStr)) {
        reservationCountMap.set(dateStr, {
          morning: 0,
          afternoon: 0,
          evening: 0,
        });
      }
      const existing = reservationCountMap.get(dateStr)!;
      if (res.use_morning) existing.morning++;
      if (res.use_afternoon) existing.afternoon++;
      if (res.use_evening) existing.evening++;
    });

    // Generate calendar for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const availability: DayAvailability[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isClosed = closedDates.includes(date);
      const reservationCounts = reservationCountMap.get(date) || { morning: 0, afternoon: 0, evening: 0 };

      availability.push({
        date,
        is_closed: isClosed,
        morning_available: !isClosed && reservationCounts.morning < maxCount,
        afternoon_available: !isClosed && reservationCounts.afternoon < maxCount,
        evening_available: !isClosed && reservationCounts.evening < maxCount,
        // 在庫情報を追加
        morning_count: reservationCounts.morning,
        afternoon_count: reservationCounts.afternoon,
        evening_count: reservationCounts.evening,
        max_count: maxCount,
      });
    }

    return availability;
  }

  /**
   * Check if a specific slot is available
   */
  async checkSlotAvailability(
    roomId: number,
    date: string,
    slot: 'morning' | 'afternoon' | 'evening'
  ): Promise<boolean> {
    // Check if date is closed
    const [closedRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM closed_dates WHERE date = ?',
      [date]
    );

    if (closedRows[0].count > 0) {
      return false;
    }

    // Get room's max reservation count
    const room = await RoomRepository.findById(roomId);
    const maxCount = room?.maxReservationCount || 1;

    // Check for existing reservations
    const slotColumn = `use_${slot}`;
    const [reservationRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM usages u
      INNER JOIN applications a ON u.application_id = a.id
      WHERE u.room_id = ?
        AND u.date = ?
        AND u.${slotColumn} = TRUE
        AND a.cancel_status = 'none'`,
      [roomId, date]
    );

    return reservationRows[0].count < maxCount;
  }
}

export default new AvailabilityRepository();
