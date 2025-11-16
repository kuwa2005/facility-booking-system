import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import pool from '../config/database';
import { Application, Usage, UsageEquipment, CreateApplicationDto } from './types';

export class ApplicationRepository {
  /**
   * Find application by ID with all related data
   */
  async findById(id: number): Promise<Application | null> {
    const [rows] = await pool.query<(Application & RowDataPacket)[]>(
      'SELECT * FROM applications WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find application with usages and equipment
   */
  async findByIdWithDetails(id: number): Promise<{
    application: Application;
    usages: (Usage & { equipment: UsageEquipment[] })[];
  } | null> {
    const application = await this.findById(id);
    if (!application) {
      return null;
    }

    const usages = await this.findUsagesByApplicationId(id);

    return { application, usages };
  }

  /**
   * Find usages for an application
   */
  async findUsagesByApplicationId(applicationId: number): Promise<(Usage & { equipment: UsageEquipment[] })[]> {
    const [usageRows] = await pool.query<(Usage & RowDataPacket)[]>(
      'SELECT * FROM usages WHERE application_id = ? ORDER BY date ASC',
      [applicationId]
    );

    // Load equipment for each usage
    const usages = await Promise.all(
      usageRows.map(async (usage) => {
        const [equipmentRows] = await pool.query<(UsageEquipment & RowDataPacket)[]>(
          'SELECT * FROM usage_equipment WHERE usage_id = ?',
          [usage.id]
        );
        return { ...usage, equipment: equipmentRows };
      })
    );

    return usages;
  }

  /**
   * Find all applications with filters
   */
  async findAll(filters?: {
    startDate?: string;
    endDate?: string;
    roomId?: number;
    paymentStatus?: string;
    cancelStatus?: string;
    searchTerm?: string;
  }): Promise<Application[]> {
    let query = 'SELECT * FROM applications WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      query += ' AND id IN (SELECT application_id FROM usages WHERE date >= ?)';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      query += ' AND id IN (SELECT application_id FROM usages WHERE date <= ?)';
      params.push(filters.endDate);
    }

    if (filters?.roomId) {
      query += ' AND id IN (SELECT application_id FROM usages WHERE room_id = ?)';
      params.push(filters.roomId);
    }

    if (filters?.paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(filters.paymentStatus);
    }

    if (filters?.cancelStatus) {
      query += ' AND cancel_status = ?';
      params.push(filters.cancelStatus);
    }

    if (filters?.searchTerm) {
      query += ' AND (event_name LIKE ? OR applicant_representative LIKE ? OR applicant_email LIKE ?)';
      const searchPattern = `%${filters.searchTerm}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query<(Application & RowDataPacket)[]>(query, params);
    return rows;
  }

  /**
   * Create application with usages in a transaction
   */
  async createWithUsages(
    applicationData: Omit<Application, 'id' | 'created_at' | 'updated_at'>,
    usagesData: Omit<Usage, 'id' | 'application_id' | 'created_at' | 'updated_at'>[],
    equipmentData: { usageIndex: number; equipment: Omit<UsageEquipment, 'id' | 'usage_id' | 'created_at' | 'updated_at'>[] }[]
  ): Promise<{ application: Application; usages: Usage[] }> {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create application
      const [appResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO applications (
          user_id, applicant_address, applicant_group_name, applicant_representative,
          applicant_phone, applicant_email, event_name, expected_attendees, event_description,
          program_attachment_path, entrance_fee_type, entrance_fee_amount, ticket_multiplier,
          use_digital_signboard, setup_datetime, meeting_date, hall_manager_name, hall_manager_phone,
          signboard_entrance, signboard_stage, open_time, start_time, end_time, remarks,
          total_amount, payment_status, cancel_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          applicationData.user_id,
          applicationData.applicant_address,
          applicationData.applicant_group_name,
          applicationData.applicant_representative,
          applicationData.applicant_phone,
          applicationData.applicant_email,
          applicationData.event_name,
          applicationData.expected_attendees,
          applicationData.event_description,
          applicationData.program_attachment_path,
          applicationData.entrance_fee_type,
          applicationData.entrance_fee_amount,
          applicationData.ticket_multiplier,
          applicationData.use_digital_signboard,
          applicationData.setup_datetime,
          applicationData.meeting_date,
          applicationData.hall_manager_name,
          applicationData.hall_manager_phone,
          applicationData.signboard_entrance,
          applicationData.signboard_stage,
          applicationData.open_time,
          applicationData.start_time,
          applicationData.end_time,
          applicationData.remarks,
          applicationData.total_amount,
          applicationData.payment_status,
          applicationData.cancel_status,
        ]
      );

      const applicationId = appResult.insertId;

      // Create usages
      const createdUsages: Usage[] = [];
      for (let i = 0; i < usagesData.length; i++) {
        const usage = usagesData[i];
        const [usageResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO usages (
            application_id, room_id, date, use_morning, use_afternoon, use_evening,
            use_midday_extension, use_evening_extension, ac_requested, ac_hours,
            room_base_charge_before_multiplier, room_charge_after_multiplier,
            equipment_charge, ac_charge, subtotal_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            applicationId,
            usage.room_id,
            usage.date,
            usage.use_morning,
            usage.use_afternoon,
            usage.use_evening,
            usage.use_midday_extension,
            usage.use_evening_extension,
            usage.ac_requested,
            usage.ac_hours,
            usage.room_base_charge_before_multiplier,
            usage.room_charge_after_multiplier,
            usage.equipment_charge,
            usage.ac_charge,
            usage.subtotal_amount,
          ]
        );

        const usageId = usageResult.insertId;

        // Create equipment for this usage
        const equipmentForUsage = equipmentData.find((e) => e.usageIndex === i);
        if (equipmentForUsage && equipmentForUsage.equipment.length > 0) {
          for (const equip of equipmentForUsage.equipment) {
            await connection.query(
              `INSERT INTO usage_equipment (
                usage_id, equipment_id, quantity, slot_count, line_amount
              ) VALUES (?, ?, ?, ?, ?)`,
              [usageId, equip.equipment_id, equip.quantity, equip.slot_count, equip.line_amount]
            );
          }
        }

        const [createdUsageRows] = await connection.query<(Usage & RowDataPacket)[]>(
          'SELECT * FROM usages WHERE id = ?',
          [usageId]
        );
        createdUsages.push(createdUsageRows[0]);
      }

      await connection.commit();

      const [appRows] = await connection.query<(Application & RowDataPacket)[]>(
        'SELECT * FROM applications WHERE id = ?',
        [applicationId]
      );

      return {
        application: appRows[0],
        usages: createdUsages,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update application
   */
  async update(id: number, data: Partial<Application>): Promise<Application> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      const application = await this.findById(id);
      if (!application) throw new Error('Application not found');
      return application;
    }

    values.push(id);
    await pool.query(`UPDATE applications SET ${fields.join(', ')} WHERE id = ?`, values);

    const application = await this.findById(id);
    if (!application) {
      throw new Error('Application not found');
    }
    return application;
  }

  /**
   * Cancel application
   */
  async cancel(id: number, cancellationFee: number): Promise<Application> {
    await pool.query(
      `UPDATE applications SET
        cancel_status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_fee = ?
      WHERE id = ?`,
      [cancellationFee, id]
    );

    const application = await this.findById(id);
    if (!application) {
      throw new Error('Application not found');
    }
    return application;
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    id: number,
    status: 'unpaid' | 'paid' | 'refunded',
    paymentProviderId?: string
  ): Promise<Application> {
    await pool.query(
      `UPDATE applications SET
        payment_status = ?,
        payment_provider_id = ?
      WHERE id = ?`,
      [status, paymentProviderId || null, id]
    );

    const application = await this.findById(id);
    if (!application) {
      throw new Error('Application not found');
    }
    return application;
  }

  /**
   * Check for conflicting reservations
   */
  async checkConflict(roomId: number, date: string, excludeApplicationId?: number): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as count FROM usages u
      INNER JOIN applications a ON u.application_id = a.id
      WHERE u.room_id = ? AND u.date = ? AND a.cancel_status = 'none'
    `;
    const params: any[] = [roomId, date];

    if (excludeApplicationId) {
      query += ' AND u.application_id != ?';
      params.push(excludeApplicationId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count > 0;
  }
}

export default new ApplicationRepository();
